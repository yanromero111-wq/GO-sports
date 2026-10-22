// Golfe: campos gerados (fairway, green, bancas de areia, água), vento, tacos, putt com caída do green.
// Física determinística (mesma tacada => mesmo resultado), usada também para o modo online.
import { SportBase, THREE, BOT, clamp, lerp, gauss } from './common.js';
import { makeClub } from '../engine/avatar.js';
import { toon, basic, shadowBlob } from '../engine/materials.js';
import { tree, pine, hills, skyClouds } from '../engine/props.js';
import { Trail } from '../engine/fx.js';
import { banner, h } from '../ui/dom.js';

const G = 9.8;
const CUP_R = 0.11; // buraco um pouco maior que o real, para ficar divertido
const CLUBS = [
  { id: 'driver', name: 'Driver', max: 230, loft: 0.26 },
  { id: 'i5', name: 'Ferro 5', max: 170, loft: 0.36 },
  { id: 'i9', name: 'Ferro 9', max: 120, loft: 0.52 },
  { id: 'wedge', name: 'Wedge', max: 75, loft: 0.8 },
  { id: 'putter', name: 'Putter', max: 22, loft: 0 },
];
const SURF = {
  fairway: { e: 0.32, roll: 3.2, name: 'Fairway' }, rough: { e: 0.2, roll: 7, name: 'Rough' }, green: { e: 0.22, roll: 1.25, name: 'Green' },
  bunker: { e: 0.04, roll: 18, name: 'Areia' }, water: { e: 0, roll: 99, name: 'Água' }, oob: { e: 0.2, roll: 7, name: 'Fora' }, tee: { e: 0.3, roll: 3.2, name: 'Tee' },
};

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Gera os buracos de um campo (determinístico a partir da semente).
function makeCourse(seed, n, water) {
  const r = rng(seed);
  const holes = [];
  const pars = [3, 4, 5, 4, 3, 4, 5, 4, 3];
  for (let i = 0; i < n; i++) {
    const par = pars[i % pars.length];
    const len = par === 3 ? 120 + r() * 50 : par === 4 ? 250 + r() * 90 : 410 + r() * 60;
    const bend = (r() - 0.5) * (par === 3 ? 10 : 70);
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(bend * 0.6, 0, len * 0.45), new THREE.Vector3(bend, 0, len * 0.8), new THREE.Vector3(bend * 0.9, 0, len)];
    const curve = new THREE.CatmullRomCurve3(pts);
    const green = pts[3].clone();
    const greenR = 13 + r() * 4;
    const cup = green.clone().add(new THREE.Vector3((r() - 0.5) * greenR, 0, (r() - 0.5) * greenR));
    const slope = new THREE.Vector2((r() - 0.5) * 0.9, (r() - 0.5) * 0.9);
    const bunkers = [];
    for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
      const t = k === 0 ? 0.97 : 0.4 + r() * 0.5;
      const p = curve.getPoint(Math.min(1, t));
      const side = r() < 0.5 ? -1 : 1;
      bunkers.push({ x: p.x + side * (k === 0 ? greenR + 3 : 12 + r() * 8), z: p.z + (r() - 0.5) * 10, r: 5 + r() * 4 });
    }
    const ponds = [];
    if (water || par === 5) {
      const p = curve.getPoint(0.3 + r() * 0.3);
      ponds.push({ x: p.x + (r() < 0.5 ? -1 : 1) * (8 + r() * 10), z: p.z, r: 10 + r() * 8 });
    }
    holes.push({ par, len, curve, green, greenR, cup, slope, bunkers, ponds, samples: curve.getSpacedPoints(60) });
  }
  return holes;
}

