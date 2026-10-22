// Regras de progressão compartilhadas entre o navegador (convidado) e o servidor (contas).
// Mantenha este arquivo sem dependências: ele roda no Node e no browser.

export const SPORTS = [
  { id: 'tennis', name: 'Tênis', icon: '🎾', color: '#4cc96f' },
  { id: 'volleyball', name: 'Vôlei', icon: '🏐', color: '#ffb703' },
  { id: 'bowling', name: 'Boliche', icon: '🎳', color: '#8e7dff' },
  { id: 'golf', name: 'Golfe', icon: '⛳', color: '#2bb673' },
  { id: 'baseball', name: 'Beisebol', icon: '⚾', color: '#ef476f' },
  { id: 'boxing', name: 'Boxe', icon: '🥊', color: '#ff5d5d' },
  { id: 'basketball', name: 'Basquete', icon: '🏀', color: '#ff8c42' },
  { id: 'pingpong', name: 'Tênis de Mesa', icon: '🏓', color: '#26b5d9' },
  { id: 'archery', name: 'Arco e Flecha', icon: '🏹', color: '#c77dff' },
];
export const SPORT_IDS = SPORTS.map((s) => s.id);
export const sportName = (id) => (SPORTS.find((s) => s.id === id) || { name: id }).name;

export const LEAGUES = [
  { id: 'bronze', name: 'Bronze', min: 0, color: '#cd7f32', icon: '🥉' },
  { id: 'prata', name: 'Prata', min: 300, color: '#b8c4cc', icon: '🥈' },
  { id: 'ouro', name: 'Ouro', min: 700, color: '#ffc93c', icon: '🥇' },
  { id: 'platina', name: 'Platina', min: 1200, color: '#6fe3d6', icon: '💠' },
  { id: 'diamante', name: 'Diamante', min: 1800, color: '#7ab8ff', icon: '💎' },
  { id: 'lenda', name: 'Lenda', min: 2600, color: '#ff6bd6', icon: '👑' },
];
export function leagueFor(lp = 0) {
  let l = LEAGUES[0];
  for (const x of LEAGUES) if (lp >= x.min) l = x;
  return l;
}

export const xpNeeded = (level) => 100 + (level - 1) * 60;
export function levelFromXp(xp = 0) {
  let level = 1;
  let rest = xp;
  while (rest >= xpNeeded(level) && level < 99) {
    rest -= xpNeeded(level);
    level++;
  }
  return { level, into: rest, need: xpNeeded(level) };
}

export const DIFFICULTIES = {
  easy: { name: 'Fácil', xp: 0.8, coins: 0.8, lpWin: 6, lpLoss: 4 },
  medium: { name: 'Médio', xp: 1, coins: 1, lpWin: 14, lpLoss: 8 },
  hard: { name: 'Difícil', xp: 1.3, coins: 1.3, lpWin: 22, lpLoss: 10 },
};

// Eventos especiais que os esportes podem relatar em result.events
export const EVENT_NAMES = {
  strike: 'Strikes', spare: 'Spares', ace: 'Aces', ko: 'Nocautes', homerun: 'Home runs',
  bullseye: 'Na mosca', holeinone: 'Hole in one', birdie: 'Birdies', swish: 'Cestas limpas',
  spike: 'Cortadas', rally10: 'Ralis longos', moneyball: 'Bolas de ouro',
};

