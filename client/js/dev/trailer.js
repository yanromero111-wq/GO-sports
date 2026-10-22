// Gerador do trailer do GO SPORTS (ferramenta de desenvolvimento).
// Grava cenas de jogo de verdade quadro a quadro (sem depender da velocidade do computador), desenha os títulos
// por cima, sintetiza a trilha com o mesmo sintetizador do jogo e envia tudo para scripts/trailer-receiver.js,
// que monta o MP4 com o ffmpeg.
// Uso (console da tela principal, já no menu):
//   const t = await import('/js/dev/trailer.js'); await t.makeTrailer();
import { startGame, AUTO } from './autoplay.js';
import { botProfile } from '../engine/avatar.js';

const app = window.app;
const FPS = 30;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const back = (x) => { x = Math.min(1, Math.max(0, x)); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const NAVY = '#1d2b53', YELLOW = '#ffd166';

// ---------------- desenho dos títulos ----------------
function text(g, str, x, y, size, { color = '#fff', stroke = NAVY, align = 'center', scale = 1, alpha = 1, weight = 700 } = {}) {
  if (alpha <= 0 || scale <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.scale(scale, scale);
  g.font = `${weight} ${size}px Fredoka, Nunito, sans-serif`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.fillStyle = stroke;
  g.fillText(str, 0, size * 0.09); // sombra
  g.lineWidth = size * 0.12;
  g.strokeStyle = stroke;
  g.strokeText(str, 0, 0);
  g.fillStyle = color;
  g.fillText(str, 0, 0);
  g.restore();
}
function logo(g, cx, cy, size, p) {
  const s = back(p);
  if (s <= 0) return;
  g.save();
  g.translate(cx, cy);
  g.rotate((1 - ease(p)) * -0.2);
  g.scale(s, s);
  g.font = `700 ${size}px Fredoka, sans-serif`;
  const w1 = g.measureText('GO ').width, w2 = g.measureText('SPORTS').width;
  const x0 = -(w1 + w2) / 2;
  text(g, 'GO ', x0, 0, size, { align: 'left' });
  text(g, 'SPORTS', x0 + w1, 0, size, { align: 'left', color: YELLOW });
  g.restore();
}
function pill(g, str, x, y, color, p = 1) {
  if (p <= 0) return;
  g.save();
  g.globalAlpha = ease(p * 2);
  g.translate((1 - ease(p * 2)) * -120, 0);
  g.font = '700 64px Fredoka, sans-serif';
  const w = g.measureText(str).width + 80;
  g.fillStyle = NAVY;
  roundRect(g, x, y - 52 + 10, w, 104, 52);
  g.fill();
  g.fillStyle = color;
  roundRect(g, x, y - 52, w, 104, 52);
  g.fill();
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  g.fillText(str, x + 40, y + 4);
  g.restore();
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function phone(g, x, y, s, t) {
  g.save();
  g.translate(x, y);
  g.rotate(Math.sin(t * 6) * 0.35);
  g.scale(s, s);
  g.fillStyle = NAVY;
  roundRect(g, -70, -130, 140, 260, 26);
  g.fill();
  const grd = g.createLinearGradient(0, -110, 0, 110);
  grd.addColorStop(0, '#3a86ff');
  grd.addColorStop(1, '#8ecae6');
  g.fillStyle = grd;
  roundRect(g, -58, -112, 116, 224, 14);
  g.fill();
  g.fillStyle = '#4cc96f';
  g.beginPath(); g.arc(28, 70, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ef476f';
  g.beginPath(); g.arc(-26, 74, 17, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)';
  roundRect(g, -46, -96, 92, 120, 12);
  g.fill();
  g.restore();
  // arcos de movimento
  g.save();
  g.strokeStyle = YELLOW;
  g.lineWidth = 12;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = ((t * 2 + i * 0.33) % 1);
    g.globalAlpha = 1 - a;
    g.beginPath();
    g.arc(x, y, (170 + a * 120) * s, -2.4, -0.7);
    g.stroke();
  }
  g.restore();
}
function flash(g, w, h, a) {
  if (a <= 0) return;
  g.fillStyle = `rgba(255,255,255,${a})`;
  g.fillRect(0, 0, w, h);
}

// ---------------- trilha sonora offline ----------------
async function renderAudio(events, duration) {
  const { Audio } = await import('../audio.js');
  const sr = 44100;
  const off = new OfflineAudioContext(2, Math.ceil(sr * duration), sr);
  let now = 0;
  const ctx = new Proxy(off, {
    get(t, k) {
      if (k === 'currentTime') return now;
      if (k === 'state') return 'running';
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  const a = new Audio();
  a.ctx = ctx;
  const comp = off.createDynamicsCompressor();
  comp.connect(off.destination);
  a.master = off.createGain();
  a.master.connect(comp);
  a.musicBus = off.createGain();
  a.musicBus.gain.setValueAtTime(0.3, 0);
  a.musicBus.gain.setValueAtTime(0.3, duration - 2.2);
  a.musicBus.gain.linearRampToValueAtTime(0.0001, duration - 0.1);
  a.musicBus.connect(a.master);
  a.sfxBus = off.createGain();
  a.sfxBus.gain.value = 0.85;
  a.sfxBus.connect(a.master);
  a.noise = off.createBuffer(1, sr * 2, sr);
  const d = a.noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  a.playMusic('game');
  clearInterval(a.timer);
  a.nextTime = 0.05;
  for (now = 0; now < duration; now += 0.1) a.schedule();
  for (const e of events) { now = e.t; a.play(e.n, e.o); }
  const buf = await off.startRendering();
  return wav(buf);
}
function wav(buf) {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); str(36, 'data');
  out.setUint32(40, len * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 0x7fff, true); o += 2; }
  return out.buffer;
}

// ---------------- roteiro ----------------
export async function makeTrailer({ receiver = 'http://localhost:3999', width = 1920, height = 1080, name = 'GO-SPORTS-trailer', only = null } = {}) {
  const W = 1920, H = 1080; // coordenadas dos títulos (escalam para qualquer resolução)
  const world = app.world;
  await document.fonts.load('700 100px Fredoka');
  const post = (path, body) => fetch(receiver + path, { method: 'POST', body }).then((r) => { if (!r.ok) throw new Error(path + ' ' + r.status); return r.json(); });
  await post('/start', '');

  // renderizador no tamanho do vídeo
  const realResize = world.resize.bind(world);
  world.resize = () => {};
  world.renderer.setPixelRatio(1);
  world.renderer.setSize(width, height, false);
  world.camera.aspect = width / height;
  world.camera.updateProjectionMatrix();
  const comp = document.createElement('canvas');
  comp.width = width;
  comp.height = height;
  const g = comp.getContext('2d');

  // registra os efeitos sonoros com o tempo do vídeo
  const events = [];
  let frame = 0;
  let recording = false;
  const origPlay = app.audio.play.bind(app.audio);
  app.audio.play = (n, o) => { if (recording) events.push({ t: frame / FPS, n, o }); return origPlay(n, o); };
  const sfx = (n, o) => events.push({ t: frame / FPS, n, o });

  const uploads = [];
  async function capture(n, overlay, each) {
    recording = true;
    for (let i = 0; i < n; i++) {
      const t = i / FPS;
      each?.(i, t);
      app.step(2, 1 / 60);
      g.drawImage(world.renderer.domElement, 0, 0, width, height);
      g.save();
      g.scale(width / W, height / H);
      overlay?.(g, t, i);
      flash(g, W, H, i < 5 ? (1 - i / 5) * 0.75 : 0);
      g.restore();
      // toDataURL é síncrono e bem mais rápido que toBlob numa aba em segundo plano
      uploads.push(post('/frame?i=' + frame, comp.toDataURL('image/jpeg', 0.9)));
      if (uploads.length > 6) await uploads.shift();
      frame++;
    }
    recording = false;
  }
  const sec = (s) => Math.round(s * FPS);
  const prewarm = async (cond, maxSec, each) => {
    for (let i = 0; i < maxSec * FPS && !cond(); i++) { each?.(); app.step(2, 1 / 60); if (i % 300 === 0) await wait(0); }
  };
  const caption = (label, color) => (gg, t) => pill(gg, label, 70, H - 120, color, t * 1.6);
  const word = (str, start, color = '#fff', y = 0.42) => (gg, t) => {
    if (start == null || t < start) return;
    const p = (t - start) * 2.2;
    text(gg, str, W / 2, H * y, 190, { scale: back(p), color, alpha: Math.min(1, (start + 1.7 - t) * 3) });
  };
  const cd = { t: 0 };
  const auto = (sport) => () => { cd.t -= 1 / 30; if (cd.t <= 0) AUTO[sport](app.sport, cd); };

  const plaza = async (view) => {
    app.go('menu');
    document.getElementById('ui').innerHTML = '';
    await wait(150);
    app.plaza.setView(view, true);
  };
  const sports = [];
  const scene = (id, fn) => { if (!only || only.includes(id)) sports.push([id, fn]); };

  // ---------- 1. abertura ----------
  scene('intro', async () => {
    await plaza('center');
    const av = app.plaza.avatar;
    sfx('whoosh');
    await capture(sec(3.6), (gg, t) => {
      logo(gg, W / 2, H * 0.17, 200, (t - 0.35) * 1.5);
      if (t > 1.6) text(gg, 'Esportes em família', W / 2, H * 0.31, 80, { alpha: ease((t - 1.6) * 2), scale: 0.9 + 0.1 * ease((t - 1.6) * 2) });
    }, (i, t) => {
      if (i === 8) { av.celebrate(); sfx('fanfare'); }
      const a = -0.35 + t * 0.2; // gira devagar, sempre de frente para o personagem
      world.setCamera(new THREE_V(Math.sin(a) * 4.6, 1.3, Math.cos(a) * 4.6), new THREE_V(0, 1.55, 0), true);
    });
  });

  // ---------- 2. celular = controle ----------
  scene('phone', async () => {
    await plaza('pairing');
    const av = app.plaza.avatar;
    await capture(sec(3.2), (gg, t) => {
      phone(gg, W * 0.86, H * 0.55, 1.1, t);
      text(gg, 'Seu celular', W * 0.3, H * 0.33, 120, { scale: back(t * 2.5) });
      text(gg, 'vira o controle!', W * 0.3, H * 0.47, 120, { scale: back((t - 0.25) * 2.5), color: YELLOW });
      text(gg, 'Escaneie o QR · Balance · Jogue', W * 0.3, H * 0.64, 54, { alpha: ease((t - 0.9) * 2) });
    }, (i) => {
      // personagem à direita da tela, texto à esquerda
      world.setCamera(new THREE_V(-1.25, 1.35, 4.1), new THREE_V(-1.25, 1.15, 0), true);
      if (i % 24 === 2) { av.play(i % 48 === 2 ? 'fore' : 'back', 1); sfx('whoosh'); }
      if (i % 24 === 10) sfx('hit');
    });
  });

  // ---------- 3. esportes ----------
  const sportScene = async (setup, { label, color, prep, run, dur = 3, overlay }) => {
    const gm = await startGame({ mode: 'bot', difficulty: 'easy', control: 'motion', ...setup });
    await prep?.(gm);
    const st = { word: null };
    await capture(sec(dur), (gg, t) => { caption(label, color)(gg, t); overlay?.(gg, t, st); }, (i, t) => run?.(gm, i, t, st));
  };

  scene('tennis', () => sportScene({ sport: 'tennis', arena: 'arena_tennis_park', length: 2 }, {
    label: '🎾 Tênis', color: '#4cc96f', prep: () => prewarm(() => false, 4.5, auto('tennis')), run: () => auto('tennis')(),
  }));

  scene('bowling', async () => {
    const { RollSim } = await import('../sports/bowling.js');
    let params = null;
    await sportScene({ sport: 'bowling', arena: 'arena_bowling_disco', length: 3 }, {
      label: '🎳 Boliche', color: '#8e7dff', dur: 3.6,
      prep: async (gm) => {
        await prewarm(() => gm.state === 'aim' && gm.isLocalTurn(), 6);
        // procura um arremesso que derruba os 10 pinos
        search: for (const hook of [0, 0.6, -0.6, 1]) for (let x = -0.15; x <= 0.15; x += 0.05) for (let xt = -0.1; xt <= 0.1; xt += 0.02) {
          const p = { x, angle: Math.atan2(xt - x, 18.29), speed: 9, hook };
          const sim = new RollSim(gm.freshPins(), p);
          while (!sim.done) sim.step();
          if (sim.pins.every((q) => q.hit || q.gone)) { params = p; break search; }
        }
        params ||= { x: 0.05, angle: 0, speed: 9, hook: 0 };
        gm.aim.x = params.x;
        await prewarm(() => false, 0.5);
      },
      run: (gm, i, t, st) => {
        if (i === 6) gm.throw(params);
        if (!st.word && gm.sim && gm.sim.hits > 0) st.word = t + 0.25;
      },
      overlay: (gg, t, st) => word('STRIKE!', st.word, YELLOW, 0.18)(gg, t),
    });
  });

  scene('boxing', () => sportScene({ sport: 'boxing', arena: 'arena_boxing_arena', length: 2 }, {
    label: '🥊 Boxe', color: '#ef476f',
    prep: (gm) => prewarm(() => gm.state === 'fight', 4),
    run: (gm, i, t, st) => {
      const seq = [{ dx: 0, dy: 0, hand: 'L' }, { dx: 0, dy: 0, hand: 'R' }, { dx: -0.9, dy: 0 }, { dx: 0, dy: 0.9 }];
      if (i % 11 === 3) app.input.emit('swing', { slot: 0, power: 1, twist: 0, source: 'trailer', ...seq[(i / 11 | 0) % 4] });
      if (i === 40) st.word = t;
    },
    overlay: (gg, t, st) => word('POW!', st.word, '#ff6b6b')(gg, t),
  }));

  scene('golf', () => sportScene({ sport: 'golf', arena: 'arena_golf_beach', length: 3 }, {
    label: '⛳ Golfe', color: '#2bb673', dur: 3.2,
    prep: (gm) => prewarm(() => gm.state === 'aim', 5),
    run: (gm, i, t, st) => {
      if (i === 4) gm.shoot({ yaw: gm.aimYaw, club: gm.club, power: 0.98, twist: 0 });
      if (i === 45) st.word = t;
    },
    overlay: (gg, t, st) => word('QUE TACADA!', st.word)(gg, t),
  }));

  scene('basketball', () => sportScene({ sport: 'basketball', arena: 'arena_basketball_arena', length: 3 }, {
    label: '🏀 Basquete', color: '#ff8c42', dur: 2.9,
    prep: (gm) => prewarm(() => gm.state === 'ready', 5),
    run: (gm, i, t, st) => {
      if (i === 5) gm.shoot({ factor: 1, lateral: 0 });
      if (!st.word && gm.bs?.scored) st.word = t;
    },
    overlay: (gg, t, st) => word('CHUÁ!', st.word, YELLOW)(gg, t),
  }));

  scene('volleyball', () => sportScene({ sport: 'volleyball', arena: 'arena_volleyball_beach', length: 7 }, {
    label: '🏐 Vôlei', color: '#ffb703', dur: 3,
    prep: (gm) => prewarm(() => gm.lastTeam === 0 && gm.phase === 'set' && gm.ballS.v.y > 0, 30, auto('volleyball')),
    run: (gm, i, t, st) => {
      auto('volleyball')();
      if (!st.word && gm.phase === 'spike' && gm.lastTeam === 0) st.word = t;
    },
    overlay: (gg, t, st) => word('CORTADA!', st.word, YELLOW)(gg, t),
  }));

  scene('baseball', () => sportScene({ sport: 'baseball', arena: 'arena_baseball_stadium', length: 1 }, {
    label: '⚾ Beisebol', color: '#ef476f', dur: 3.6,
    prep: (gm) => prewarm(() => gm.state === 'pitch' && gm.pb?.p.z < 9, 8),
    run: (gm, i, t, st) => {
      if (!st.hit && gm.pb?.p.z < 0.6) {
        st.hit = true;
        gm.pb.swung = true;
        gm.teams[gm.battingTeam].batter.play('bat', 1.3);
        gm.hitBall({ spray: 0.12, ev: 36, la: 0.5 });
        st.word = t + 1.1;
      }
    },
    overlay: (gg, t, st) => word('HOME RUN!', st.word, YELLOW)(gg, t),
  }));

  scene('archery', () => sportScene({ sport: 'archery', arena: 'arena_archery_forest', length: 3 }, {
    label: '🏹 Arco e Flecha', color: '#c77dff', dur: 3.2,
    prep: async (gm) => { await prewarm(() => gm.state === 'aim' && gm.cur.pl.kind === 'human', 5); gm.drawInput(0, true); },
    run: (gm, i, t, st) => {
      if (i === 26) {
        // mira exata: compensa a queda e o vento
        const T = gm.dist / 70;
        const from = gm.launchPos();
        const tgt = from.clone().set(-0.25 * gm.wind * T * T, 1.3 + 0.5 * 1.96 * T * T, gm.dist);
        const dir = tgt.sub(from).normalize();
        gm.aim.offY = Math.atan2(dir.x, dir.z) - gm.aim.yaw;
        gm.aim.offP = Math.asin(dir.y) - gm.aim.pitch;
        gm.drawInput(0, false);
      }
      if (!st.word && gm.state === 'between') st.word = t;
    },
    overlay: (gg, t, st) => word('NA MOSCA!', st.word, YELLOW)(gg, t),
  }));

  scene('pingpong', () => sportScene({ sport: 'pingpong', arena: 'arena_pingpong_pro', length: 5 }, {
    label: '🏓 Tênis de Mesa', color: '#26b5d9', dur: 2.7, prep: () => prewarm(() => false, 3, auto('pingpong')), run: () => auto('pingpong')(),
  }));

  // ---------- 4. personagem ----------
  scene('custom', async () => {
    await plaza('editor');
    app.plaza.rotateAvatar(0);
    await capture(sec(3), (gg, t) => {
      text(gg, 'Crie seu atleta', W * 0.66, H * 0.4, 120, { scale: back(t * 2.5) });
      text(gg, 'cabelo · rosto · roupa · acessórios', W * 0.66, H * 0.53, 52, { alpha: ease((t - 0.6) * 2) });
    }, (i) => {
      if (i % 9 === 0) { app.plaza.setAvatar({ ...botProfile(i * 7919 + 3).avatar }); sfx('click', { pitch: 1 + (i % 4) * 0.1 }); }
      if (i === 60) { app.plaza.avatar.celebrate(); sfx('coin'); }
    });
  });

  // ---------- 5. modos ----------
  scene('modes', async () => {
    await plaza('menu');
    const lines = ['🤖  Contra BOTs: fácil, médio e difícil', '👨‍👩‍👧  Até 4 celulares na mesma TV', '🌍  Online com ligas: Bronze → Lenda'];
    await capture(sec(3.4), (gg, t) => {
      gg.fillStyle = 'rgba(29,43,83,.45)';
      gg.fillRect(0, 0, W, H);
      lines.forEach((l, k) => text(gg, l, W / 2, H * (0.3 + k * 0.18), 76, { scale: back((t - 0.25 - k * 0.45) * 2.5) }));
    }, (i) => { if (i === 8 || i === 21 || i === 35) sfx('point'); });
  });

  // ---------- 6. modo câmera ----------
  scene('camera', async () => {
    await plaza('center');
    const av = app.plaza.avatar;
    await capture(sec(2.8), (gg, t) => {
      text(gg, 'Sem celular?', W / 2, H * 0.22, 110, { scale: back(t * 2.5) });
      text(gg, 'Jogue só com a câmera 📷', W / 2, H * 0.36, 96, { color: YELLOW, scale: back((t - 0.4) * 2.5) });
    }, (i) => { if (i === 10) { av.play('cheer', 1); sfx('whoosh'); } if (i === 40) av.play('punchR', 1); if (i === 48) av.play('punchL', 1); });
  });

  // ---------- 7. final ----------
  scene('outro', async () => {
    await plaza('center');
    const av = app.plaza.avatar;
    await capture(sec(4.2), (gg, t) => {
      gg.fillStyle = `rgba(29,43,83,${0.35 * ease(t)})`;
      gg.fillRect(0, 0, W, H);
      logo(gg, W / 2, H * 0.36, 230, (t - 0.2) * 1.4);
      text(gg, '9 esportes · 1 celular · muita diversão', W / 2, H * 0.56, 62, { alpha: ease((t - 1) * 2) });
      text(gg, 'Jogue grátis no navegador!', W / 2, H * 0.7, 80, { color: YELLOW, scale: back((t - 1.6) * 2) });
    }, (i) => {
      if (i === 6) { sfx('fanfare'); sfx('cheer'); app.fx.confetti(new THREE_V(0, 3, 0), 160, 6); av.celebrate(); }
      world.setCamera(new THREE_V(0, 1.6, 5 + i * 0.01), new THREE_V(0, 1.4, 0), true);
    });
  });

  let THREE_V;
  ({ Vector3: THREE_V } = await import('three'));
  const log = [];
  try {
    for (const [id, fn] of sports) {
      const f0 = frame;
      sfx('whoosh', { vol: 0.8 });
      await fn();
      log.push(`${id}: ${((frame - f0) / FPS).toFixed(1)}s`);
    }
    await Promise.all(uploads);
    const duration = frame / FPS;
    const audio = await renderAudio(events, duration);
    await post('/audio', audio);
    const res = await post('/done?name=' + encodeURIComponent(name), '');
    return { ...res, duration, scenes: log };
  } finally {
    app.audio.play = origPlay;
    world.resize = realResize;
    world.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    realResize();
    app.go('menu');
  }
}
