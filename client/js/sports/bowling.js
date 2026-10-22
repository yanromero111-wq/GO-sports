// Boliche: física 2D determinística dos pinos (reações em cadeia), efeito (curva) pelo giro do pulso,
// pontuação oficial (strike/spare) e turnos alternados contra BOT, amigos ou online.
import { SportBase, THREE, BOT, clamp, lerp, gauss } from './common.js';
import { toon, basic, canvasTexture } from '../engine/materials.js';
import { crowd } from '../engine/props.js';
import { banner, h } from '../ui/dom.js';

const LANE_W = 0.527; // meia largura da pista
const HEAD_Z = 18.29;
const RB = 0.109; // raio da bola
const RP = 0.061; // raio do pino
const MB = 7, MP = 1.5;
const STEP = 1 / 240;
const SP = 0.3048;
const PIN_SPOTS = [
  [0, 0], [-SP / 2, 0.2639], [SP / 2, 0.2639], [-SP, 0.5278], [0, 0.5278], [SP, 0.5278],
  [-1.5 * SP, 0.7917], [-SP / 2, 0.7917], [SP / 2, 0.7917], [1.5 * SP, 0.7917],
];

// Pontuação de boliche com N frames (bônus no último).
export function scoreFrames(rolls, nFrames) {
  const frames = [];
  let i = 0;
  let total = 0;
  for (let f = 0; f < nFrames; f++) {
    const last = f === nFrames - 1;
    const r1 = rolls[i];
    if (r1 === undefined) break;
    if (r1 === 10 && !last) {
      const b1 = rolls[i + 1], b2 = rolls[i + 2];
      const done = b1 !== undefined && b2 !== undefined;
      if (done) total += 10 + b1 + b2;
      frames.push({ marks: ['X'], total: done ? total : null });
      i += 1;
      continue;
    }
    const r2 = rolls[i + 1];
    if (last) {
      const r3 = rolls[i + 2];
      const marks = [r1 === 10 ? 'X' : r1 || '-'];
      if (r2 !== undefined) marks.push(r1 === 10 ? (r2 === 10 ? 'X' : r2 || '-') : r1 + r2 === 10 ? '/' : r2 || '-');
      if (r3 !== undefined) marks.push(r3 === 10 ? 'X' : (r1 === 10 && r2 !== 10 && r2 + r3 === 10) ? '/' : r3 || '-');
      const needThird = r1 === 10 || (r2 !== undefined && r1 + r2 === 10);
      const done = r2 !== undefined && (!needThird || r3 !== undefined);
      if (done) total += r1 + r2 + (needThird ? r3 : 0);
      frames.push({ marks, total: done ? total : null });
      i += needThird ? 3 : 2;
      continue;
    }
    if (r2 === undefined) { frames.push({ marks: [r1 || '-'], total: null }); break; }
    if (r1 + r2 === 10) {
      const b = rolls[i + 2];
      if (b !== undefined) total += 10 + b;
      frames.push({ marks: [r1 || '-', '/'], total: b !== undefined ? total : null });
    } else {
      total += r1 + r2;
      frames.push({ marks: [r1 || '-', r2 || '-'], total });
    }
    i += 2;
  }
  return { frames, total };
}

