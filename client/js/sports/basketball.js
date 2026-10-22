// Basquete: disputa de arremessos de 3 pontos. 5 bolas por posição, a última vale 2 ("bola de ouro").
// Física com aro (toro) e tabela; resultado determinístico a partir dos parâmetros do arremesso.
import { SportBase, THREE, BOT, clamp, lerp, gauss } from './common.js';
import { toon, basic, canvasTexture } from '../engine/materials.js';
import { crowd, ground, skyClouds, tree } from '../engine/props.js';
import { Trail } from '../engine/fx.js';
import { banner, h } from '../ui/dom.js';

const G = 9.8;
const RIM = new THREE.Vector3(0, 3.05, 0);
const RIM_R = 0.23;
const BALL_R = 0.12;
const BOARD_Z = 0.4;
const DIST = 6.2;
const IDEAL_POWER = 0.65;

function ballTexture(color) {
  return canvasTexture(256, 128, (g, w, hh) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, hh);
    g.strokeStyle = '#2b1a10';
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, hh / 2); g.lineTo(w, hh / 2); g.stroke();
    for (const x of [w / 4, (3 * w) / 4]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, hh); g.stroke(); }
    g.beginPath(); g.ellipse(w / 2, hh / 2, w / 6, hh / 2, 0, 0, Math.PI * 2); g.stroke();
  });
}

class Basketball extends SportBase {
  constructor(ctx) {
    super(ctx);
    const n = this.setup.length || 5;
    this.spots = n === 3 ? [-60, 0, 60] : [-80, -40, 0, 40, 80];
    this.buildCourt();
    const ballItem = ctx.equip('ball');
    this.ballTex = ballTexture(ballItem?.color || '#ff8c42');
    this.ballObj = this.ball(BALL_R, '#ffffff', 20);
    this.ballObj.mesh.material = new THREE.MeshToonMaterial({ map: this.ballTex });
    this.trail = new Trail(this.root, '#ffd166', 14, 0.07);
    this.ps = this.players.map((pl, i) => {
      const av = this.makeAvatar(pl);
      av.root.visible = false;
      return { pl, av, i, score: 0, made: 0 };
    });
    this.me = this.ps.find((p) => p.pl.kind === 'human' && p.pl.slot === 0) || this.ps[0];
    this.turn = 0;
    this.spotIdx = 0;
    this.shotIdx = 0;
    this.state = 'idle';
    this.hud.scoreboard(this.ps.map((p) => ({ name: p.pl.name, color: p.pl.color, score: 0 })), { allLeft: this.ps.length > 2 });
    this.on('swing', (e) => this.humanShot(e));
  }