export const ACHIEVEMENTS = [
  { id: 'first_win', icon: '🏆', name: 'Primeira vitória', desc: 'Vença sua primeira partida', check: (p) => p.stats.wins >= 1 },
  { id: 'ten_wins', icon: '🔥', name: 'Embalado', desc: 'Vença 10 partidas', check: (p) => p.stats.wins >= 10 },
  { id: 'fifty_matches', icon: '🎽', name: 'Maratonista', desc: 'Jogue 50 partidas', check: (p) => p.stats.matches >= 50 },
  { id: 'all_sports', icon: '🌈', name: 'Poliesportivo', desc: 'Jogue todos os esportes', check: (p) => SPORT_IDS.every((s) => (p.stats.perSport[s]?.played || 0) > 0) },
  { id: 'strike10', icon: '🎳', name: 'Rei do strike', desc: 'Faça 10 strikes', check: (p) => (p.stats.events.strike || 0) >= 10 },
  { id: 'ko', icon: '🥊', name: 'Nocaute!', desc: 'Vença uma luta por nocaute', check: (p) => (p.stats.events.ko || 0) >= 1 },
  { id: 'homerun', icon: '⚾', name: 'Lá se vai!', desc: 'Rebata um home run', check: (p) => (p.stats.events.homerun || 0) >= 1 },
  { id: 'bullseye5', icon: '🎯', name: 'Olho de águia', desc: 'Acerte 5 flechas na mosca', check: (p) => (p.stats.events.bullseye || 0) >= 5 },
  { id: 'holeinone', icon: '⛳', name: 'Hole in one', desc: 'Acerte o buraco com uma tacada', check: (p) => (p.stats.events.holeinone || 0) >= 1 },
  { id: 'ace', icon: '🎾', name: 'Saque perfeito', desc: 'Faça um ace', check: (p) => (p.stats.events.ace || 0) >= 1 },
  { id: 'swish20', icon: '🏀', name: 'Mão quente', desc: 'Faça 20 cestas', check: (p) => (p.stats.events.swish || 0) >= 20 },
  { id: 'hard_win', icon: '🤖', name: 'Vencedor de máquinas', desc: 'Vença um BOT difícil', check: (p) => (p.stats.hardWins || 0) >= 1 },
  { id: 'online_win', icon: '🌍', name: 'Campeão online', desc: 'Vença uma partida online', check: (p) => (p.stats.onlineWins || 0) >= 1 },
  { id: 'gold', icon: '🥇', name: 'Liga Ouro', desc: 'Chegue à liga Ouro em algum esporte', check: (p) => bestLp(p) >= 700 },
  { id: 'legend', icon: '👑', name: 'Lenda', desc: 'Chegue à liga Lenda', check: (p) => bestLp(p) >= 2600 },
  { id: 'level10', icon: '⭐', name: 'Nível 10', desc: 'Alcance o nível 10', check: (p) => levelFromXp(p.xp).level >= 10 },
  { id: 'collector', icon: '🛍️', name: 'Colecionador', desc: 'Compre 5 itens na loja', check: (p) => (p.stats.purchases || 0) >= 5 },
];

const bestLp = (p) => Math.max(0, ...Object.values(p.ratings || {}).map((r) => r.lp || 0));

const MISSION_POOL = [
  { id: 'play3', text: 'Jogue 3 partidas', goal: 3, key: 'match', coins: 60 },
  { id: 'win2', text: 'Vença 2 partidas', goal: 2, key: 'win', coins: 80 },
  { id: 'strike', text: 'Faça 3 strikes no Boliche', goal: 3, key: 'ev:strike', coins: 70 },
  { id: 'bulls', text: 'Acerte 2 flechas na mosca', goal: 2, key: 'ev:bullseye', coins: 70 },
  { id: 'swish', text: 'Faça 8 cestas no Basquete', goal: 8, key: 'ev:swish', coins: 70 },
  { id: 'spike', text: 'Faça 5 cortadas no Vôlei', goal: 5, key: 'ev:spike', coins: 70 },
  { id: 'hr', text: 'Rebata 1 home run', goal: 1, key: 'ev:homerun', coins: 90 },
  { id: 'birdie', text: 'Faça 1 birdie no Golfe', goal: 1, key: 'ev:birdie', coins: 90 },
  { id: 'rally', text: 'Faça 2 ralis longos (10+ toques)', goal: 2, key: 'ev:rally10', coins: 70 },
  ...SPORTS.map((s) => ({ id: 'win_' + s.id, text: `Vença uma partida de ${s.name}`, goal: 1, key: 'win:' + s.id, coins: 75 })),
  ...SPORTS.map((s) => ({ id: 'play_' + s.id, text: `Jogue ${s.name}`, goal: 1, key: 'play:' + s.id, coins: 40 })),
];

function seededRandom(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);