// Simulação de uma jogada (determinística: mesmos parâmetros => mesmo resultado em qualquer aparelho).
export class RollSim {
  constructor(pins, p) {
    this.ball = { x: p.x, z: -0.3, vx: Math.sin(p.angle) * p.speed, vz: Math.cos(p.angle) * p.speed, hook: p.hook, gutter: false, spin: 0 };
    this.pins = pins.map((q) => ({ ...q, vx: 0, vz: 0, tilt: q.down ? Math.PI / 2 : 0, dirX: 0, dirZ: 1 }));
    this.t = 0;
    this.after = 0;
    this.hits = 0;
  }
  step() {
    const b = this.ball;
    this.t += STEP;
    if (!b.gutter) {
      if (b.z > 10 && b.z < HEAD_Z) b.vx += b.hook * STEP; // curva na parte seca da pista
      if (Math.abs(b.x) > LANE_W - RB * 0.3 && b.z < HEAD_Z - 0.2) {
        b.gutter = true;
        b.x = Math.sign(b.x) * (LANE_W + 0.12);
        b.vx = 0;
      }
    }
    b.x += b.vx * STEP;
    b.z += b.vz * STEP;
    b.spin += b.vz * STEP / RB;
    if (!b.gutter && b.z > HEAD_Z - 0.4 && b.z < HEAD_Z + 1.4) {
      for (const p of this.pins) if (!p.gone) this.collide(b, MB, p, MP, RB + RP, 0.55, true);
    }
    for (let i = 0; i < this.pins.length; i++) {
      const p = this.pins[i];
      if (p.gone) continue;
      for (let j = i + 1; j < this.pins.length; j++) if (!this.pins[j].gone) this.collide(p, MP, this.pins[j], MP, RP * 2 + (p.tilt + this.pins[j].tilt) * 0.06, 0.5, false);
      const sp = Math.hypot(p.vx, p.vz);
      if (sp > 0) {
        const dec = Math.max(0, sp - 2.2 * STEP) / sp;
        p.vx *= dec;
        p.vz *= dec;
        p.x += p.vx * STEP;
        p.z += p.vz * STEP;
      }
      if (p.hit && p.tilt < Math.PI / 2) p.tilt = Math.min(Math.PI / 2, p.tilt + STEP * 5.5);
      if (Math.abs(p.x) > LANE_W + 0.25 || p.z > HEAD_Z + 1.3) p.gone = true;
    }
    if (b.z > HEAD_Z + 1.5) this.after += STEP;
  }
  collide(a, ma, b, mb, minD, e, isBall) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= minD * minD || d2 === 0) return;
    const d = Math.sqrt(d2);
    const nx = dx / d, nz = dz / d;
    const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    const overlap = minD - d;
    a.x -= nx * overlap * (mb / (ma + mb));
    a.z -= nz * overlap * (mb / (ma + mb));
    b.x += nx * overlap * (ma / (ma + mb));
    b.z += nz * overlap * (ma / (ma + mb));
    if (rel <= 0) return;
    const jimp = ((1 + e) * rel) / (1 / ma + 1 / mb);
    a.vx -= (jimp / ma) * nx;
    a.vz -= (jimp / ma) * nz;
    b.vx += (jimp / mb) * nx;
    b.vz += (jimp / mb) * nz;
    for (const p of isBall ? [b] : [a, b]) {
      if (!p.hit && Math.hypot(p.vx, p.vz) > 0.25) { p.hit = true; const s = Math.hypot(p.vx, p.vz) || 1; p.dirX = p.vx / s; p.dirZ = p.vz / s; }
    }
    if (isBall) this.hits++;
  }
  get done() {
    if (this.ball.gutter && this.ball.z > HEAD_Z + 1.5) return true;
    const moving = this.pins.some((p) => !p.gone && Math.hypot(p.vx, p.vz) > 0.05);
    return this.after > 1.6 && !moving || this.after > 4 || this.t > 9;
  }
}

