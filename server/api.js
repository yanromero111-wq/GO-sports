// Rotas REST: contas, perfil, partidas, loja e ranking.
import express from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  newProfile, normalizeProfile, applyMatch, sanitizeResult, mergeProfiles, claimDoubleCoins, levelFromXp,
} from '../client/shared/progression.js';
import { buyItem, itemById, isOwned } from '../client/shared/catalog.js';

const USER_RE = /^[A-Za-z0-9_]{3,16}$/;
const BANNED = ['admin', 'moderador', 'gosports', 'root'];

// Limite simples de tentativas por IP (protege contra força bruta no login).
const attempts = new Map();
function rateLimited(ip, max = 20, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const a = (attempts.get(ip) || []).filter((t) => now - t < windowMs);
  a.push(now);
  attempts.set(ip, a);
  return a.length > max;
}

// Progresso de convidado vem do aparelho e não é confiável: limitamos o que pode ser importado.
function capGuest(g) {
  if (!g || typeof g !== 'object') return null;
  const p = normalizeProfile(g);
  p.coins = Math.min(Math.max(0, p.coins | 0), 3000);
  p.xp = Math.min(Math.max(0, p.xp | 0), 30000);
  for (const r of Object.values(p.ratings)) r.lp = Math.min(Math.max(0, r.lp | 0), 1200);
  p.owned = p.owned.filter((id) => itemById(id)).slice(0, 20);
  return p;
}

const meta = (p) => ({
  level: levelFromXp(p.xp).level,
  xp: p.xp,
  lpTotal: Object.values(p.ratings).reduce((s, r) => s + (r.lp || 0), 0),
});

// Campos que o cliente pode alterar diretamente (o resto só muda pelas regras do servidor).
const CLIENT_FIELDS = ['avatar', 'settings', 'calibration', 'equipped', 'tutorialsSeen'];

export function apiRouter(db) {
  const r = express.Router();

  const auth = async (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Não autenticado' });
    const s = await db.getSession(token);
    if (!s) return res.status(401).json({ error: 'Sessão expirada' });
    const u = await db.getUserById(s.user_id);
    if (!u) return res.status(401).json({ error: 'Conta não encontrada' });
    req.user = u;
    req.token = token;
    req.profile = normalizeProfile(JSON.parse(u.profile));
    req.profile.username = u.username;
    next();
  };
  const save = (req) => db.saveProfile(req.user.id, req.profile, meta(req.profile));
  const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
    console.error('[api]', e);
    res.status(500).json({ error: 'Erro no servidor' });
  });

  r.post('/auth/check', wrap(async (req, res) => {
    const name = String(req.body.username || '');
    if (!USER_RE.test(name)) return res.json({ available: false, reason: 'Use 3 a 16 letras, números ou _' });
    if (BANNED.includes(name.toLowerCase())) return res.json({ available: false, reason: 'Nome reservado' });
    const u = await db.getUserByName(name);
    res.json({ available: !u, reason: u ? 'Nome já está em uso' : '' });
  }));

  r.post('/auth/register', wrap(async (req, res) => {
    if (rateLimited(req.ip, 10)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
    const username = String(req.body.username || '');
    const password = String(req.body.password || '');
    if (!USER_RE.test(username) || BANNED.includes(username.toLowerCase())) return res.status(400).json({ error: 'Nome de usuário inválido' });
    if (password.length < 6 || password.length > 72) return res.status(400).json({ error: 'A senha precisa ter de 6 a 72 caracteres' });
    if (await db.getUserByName(username)) return res.status(409).json({ error: 'Nome já está em uso' });
    // Começa com o progresso de convidado (se houver), mas sempre normalizado/saneado.
    let profile = newProfile(username);
    const guest = capGuest(req.body.guestProfile);
    if (guest) profile = mergeProfiles(profile, guest);
    profile.username = username;
    if (req.body.avatar) profile.avatar = { ...profile.avatar, ...req.body.avatar };
    const hash = await bcrypt.hash(password, 10);
    const id = await db.createUser(username, hash, profile);
    await db.saveProfile(id, profile, meta(profile));
    const token = crypto.randomBytes(32).toString('hex');
    await db.createSession(token, id);
    res.json({ token, profile });
  }));

  r.post('/auth/login', wrap(async (req, res) => {
    if (rateLimited(req.ip)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
    const u = await db.getUserByName(String(req.body.username || ''));
    const ok = u && (await bcrypt.compare(String(req.body.password || ''), u.pass_hash));
    if (!ok) return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    let profile = normalizeProfile(JSON.parse(u.profile));
    profile.username = u.username;
    const guest = capGuest(req.body.guestProfile);
    if (guest && req.body.mergeGuest) {
      profile = mergeProfiles(profile, guest);
      await db.saveProfile(u.id, profile, meta(profile));
    }
    const token = crypto.randomBytes(32).toString('hex');
    await db.createSession(token, u.id);
    res.json({ token, profile });
  }));

  r.post('/auth/logout', auth, wrap(async (req, res) => {
    await db.deleteSession(req.token);
    res.json({ ok: true });
  }));

  r.get('/profile', auth, wrap(async (req, res) => {
    await save(req); // grava missões do dia, se mudaram
    res.json({ profile: req.profile });
  }));

  r.put('/profile', auth, wrap(async (req, res) => {
    for (const k of CLIENT_FIELDS) if (req.body[k] !== undefined) req.profile[k] = req.body[k];
    // Acessório pago só pode ser usado se comprado.
    const acc = req.profile.avatar?.acc;
    const paid = ['crown', 'starglasses', 'bunny', 'halo'];
    if (paid.includes(acc)) {
      const item = { crown: 'acc_crown', starglasses: 'acc_star', bunny: 'acc_bunny', halo: 'acc_halo' }[acc];
      if (!isOwned(req.profile, itemById(item))) req.profile.avatar.acc = 'none';
    }
    await save(req);
    res.json({ profile: req.profile });
  }));

  r.post('/match', auth, wrap(async (req, res) => {
    const result = sanitizeResult(req.body);
    const summary = applyMatch(req.profile, result);
    await save(req);
    await db.addMatch(req.user.id, result);
    res.json({ summary, profile: req.profile });
  }));

  r.post('/reward/double', auth, wrap(async (req, res) => {
    const coins = claimDoubleCoins(req.profile);
    await save(req);
    res.json({ coins, profile: req.profile });
  }));

  r.post('/shop/buy', auth, wrap(async (req, res) => {
    const out = buyItem(req.profile, String(req.body.itemId || ''));
    if (!out.ok) return res.status(400).json({ error: out.reason });
    await save(req);
    res.json({ profile: req.profile });
  }));

  r.get('/leaderboard', wrap(async (req, res) => {
    const rows = await db.leaderboard(String(req.query.sport || 'all'), 50);
    res.json({ rows });
  }));

  return r;
}
