// Teste rápido do backend: sobe o servidor numa porta livre e verifica contas, partidas, ranking,
// pareamento TV <-> celular e matchmaking (com bot reserva). Uso: npm test
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const tmpDb = path.join(os.tmpdir(), `gosports-test-${Date.now()}.db`);
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✅' : '❌'} ${msg}`); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, p, body, token) {
  const r = await fetch(BASE + '/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
function ws() {
  return new Promise((resolve) => {
    const s = new WebSocket(`ws://localhost:${PORT}/ws`);
    s.inbox = [];
    s.on('message', (m) => s.inbox.push(JSON.parse(m)));
    s.on('open', () => resolve(s));
  });
}
async function waitMsg(s, pred, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const i = s.inbox.findIndex(pred);
    if (i >= 0) return s.inbox.splice(i, 1)[0];
    await sleep(20);
  }
  return null;
}

const server = spawn(process.execPath, ['server/index.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT), DEV_HTTPS: '0', SQLITE_FILE: tmpDb, MM_TIMEOUT_MS: '1200', DATABASE_URL: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (d) => { const s = String(d); if (!s.includes('ExperimentalWarning') && !s.includes('--trace-warnings')) process.stderr.write(s); });

try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {} await sleep(150); }
  ok((await api('GET', '/health')).status === 200, 'servidor responde /api/health');
  ok((await fetch(BASE + '/')).status === 200 && (await fetch(BASE + '/controller.html')).status === 200, 'serve a tela principal e o controle do celular');
  ok((await fetch(BASE + '/vendor/three/three.module.js')).status === 200, 'three.js disponível em /vendor');
  const qr = await fetch(BASE + '/api/qr?text=' + encodeURIComponent('https://exemplo/controller.html?room=ABCD'));
  ok(qr.ok && (await qr.text()).includes('<svg'), 'gera QR code em SVG');

  const user = 'teste_' + Math.floor(Math.random() * 1e6);
  ok((await api('POST', '/auth/check', { username: user })).data.available === true, 'nome de usuário disponível');
  const reg = await api('POST', '/auth/register', { username: user, password: 'segredo123', guestProfile: { coins: 999999, xp: 50 } });
  ok(reg.status === 200 && reg.data.token, 'cria conta');
  ok(reg.data.profile.coins <= 3000, 'progresso de convidado importado com limite (anti-trapaça)');
  ok((await api('POST', '/auth/register', { username: user.toUpperCase(), password: 'outra123' })).status === 409, 'nome único (sem diferenciar maiúsculas)');
  ok((await api('POST', '/auth/login', { username: user, password: 'errada' })).status === 401, 'senha errada é recusada');
  const login = await api('POST', '/auth/login', { username: user, password: 'segredo123' });
  ok(login.status === 200 && login.data.token, 'login com senha');
  const token = login.data.token;

  const put = await api('PUT', '/profile', { avatar: { hair: 3, acc: 'crown' }, calibration: { trigger: 210 } }, token);
  ok(put.data.profile.avatar.hair === 3 && put.data.profile.avatar.acc === 'none', 'salva avatar (acessório pago bloqueado sem compra)');
  ok(put.data.profile.calibration?.trigger === 210, 'salva calibração no servidor');

  const coins0 = put.data.profile.coins;
  const m = await api('POST', '/match', { sport: 'bowling', won: true, mode: 'bot', difficulty: 'hard', myScore: 120, oppScore: 90, durationSec: 200, events: { strike: 3 } }, token);
  ok(m.status === 200 && m.data.summary.xp > 0 && m.data.profile.coins > coins0, 'salva partida e calcula XP/moedas no servidor');
  ok(m.data.profile.ratings.bowling.lp === 22, 'pontos de liga (BOT difícil +22)');
  ok(m.data.profile.achievements.includes('first_win'), 'conquista "Primeira vitória"');
  const dbl = await api('POST', '/reward/double', {}, token);
  ok(dbl.data.coins > 0, 'vídeo premiado dobra moedas uma vez');
  ok((await api('POST', '/reward/double', {}, token)).data.coins === 0, 'não dobra duas vezes');
  const buy = await api('POST', '/shop/buy', { itemId: 'racket_neon' }, token);
  ok(buy.status === 200 && buy.data.profile.owned.includes('racket_neon'), 'compra item na loja');
  const lb = await api('GET', '/leaderboard?sport=bowling');
  ok(lb.data.rows.some((r) => r.username === user), 'aparece no ranking do esporte');

  // pareamento
  const tv = await ws();
  tv.send(JSON.stringify({ t: 'host' }));
  const hosted = await waitMsg(tv, (x) => x.t === 'hosted');
  ok(hosted && /^[A-Z0-9]{4}$/.test(hosted.room), 'TV recebe código de sala');
  const phone = await ws();
  phone.send(JSON.stringify({ t: 'join', room: hosted.room, cid: 'abc' }));
  ok((await waitMsg(phone, (x) => x.t === 'joined'))?.slot === 0, 'celular entra na sala como jogador 1');
  ok(!!(await waitMsg(tv, (x) => x.t === 'ctrl_join')), 'TV é avisada do celular');
  phone.send(JSON.stringify({ t: 'c', d: { k: 's', pw: 0.8 } }));
  ok((await waitMsg(tv, (x) => x.t === 'c'))?.d?.pw === 0.8, 'gesto do celular chega na TV');
  tv.send(JSON.stringify({ t: 'h', slot: 0, d: { k: 'vibrate' } }));
  ok((await waitMsg(phone, (x) => x.t === 'h'))?.d?.k === 'vibrate', 'TV envia comando ao celular');
  const bad = await ws();
  bad.send(JSON.stringify({ t: 'join', room: 'ZZZZ' }));
  ok((await waitMsg(bad, (x) => x.t === 'error'))?.code === 'no_room', 'sala inexistente dá erro claro');

  // matchmaking
  const a = await ws(), b = await ws();
  a.send(JSON.stringify({ t: 'mm_find', sport: 'tennis', lp: 100, name: 'A' }));
  b.send(JSON.stringify({ t: 'mm_find', sport: 'tennis', lp: 300, name: 'B' }));
  const fa = await waitMsg(a, (x) => x.t === 'mm_found');
  const fb = await waitMsg(b, (x) => x.t === 'mm_found');
  ok(fa && fb && fa.matchId === fb.matchId && fa.role !== fb.role, 'matchmaking pareia dois jogadores da mesma faixa de liga');
  a.send(JSON.stringify({ t: 'mm_msg', d: { k: 'hit', x: 1 } }));
  ok((await waitMsg(b, (x) => x.t === 'mm_msg'))?.d?.k === 'hit', 'mensagens da partida online chegam ao rival');
  const c = await ws();
  c.send(JSON.stringify({ t: 'mm_find', sport: 'golf', lp: 0, name: 'C' }));
  ok(!!(await waitMsg(c, (x) => x.t === 'mm_bot', 3000)), 'sem adversário: bot reserva');
  for (const s of [tv, phone, bad, a, b, c]) s.close();
} catch (e) {
  console.error(e);
  failures++;
} finally {
  server.kill();
  await sleep(300);
  for (const f of [tmpDb, tmpDb + '-wal', tmpDb + '-shm']) try { fs.unlinkSync(f); } catch {}
}
console.log(failures ? `\n${failures} teste(s) falharam` : '\nTodos os testes passaram 🎉');
process.exit(failures ? 1 : 0);