class Bowling extends SportBase {
  constructor(ctx) {
    super(ctx);
    this.nFrames = this.setup.length || 5;
    this.buildArena();
    const ballItem = ctx.equip('ball');
    this.ballColor = ballItem?.color || '#3a86ff';
    this.ballMesh = this.makeBall(this.ballColor);
    this.pinMeshes = PIN_SPOTS.map(() => this.makePin());
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 3), basic('#ffd166', { transparent: true, opacity: 0.85 }));
    this.arrow.rotation.x = Math.PI / 2;
    this.root.add(this.arrow);
    this.aimLine = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 8), basic('#ffd166', { transparent: true, opacity: 0.35 }));
    this.aimLine.rotation.x = -Math.PI / 2;
    this.root.add(this.aimLine);

    this.ps = this.players.map((pl, i) => {
      const av = this.makeAvatar(pl);
      av.root.position.set(-1.6 - i * 0.9, 0, -3.5);
      av.root.rotation.y = 0.4;
      return { pl, av, rolls: [], i };
    });
    this.me = this.ps.find((p) => p.pl.kind === 'human' && p.pl.slot === 0) || this.ps[0];
    this.turn = 0;
    this.frame = 0;
    this.rollInFrame = 0;
    this.pins = this.freshPins();
    this.aim = { x: 0, angle: 0 };
    this.state = 'idle';
    this.hud.scoreboard(this.ps.map((p) => ({ name: p.pl.name, color: p.pl.color, score: 0 })), { allLeft: this.ps.length > 2 });
    this.card = this.hud.block('card', h('div.scorecard'));
    this.renderCard();

    this.on('pointer', (e) => this.aimInput(e.slot, e.dx * 0.0025, -e.dy * 0.0006));
    this.on('button', (e) => {
      if (!e.down) return;
      const m = { left: [0.04, 0], right: [-0.04, 0], up: [0, 0.008], down: [0, -0.008] }[e.id];
      if (m) this.aimInput(e.slot, m[0], m[1]);
    });
    this.on('swing', (e) => this.humanThrow(e));
  }

  freshPins() { return PIN_SPOTS.map(([x, dz]) => ({ x, z: HEAD_Z + dz, down: false, gone: false })); }
  get current() { return this.ps[this.turn]; }

  makeBall(color) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(RB, 24, 18), toon(color));
    m.castShadow = true;
    g.add(m);
    for (const [a, b] of [[0.3, 0.2], [0.45, 0.35], [0.15, 0.4]]) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.014, 10), basic('#111'));
      const v = new THREE.Vector3(Math.sin(a), Math.cos(b), Math.cos(a)).normalize().multiplyScalar(RB + 0.001);
      hole.position.copy(v);
      hole.lookAt(v.clone().multiplyScalar(2));
      g.add(hole);
    }
    this.root.add(g);
    return g;
  }
  makePin() {
    const pts = [[0, 0], [0.03, 0.005], [0.052, 0.07], [0.06, 0.14], [0.045, 0.22], [0.025, 0.27], [0.03, 0.32], [0.032, 0.35], [0.02, 0.375], [0, 0.381]].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), toon('#ffffff'));
    body.castShadow = true;
    g.add(body);
    for (const y of [0.25, 0.275]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.006, 6, 14), toon('#e63946'));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      g.add(ring);
    }
    this.root.add(g);
    return g;
  }

  buildArena() {
    const t = this.theme;
    const g = this.root;
    this.world.setShadowArea(new THREE.Vector3(0, 0, 9), 14);
    this.world.setFog(30, 90);
    const boards = canvasTexture(256, 512, (c, w, hh) => {
      for (let i = 0; i < 16; i++) {
        c.fillStyle = i % 2 ? t.lane || '#e0b179' : shadeHex(t.lane || '#e0b179', 0.92);
        c.fillRect((i * w) / 16, 0, w / 16 + 1, hh);
      }
      c.fillStyle = 'rgba(120,60,20,.6)';
      for (let k = 0; k < 7; k++) {
        const x = w / 2 + (k - 3) * (w / 16) * 2.5;
        const y = hh * 0.3 + Math.abs(k - 3) * 18;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - 8, y + 26); c.lineTo(x + 8, y + 26); c.fill();
      }
    });
    for (const off of [-2.6, 0, 2.6]) {
      const lane = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W * 2, 24), new THREE.MeshToonMaterial({ map: boards }));
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(off, 0, 9);
      lane.receiveShadow = true;
      g.add(lane);
      for (const s of [-1, 1]) {
        // canaleta: canal rebaixado e escuro dos dois lados da pista
        const gutter = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 24), toon('#2b2d42'));
        gutter.rotation.x = -Math.PI / 2;
        gutter.position.set(off + s * (LANE_W + 0.12), -0.035, 9);
        g.add(gutter);
        const rim = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 24), toon('#55597a'));
        rim.position.set(off + s * (LANE_W + 0.25), 0.0, 9);
        g.add(rim);
      }
      const divider = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 24), toon(t.wall || '#6c4ab6'));
      divider.position.set(off + 1.3, 0.06, 9);
      g.add(divider);
      if (off !== 0) {
        for (const [x, dz] of PIN_SPOTS) {
          const p = this.makePin();
          p.position.set(off + x, 0, HEAD_Z + dz);
        }
      }
    }
    const approach = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), toon(shadeHex(t.lane || '#e0b179', 0.8)));
    approach.rotation.x = -Math.PI / 2;
    approach.position.set(0, -0.001, -3);
    g.add(approach);
    const foul = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.04), basic('#e63946'));
    foul.rotation.x = -Math.PI / 2;
    foul.position.set(0, 0.002, 0);
    g.add(foul);
    const pit = new THREE.Mesh(new THREE.BoxGeometry(9, 1.4, 0.4), toon('#1b1b2f'));
    pit.position.set(0, 0.7, HEAD_Z + 1.9);
    g.add(pit);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(9, 0.9, 1.4), toon(t.wall || '#6c4ab6'));
    hood.position.set(0, 1.7, HEAD_Z + 0.9);
    g.add(hood);
    const room = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 34), toon(t.wall || '#6c4ab6', { side: THREE.BackSide }));
    room.position.set(0, 3.4, 8);
    g.add(room);
    for (let i = 0; i < 6; i++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(5, 0.08, 0.5), basic(t.accent || '#ffd166'));
      lamp.position.set(0, 6.8, -2 + i * 4.5);
      g.add(lamp);
    }
    if (t.disco || t.stars) {
      const n = t.stars ? 220 : 60;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 15, 1 + Math.random() * 5.5, -8 + Math.random() * 32], i * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: t.stars ? '#ffffff' : t.accent, size: t.stars ? 0.05 : 0.15 }));
      g.add(stars);
      this.world.updaters.add((dt) => { stars.rotation.z += dt * (t.disco ? 0.2 : 0.02); });
    }
    this.crowd = crowd(g, { width: 8, rows: 2, x: 0, z: -7.5, rotY: 0, step: 0.9 });
  }

  start() {
    super.start();
    banner('BOLICHE', `${this.nFrames} frames`);
    this.audio.play('bell');
    this.later(1.2, () => this.beginTurn());
  }

  isLocalTurn() {
    const p = this.current.pl;
    return p.kind === 'human';
  }

  beginTurn() {
    if (this.over) return;
    const cur = this.current;
    this.state = 'aim';
    this.aim = { x: cur.lastAim?.x ?? 0.05, angle: cur.lastAim?.angle ?? 0 };
    for (const p of this.ps) {
      p.av.root.position.set(p === cur ? this.aim.x - 0.2 : -1.6 - p.i * 0.9, 0, p === cur ? -1.9 : -3.5);
      p.av.root.rotation.y = p === cur ? 0 : 0.4;
      p.av.hold('R', null);
    }
    this.hud.setActive(this.turn);
    this.renderCard();
    const label = `Frame ${this.frame + 1}/${this.nFrames} · ${this.rollInFrame === 0 ? '1ª bola' : this.rollInFrame === 1 ? '2ª bola' : 'bola extra'}`;
    this.hud.center(`🎳 ${label} · vez de ${cur.pl.name}`);
    if (cur.pl.kind === 'human') {
      this.hud.hint('← → posição · ↑ ↓ ângulo · balance por baixo para jogar (gire o pulso para curvar)');
      this.vibrate(cur.pl.slot, 40);
      if (cur.pl.slot !== 0) banner(`Vez do ${cur.pl.name}`);
    } else if (cur.pl.kind === 'bot') {
      this.hud.hint(`${cur.pl.name} está mirando…`);
      this.later(1.6, () => this.botThrow());
    } else { this.hud.hint(`Aguardando ${cur.pl.name}…`); this.drainRemote('throw'); }
  }

  aimInput(slot, dx, da) {
    if (this.state !== 'aim' || !this.isLocalTurn() || this.current.pl.slot !== slot) return;
    this.aim.x = clamp(this.aim.x - dx, -0.42, 0.42);
    this.aim.angle = clamp(this.aim.angle + da, -0.07, 0.07);
  }

  humanThrow(e) {
    const cur = this.current;
    if (this.state !== 'aim' || cur.pl.kind !== 'human' || cur.pl.slot !== e.slot) return;
    const params = {
      x: this.aim.x,
      angle: this.aim.angle - e.dx * 0.012,
      speed: lerp(4.5, 10.5, clamp(e.power, 0, 1.2) / 1.2),
      hook: clamp(e.twist, -1, 1) * 1.6,
    };
    cur.lastAim = { ...this.aim };
    this.throw(params);
  }

  botThrow() {
    if (this.state !== 'aim') return;
    const k = BOT[this.difficulty];
    const err = { easy: 0.13, medium: 0.07, hard: 0.035 }[this.difficulty];
    // mira no "bolso" (entre pinos 1 e 3) ou no pino restante
    const standing = this.pins.filter((p) => !p.down && !p.gone);
    const tgt = this.rollInFrame === 0 || standing.length === 0 ? 0.06 : standing.reduce((s, p) => s + p.x, 0) / standing.length;
    const x0 = clamp(tgt * 0.4 + gauss() * 0.05, -0.35, 0.35);
    const xt = tgt + gauss() * err;
    const params = { x: x0, angle: Math.atan2(xt - x0, HEAD_Z), speed: lerp(6.5, 9.5, k.power) + gauss() * 0.5, hook: 0 };
    this.aim.x = x0;
    this.throw(params);
  }

  throw(params) {
    if (this.state !== 'aim') return;
    this.state = 'roll';
    const cur = this.current;
    if (this.net && cur.pl.kind === 'human') this.net.send({ k: 'throw', params });
    cur.av.root.position.x = params.x - 0.2;
    cur.av.play('under', 1);
    this.audio.play('whoosh');
    this.hud.hint('');
    this.sim = new RollSim(this.pins, params);
    this.rollSound = 0;
    this.crashed = false;
    this.before = this.pins.filter((p) => !p.down && !p.gone).length;
  }

  finishRoll() {
    const sim = this.sim;
    this.sim = null;
    this.pins = sim.pins.map((p) => ({ x: p.x, z: p.z, down: p.down || p.hit || p.gone, gone: p.gone }));
    const standing = this.pins.filter((p) => !p.down).length;
    const knocked = this.before - standing;
    const cur = this.current;
    cur.rolls.push(knocked);
    const last = this.frame === this.nFrames - 1;
    const mine = cur.pl.kind === 'human' && (cur.pl.slot === 0);
    let msg = knocked ? `${knocked} pino${knocked > 1 ? 's' : ''}` : sim.ball.gutter ? 'Canaleta!' : 'Nenhum pino';
    let big = false;
    const firstBall = this.rollInFrame === 0 || (last && this.before === 10);
    if (knocked === 10 && firstBall) { banner('STRIKE!', '🎳💥'); big = true; if (mine) this.ev('strike'); }
    else if (standing === 0) { banner('SPARE!', '✨'); big = true; if (mine) this.ev('spare'); }
    else banner(String(knocked), msg);
    this.audio.play(big ? 'fanfare' : knocked > 5 ? 'point' : 'aww');
    if (big) { this.fx.confetti(new THREE.Vector3(0, 1.5, HEAD_Z)); this.crowd.cheer(1); cur.av.celebrate(); }
    else if (knocked < 3) cur.av.sad();
    // próxima bola
    let nextTurn = false;
    if (!last) {
      if (standing === 0 || this.rollInFrame === 1) nextTurn = true;
      else this.rollInFrame = 1;
    } else {
      const r = cur.rolls.slice(-(this.rollInFrame + 1));
      const sum2 = (r[0] || 0) + (r[1] || 0);
      if (this.rollInFrame === 0) { this.rollInFrame = 1; if (standing === 0) this.pins = this.freshPins(); }
      else if (this.rollInFrame === 1) {
        if (r[0] === 10 || sum2 === 10) { this.rollInFrame = 2; if (standing === 0) this.pins = this.freshPins(); }
        else nextTurn = true;
      } else nextTurn = true;
    }
    this.renderCard();
    this.ps.forEach((p, i) => this.hud.setScore(i, scoreFrames(p.rolls, this.nFrames).total));
    this.later(2.2, () => {
      if (nextTurn) {
        this.pins = this.freshPins();
        this.rollInFrame = 0;
        this.turn = (this.turn + 1) % this.ps.length;
        if (this.turn === 0) this.frame++;
        if (this.frame >= this.nFrames) return this.finishGame();
      } else {
        // varre os pinos derrubados
        this.pins = this.pins.filter((p) => !p.down).map((p) => ({ ...p })).concat(this.pins.filter((p) => p.down).map((p) => ({ ...p, gone: true })));
      }
      this.beginTurn();
    });
  }

  finishGame() {
    const totals = this.ps.map((p) => scoreFrames(p.rolls, this.nFrames).total);
    this.totals = totals;
    const best = Math.max(...totals);
    const mine = totals[this.me.i];
    const others = totals.filter((_, i) => i !== this.me.i);
    const won = mine === best && totals.filter((t) => t === best).length === 1;
    const draw = mine === best && !won;
    const winner = this.ps[totals.indexOf(best)];
    banner(won ? 'VITÓRIA!' : draw ? 'EMPATE!' : 'FIM DE JOGO', `${winner.pl.name}: ${best} pontos`);
    if (won) this.fx.confetti(new THREE.Vector3(0, 2, 2));
    this.end({ won, draw, myScore: mine, oppScore: Math.max(...others), label: `${mine} x ${Math.max(...others)} pontos`, winnerName: winner.pl.name });
  }

  renderCard() {
    const n = this.nFrames;
    const rows = this.ps.map((p, pi) => {
      const sc = scoreFrames(p.rolls, n);
      const cells = [];
      for (let f = 0; f < n; f++) {
        const fr = sc.frames[f];
        cells.push(h('td' + (pi === this.turn && f === this.frame ? '.cur' : ''), {}, fr ? fr.marks.join(' ') : '', h('br'), h('small', {}, fr?.total ?? '')));
      }
      return h('tr', {}, h('th', { style: { color: p.pl.color } }, p.pl.name.slice(0, 10)), ...cells, h('td', {}, h('b', {}, sc.total)));
    });
    this.card.innerHTML = '';
    this.card.appendChild(h('table', {}, h('tr', {}, h('th', {}, ''), ...Array.from({ length: n }, (_, i) => h('th', {}, i + 1)), h('th', {}, 'Total')), ...rows));
  }

  update(dt) {
    super.update(dt);
    const cur = this.current;
    // modo câmera: dar passos para os lados escolhe a posição na pista
    const cam = this.app.camera;
    if (this.cameraMode && cam?.seen && this.state === 'aim' && this.isLocalTurn() && cur.pl.slot === 0) this.aim.x = clamp(cam.bodyX * 0.42, -0.42, 0.42);
    // simulação da jogada
    if (this.sim) {
      let n = Math.round(dt / STEP);
      while (n-- > 0 && !this.sim.done) {
        const hitsBefore = this.sim.hits;
        this.sim.step();
        if (this.sim.hits > hitsBefore && !this.crashed) {
          this.crashed = true;
          this.audio.play('pins');
          this.world.addShake(0.25);
        }
      }
      if (this.sim && this.sim.done) this.finishRoll();
    }
    // bola
    const bm = this.ballMesh;
    if (this.sim) {
      const b = this.sim.ball;
      bm.position.set(b.x, b.gutter ? 0.03 : RB, b.z);
      bm.rotation.x = b.spin;
      this.rollSound -= dt;
      if (this.rollSound < 0 && b.z < HEAD_Z) { this.rollSound = 0.35; this.audio.play('bounce', { pitch: 0.3, vol: 0.25 }); }
    } else if (this.state === 'aim' || this.state === 'idle') {
      const hnd = cur.av.handWorld('R', new THREE.Vector3());
      bm.position.set(hnd.x, Math.max(RB, hnd.y - 0.05), hnd.z + 0.05);
      cur.av.root.position.x += (this.aim.x - 0.2 - cur.av.root.position.x) * Math.min(1, dt * 10);
    }
    bm.visible = !(this.sim === null && this.state === 'roll');
    // pinos
    const pinsSrc = this.sim ? this.sim.pins : this.pins;
    this.pinMeshes.forEach((m, i) => {
      const p = pinsSrc[i];
      m.visible = !!p && !p.gone && !(p.down && !this.sim);
      if (!m.visible) return;
      m.position.set(p.x, 0, p.z);
      const tilt = p.tilt || 0;
      m.rotation.set(tilt * (p.dirZ ?? 1), 0, -tilt * (p.dirX ?? 0));
    });
    // mira
    const aiming = this.state === 'aim' && this.isLocalTurn();
    this.arrow.visible = this.aimLine.visible = aiming;
    if (aiming) {
      this.arrow.position.set(this.aim.x + Math.sin(this.aim.angle) * 1.5, 0.02, 1.5);
      this.arrow.rotation.z = -this.aim.angle;
      this.aimLine.position.set(this.aim.x + Math.sin(this.aim.angle) * 5, 0.01, 5);
      this.aimLine.rotation.z = this.aim.angle;
    }
    for (const p of this.ps) {
      if (p === cur && this.isLocalTurn() && this.input.hasLiveOrient(p.pl.slot) && !p.av.swinging) {
        p.av.armMode.R = 'orient';
        p.av.armOrient = this.input.orient(p.pl.slot);
      } else p.av.armMode.R = 'idle';
      p.av.update(dt);
    }
    this.applyCamera(this.me.av);
    this.crowd.update(dt);
    // câmera
    if (this.sim) {
      const b = this.sim.ball;
      if (b.z < 13) this.world.setCamera(new THREE.Vector3(b.x * 0.5, 1.1, b.z - 3.2), new THREE.Vector3(b.x * 0.6, 0.15, b.z + 6), false, 6);
      else this.world.setCamera(new THREE.Vector3(0.5, 1.2, HEAD_Z - 3.6), new THREE.Vector3(0, 0.15, HEAD_Z + 0.4), false, 3);
    } else {
      this.world.setCamera(new THREE.Vector3(this.aim.x * 0.6, 1.7, -4.6), new THREE.Vector3(this.aim.x * 0.3, 0.2, 9), false, 3);
    }
  }

  onNet(d) {
    if (d.k !== 'throw') return;
    if (this.current.pl.kind !== 'remote' || this.state !== 'aim') return this.queueRemote(d);
    this.aim.x = d.params.x;
    this.throw(d.params);
  }
}

function shadeHex(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

export function create(ctx) {
  // Online: o anfitrião (A) joga primeiro; a ordem dos jogadores é a mesma nos dois aparelhos.
  if (ctx.online && !ctx.online.isHost) ctx.players.reverse();
  return new Bowling(ctx);
}
