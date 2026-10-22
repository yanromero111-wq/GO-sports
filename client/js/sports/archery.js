// Arco e flecha: segure PUXAR para esticar a corda, mire apontando o celular (ou mouse), solte para atirar.
// Vento lateral e queda da flecha com a distância. Alvo oficial de 10 anéis. Séries de 3 flechas.
import { SportBase, THREE, BOT, clamp, lerp, gauss } from './common.js';
import { makeBow } from '../engine/avatar.js';
import { toon, basic, canvasTexture } from '../engine/materials.js';
import { ground, tree, pine, hills, skyClouds } from '../engine/props.js';
import { banner, h } from '../ui/dom.js';

const GRAV = 9.8 * 0.2; // gravidade "de jogo" (miras de verdade compensam a queda)
const SPEED = 70;
const FACE_R = 0.61;
const TARGET_Y = 1.3;
const DISTS = [20, 30, 40, 50, 60, 70];
const EYE = new THREE.Vector3(0.3, 1.72, -0.95); // câmera sobre o ombro; a flecha sai da linha de mira
const RING_COLORS = ['#ffffff', '#ffffff', '#222222', '#222222', '#3a86ff', '#3a86ff', '#ef476f', '#ef476f', '#ffd166', '#ffd166'];

function rng(seed) { let s = seed >>> 0 || 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

class Archery extends SportBase {
  constructor(ctx) {
    super(ctx);
    this.nSeries = this.setup.length || 3;
    this.seed = this.net ? this.net.seed : Math.floor(Math.random() * 1e9);
    this.rand = rng(this.seed);
    this.buildRange();
    const bowItem = ctx.equip('bow');
    this.ps = this.players.map((pl, i) => {
      const bow = makeBow(i === 0 ? bowItem?.color : '#8d5524');
      const av = this.makeAvatar(pl);
      av.hold('L', bow);
      av.root.visible = false;
      return { pl, av, bow, i, score: 0, arrows: [] };
    });
    this.me = this.ps.find((p) => p.pl.kind === 'human' && p.pl.slot === 0) || this.ps[0];
    this.series = 0;
    this.turn = 0;
    this.arrowIdx = 0;
    this.state = 'idle';
    this.draw = 0;
    this.aim = { yaw: 0, pitch: 0, offY: 0, offP: 0 };
    this.arrowMeshes = [];
    this.reticle = this.hud.block('reticle', h('div.reticle', { style: { left: '50%', top: '50%', display: 'none' } }));
    this.hud.scoreboard(this.ps.map((p) => ({ name: p.pl.name, color: p.pl.color, score: 0 })), { allLeft: this.ps.length > 2 });
    this.on('action', (e) => { if (e.id === 'draw') this.drawInput(e.slot, e.down); });
    // (no modo câmera o "soltar" é juntar as mãos; movimentos rápidos dos braços não disparam a flecha)
    this.on('swing', (e) => { if (e.source !== 'camera' && this.drawing && this.cur.pl.slot === e.slot) this.drawInput(e.slot, false); });
    this.on('pointer', (e) => {
      if (this.state !== 'aim' || this.cur.pl.kind !== 'human' || this.cur.pl.slot !== e.slot) return;
      this.aim.offY -= e.dx * 0.0006;
      this.aim.offP -= e.dy * 0.0006;
    });
    this.on('button', (e) => {
      if (!e.down || this.state !== 'aim' || this.cur.pl.slot !== e.slot) return;
      const m = { left: [0.004, 0], right: [-0.004, 0], up: [0, 0.004], down: [0, -0.004] }[e.id];
      if (m) { this.aim.offY += m[0]; this.aim.offP += m[1]; }
      if (e.id === 'A') this.drawInput(e.slot, !this.drawing);
    });
  }

  buildRange() {
    const t = this.theme;
    const g = this.root;
    this.world.setShadowArea(new THREE.Vector3(0, 0, 10), 20);
    this.world.setFog(90, 400);
    ground(g, t.ground || '#7cc576');
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(6, 90), toon(shadeHex(t.ground || '#7cc576', 1.1)));
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, 0.01, 40);
    g.add(lane);
    for (const d of DISTS) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.08), basic('#ffffff', { transparent: true, opacity: 0.6 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, 0.02, d);
      g.add(m);
    }
    // alvo
    const face = canvasTexture(512, 512, (c, w) => {
      for (let i = 0; i < 10; i++) {
        c.beginPath();
        c.arc(w / 2, w / 2, (w / 2) * (1 - i / 10), 0, Math.PI * 2);
        c.fillStyle = RING_COLORS[i];
        c.fill();
        c.strokeStyle = i === 2 || i === 3 ? '#ffffff' : '#222';
        c.lineWidth = 2;
        c.stroke();
      }
      c.beginPath(); c.arc(w / 2, w / 2, (w / 2) * 0.05, 0, Math.PI * 2); c.strokeStyle = '#222'; c.stroke();
    });
    this.target = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(FACE_R, 48), new THREE.MeshBasicMaterial({ map: face }));
    disc.rotation.y = Math.PI;
    this.target.add(disc);
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(FACE_R + 0.06, FACE_R + 0.06, 0.25, 32), toon('#e9c46a'));
    boss.rotation.x = Math.PI / 2;
    boss.position.z = 0.13;
    this.target.add(boss);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.7, 6), toon('#8d5524'));
      leg.position.set(s * 0.45, -0.5, 0.3);
      leg.rotation.x = 0.25;
      this.target.add(leg);
    }
    this.target.position.y = TARGET_Y;
    g.add(this.target);
    // bandeira de vento
    this.flag = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), toon('#ef476f', { side: THREE.DoubleSide }));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4, 6), toon('#ffffff'));
    pole.position.set(-3.5, 2, 15);
    g.add(pole);
    this.flag.position.set(-3, 3.7, 15);
    g.add(this.flag);
    if (t.trees) for (let i = 0; i < 30; i++) { const tr = i % 2 ? pine(2 + Math.random()) : tree(1.8 + Math.random(), '#2f8f4f'); tr.position.set((i % 2 ? -1 : 1) * (7 + Math.random() * 12), 0, -5 + i * 3.5); g.add(tr); }
    else for (let i = 0; i < 10; i++) { const tr = tree(2, '#56c271'); tr.position.set((i % 2 ? -1 : 1) * (14 + Math.random() * 8), 0, i * 9); g.add(tr); }
    hills(g, t.moving ? '#c96f45' : '#6cc06c', 180, 14);
    this.world.updaters.add(skyClouds(g, 8, 50, 150));
  }

  start() {
    super.start();
    this.audio.play('bell');
    this.beginSeries();
  }

  get cur() { return this.ps[this.turn]; }
  get dist() { return DISTS[Math.min(DISTS.length - 1, this.series % DISTS.length)]; }

  beginSeries() {
    if (this.over) return;
    const maxWind = (this.theme.wind || 1) * 1.2;
    this.wind = (this.rand() - 0.5) * 2 * maxWind;
    this.moving = !!this.theme.moving && !this.net;
    this.target.position.set(0, TARGET_Y, this.dist);
    for (const a of this.arrowMeshes) a.parent?.remove(a);
    this.arrowMeshes = [];
    banner(`Série ${this.series + 1}/${this.nSeries}`, `${this.dist} m · vento ${Math.abs(this.wind).toFixed(1)} m/s ${this.wind > 0 ? '⬅️' : '➡️'}`);
    this.hud.wind(`🌬️ ${this.wind > 0 ? '⬅️' : '➡️'} ${Math.abs(this.wind).toFixed(1)} m/s`);
    this.later(1.5, () => this.beginTurn());
  }

  beginTurn() {
    if (this.over) return;
    this.arrowIdx = 0;
    const p = this.cur;
    for (const x of this.ps) x.av.root.visible = x === p;
    this.hud.setActive(this.turn);
    this.aim = { yaw: 0, pitch: 0.012 * (this.dist / 30), offY: 0, offP: 0 };
    this.readyArrow();
  }

  readyArrow() {
    this.state = 'aim';
    this.draw = 0;
    this.drawing = false;
    this.holdT = 0;
    const p = this.cur;
    this.hud.center(`🏹 ${p.pl.name} · flecha ${this.arrowIdx + 1}/3 · ${this.dist} m`);
    if (p.pl.kind === 'human') {
      this.hud.hint('Segure PUXAR (botão direito / F), mire e solte! Mire um pouco acima e contra o vento.');
      this.vibrate(p.pl.slot, 30);
    } else if (p.pl.kind === 'bot') {
      this.hud.hint(`${p.pl.name} está mirando…`);
      this.drawing = true;
      this.later(1.6 + Math.random(), () => this.botShoot());
    } else { this.hud.hint(`Aguardando ${p.pl.name}…`); this.drainRemote('arrow'); }
  }

  drawInput(slot, down) {
    const p = this.cur;
    if (this.state !== 'aim' || p.pl.kind !== 'human' || p.pl.slot !== slot) return;
    if (down) {
      this.drawing = true;
      this.holdT = 0;
      this.audio.play('whoosh', { pitch: 0.6, vol: 0.4 });
    } else if (this.drawing) {
      this.drawing = false;
      if (this.draw < 0.25) { this.draw = 0; return; }
      const dir = this.aimDir();
      this.release({ dx: dir.x, dy: dir.y, dz: dir.z, speed: SPEED * (0.55 + 0.45 * this.draw) });
    }
  }

  aimDir() {
    const yaw = this.aim.yaw + this.aim.offY;
    const pitch = this.aim.pitch + this.aim.offP;
    return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).normalize();
  }

  botShoot() {
    if (this.state !== 'aim') return;
    const k = BOT[this.difficulty];
    const err = { easy: 0.3, medium: 0.15, hard: 0.07 }[this.difficulty] * (this.dist / 50);
    // mira compensando gravidade e parte do vento
    const T = this.dist / SPEED;
    const tgt = new THREE.Vector3(gauss() * err - 0.5 * this.wind * T * T * k.aim, TARGET_Y + 0.5 * GRAV * T * T + gauss() * err, this.dist);
    const from = this.launchPos();
    const dir = tgt.sub(from).normalize();
    this.release({ dx: dir.x, dy: dir.y, dz: dir.z, speed: SPEED });
  }

  launchPos() { return EYE.clone().addScaledVector(this.aimDir(), 1.2); }

  release(params) {
    this.state = 'flight';
    this.drawing = false;
    const p = this.cur;
    if (this.net && p.pl.kind === 'human') this.net.send({ k: 'arrow', params });
    this.hud.hint('');
    this.audio.play('arrow');
    this.vibrate(p.pl.kind === 'human' ? p.pl.slot : null, 50);
    const mesh = this.makeArrow();
    this.arrowMeshes.push(mesh);
    this.root.add(mesh);
    this.arrow = { p: this.launchPos(), v: new THREE.Vector3(params.dx, params.dy, params.dz).multiplyScalar(params.speed), mesh, t: 0 };
    this.draw = 0;
  }

  makeArrow() {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.75, 5), toon('#8d5524'));
    shaft.rotation.x = Math.PI / 2;
    g.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 6), toon('#adb5bd'));
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.4;
    g.add(tip);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.1), toon(this.cur.pl.color, { side: THREE.DoubleSide }));
      f.position.z = -0.32;
      f.rotation.set(0, Math.PI / 2, (i / 3) * Math.PI);
      g.add(f);
    }
    return g;
  }

  stepArrow(dt) {
    const a = this.arrow;
    const prevZ = a.p.z;
    a.v.y -= GRAV * dt;
    a.v.x -= this.wind * dt * 0.5;
    a.p.addScaledVector(a.v, dt);
    a.t += dt;
    const tz = this.target.position.z;
    if (prevZ < tz && a.p.z >= tz) {
      const lx = a.p.x - this.target.position.x, ly = a.p.y - TARGET_Y;
      const r = Math.hypot(lx, ly);
      if (r <= FACE_R + 0.06) {
        a.p.z = tz - 0.02;
        return this.hitTarget(r);
      }
    }
    if (a.p.y < 0.02 || a.t > 4) return this.hitTarget(99);
  }

  hitTarget(r) {
    const p = this.cur;
    const a = this.arrow;
    this.state = 'between';
    let pts = 0;
    if (r <= FACE_R) pts = Math.max(1, 10 - Math.floor(r / (FACE_R / 10)));
    if (r < 99 && r <= FACE_R + 0.06) {
      a.stuck = true;
      this.audio.play('thunk');
      this.fx.burst(a.p, '#e9c46a', 6, 1, 0.05);
    } else this.audio.play('aww', { vol: 0.4 });
    p.score += pts;
    p.arrows.push(pts);
    const x = r < FACE_R / 20;
    if (pts === 10) {
      banner(x ? 'NA MOSCA! ✖' : '10!', 'Perfeito!');
      this.audio.play('fanfare');
      if (p === this.me) this.ev('bullseye');
      this.fx.confetti(a.p.clone(), 50, 2);
    } else banner(pts ? String(pts) : 'ERROU', pts >= 8 ? 'Ótimo!' : pts >= 5 ? 'Bom' : '');
    if (pts >= 8) this.audio.play('point');
    this.ps.forEach((x, i) => this.hud.setScore(i, x.score));
    this.later(1.6, () => {
      this.arrowIdx++;
      if (this.arrowIdx < 3) return this.readyArrow();
      this.turn++;
      if (this.turn >= this.ps.length) {
        this.turn = 0;
        this.series++;
        if (this.series >= this.nSeries) return this.finish();
        return this.beginSeries();
      }
      this.beginTurn();
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
    if (won) this.fx.confetti(new THREE.Vector3(0, 2, 3));
    this.end({ won, draw, myScore: mine, oppScore: Math.max(...others), label: `${mine} x ${Math.max(...others)} pontos`, winnerName: winner.pl.name });
  }

  update(dt) {
    super.update(dt);
    const p = this.cur;
    // mira: orientação do celular (ou mouse) + ajuste fino do touchpad
    if (this.state === 'aim' && p.pl.kind === 'human') {
      const cam = this.app.camera;
      const useArm = this.cameraMode && cam?.seen && p.pl.slot === 0;
      // modo câmera: afastar as mãos com o braço do arco esticado = puxar; juntar = soltar
      if (useArm && cam.drawing !== this.drawing) this.drawInput(0, cam.drawing);
      const o = useArm ? cam.armAim : this.input.orient(p.pl.slot);
      const sens = useArm ? 0.35 : 0.22; // braço esquerdo esticado aponta a mira
      this.holdT += dt;
      const tremor = this.drawing ? Math.max(0, this.holdT - 3) * 0.002 + 0.0006 : 0;
      this.aim.yaw = lerp(this.aim.yaw, clamp(o.y * sens, -0.25, 0.25) + Math.sin(this.time * 7) * tremor, Math.min(1, dt * 10));
      this.aim.pitch = lerp(this.aim.pitch, clamp(o.p * sens, -0.15, 0.25) + Math.cos(this.time * 5) * tremor, Math.min(1, dt * 10));
    }
    if (this.drawing) this.draw = Math.min(1, this.draw + dt / 0.8);
    if (this.moving && this.state !== 'between') this.target.position.x = Math.sin(this.time * 0.8) * 1.6;
    if (this.state === 'flight') {
      for (let i = 0; i < 4 && this.state === 'flight'; i++) this.stepArrow(dt / 4);
    }
    if (this.arrow && this.arrow.mesh) {
      const a = this.arrow;
      a.mesh.position.copy(a.p);
      if (!a.stuck) a.mesh.lookAt(a.p.clone().add(a.v));
      else if (!a.followTarget) { a.followTarget = true; this.target.attach(a.mesh); }
    }
    this.flag.rotation.y = this.wind > 0 ? 0 : Math.PI;
    this.flag.scale.x = 0.5 + Math.abs(this.wind) * 0.2 + Math.sin(this.time * 8) * 0.05;

    // avatar
    const dir = this.aimDir();
    if (p) {
      p.av.root.position.set(-0.5, 0, 0);
      p.av.root.rotation.y = Math.atan2(dir.x, dir.z) - 0.05;
      p.av.armMode.L = p.av.armMode.R = 'hold';
      p.av.setArmDir('L', new THREE.Vector3(0.05, dir.y * 3 + 0.12, 1), 0.05, 0);
      const d = this.draw;
      p.av.setArmDir('R', new THREE.Vector3(-0.15, 0.25 + dir.y, 1 - d * 0.6), 0.4 + d * 2.1, 0);
      p.bow.userData.setDraw?.(this.state === 'aim' ? d : 0);
      p.av.update(dt);
    }
    this.applyCamera(this.me.av);
    const aiming = this.state === 'aim';
    this.reticle.style.display = aiming && p.pl.kind === 'human' ? 'block' : 'none';
    this.reticle.style.transform = `scale(${1 + (1 - this.draw) * 0.6})`;
    // câmera
    if (this.state === 'flight' && this.arrow) {
      const a = this.arrow.p;
      this.world.setCamera(a.clone().add(new THREE.Vector3(0.3, 0.35, -2.2)), a.clone().add(new THREE.Vector3(0, 0, 6)), false, 8);
    } else if (this.state === 'between') {
      const tp = this.target.position;
      this.world.setCamera(new THREE.Vector3(tp.x + 0.6, TARGET_Y + 0.3, tp.z - 2.6), new THREE.Vector3(tp.x, TARGET_Y, tp.z), false, 3);
    } else {
      this.world.setCamera(EYE, EYE.clone().addScaledVector(dir, 30), true);
    }
  }

  onNet(d) {
    if (d.k !== 'arrow') return;
    if (this.cur.pl.kind !== 'remote' || this.state !== 'aim') return this.queueRemote(d);
    this.release(d.params);
  }
}

function shadeHex(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

export function create(ctx) {
  if (ctx.online && !ctx.online.isHost) ctx.players.reverse();
  return new Archery(ctx);
}
