// Kit de teste automatizado (desenvolvimento): joga partidas inteiras simulando os gestos do jogador 1.
// Uso no console da tela principal:  const t = await import('/js/dev/autoplay.js'); await t.selfTest();
const app = window.app;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const swing = (o) => app.input.emit('swing', { slot: 0, power: 0.75, dx: 0, dy: 0, twist: 0, source: 'test', ...o });

export async function startGame(setup) {
  app.go('game', { setup });
  for (let i = 0; i < 80 && !(app.sport && app.sport.started); i++) {
    const b = [...document.querySelectorAll('#ui button')].find((x) => x.textContent.includes('Entendi'));
    if (b) b.click();
    await wait(100);
  }
  return app.sport;
}

// Roda a simulação quadro a quadro (não depende do requestAnimationFrame).
export async function run(setup, auto, maxSec = 300) {
  const g = await startGame(setup);
  const cd = { t: 0 };
  let f = 0;
  while (f < maxSec * 60 && !g.over) {
    cd.t -= 1 / 60;
    if (auto && cd.t <= 0) auto(g, cd);
    app.step(1, 1 / 60);
    f++;
    if (f % 900 === 0) await wait(0);
  }
  return { g, secs: Math.round(f / 60), over: g.over };
}

// ---------- jogadores automáticos por esporte ----------
export const AUTO = {
  tennis(g, cd) {
    const s = g.sides[0];
    if (g.state === 'serve' && g.server === 0) { cd.t = 0.6; return swing({ power: 0.8 }); }
    const w = g.inWindow(s);
    if (w && Math.abs(w.t) < 0.2) { cd.t = 0.4; swing({ power: 0.7, dx: Math.random() - 0.5 }); }
  },
  volleyball(g, cd) {
    const t = g.teams[0];
    if (g.state === 'serve' && g.server === 0) { cd.t = 0.8; return swing({ power: 0.75, dy: 0.8 }); }
    const w = g.window(t);
    if (w && w.q > 0.8) { cd.t = 0.4; swing({ power: 0.85, dx: Math.random() - 0.5, dy: w.kind === 'spike' ? 0.8 : -0.6 }); }
  },
};
AUTO.pingpong = AUTO.tennis;
AUTO.bowling = (g, cd) => {
  if (g.state === 'aim' && g.isLocalTurn()) { cd.t = 1; swing({ power: 0.8 + Math.random() * 0.3, dx: (Math.random() - 0.5) * 0.4, twist: (Math.random() - 0.5) * 0.4 }); }
};

// Golfe: força proporcional à distância (como um jogador atento).
AUTO.golf = (g, cd) => {
  if (g.state !== 'aim' || g.cur.pl.kind !== 'human') return;
  cd.t = 0.8;
  const d = Math.hypot(g.hole.cup.x - g.ballPos.x, g.hole.cup.z - g.ballPos.z);
  const max = [230, 170, 120, 75, 22][g.club];
  swing({ power: Math.min(1, (g.club === 4 ? d + 0.5 : d) / max) * (0.95 + Math.random() * 0.1), dx: (Math.random() - 0.5) * 0.2 });
};

AUTO.baseball = (g, cd) => {
  const bat = g.teams[g.battingTeam];
  const pit = g.teams[1 - g.battingTeam];
  if (pit.pl.kind === 'human' && g.state === 'ready') { cd.t = 1; g.aimP.x = (Math.random() - 0.5) * 0.5; return swing({ power: 0.9, twist: (Math.random() - 0.5) }); }
  if (bat.pl.kind === 'human' && g.state === 'pitch' && g.pb && !g.pb.swung && g.pb.p.z < 1.2 + Math.random() * 0.6) {
    const p = g.pitchParams;
    if (Math.abs(p.x) < 0.33 && p.y > 0.45 && p.y < 1.2) { cd.t = 1; swing({ power: 0.8 + Math.random() * 0.4, dy: Math.random() * 0.6 }); }
  }
};

AUTO.boxing = (g, cd) => {
  const me = g.f[0], bot = g.f[1];
  // defende quando a luva do bot brilha; senão soca
  const threat = g.ai.windup && g.ai.windup.t < 0.25;
  app.input.player(0).actions.guard = !!threat && Math.random() < 0.8;
  if (!threat && g.state === 'fight' && me.cooldown <= 0) { cd.t = 0.35 + Math.random() * 0.3; swing({ power: 0.8, dx: Math.random() < 0.3 ? (Math.random() - 0.5) * 2 : 0, dy: Math.random() < 0.2 ? 0.8 : 0 }); }
};

AUTO.basketball = (g, cd) => {
  if (g.state === 'ready' && g.cur.pl.kind === 'human') { cd.t = 0.8; swing({ power: 0.65 + (Math.random() - 0.5) * 0.25, dy: 0.9, dx: (Math.random() - 0.5) * 0.3 }); }
};
// Arco: mira compensando queda e vento, puxa e solta.
AUTO.archery = (g, cd) => {
  if (g.state !== 'aim' || g.cur.pl.kind !== 'human') return;
  if (!g.drawing) { g.drawInput(0, true); cd.t = 1.0; return; }
  const T = g.dist / 70;
  const from = g.launchPos();
  const tgt = new g.target.position.constructor(g.target.position.x - 0.5 * g.wind * T * T + (Math.random() - 0.5) * 0.15, 1.3 + 0.5 * 1.96 * T * T + (Math.random() - 0.5) * 0.15, g.dist);
  const d = tgt.sub(from).normalize();
  g.aim.offY = Math.atan2(d.x, d.z) - g.aim.yaw;
  g.aim.offP = Math.asin(d.y) - g.aim.pitch;
  g.drawInput(0, false);
  cd.t = 1;
};