  buildCourt() {
    const t = this.theme;
    const g = this.root;
    this.world.setShadowArea(new THREE.Vector3(0, 0, -3), 10);
    this.world.setFog(30, 160);
    ground(g, t.indoor ? '#3d405b' : '#7a8b99');
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(15, 14), toon(t.floor || '#6c757d'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.005, -5);
    floor.receiveShadow = true;
    g.add(floor);
    const key = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 5.8), toon(t.paint || '#ef476f'));
    key.rotation.x = -Math.PI / 2;
    key.position.set(0, 0.01, -2.3);
    g.add(key);
    const arc = new THREE.Mesh(new THREE.RingGeometry(DIST - 0.05, DIST + 0.05, 60, 1, Math.PI * 1.03, Math.PI * 0.94), basic('#ffffff'));
    arc.rotation.x = -Math.PI / 2;
    arc.position.y = 0.012;
    g.add(arc);
    const ft = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.8, 40, 1, Math.PI, Math.PI), basic('#ffffff'));
    ft.rotation.x = -Math.PI / 2;
    ft.position.set(0, 0.012, -4.6);
    g.add(ft);
    // tabela e aro
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.6, 10), toon('#2b2d42'));
    pole.position.set(0, 1.8, 1.4);
    g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.1), toon('#2b2d42'));
    arm.position.set(0, 3.5, 0.95);
    g.add(arm);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.05), toon('#ffffff', { transparent: true, opacity: 0.92 }));
    board.position.set(0, 3.42, BOARD_Z + 0.025);
    g.add(board);
    const sq = new THREE.Mesh(new THREE.PlaneGeometry(0.59, 0.45), basic('#ef476f'));
    sq.position.set(0, 3.3, BOARD_Z - 0.002);
    sq.rotation.y = Math.PI;
    g.add(sq);
    const sqIn = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.37), basic('#ffffff'));
    sqIn.position.set(0, 3.3, BOARD_Z - 0.003);
    sqIn.rotation.y = Math.PI;
    g.add(sqIn);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, 0.018, 8, 28), toon('#ff6b00'));
    rim.rotation.x = Math.PI / 2;
    rim.position.copy(RIM);
    g.add(rim);
    const net = new THREE.Mesh(new THREE.CylinderGeometry(RIM_R, RIM_R * 0.6, 0.42, 14, 3, true), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true }));
    net.position.set(0, RIM.y - 0.21, 0);
    g.add(net);
    this.netMesh = net;
    this.crowds = [];
    if (t.stands || t.indoor) {
      this.crowds.push(crowd(g, { width: 16, rows: t.stands ? 6 : 3, x: -9, z: -4, rotY: Math.PI / 2 }));
      this.crowds.push(crowd(g, { width: 16, rows: t.stands ? 6 : 3, x: 9, z: -4, rotY: -Math.PI / 2 }));
      const room = new THREE.Mesh(new THREE.BoxGeometry(26, 12, 26), toon(t.sky?.[1] || '#bde0fe', { side: THREE.BackSide }));
      room.position.set(0, 6, -4);
      if (t.indoor) g.add(room);
    } else {
      this.world.updaters.add(skyClouds(g, 6, 40, 100));
      for (let i = 0; i < 8; i++) {
        const tr = tree(1.6, '#3fae5a');
        tr.position.set(-12 + (i % 4) * 8, 0, 6 + Math.floor(i / 4) * 5);
        g.add(tr);
      }
      const fence = new THREE.Mesh(new THREE.PlaneGeometry(16, 3, 16, 3), new THREE.MeshBasicMaterial({ color: '#555', wireframe: true }));
      fence.position.set(0, 1.5, 2.8);
      g.add(fence);
    }
    // rack de bolas
    this.rack = new THREE.Group();
    g.add(this.rack);
  }

  start() {
    super.start();
    banner('BASQUETE', 'Disputa de 3 pontos!');
    this.audio.play('whistle');
    this.later(1.2, () => this.beginRack());
  }

  get cur() { return this.ps[this.turn]; }
  spotPos(i = this.spotIdx) {
    const a = (this.spots[i] * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(a) * DIST, 0, -Math.cos(a) * DIST);
  }

  beginRack() {
    if (this.over) return;
    this.shotIdx = 0;
    const p = this.cur;
    for (const x of this.ps) x.av.root.visible = x === p;
    const sp = this.spotPos();
    p.av.root.position.copy(sp);
    p.av.root.rotation.y = Math.atan2(-sp.x, -sp.z);
    // rack visual
    this.rack.clear();
    const side = new THREE.Vector3(-sp.z, 0, sp.x).normalize().multiplyScalar(0.9);
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 14, 10), new THREE.MeshToonMaterial({ map: this.ballTex, color: i === 4 ? '#ffd166' : '#ffffff' }));
      b.position.copy(sp).add(side).add(new THREE.Vector3(0, 0.5, 0)).addScaledVector(sp.clone().normalize(), (i - 2) * 0.26);
      this.rack.add(b);
    }
    banner(`${p.pl.name}`, `Posição ${this.spotIdx + 1}/${this.spots.length}`);
    this.hud.setActive(this.turn);
    this.later(1, () => this.readyShot());
  }

  readyShot() {
    if (this.over) return;
    this.state = 'ready';
    const p = this.cur;
    const money = this.shotIdx === 4;
    this.hud.center(`🏀 Posição ${this.spotIdx + 1}/${this.spots.length} · bola ${this.shotIdx + 1}/5 ${money ? '· ⭐ BOLA DE OURO (2 pts)' : ''}`);
    this.rack.children.forEach((b, i) => { b.visible = i > this.shotIdx; });
    const bp = this.handPos();
    this.bs = { p: bp, v: new THREE.Vector3(), money };
    if (p.pl.kind === 'human') this.hud.hint('Balance PARA CIMA para arremessar 🏀');
    else if (p.pl.kind === 'bot') { this.hud.hint(''); this.later(0.9, () => this.botShot()); }
    else { this.hud.hint(`Aguardando ${p.pl.name}…`); this.drainRemote('shot'); }
  }

  handPos() {
    const sp = this.spotPos();
    const toward = sp.clone().multiplyScalar(-1).normalize();
    return sp.clone().addScaledVector(toward, 0.35).setY(2.15);
  }

  humanShot(e) {
    const p = this.cur;
    if (this.state !== 'ready' || p.pl.kind !== 'human' || p.pl.slot !== e.slot) return;
    let pw = clamp(e.power, 0.1, 1.3);
    let factor = 1 + (pw - IDEAL_POWER) * 0.32;
    if (Math.abs(pw - IDEAL_POWER) < 0.12) factor = 1 + (pw - IDEAL_POWER) * 0.08; // zona boa: ajuda
    if (e.dy < -0.3) factor -= 0.08; // arremesso empurrado
    this.lastFeedback = pw - IDEAL_POWER;
    this.shoot({ factor, lateral: clamp(e.dx, -1, 1) * 0.05 + clamp(e.twist, -1, 1) * 0.015 });
  }

  botShot() {
    if (this.state !== 'ready') return;
    const err = { easy: [0.06, 0.03], medium: [0.035, 0.018], hard: [0.02, 0.01] }[this.difficulty];
    this.shoot({ factor: 1 + gauss() * err[0], lateral: gauss() * err[1] });
  }

  shoot(params) {
    const p = this.cur;
    this.state = 'flight';
    if (this.net && p.pl.kind === 'human') this.net.send({ k: 'shot', params });
    p.av.play('shoot', 1);
    this.hud.hint('');
    const from = this.handPos();
    const D = Math.hypot(RIM.x - from.x, RIM.z - from.z);
    const dh = RIM.y - from.y;
    const th = (52 * Math.PI) / 180;
    const v0 = Math.sqrt((G * D * D) / (2 * Math.cos(th) ** 2 * (D * Math.tan(th) - dh))) * params.factor;
    const yaw = Math.atan2(RIM.x - from.x, RIM.z - from.z) + params.lateral;
    this.bs = { p: from, v: new THREE.Vector3(Math.sin(yaw) * Math.cos(th) * v0, Math.sin(th) * v0, Math.cos(yaw) * Math.cos(th) * v0), money: this.shotIdx === 4, touched: false, scored: false, bounces: 0, t: 0 };
    this.audio.play('whoosh');
    this.trail.reset();
  }

  stepBall(dt) {
    const b = this.bs;
    const prevY = b.p.y;
    b.v.y -= G * dt;
    b.p.addScaledVector(b.v, dt);
    b.t += dt;
    // aro
    const dx = b.p.x - RIM.x, dz = b.p.z - RIM.z;
    const hd = Math.hypot(dx, dz) || 1e-6;
    const q = new THREE.Vector3(RIM.x + (dx / hd) * RIM_R, RIM.y, RIM.z + (dz / hd) * RIM_R);
    const d = b.p.clone().sub(q);
    const dist = d.length();
    if (dist < BALL_R + 0.018) {
      const n = d.normalize();
      const vn = b.v.dot(n);
      if (vn < 0) {
        b.v.addScaledVector(n, -(1 + 0.55) * vn);
        b.v.multiplyScalar(0.92);
        if (!b.rimSound || b.t - b.rimSound > 0.08) { this.audio.play('thunk', { vol: 0.6 }); b.rimSound = b.t; }
        b.touched = true;
      }
      b.p.copy(q).addScaledVector(n, BALL_R + 0.019);
    }
    // tabela
    if (b.p.z + BALL_R > BOARD_Z && b.p.z < BOARD_Z + 0.2 && Math.abs(b.p.x) < 0.9 && b.p.y > 2.9 && b.p.y < 3.95 && b.v.z > 0) {
      b.p.z = BOARD_Z - BALL_R;
      b.v.z *= -0.6;
      b.touched = true;
      this.audio.play('thunk', { pitch: 0.7, vol: 0.6 });
    }
    // cesta: atravessa o plano do aro descendo, por dentro
    if (!b.scored && prevY >= RIM.y && b.p.y < RIM.y && b.v.y < 0 && Math.hypot(b.p.x - RIM.x, b.p.z - RIM.z) < RIM_R - BALL_R * 0.25) {
      b.scored = true;
      this.netShake = 1;
    }
    if (b.p.y < BALL_R) {
      b.p.y = BALL_R;
      b.v.y = -b.v.y * 0.65;
      b.v.x *= 0.8;
      b.v.z *= 0.8;
      b.bounces++;
      this.audio.play('bounce', { pitch: 0.5, vol: 0.5 });
    }
  }

  endShot() {
    const p = this.cur;
    const b = this.bs;
    this.state = 'between';
    if (b.scored) {
      const pts = b.money ? 2 : 1;
      p.score += pts;
      p.made++;
      if (p === this.me) { this.ev('swish'); if (b.money) this.ev('moneyball'); }
      banner(b.touched ? (b.money ? 'BOLA DE OURO!' : 'CESTA!') : 'CHUÁ!', `+${pts}`);
      this.audio.play(b.touched ? 'point' : 'swish');
      this.audio.play('cheer', { vol: 0.6 });
      this.crowds.forEach((c) => c.cheer(0.8));
      if (!b.touched) this.fx.confetti(RIM.clone(), 40, 2);
    } else {
      this.audio.play('aww', { vol: 0.5 });
      if (p.pl.kind === 'human' && this.lastFeedback != null) {
        const f = this.lastFeedback;
        this.hud.hint(Math.abs(f) < 0.12 ? 'Quase! A força estava boa 👍' : f > 0 ? '⬇️ Forte demais: balance mais leve' : '⬆️ Fraco demais: balance mais forte');
      }
    }
    this.lastFeedback = null;
    this.ps.forEach((x, i) => this.hud.setScore(i, x.score));
    this.shotIdx++;
    this.later(b.scored ? 1 : 1.3, () => {
      if (this.shotIdx < 5) return this.readyShot();
      // próximo jogador / próxima posição
      this.turn++;
      if (this.turn >= this.ps.length) { this.turn = 0; this.spotIdx++; }
      if (this.spotIdx >= this.spots.length) return this.finish();
      this.beginRack();
    });
  }

  finish() {
    const scores = this.ps.map((p) => p.score);
    const mine = scores[this.me.i];
    const others = scores.filter((_, i) => i !== this.me.i);
    const best = Math.max(...scores);
    const won = mine === best && scores.filter((s) => s === best).length === 1;
    const draw = mine === best && !won;
    const winner = this.ps[scores.indexOf(best)];
    banner(won ? 'VITÓRIA!' : draw ? 'EMPATE!' : 'FIM DE JOGO', `${winner.pl.name}: ${best} pontos`);
    if (won) this.fx.confetti(RIM.clone());
    this.end({ won, draw, myScore: mine, oppScore: Math.max(...others), label: `${mine} x ${Math.max(...others)} pontos`, winnerName: winner.pl.name });
  }

  update(dt) {
    super.update(dt);
    if (this.state === 'flight') {
      for (let i = 0; i < 6; i++) this.stepBall(dt / 6);
      this.trail.push(this.bs.p);
      if (this.bs.bounces >= 2 || this.bs.t > 4 || (this.bs.scored && this.bs.p.y < 1)) this.endShot();
    }
    const p = this.cur;
    if (this.bs) {
      if (this.state === 'ready') this.bs.p.copy(p.av.root.position).add(new THREE.Vector3(0, 2.2, 0)).addScaledVector(this.spotPos().normalize(), -0.3);
      this.ballObj.mesh.position.copy(this.bs.p);
      this.ballObj.mesh.rotation.x -= dt * 6;
      this.ballObj.shadow.position.set(this.bs.p.x, 0.02, this.bs.p.z);
    }
    if (this.netShake) {
      this.netShake = Math.max(0, this.netShake - dt * 2);
      this.netMesh.scale.set(1 - this.netShake * 0.15, 1 + this.netShake * 0.3, 1 - this.netShake * 0.15);
      this.netMesh.position.y = RIM.y - 0.21 - this.netShake * 0.05;
    }
    for (const x of this.ps) {
      if (x === p && this.state === 'ready' && !x.av.swinging) {
        x.av.armMode.R = x.av.armMode.L = 'hold';
        x.av.setArmDir('R', new THREE.Vector3(-0.15, 0.6, 0.45), 2.2);
        x.av.setArmDir('L', new THREE.Vector3(0.25, 0.55, 0.45), 2.0);
      } else if (!x.av.swinging) x.av.armMode.R = x.av.armMode.L = 'idle';
      x.av.update(dt);
    }
    this.applyCamera(this.me.av);
    this.crowds.forEach((c) => c.update(dt));
    const sp = this.spotPos();
    const back = sp.clone().normalize();
    const camPos = sp.clone().addScaledVector(back, 3.4).add(new THREE.Vector3(0, 2.6, 0));
    const look = this.state === 'flight' ? this.bs.p.clone().lerp(RIM, 0.5) : RIM.clone().setY(2.6);
    this.world.setCamera(camPos, look, false, 3);
  }

  onNet(d) {
    if (d.k !== 'shot') return;
    if (this.cur.pl.kind !== 'remote' || this.state !== 'ready') return this.queueRemote(d);
    this.shoot(d.params);
  }
}

export function create(ctx) {
  if (ctx.online && !ctx.online.isHost) ctx.players.reverse();
  return new Basketball(ctx);
}