export function ensureDailyMissions(profile, dateKey = todayKey()) {
  if (profile.missions && profile.missions.date === dateKey) return profile.missions;
  const rnd = seededRandom(dateKey + ':' + (profile.username || 'guest'));
  const pool = [...MISSION_POOL];
  const list = [];
  while (list.length < 3 && pool.length) {
    const m = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    if (list.some((x) => x.key.split(':')[0] === m.key.split(':')[0] && m.key.includes(':'))) continue;
    list.push({ id: m.id, text: m.text, goal: m.goal, key: m.key, coins: m.coins, progress: 0, done: false });
  }
  profile.missions = { date: dateKey, list };
  return profile.missions;
}

export const DEFAULT_AVATAR = {
  body: 1, height: 1, skin: '#f2c29b', eyes: 0, mouth: 0, brows: 0, hair: 1, hairColor: '#4a2c1a',
  shirt: '#3a86ff', pants: '#2b2d42', shoes: '#ffffff', acc: 'none', cheeks: true,
};

export function newProfile(username = 'Convidado') {
  const ratings = {};
  for (const s of SPORT_IDS) ratings[s] = { lp: 0, w: 0, l: 0, best: 0 };
  const p = {
    v: 1,
    username,
    avatar: { ...DEFAULT_AVATAR },
    coins: 200,
    xp: 0,
    ratings,
    stats: { matches: 0, wins: 0, hardWins: 0, onlineWins: 0, purchases: 0, perSport: {}, events: {} },
    achievements: [],
    owned: [],
    equipped: {},
    settings: { music: 0.6, sfx: 0.8, controlMode: 'motion', showFps: false, sensitivity: 1, leftHanded: false },
    calibration: null,
    tutorialsSeen: [],
    lastMatch: null,
    entitlements: { noAds: false },
    updatedAt: Date.now(),
  };
  ensureDailyMissions(p);
  return p;
}