export const SETUPS = {
  basketball: { sport: 'basketball', arena: 'arena_basketball_street', length: 3 },
  archery: { sport: 'archery', arena: 'arena_archery_field', length: 3 },
  boxing: { sport: 'boxing', arena: 'arena_boxing_gym', length: 1 },
  baseball: { sport: 'baseball', arena: 'arena_baseball_park', length: 1 },
  golf: { sport: 'golf', arena: 'arena_golf_valley', length: 3 },
  tennis: { sport: 'tennis', arena: 'arena_tennis_park', length: 1 },
  pingpong: { sport: 'pingpong', arena: 'arena_pingpong_club', length: 5 },
  volleyball: { sport: 'volleyball', arena: 'arena_volleyball_gym', length: 7 },
  bowling: { sport: 'bowling', arena: 'arena_bowling_classic', length: 3 },
};

export async function play(sport, difficulty = 'medium', extra = {}) {
  const setup = { mode: 'bot', difficulty, control: 'motion', ...SETUPS[sport], ...extra };
  const reasons = [];
  const r = await run(setup, (g, cd) => {
    if (!g._hooked && g.pointTo) {
      g._hooked = true;
      const o = g.pointTo.bind(g);
      g.pointTo = (w, why) => { if (g.state !== 'dead') reasons.push(`${w}:${why}`); o(w, why); };
    }
    AUTO[sport]?.(g, cd);
  }, extra.maxSec || 400);
  return { sport, over: r.over, secs: r.secs, events: { ...r.g.events }, reasons: reasons.join(' '), score: r.g.score || r.g.pts || r.g.totals };
}

export async function selfTest(list = Object.keys(SETUPS)) {
  const out = [];
  for (const s of list) {
    app.go('menu');
    await wait(200);
    try { out.push(await play(s)); } catch (e) { out.push({ sport: s, error: String(e.stack || e) }); }
  }
  app.go('menu');
  return out;
}

// Teste online: entra na fila e joga sozinho (use em duas abas ao mesmo tempo).
export async function online(sport, extra = {}) {
  const setup = { mode: 'online', difficulty: 'medium', control: 'motion', ...SETUPS[sport], ...extra };
  const st = (window.__online = { phase: 'queue', log: [] });
  const offNet = app.on('net', (m) => st.log.push(m.t + (m.d?.k ? ':' + m.d.k : '')));
  app.go('matchmaking', { setup });
  for (let i = 0; i < 100 && !(app.sport && app.sport.started); i++) {
    const b = [...document.querySelectorAll('#ui button')].find((x) => x.textContent.includes('Entendi'));
    if (b) b.click();
    await wait(200);
  }
  const g = app.sport;
  if (!g) { st.phase = 'no-game'; return st; }
  st.phase = 'playing';
  st.online = !!g.net;
  const cd = { t: 0 };
  st.timer = setInterval(() => {
    for (let i = 0; i < 60 && !g.over; i++) { cd.t -= 1 / 60; if (cd.t <= 0) AUTO[sport]?.(g, cd); app.step(1, 1 / 60); }
    if (g.over) { st.phase = 'over'; clearInterval(st.timer); offNet(); }
  }, 100);
  return st;
}

// Simulador do modo só câmera: gera poses sintéticas do MediaPipe (sem webcam) para testar cursor e gestos.
export async function cameraSim() {
  const { CameraTracker } = await import('../camera/tracker.js');
  const tr = new CameraTracker(app);
  tr.cursorMode = true;
  app.tracker = tr;
  app.cameraOnly = true;
  let t = performance.now();
  const pose = (o = {}) => {
    const W = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
    const set = (i, v) => { W[i] = { x: v[0], y: v[1], z: v[2] }; };
    set(0, [0, -0.62, -0.05]); set(7, [0.07, -0.6, 0.03]); set(8, [-0.07, -0.6, 0.03]);
    set(11, [0.18, -0.45, 0]); set(12, [-0.18, -0.45, 0]); set(13, [0.2, -0.2, 0]); set(14, [-0.2, -0.2, 0]);
    set(15, o.wrL || [0.2, 0.02, 0]); set(16, o.wrR || [-0.2, 0.02, 0]);
    set(23, [0.1, 0, 0]); set(24, [-0.1, 0, 0]); set(25, [0.1, 0.42, 0]); set(26, [-0.1, 0.42, 0]); set(27, [0.1, 0.82, 0]); set(28, [-0.1, 0.82, 0]);
    const I = W.map((p) => ({ x: 0.5 + (o.hipX || 0) + p.x * 0.4, y: 0.5 + p.y * 0.4, z: 0 }));
    if (o.handImg) I[16] = { x: o.handImg[0], y: o.handImg[1], z: 0 };
    return [W, I];
  };
  const feed = (o, frames = 1, step = false) => {
    for (let i = 0; i < frames; i++) { t += 33; const [W, I] = pose(o); tr.process(W, I, t, 0.033); if (step) app.step(2, 1 / 60); }
  };
  const top = 0.32 - 0.18 * 0.9, bottom = 0.5 - 0.18 * 0.15;
  const handOn = (el) => {
    const r = el.getBoundingClientRect();
    const sx = (r.left + r.width / 2) / innerWidth, sy = (r.top + r.height / 2) / innerHeight;
    return [1 - (0.2 + 0.6 * sx), top + sy * (bottom - top)];
  };
  const press = async (el) => { feed({ handImg: handOn(el), wrR: [-0.25, -0.7, -0.2] }, 55); await wait(250); };
  const button = (text) => [...document.querySelectorAll('#ui button')].find((b) => b.textContent.includes(text));
  return { tr, feed, press, button };
}