class Golf extends SportBase {
  constructor(ctx) {
    super(ctx);
    const seed = this.net ? this.net.seed : Math.floor(Math.random() * 1e9);
    this.nHoles = this.setup.length || 3;
    this.course = makeCourse(seed, this.nHoles, !!this.theme.water);
    this.windRng = rng(seed + 99);
    this.holeIdx = 0;
    this.holeGroup = new THREE.Group();
    this.root.add(this.holeGroup);
    this.buildScenery();
    const clubItem = ctx.equip('club');
    const ballItem = ctx.equip('ball');
    this.ballObj = this.ball(0.06, ballItem?.sport === 'golf' ? ballItem.color : '#ffffff', 12);
    this.trail = new Trail(this.root, '#ffffff', 20, 0.08);
    this.aimArrow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1), basic('#ffd166', { transparent: true, opacity: 0.8, depthWrite: false }));
    this.aimArrow.rotation.x = -Math.PI / 2;
    this.root.add(this.aimArrow);
    this.landRing = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 24), basic('#ffffff', { transparent: true, opacity: 0.7, depthWrite: false }));
    this.landRing.rotation.x = -Math.PI / 2;
    this.root.add(this.landRing);
    this.ps = this.players.map((pl, i) => {
      const av = this.makeAvatar(pl, makeClub(i === 0 ? clubItem?.color : '#c0c7d0'));
      av.root.visible = false;
      return { pl, av, i, strokes: [], ball: null };
    });
    this.me = this.ps.find((p) => p.pl.kind === 'human' && p.pl.slot === 0) || this.ps[0];
    this.turn = 0;
    this.state = 'idle';
    this.hud.scoreboard(this.ps.map((p) => ({ name: p.pl.name, color: p.pl.color, score: 0 })), { allLeft: this.ps.length > 2 });
    this.card = this.hud.block('card', h('div.scorecard'));

    this.on('pointer', (e) => this.aimInput(e.slot, -e.dx * 0.0016, 0));
    this.on('button', (e) => {
      if (!e.down) return;
      if (e.id === 'left') this.aimInput(e.slot, 0.025, 0);
      if (e.id === 'right') this.aimInput(e.slot, -0.025, 0);
      if (e.id === 'up') this.aimInput(e.slot, 0, -1);
      if (e.id === 'down') this.aimInput(e.slot, 0, 1);
    });
    this.on('swing', (e) => this.humanShot(e));
  }

  // ---------- cenário ----------
  buildScenery() {
    const t = this.theme;
    this.world.setFog(250, 1100);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), toon(t.rough || '#3f9a46'));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.root.add(ground);
    hills(this.root, t.snow ? '#e8f2fb' : t.ground || '#5cbf5c', 700, 18, !!t.snow);
    this.world.updaters.add(skyClouds(this.root, 10, 80, 400));
    if (t.water) {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 1200), toon('#2bb5e8'));
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(-1700, 0.03, 300);
      this.root.add(sea);
    }
  }

  buildHole(hole) {
    const g = this.holeGroup;
    for (const c of [...g.children]) { g.remove(c); c.traverse((o) => o.geometry?.dispose()); }
    const t = this.theme;
    // fairway como faixa
    const pts = hole.samples;
    const pos = [];
    const idx = [];
    const width = 30;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dir = b.clone().sub(a).normalize();
      const side = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(width / 2);
      const p = pts[i];
      pos.push(p.x + side.x, 0.02, p.z + side.z, p.x - side.x, 0.02, p.z - side.z);
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setIndex(idx);
    fg.computeVertexNormals();
    const fair = new THREE.Mesh(fg, toon(t.fairway || '#7ed67e', { side: THREE.DoubleSide }));
    fair.receiveShadow = true;
    g.add(fair);
    const tee = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 6), toon(t.fairway || '#7ed67e'));
    tee.position.set(0, 0.03, 0);
    g.add(tee);
    const green = new THREE.Mesh(new THREE.CircleGeometry(hole.greenR, 40), toon('#5fd35f'));
    green.rotation.x = -Math.PI / 2;
    green.position.set(hole.green.x, 0.04, hole.green.z);
    green.receiveShadow = true;
    g.add(green);
    const cup = new THREE.Mesh(new THREE.CircleGeometry(CUP_R * 1.3, 16), basic('#111111'));
    cup.rotation.x = -Math.PI / 2;
    cup.position.set(hole.cup.x, 0.05, hole.cup.z);
    g.add(cup);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), toon('#ffffff'));
    pole.position.set(hole.cup.x, 1.2, hole.cup.z);
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), toon('#ef476f', { side: THREE.DoubleSide }));
    flag.position.set(hole.cup.x + 0.45, 2.1, hole.cup.z);
    g.add(flag);
    this.flag = flag;
    for (const b of hole.bunkers) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(b.r, 24), toon('#f2dfa7'));
      m.rotation.x = -Math.PI / 2;
      m.position.set(b.x, 0.045, b.z);
      g.add(m);
    }
    for (const p of hole.ponds) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(p.r, 28), toon('#3db7f2'));
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x, 0.05, p.z);
      g.add(m);
    }
    // árvores nas laterais
    const r = rng(Math.floor(hole.len * 7));
    for (let i = 0; i < 40; i++) {
      const p = pts[Math.floor(r() * pts.length)];
      const side = r() < 0.5 ? -1 : 1;
      const tr = t.snow ? pine(2 + r() * 1.5, true) : tree(2 + r() * 1.5, r() < 0.5 ? '#2f9e4f' : '#3fae5a');
      tr.position.set(p.x + side * (28 + r() * 30), 0, p.z + (r() - 0.5) * 10);
      if (tr.position.distanceTo(hole.green) > hole.greenR + 6) g.add(tr);
    }
    this.world.setShadowArea(new THREE.Vector3(0, 0, 0), 40);
  }

  surfaceAt(x, z, hole = this.hole) {
    for (const p of hole.ponds) if (Math.hypot(x - p.x, z - p.z) < p.r) return 'water';
    if (Math.hypot(x - hole.green.x, z - hole.green.z) < hole.greenR) return 'green';
    for (const b of hole.bunkers) if (Math.hypot(x - b.x, z - b.z) < b.r) return 'bunker';
    let best = Infinity;
    for (const p of hole.samples) best = Math.min(best, Math.hypot(x - p.x, z - p.z));
    if (Math.abs(x) < 4 && Math.abs(z) < 3) return 'tee';
    if (best < 15) return 'fairway';
    if (best > 75 || z < -30) return 'oob';
    return 'rough';
  }

  // ---------- fluxo do jogo ----------
  start() {
    super.start();
    this.audio.play('bell');
    this.startHole();
  }

  startHole() {
    if (this.over) return;
    this.hole = this.course[this.holeIdx];
    this.buildHole(this.hole);
    const wr = this.windRng;
    this.wind = new THREE.Vector2((wr() - 0.5) * 2, (wr() - 0.5) * 2).multiplyScalar(this.theme.snow ? 1.4 : 1);
    for (const p of this.ps) { p.ball = new THREE.Vector3(0, 0, 0); p.holed = false; p.strokes[this.holeIdx] = 0; }
    this.turn = 0;
    banner(`Buraco ${this.holeIdx + 1}`, `Par ${this.hole.par} · ${Math.round(this.hole.len)} m`);
    this.renderCard();
    this.later(1.4, () => this.beginShot());
  }

  get cur() { return this.ps[this.turn]; }

  beginShot() {
    if (this.over) return;
    const p = this.cur;
    if (p.holed || p.strokes[this.holeIdx] >= 10) {
      // pula jogadores que já terminaram
      const next = this.ps.findIndex((x) => !x.holed && x.strokes[this.holeIdx] < 10);
      if (next < 0) return this.endHole();
      this.turn = next;
      return this.beginShot();
    }
    this.state = 'aim';
    this.ballPos = p.ball.clone();
    const toCup = this.hole.cup.clone().sub(this.ballPos);
    const dist = Math.hypot(toCup.x, toCup.z);
    this.surface = this.surfaceAt(this.ballPos.x, this.ballPos.z);
    this.aimYaw = Math.atan2(toCup.x, toCup.z);
    // taco automático
    if (this.surface === 'green') this.club = 4;
    else {
      this.club = 0;
      for (let i = 0; i < 4; i++) if (CLUBS[i].max >= dist * 0.95) this.club = i;
      // longe do green: mira no fairway (ponto da curva)
      if (dist > CLUBS[0].max) {
        const tgt = this.hole.samples.find((s) => s.distanceTo(this.ballPos) > CLUBS[0].max * 0.92) || this.hole.green;
        this.aimYaw = Math.atan2(tgt.x - this.ballPos.x, tgt.z - this.ballPos.z);
      }
    }
    for (const x of this.ps) x.av.root.visible = x === p;
    this.baseYaw = this.aimYaw;
    this.hud.setActive(this.turn);
    this.updateHud();
    if (p.pl.kind === 'human') {
      this.hud.hint(this.club === 4 ? '⛳ Putt: ← → mira · balance leve para tacar' : '← → mirar · ↑ ↓ trocar taco · balance para a tacada');
      this.vibrate(p.pl.slot, 40);
    } else if (p.pl.kind === 'bot') {
      this.hud.hint(`${p.pl.name} está se preparando…`);
      this.later(1.5, () => this.botShot());
    } else { this.hud.hint(`Aguardando ${p.pl.name}…`); this.drainRemote('shot'); }
  }

  updateHud() {
    const p = this.cur;
    const d = Math.hypot(this.hole.cup.x - this.ballPos.x, this.hole.cup.z - this.ballPos.z);
    const wd = Math.round(this.wind.length() * 10) / 10;
    const wa = Math.atan2(this.wind.x, this.wind.y) - this.aimYaw;
    const arrow = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'][((Math.round((-wa / (Math.PI * 2)) * 8) % 8) + 8) % 8];
    this.hud.center(`⛳ Buraco ${this.holeIdx + 1}/${this.nHoles} · Par ${this.hole.par} · ${Math.round(d)} m · ${SURF[this.surface].name} · ${CLUBS[this.club].name} · tacada ${p.strokes[this.holeIdx] + 1}`);
    this.hud.wind(`🌬️ Vento ${arrow} ${wd} m/s`);
  }

  aimInput(slot, dyaw, dclub) {
    const p = this.cur;
    if (this.state !== 'aim' || p.pl.kind !== 'human' || p.pl.slot !== slot) return;
    this.aimYaw += dyaw;
    if (dclub && this.surface !== 'green') {
      this.club = clamp(this.club + dclub, 0, 3);
      this.audio.play('click');
    }
    this.updateHud();
  }

  humanShot(e) {
    const p = this.cur;
    if (this.state !== 'aim' || p.pl.kind !== 'human' || p.pl.slot !== e.slot) return;
    this.hud.meter(Math.min(1, e.power / 1.2));
    this.shoot({ yaw: this.aimYaw + e.dx * 0.06, club: this.club, power: e.power, twist: e.twist });
  }

  botShot() {
    if (this.state !== 'aim') return;
    const k = BOT[this.difficulty];
    const d = Math.hypot(this.hole.cup.x - this.ballPos.x, this.hole.cup.z - this.ballPos.z);
    const club = CLUBS[this.club];
    let need;
    if (this.club === 4) {
      need = Math.min(1.2, (d + 0.4) / club.max);
      // compensa a caída do green
      const sl = this.hole.slope;
      const side = new THREE.Vector2(Math.cos(this.aimYaw), -Math.sin(this.aimYaw));
      this.aimYaw -= ((sl.x * side.x + sl.y * side.y) * 0.35 * (d / 4)) / Math.max(4, d * 1.4) * (1 - k.err * 0.3);
    } else need = Math.min(1, d / club.max);
    // compensa um pouco do vento
    this.aimYaw -= this.wind.x * 0.004 * k.aim;
    const errPow = { easy: 0.13, medium: 0.07, hard: 0.035 }[this.difficulty] * (this.club === 4 ? 0.8 : 1);
    this.shoot({ yaw: this.aimYaw + gauss() * 0.04 * k.err, club: this.club, power: clamp(need + gauss() * errPow, 0.05, 1.05), twist: gauss() * 0.15 * k.err });
  }

  shoot(params) {
    this.state = 'flight';
    const p = this.cur;
    if (this.net && p.pl.kind === 'human') this.net.send({ k: 'shot', params });
    this.hud.hint('');
    p.strokes[this.holeIdx]++;
    this.renderCard();
    p.av.play('golf', this.club === 4 ? 1.6 : 1);
    this.aimYaw = params.yaw;
    const club = CLUBS[params.club];
    const pw = clamp(params.power, 0.03, 1.25);
    const dir = new THREE.Vector3(Math.sin(params.yaw), 0, Math.cos(params.yaw));
    this.shotStart = this.ballPos.clone();
    // Sorteio determinístico: o erro de força excessiva vem só dos parâmetros
    let curve = clamp(params.twist, -1, 1) * 5;
    if (pw > 1.05) curve += (pw - 1.05) * 30 * (params.twist >= 0 ? 1 : -1);
    const surfFactor = this.surface === 'rough' ? 0.85 : this.surface === 'bunker' ? 0.6 : 1;
    if (club.id === 'putter') {
      const decel = SURF.green.roll;
      const d = club.max * pw;
      const v = Math.sqrt(2 * decel * d);
      this.bs = { p: this.ballPos.clone(), v: dir.multiplyScalar(v), curve: 0, air: false };
      this.audio.play('tick');
    } else {
      const carry = club.max * Math.min(pw, 1.15) * surfFactor;
      const v = Math.sqrt((carry * G) / Math.sin(2 * club.loft));
      this.bs = { p: this.ballPos.clone().setY(0.06), v: dir.multiplyScalar(v * Math.cos(club.loft)).setY(v * Math.sin(club.loft)), curve, air: true, loft: club.loft, side: new THREE.Vector3(Math.cos(params.yaw), 0, -Math.sin(params.yaw)) };
      this.audio.play('bat', { vol: 0.8 });
      this.fx.burst(this.ballPos, this.surface === 'bunker' ? '#f2dfa7' : '#7ed67e', 10, 2, 0.12);
    }
    this.trail.reset();
    this.flightT = 0;
  }

  stepBall(dt) {
    const b = this.bs;
    const hole = this.hole;
    if (b.air) {
      b.v.y -= G * dt;
      b.v.addScaledVector(b.side, b.curve * dt);
      b.v.x += this.wind.x * 0.25 * dt;
      b.v.z += this.wind.y * 0.25 * dt;
      b.p.addScaledVector(b.v, dt);
      if (b.p.y <= 0.06 && b.v.y < 0) {
        const s = this.surfaceAt(b.p.x, b.p.z);
        b.p.y = 0.06;
        if (s === 'water') return this.hazard('water');
        if (s === 'oob') return this.hazard('oob');
        this.fx.burst(b.p, s === 'bunker' ? '#f2dfa7' : s === 'green' ? '#5fd35f' : '#7ed67e', 6, 1.5, 0.1);
        this.audio.play('thunk', { vol: 0.5 });
        const e = SURF[s].e;
        b.v.y = -b.v.y * e;
        const keep = clamp(0.55 - b.loft * 0.4, 0.15, 0.6); // tacos com mais "loft" seguram a bola (backspin)
        b.v.x *= keep;
        b.v.z *= keep;
        if (b.v.y < 1.2) { b.air = false; b.v.y = 0; }
      }
    } else {
      const s = this.surfaceAt(b.p.x, b.p.z);
      if (s === 'water') return this.hazard('water');
      const sp = Math.hypot(b.v.x, b.v.z);
      let dec = SURF[s].roll;
      if (s === 'green') { b.v.x += hole.slope.x * 0.35 * dt; b.v.z += hole.slope.y * 0.35 * dt; }
      const ns = Math.max(0, sp - dec * dt);
      if (sp > 0) { b.v.x *= ns / sp; b.v.z *= ns / sp; }
      b.p.x += b.v.x * dt;
      b.p.z += b.v.z * dt;
      // buraco
      const dc = Math.hypot(b.p.x - hole.cup.x, b.p.z - hole.cup.z);
      if (dc < CUP_R && sp < 2.2) return this.holed();
      if (dc < CUP_R * 1.6 && sp >= 2.2) this.audio.play('tick');
      if (ns < 0.03) return this.settle();
    }
    if (this.flightT > 20) this.settle();
  }

  hazard(kind) {
    const p = this.cur;
    this.state = 'wait';
    p.strokes[this.holeIdx]++;
    banner(kind === 'water' ? 'ÁGUA!' : 'FORA!', '+1 tacada de penalidade');
    this.audio.play(kind === 'water' ? 'splash' : 'aww');
    if (kind === 'water') this.fx.burst(this.bs.p, '#3db7f2', 20, 4, 0.15);
    p.ball = this.shotStart.clone();
    this.renderCard();
    this.later(2, () => this.nextTurn());
  }

  settle() {
    const p = this.cur;
    this.state = 'wait';
    p.ball = this.bs.p.clone().setY(0);
    const s = this.surfaceAt(p.ball.x, p.ball.z);
    const d = Math.hypot(this.hole.cup.x - p.ball.x, this.hole.cup.z - p.ball.z);
    if (p.pl.kind === 'human') banner(d < 3 ? 'Pertinho!' : SURF[s].name.toUpperCase(), `${d.toFixed(d < 10 ? 1 : 0)} m do buraco`);
    this.later(1.4, () => this.nextTurn());
  }

  holed() {
    const p = this.cur;
    this.state = 'wait';
    p.holed = true;
    p.ball = this.hole.cup.clone();
    const n = p.strokes[this.holeIdx];
    const diff = n - this.hole.par;
    const names = { '-3': 'ALBATROZ!', '-2': 'EAGLE!', '-1': 'BIRDIE!', 0: 'PAR', 1: 'BOGEY', 2: 'DUPLO BOGEY' };
    const label = n === 1 ? 'HOLE IN ONE!' : names[diff] || `+${diff}`;
    banner(label, `${p.pl.name} · ${n} tacada${n > 1 ? 's' : ''}`);
    this.audio.play('cup');
    if (diff <= 0) { this.audio.play('cheer'); this.fx.confetti(this.hole.cup.clone().setY(1)); }
    if (p === this.me) {
      if (n === 1) this.ev('holeinone');
      if (diff <= -1) this.ev('birdie');
      if (diff <= 0) p.av.celebrate();
    }
    this.renderCard();
    this.later(2.2, () => this.nextTurn());
  }

  nextTurn() {
    if (this.over) return;
    // Ordem: o jogador mais longe do buraco joga primeiro (como no golfe de verdade)
    const open = this.ps.filter((x) => !x.holed && x.strokes[this.holeIdx] < 10);
    if (!open.length) return this.endHole();
    open.sort((a, b) => b.ball.distanceTo(this.hole.cup) - a.ball.distanceTo(this.hole.cup) || a.i - b.i);
    this.turn = open[0].i;
    this.beginShot();
  }

  endHole() {
    this.holeIdx++;
    this.ps.forEach((p, i) => this.hud.setScore(i, this.relPar(p)));
    if (this.holeIdx >= this.nHoles) return this.finish();
    this.later(0.5, () => this.startHole());
  }

  relPar(p) {
    let s = 0;
    for (let i = 0; i < this.course.length; i++) if (p.strokes[i]) s += p.strokes[i] - this.course[i].par;
    return s > 0 ? `+${s}` : s === 0 ? 'E' : String(s);
  }

  finish() {
    const tot = this.ps.map((p) => p.strokes.reduce((a, b) => a + (b || 0), 0));
    const mine = tot[this.me.i];
    const others = tot.filter((_, i) => i !== this.me.i);
    const best = Math.min(...tot);
    const won = mine === best && tot.filter((t) => t === best).length === 1;
    const draw = mine === best && !won;
    const winner = this.ps[tot.indexOf(best)];
    banner(won ? 'VITÓRIA!' : draw ? 'EMPATE!' : 'FIM DE JOGO', `${winner.pl.name}: ${best} tacadas`);
    if (won) this.fx.confetti(this.hole.cup.clone().setY(2));
    // menos tacadas é melhor: o placar enviado é "pontos" = 100 - tacadas para o ranking
    this.end({ won, draw, myScore: Math.max(0, 100 - mine), oppScore: Math.max(0, 100 - Math.min(...others)), label: `${mine} x ${Math.min(...others)} tacadas`, winnerName: winner.pl.name });
  }

  renderCard() {
    const n = this.nHoles;
    this.card.innerHTML = '';
    this.card.appendChild(h('table', {},
      h('tr', {}, h('th', {}, 'Buraco'), ...this.course.map((_, i) => h('th', {}, i + 1)), h('th', {}, 'Total')),
      h('tr', {}, h('th', {}, 'Par'), ...this.course.map((c) => h('td', {}, c.par)), h('td', {}, this.course.reduce((a, c) => a + c.par, 0))),
      ...this.ps.map((p) => h('tr', {}, h('th', { style: { color: p.pl.color } }, p.pl.name.slice(0, 10)),
        ...Array.from({ length: n }, (_, i) => h('td' + (i === this.holeIdx ? '.cur' : ''), {}, p.strokes[i] || '')),
        h('td', {}, h('b', {}, p.strokes.reduce((a, b) => a + (b || 0), 0))))),
    ));
  }

  update(dt) {
    super.update(dt);
    if (!this.hole) return;
    const p = this.cur;
    // modo câmera: passos para os lados giram a mira
    const cam = this.app.camera;
    if (this.cameraMode && cam?.seen && this.state === 'aim' && p.pl.kind === 'human' && p.pl.slot === 0) this.aimYaw = this.baseYaw + cam.bodyX * 0.35;
    if (this.state === 'flight' && this.bs) {
      const sub = 4;
      for (let i = 0; i < sub && this.state === 'flight'; i++) { this.flightT += dt / sub; this.stepBall(dt / sub); }
      if (this.bs) this.trail.push(this.bs.p);
    }
    const bp = this.state === 'flight' || (this.state === 'wait' && this.bs) ? this.bs.p : this.ballPos || new THREE.Vector3();
    this.ballObj.mesh.position.copy(bp);
    this.ballObj.mesh.visible = !(this.state === 'wait' && p?.holed);
    this.ballObj.shadow.position.set(bp.x, 0.06, bp.z);
    this.ballObj.shadow.scale.setScalar(1 + bp.y * 0.05);
    if (this.flag) this.flag.rotation.y = Math.sin(this.time * 3) * 0.2 + Math.atan2(this.wind.y, this.wind.x);

    // avatar ao lado da bola, de frente para ela (alvo à esquerda)
    const dir = new THREE.Vector3(Math.sin(this.aimYaw), 0, Math.cos(this.aimYaw));
    const side = new THREE.Vector3(dir.z, 0, -dir.x); // direita do alvo
    if (p) {
      const base = this.ballPos || new THREE.Vector3();
      p.av.root.position.copy(base).addScaledVector(side, 0.75).addScaledVector(dir, -0.15);
      p.av.root.rotation.y = this.aimYaw - Math.PI / 2; // de lado: alvo à esquerda do jogador
      p.av.armMode.R = p.av.armMode.L = 'hold';
      p.av.setArmDir('R', new THREE.Vector3(-0.05, -1, 0.3), 0.1);
      p.av.setArmDir('L', new THREE.Vector3(0.05, -1, 0.3), 0.1);
      p.av.update(dt);
    }
    this.applyCamera(this.me.av);

    // mira
    const aiming = this.state === 'aim' && p?.pl.kind === 'human';
    this.aimArrow.visible = this.landRing.visible = aiming;
    if (aiming) {
      const club = CLUBS[this.club];
      const sf = this.surface === 'rough' ? 0.85 : this.surface === 'bunker' ? 0.6 : 1;
      const carry = club.id === 'putter' ? Math.min(club.max, this.ballPos.distanceTo(this.hole.cup)) : club.max * sf;
      const land = this.ballPos.clone().addScaledVector(dir, carry);
      this.landRing.position.set(land.x, 0.1, land.z);
      this.landRing.scale.setScalar(club.id === 'putter' ? 0.15 : 1 + carry / 100);
      this.aimArrow.position.copy(this.ballPos).addScaledVector(dir, club.id === 'putter' ? 1 : 4).setY(0.08);
      this.aimArrow.scale.set(club.id === 'putter' ? 0.4 : 1.5, club.id === 'putter' ? 1.4 : 6, 1);
      this.aimArrow.rotation.z = -this.aimYaw;
      this.updateHudThrottled(dt);
    }

    // câmera
    if (this.state === 'flight' && this.bs) {
      const b = this.bs.p;
      const v = this.bs.v.clone().setY(0);
      const back = v.lengthSq() > 0.1 ? v.normalize() : dir;
      this.world.setCamera(b.clone().addScaledVector(back, this.bs.air ? -14 : -5).setY(b.y + (this.bs.air ? 6 : 2)), b.clone(), false, this.bs.air ? 2.5 : 4);
    } else if (this.ballPos) {
      const putt = this.club === 4;
      this.world.setCamera(this.ballPos.clone().addScaledVector(dir, putt ? -3.5 : -7).setY(putt ? 1.8 : 3.2), this.ballPos.clone().addScaledVector(dir, putt ? 6 : 50), false, 3);
    }
  }
  updateHudThrottled(dt) {
    this.hudT = (this.hudT || 0) - dt;
    if (this.hudT <= 0) { this.hudT = 0.15; this.updateHud(); }
  }

  onNet(d) {
    if (d.k !== 'shot') return;
    if (this.cur.pl.kind !== 'remote' || this.state !== 'aim') return this.queueRemote(d);
    this.aimYaw = d.params.yaw;
    this.club = d.params.club;
    this.shoot(d.params);
  }
}

export function create(ctx) {
  if (ctx.online && !ctx.online.isHost) ctx.players.reverse();
  return new Golf(ctx);
}