// Corrige perfis antigos/incompletos.
export function normalizeProfile(p) {
  const base = newProfile(p?.username || 'Convidado');
  if (!p || typeof p !== 'object') return base;
  const out = { ...base, ...p };
  out.avatar = { ...base.avatar, ...(p.avatar || {}) };
  out.ratings = { ...base.ratings, ...(p.ratings || {}) };
  out.stats = { ...base.stats, ...(p.stats || {}) };
  out.stats.perSport = { ...(p.stats?.perSport || {}) };
  out.stats.events = { ...(p.stats?.events || {}) };
  out.settings = { ...base.settings, ...(p.settings || {}) };
  out.entitlements = { ...base.entitlements, ...(p.entitlements || {}) };
  for (const k of ['achievements', 'owned', 'tutorialsSeen']) out[k] = Array.isArray(p[k]) ? p[k] : [];
  ensureDailyMissions(out);
  return out;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Calcula e aplica recompensas de uma partida. Retorna um resumo para a tela de resultado.
export function applyMatch(profile, rawResult) {
  const r = sanitizeResult(rawResult);
  const diff = DIFFICULTIES[r.difficulty] || DIFFICULTIES.medium;
  const modeXp = r.mode === 'online' ? 1.3 : r.mode === 'local' ? 0.8 : diff.xp;
  const lvBefore = levelFromXp(profile.xp).level;

  let xp = Math.round((35 + (r.won ? 45 : 10) + clamp(r.durationSec / 6, 0, 40)) * modeXp);
  let coins = Math.round((12 + (r.won ? 28 : 6)) * (r.mode === 'online' ? 1.3 : r.mode === 'local' ? 0.8 : diff.coins));
  let eventCoins = 0;
  for (const [k, n] of Object.entries(r.events)) eventCoins += n * (k === 'holeinone' || k === 'ko' ? 15 : 3);
  coins += Math.min(60, eventCoins);

  let lpDelta = 0;
  if (r.mode === 'online') lpDelta = r.won ? 28 : r.draw ? 0 : -16;
  else if (r.mode === 'bot') lpDelta = r.won ? diff.lpWin : r.draw ? 0 : -diff.lpLoss;

  const rating = profile.ratings[r.sport] || (profile.ratings[r.sport] = { lp: 0, w: 0, l: 0, best: 0 });
  const leagueBefore = leagueFor(rating.lp);
  rating.lp = Math.max(0, rating.lp + lpDelta);
  if (r.won) rating.w++;
  else if (!r.draw) rating.l++;
  rating.best = Math.max(rating.best || 0, r.myScore);
  const leagueAfter = leagueFor(rating.lp);

  const st = profile.stats;
  st.matches++;
  if (r.won) st.wins++;
  if (r.won && r.mode === 'bot' && r.difficulty === 'hard') st.hardWins = (st.hardWins || 0) + 1;
  if (r.won && r.mode === 'online') st.onlineWins = (st.onlineWins || 0) + 1;
  const ps = st.perSport[r.sport] || (st.perSport[r.sport] = { played: 0, wins: 0 });
  ps.played++;
  if (r.won) ps.wins++;
  for (const [k, n] of Object.entries(r.events)) st.events[k] = (st.events[k] || 0) + n;

  // Missões diárias
  ensureDailyMissions(profile);
  const counters = { match: 1, win: r.won ? 1 : 0, ['play:' + r.sport]: 1, ['win:' + r.sport]: r.won ? 1 : 0 };
  for (const [k, n] of Object.entries(r.events)) counters['ev:' + k] = n;
  const missionsDone = [];
  for (const m of profile.missions.list) {
    if (m.done) continue;
    m.progress = Math.min(m.goal, m.progress + (counters[m.key] || 0));
    if (m.progress >= m.goal) {
      m.done = true;
      coins += m.coins;
      xp += 40;
      missionsDone.push(m);
    }
  }

  profile.coins += coins;
  profile.xp += xp;

  // Conquistas
  const newAch = [];
  for (const a of ACHIEVEMENTS) {
    if (!profile.achievements.includes(a.id) && a.check(profile)) {
      profile.achievements.push(a.id);
      profile.coins += 50;
      newAch.push({ id: a.id, name: a.name, icon: a.icon });
    }
  }

  const lvAfter = levelFromXp(profile.xp).level;
  profile.lastMatch = { coins, claimedDouble: false, at: Date.now() };
  profile.updatedAt = Date.now();
  return {
    xp, coins, lpDelta, lp: rating.lp,
    levelBefore: lvBefore, levelAfter: lvAfter,
    leagueBefore: leagueBefore.id, leagueAfter: leagueAfter.id,
    achievements: newAch, missions: missionsDone,
  };
}

export function sanitizeResult(r = {}) {
  const events = {};
  for (const k of Object.keys(EVENT_NAMES)) {
    const n = Math.floor(Number(r.events?.[k]) || 0);
    if (n > 0) events[k] = Math.min(n, 30);
  }
  return {
    sport: SPORT_IDS.includes(r.sport) ? r.sport : 'tennis',
    won: !!r.won,
    draw: !!r.draw && !r.won,
    mode: ['bot', 'online', 'local'].includes(r.mode) ? r.mode : 'bot',
    difficulty: ['easy', 'medium', 'hard'].includes(r.difficulty) ? r.difficulty : 'medium',
    myScore: clamp(Math.floor(Number(r.myScore) || 0), 0, 100000),
    oppScore: clamp(Math.floor(Number(r.oppScore) || 0), 0, 100000),
    durationSec: clamp(Number(r.durationSec) || 0, 0, 3600),
    events,
  };
}

// Recompensa do vídeo premiado opcional: dobra as moedas da última partida (uma vez).
export function claimDoubleCoins(profile) {
  const lm = profile.lastMatch;
  if (!lm || lm.claimedDouble || Date.now() - lm.at > 30 * 60 * 1000) return 0;
  lm.claimedDouble = true;
  profile.coins += lm.coins;
  return lm.coins;
}

// Mescla o progresso de convidado com uma conta recém-criada/logada (fica com o melhor de cada).
export function mergeProfiles(server, guest) {
  const s = normalizeProfile(server);
  const g = normalizeProfile(guest);
  s.xp = Math.max(s.xp, g.xp);
  s.coins = Math.max(s.coins, g.coins);
  for (const id of SPORT_IDS) {
    const a = s.ratings[id], b = g.ratings[id];
    if (b && b.lp > a.lp) s.ratings[id] = { ...b };
  }
  s.owned = [...new Set([...s.owned, ...g.owned])];
  s.achievements = [...new Set([...s.achievements, ...g.achievements])];
  s.tutorialsSeen = [...new Set([...s.tutorialsSeen, ...g.tutorialsSeen])];
  if (g.stats.matches > s.stats.matches) s.stats = g.stats;
  return s;
}
