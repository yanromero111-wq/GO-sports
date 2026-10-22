// Beisebol: rebater (tempo do balanço) e arremessar (mira + efeito). Entradas alternadas, bases e corridas.
// Online: o rebatedor é a autoridade do resultado de cada arremesso.
import { SportBase, THREE, BOT, clamp, lerp, rand, gauss } from './common.js';
import { Avatar, makeBat, botProfile } from '../engine/avatar.js';
import { toon, basic } from '../engine/materials.js';
import { ground, crowd, lightPole, skyClouds, tree } from '../engine/props.js';
import { Trail } from '../engine/fx.js';
import { banner, h } from '../ui/dom.js';

const MOUND_Z = 18.4;
const G = 9.8;
const FENCE = 98;
const ZONE = { x: 0.28, y0: 0.5, y1: 1.15 };

class Baseball extends SportBase {
  constructor(ctx) {
    super(ctx);
    this.innings = this.setup.length || 2;
    this.buildField();
    const batItem = ctx.equip('bat');
    this.ballObj = this.ball(0.05, '#ffffff', 14);
    this.trail = new Trail(this.root, '#ffffff', 16, 0.05);
    // jogadores: 0 = você, 1 = rival. Cada um tem rebatedor e arremessador (mesmo avatar).
    this.teams = [0, 1].map((i) => {
      const pl = this.players[i];
      const batter = this.makeAvatar(pl, makeBat(i === 0 ? batItem?.color : '#c68642'));
      const pitcher = new Avatar(pl.avatar);
      pitcher.setRingColor(pl.color, 0.4);
      this.root.add(pitcher.root);
      return { pl, batter, pitcher, runs: 0 };
    });
    // defensores decorativos
    this.fielders = [[-14, 30], [14, 30], [0, 50], [-30, 70], [0, 82], [30, 70]].map(([x, z], i) => {
      const a = new Avatar(botProfile(i * 31 + 5).avatar);
      a.root.position.set(x, 0, z);
      a.root.rotation.y = Math.PI;
      this.root.add(a.root);
      return { av: a, home: new THREE.Vector3(x, 0, z), target: null };
    });
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.11, 20), basic('#ffd166', { transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    this.root.add(this.reticle);
    this.zoneBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(ZONE.x * 2, ZONE.y1 - ZONE.y0)), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45 }));
    this.zoneBox.position.set(0, (ZONE.y0 + ZONE.y1) / 2, 0.1);
    this.root.add(this.zoneBox);

    this.inning = 0;
    this.half = 0; // 0 = primeira metade
    this.firstBat = this.net ? (this.net.isHost ? 0 : 1) : 0;
    this.outs = 0;
    this.pbs = 0;
    this.strikes = 0;
    this.bases = [false, false, false];
    this.state = 'idle';
    this.aimP = { x: 0, y: 0.85 };
    this.hud.scoreboard(this.teams.map((t) => ({ name: t.pl.name, color: t.pl.color, score: 0 })));
    this.countEl = this.hud.block('count', h('div.count'));
    this.diamond = this.hud.block('diamond', h('div.diamond', {}, ...[[45, 0], [0, 45], [45, 90]].map(() => h('div.base'))));
    [...this.diamond.children].forEach((b, i) => Object.assign(b.style, [{ left: '84px', top: '44px' }, { left: '44px', top: '4px' }, { left: '4px', top: '44px' }][i]));

    this.on('swing', (e) => this.humanSwing(e));
    this.on('pointer', (e) => this.aimInput(e.slot, e.dx * 0.002, -e.dy * 0.002));
    this.on('button', (e) => {
      if (!e.down) return;
      const m = { left: [-0.06, 0], right: [0.06, 0], up: [0, 0.06], down: [0, -0.06] }[e.id];
      if (m) this.aimInput(e.slot, m[0], m[1]);
    });
  }

  buildField() {
    const t = this.theme;
    const g = this.root;
    this.world.setShadowArea(new THREE.Vector3(0, 0, 10), 25);
    this.world.setFog(150, 600);
    ground(g, t.ground || '#4caf50');
    // stripes no gramado
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(new THREE.RingGeometry(20 + i * 10, 25 + i * 10, 40, 1, -Math.PI * 0.75, Math.PI / 2), toon(shade(t.ground || '#4caf50', 1.08)));
      s.rotation.x = -Math.PI / 2;
      s.rotation.z = 0;
      s.position.y = 0.005;
      g.add(s);
    }
    const dirt = toon(t.dirt || '#c98b4f');
    const infield = new THREE.Mesh(new THREE.CircleGeometry(29, 40, -Math.PI * 0.75, Math.PI / 2), dirt);
    infield.rotation.x = -Math.PI / 2;
    infield.rotation.z = 0;
    infield.position.y = 0.01;
    g.add(infield);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(19, 19), toon(t.ground || '#4caf50'));
    grass.rotation.x = -Math.PI / 2;
    grass.rotation.z = Math.PI / 4;
    grass.position.set(0, 0.015, 13.5);
    g.add(grass);
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.9, 0.25, 20), dirt);
    mound.position.set(0, 0.12, MOUND_Z);
    g.add(mound);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 5), basic('#ffffff'));
    plate.position.set(0, 0.02, 0);
    g.add(plate);
    const box = new THREE.Mesh(new THREE.CircleGeometry(4, 24), dirt);
    box.rotation.x = -Math.PI / 2;
    box.position.set(0, 0.012, 0);
    g.add(box);
    for (const [x, z] of [[19.4, 19.4], [0, 27.4], [-19.4, 19.4]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.4), basic('#ffffff'));
      b.position.set(x === 0 ? 0 : x * 0.707, 0.05, z === 27.4 ? 27.4 : 19.4 * 0.707);
      b.rotation.y = Math.PI / 4;
      g.add(b);
    }
    // linhas de falta
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 140), basic('#ffffff'));
      l.rotation.x = -Math.PI / 2;
      l.rotation.z = -s * Math.PI / 4;
      l.position.set(-s * 49.5, 0.02, 49.5);
      g.add(l);
    }
    // muro do campo
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(FENCE + 2, FENCE + 2, 3, 48, 1, true, -Math.PI / 4, Math.PI / 2), toon('#1f6f4a', { side: THREE.DoubleSide }));
    wall.position.y = 1.5;
    wall.rotation.y = 0;
    g.add(wall);
    const wallTop = new THREE.Mesh(new THREE.TorusGeometry(FENCE + 2, 0.12, 6, 48, Math.PI / 2), toon('#ffd166'));
    wallTop.rotation.x = Math.PI / 2;
    wallTop.rotation.z = Math.PI / 4;
    wallTop.position.y = 3;
    g.add(wallTop);
    // rede atrás do home
    const backstop = new THREE.Mesh(new THREE.PlaneGeometry(14, 6, 14, 6), new THREE.MeshBasicMaterial({ color: '#333', wireframe: true }));
    backstop.position.set(0, 3, -7);
    g.add(backstop);
    this.crowds = [];
    if (t.stands) {
      for (const [x, z, r] of [[-40, 50, Math.PI * 0.75], [40, 50, -Math.PI * 0.75], [0, 112, Math.PI]]) this.crowds.push(crowd(g, { width: 40, rows: 6, x, z, rotY: r }));
    } else {
      for (let i = 0; i < 16; i++) {
        const a = Math.PI / 4 + (i / 15) * (Math.PI / 2);
        const tr = tree(2.5, '#3fae5a');
        tr.position.set(Math.cos(a) * 112, 0, Math.sin(a) * 112);
        g.add(tr);
      }
      this.world.updaters.add(skyClouds(g, 8, 60, 160));
    }
    if (t.night) for (const [x, z] of [[-45, 20], [45, 20], [-60, 80], [60, 80]]) lightPole(g, x, z, 24);
  }

  start() {
    super.start();
    this.audio.play('whistle');
    banner('BEISEBOL', `${this.innings} entrada${this.innings > 1 ? 's' : ''}`);
    this.later(1.4, () => this.startHalf());
  }

  get battingTeam() { return this.half === 0 ? this.firstBat : 1 - this.firstBat; }
  get iBat() { return this.battingTeam === 0; }

  startHalf() {
    if (this.over) return;
    this.outs = 0;
    this.bases = [false, false, false];
    this.resetCount();
    const bat = this.teams[this.battingTeam];
    banner(`${this.inning + 1}ª entrada`, `${bat.pl.name} rebate`);
    this.later(1.4, () => this.nextPitch());
  }

  resetCount() { this.pbs = 0; this.strikes = 0; this.updateHud(); }

  updateHud() {
    this.teams.forEach((t, i) => this.hud.setScore(i, t.runs));
    this.hud.setActive(this.battingTeam);
    this.countEl.innerHTML = `Entrada ${this.inning + 1}/${this.innings} ${this.half ? '▼' : '▲'}<br>B ${'●'.repeat(this.pbs)}${'○'.repeat(Math.max(0, 3 - this.pbs))} · S ${'●'.repeat(this.strikes)}${'○'.repeat(Math.max(0, 2 - this.strikes))}<br>Eliminados ${'●'.repeat(this.outs)}${'○'.repeat(Math.max(0, 2 - this.outs))}`;
    [...this.diamond.children].forEach((b, i) => b.classList.toggle('on', this.bases[i]));
  }

  nextPitch() {
    if (this.over) return;
    this.state = 'ready';
    this.pb = null;
    this.pitchSent = false;
    for (const f of this.fielders) f.target = null;
    const bat = this.teams[this.battingTeam];
    const pit = this.teams[1 - this.battingTeam];
    this.hud.center(`⚾ ${bat.pl.name} rebatendo`);
    if (pit.pl.kind === 'human') {
      this.hud.hint('🎯 Mire com o touchpad/setas e balance para arremessar (gire o pulso para curvar)');
      this.vibrate(pit.pl.slot, 40);
    } else if (pit.pl.kind === 'bot') {
      this.hud.hint(bat.pl.kind === 'human' ? '⚾ Prepare-se… balance quando a bola chegar!' : '');
      this.later(1.2 + rand(0, 0.8), () => this.botPitch());
    } else { this.hud.hint('⚾ Prepare-se… o rival vai arremessar'); this.drainRemote('pitch'); }
  }

  aimInput(slot, dx, dy) {
    const pit = this.teams[1 - this.battingTeam];
    if (this.state !== 'ready' || pit.pl.kind !== 'human' || pit.pl.slot !== slot) return;
    this.aimP.x = clamp(this.aimP.x + dx, -0.55, 0.55); // câmera atrás do arremessador: +X = direita da tela
    this.aimP.y = clamp(this.aimP.y + dy, 0.25, 1.45);
  }

  botPitch() {
    if (this.state !== 'ready') return;
    const k = BOT[this.difficulty];
    const strike = Math.random() < 0.62 + k.aim * 0.15;
    const x = strike ? rand(-ZONE.x, ZONE.x) * 0.9 : (Math.random() < 0.5 ? -1 : 1) * rand(0.36, 0.55);
    const y = strike ? rand(ZONE.y0, ZONE.y1) : rand(0.2, 1.4);
    const speed = { easy: rand(22, 26), medium: rand(25, 30), hard: rand(28, 34) }[this.difficulty];
    this.pitch({ x, y, speed, curve: gauss() * 3 * k.aim });
  }

  // Lança a bola do monte até (x, y) na base. curve = aceleração lateral (m/s²).
  pitch(p) {
    this.state = 'pitch';
    const pit = this.teams[1 - this.battingTeam];
    pit.pitcher.play('pitch', 1);
    this.hud.hint('');
    const from = new THREE.Vector3(-0.3, 1.9, MOUND_Z - 1);
    const T = (MOUND_Z - 1) / p.speed;
    const v = new THREE.Vector3((p.x - from.x) / T - 0.5 * p.curve * T, (p.y - from.y + 0.5 * G * T * T) / T, -p.speed);
    this.pb = { p: from.clone(), v, curve: p.curve, mode: 'pitch', target: p, swung: false };
    this.pitchParams = p;
    this.audio.play('whoosh', { pitch: 1.2 });
    if (this.net && pit.pl.kind === 'human') this.net.send({ k: 'pitch', p });
    this.trail.reset();
  }

  humanSwing(e) {
    const bat = this.teams[this.battingTeam];
    const pit = this.teams[1 - this.battingTeam];
    if (pit.pl.kind === 'human' && pit.pl.slot === e.slot && this.state === 'ready') {
      const x = this.aimP.x + e.dx * 0.12;
      const y = this.aimP.y + e.dy * 0.08;
      return this.pitch({ x, y, speed: lerp(22, 36, clamp(e.power, 0, 1.2) / 1.2), curve: clamp(e.twist, -1, 1) * 7 });
    }
    if (bat.pl.kind !== 'human' || bat.pl.slot !== e.slot) return;
    bat.batter.play('bat', 1.3);
    this.audio.play('whoosh');
    if (this.state !== 'pitch' || this.pb?.swung) return;
    this.pb.swung = true;
    const z = this.pb.p.z;
    const ideal = 0.4;
    const t = z > ideal ? (z - ideal) / 2.6 : (z - ideal) / 1.2; // >0 cedo
    const p = this.pb.p;
    const reachable = Math.abs(p.x) < 0.6 && p.y > 0.2 && p.y < 1.5;
    if (z > 3.5 || z < -0.9 || !reachable || Math.abs(t) > 0.9) return; // errou
    this.contact(t, e.power, e.dy);
  }

  // Contato do taco com a bola: decide direção, velocidade e ângulo.
  contact(t, power, dy = 0) {
    const q = clamp(1 - Math.abs(t), 0, 1);
    const spray = clamp(t * 55 + gauss() * 8 * (1.2 - q), -75, 75) * (Math.PI / 180);
    const ev = lerp(14, 35.5, clamp(clamp(power, 0, 1.2) * 0.5 + q * 0.5, 0, 1.1));
    const la = clamp(12 + dy * 14 + (q - 0.55) * 30 + gauss() * 7, -15, 55) * (Math.PI / 180);
    this.hitBall({ spray, ev, la });
  }

  hitBall(r) {
    const b = this.pb;
    this.state = 'hit';
    b.mode = 'fly';
    b.v.set(Math.sin(r.spray) * Math.cos(r.la) * r.ev, Math.sin(r.la) * r.ev, Math.cos(r.spray) * Math.cos(r.la) * r.ev);
    b.p.set(0.3, 0.9, 0.4);
    b.curve = 0;
    this.audio.play('bat');
    this.world.addShake(0.2);
    this.fx.burst(b.p, '#ffffff', 10, 3, 0.08);
    const bat = this.teams[this.battingTeam];
    if (bat.pl.kind === 'human') this.vibrate(bat.pl.slot, 80);
    // resultado calculado já (física sem arrasto => alcance analítico)
    const range = (r.ev * r.ev * Math.sin(2 * Math.max(0.02, r.la))) / G;
    const land = new THREE.Vector3(Math.sin(r.spray) * range, 0, Math.cos(r.spray) * range);
    this.landing = land;
    const fielder = this.fielders.reduce((a, f) => (f.home.distanceTo(land) < a.home.distanceTo(land) ? f : a));
    fielder.target = land.clone();
    let out;
    const deg = Math.abs(r.spray) * (180 / Math.PI);
    const laDeg = r.la * (180 / Math.PI);
    if (deg > 45) out = { kind: 'foul' };
    else if (range > FENCE + 6 && laDeg > 14) out = { kind: 'hr' };
    else if (laDeg < 8) out = Math.random() < 0.72 - (r.ev - 25) * 0.02 ? { kind: 'out', how: 'ground' } : { kind: 'hit', bases: 1 };
    else if (laDeg < 25) out = Math.random() < 0.5 ? { kind: 'out', how: 'line' } : { kind: 'hit', bases: range > 78 ? 2 : 1 };
    else out = range < 85 ? (Math.random() < 0.9 ? { kind: 'out', how: 'fly' } : { kind: 'hit', bases: 1 }) : Math.random() < 0.62 ? { kind: 'out', how: 'fly' } : { kind: 'hit', bases: range > 92 && Math.random() < 0.3 ? 3 : 2 };
    out.range = Math.round(range);
    this.pendingResult = out;
    this.hitT = 0;
    this.hitDur = clamp((2 * r.ev * Math.sin(Math.max(0.05, r.la))) / G, 0.6, 5.5);
    if (this.net && bat.pl.kind === 'human') this.net.send({ k: 'hit', r, out });
  }

  // Resolve arremesso não rebatido.
  pitchArrived() {
    const p = this.pb.target;
    const inZone = Math.abs(this.pb.p.x) <= ZONE.x + 0.04 && this.pb.p.y >= ZONE.y0 - 0.04 && this.pb.p.y <= ZONE.y1 + 0.04;
    const bat = this.teams[this.battingTeam];
    // bot rebatedor decide aqui se não decidiu antes
    if (this.pb.swung) this.applyResult({ kind: 'strike', swing: true });
    else this.applyResult(inZone ? { kind: 'strike' } : { kind: 'ball' });
  }

  applyResult(out) {
    if (this.state === 'result') return;
    const bat = this.teams[this.battingTeam];
    // Online: quem rebate decide; o arremessador só aplica o que chegar pela rede.
    if (this.net && bat.pl.kind === 'remote' && !this.applyingRemote) return;
    if (this.net && bat.pl.kind === 'human') this.net.send({ k: 'result', out });
    this.state = 'result';
    const mine = bat.pl.kind === 'human' && bat.pl.slot === 0;
    let msg = '', sub = '';
    let walk = false;
    switch (out.kind) {
      case 'ball':
        this.pbs++;
        msg = 'BOLA';
        if (this.pbs >= 4) { walk = true; msg = 'BASE POR BOLAS'; }
        break;
      case 'strike':
        this.strikes++;
        msg = out.swing ? 'ERROU!' : 'STRIKE!';
        if (this.strikes >= 3) { this.outs++; msg = 'STRIKEOUT!'; this.resetCount(); }
        break;
      case 'foul':
        if (this.strikes < 2) this.strikes++;
        msg = 'FALTA';
        sub = `${out.range} m`;
        break;
      case 'out':
        this.outs++;
        msg = { ground: 'ELIMINADO NA 1ª', line: 'PEGOU NO AR!', fly: 'PEGOU NO AR!' }[out.how] || 'ELIMINADO';
        sub = `${out.range} m`;
        this.resetCount();
        break;
      case 'hit': {
        const n = out.bases;
        msg = ['', 'SIMPLES!', 'DUPLA!', 'TRIPLA!'][n];
        sub = `${out.range} m`;
        this.advance(n, true);
        this.resetCount();
        break;
      }
      case 'hr':
        msg = 'HOME RUN!';
        sub = `${out.range} m 🎆`;
        this.advance(4, true);
        if (mine) this.ev('homerun');
        this.fx.confetti(new THREE.Vector3(0, 3, 4));
        this.resetCount();
        break;
    }
    if (walk) { this.advance(1, false); this.resetCount(); }
    banner(msg, sub);
    const good = (out.kind === 'hit' || out.kind === 'hr' || walk) === (bat.pl.kind === 'human' && bat.pl.slot === 0) || (out.kind === 'strike' || out.kind === 'out') && bat.pl.kind !== 'human';
    this.audio.play(out.kind === 'hr' ? 'fanfare' : good ? 'point' : 'aww');
    if (out.kind === 'hr' || out.kind === 'hit') this.crowds.forEach((c) => c.cheer(1));
    this.updateHud();
    if (this.outs >= 3) return this.later(1.8, () => this.endHalf());
    this.later(out.kind === 'hit' || out.kind === 'hr' || out.kind === 'out' ? 2.4 : 1.4, () => this.nextPitch());
  }

  advance(n, batterRuns) {
    const bat = this.teams[this.battingTeam];
    let runs = 0;
    if (!batterRuns) {
      // base por bolas: só avançam os forçados
      if (this.bases[0]) { if (this.bases[1]) { if (this.bases[2]) runs++; this.bases[2] = true; } this.bases[1] = true; }
      this.bases[0] = true;
    } else {
      for (let i = 2; i >= 0; i--) {
        if (!this.bases[i]) continue;
        this.bases[i] = false;
        if (i + n >= 3) runs++;
        else this.bases[i + n] = true;
      }
      if (n >= 4) runs++;
      else this.bases[n - 1] = true;
    }
    if (runs) { bat.runs += runs; this.later(0.6, () => banner(`+${runs} corrida${runs > 1 ? 's' : ''}!`)); }
  }

  endHalf() {
    if (this.half === 0) { this.half = 1; return this.startHalf(); }
    this.half = 0;
    this.inning++;
    if (this.inning >= this.innings) return this.finish();
    this.startHalf();
  }

  finish() {
    const a = this.teams[0].runs, b = this.teams[1].runs;
    const won = a > b;
    const draw = a === b;
    banner(won ? 'VITÓRIA!' : draw ? 'EMPATE!' : 'FIM DE JOGO', `${a} x ${b}`);
    if (won) this.fx.confetti(new THREE.Vector3(0, 3, 2));
    this.end({ won, draw, myScore: a, oppScore: b, label: `${a} x ${b} corridas`, winnerName: this.teams[won ? 0 : 1].pl.name });
  }

  update(dt) {
    super.update(dt);
    const bat = this.teams[this.battingTeam];
    const pit = this.teams[1 - this.battingTeam];
    // posições
    bat.batter.root.position.set(0.75, 0, 0.1);
    bat.batter.root.rotation.y = -Math.PI / 2;
    bat.batter.root.visible = true;
    pit.batter.root.visible = false;
    pit.pitcher.root.visible = true;
    bat.pitcher.root.visible = false;
    pit.pitcher.root.position.set(0, 0.25, MOUND_Z);
    pit.pitcher.root.rotation.y = Math.PI;
    if (!bat.batter.swinging) {
      bat.batter.armMode.R = bat.batter.armMode.L = 'hold';
      bat.batter.setArmDir('R', new THREE.Vector3(-0.5, 0.55, -0.35), 1.6);
      bat.batter.setArmDir('L', new THREE.Vector3(-0.25, 0.45, -0.2), 1.8);
    }
    bat.batter.update(dt);
    pit.pitcher.update(dt);
    // modo câmera: arremessador mira dando passos para os lados
    const cam = this.app.camera;
    if (this.cameraMode && cam?.seen && this.state === 'ready' && pit.pl.kind === 'human' && pit.pl.slot === 0) this.aimP.x = clamp(-cam.bodyX * 0.5, -0.55, 0.55);
    this.applyCamera(this.teams[0].batter);

    const b = this.pb;
    if (b && b.mode === 'pitch') {
      b.v.x += b.curve * dt;
      b.v.y -= G * dt;
      b.p.addScaledVector(b.v, dt);
      // bot rebatedor
      if (bat.pl.kind === 'bot' && !b.swung && b.p.z < 4) this.botBat();
      if (b.p.z < -1.2 && this.state === 'pitch') {
        if (!(this.net && bat.pl.kind === 'remote')) this.pitchArrived();
        b.mode = 'catch';
      }
    } else if (b && b.mode === 'fly') {
      this.hitT += dt;
      b.v.y -= G * dt;
      b.p.addScaledVector(b.v, dt);
      if (b.p.y < 0.05) { b.p.y = 0.05; b.v.y = Math.abs(b.v.y) * 0.3; b.v.x *= 0.6; b.v.z *= 0.6; }
      if (this.hitT > Math.min(this.hitDur + 0.6, 4.5) && this.state === 'hit') {
        const out = this.pendingResult;
        this.pendingResult = null;
        if (!(this.net && bat.pl.kind === 'remote')) this.applyResult(out);
        else if (this.remoteResult) { this.applyingRemote = true; this.applyResult(this.remoteResult); this.applyingRemote = false; this.remoteResult = null; }
      }
    }
    if (b) {
      this.ballObj.mesh.position.copy(b.p);
      this.ballObj.shadow.position.set(b.p.x, 0.03, b.p.z);
      this.ballObj.mesh.visible = b.mode !== 'catch';
      this.trail.push(b.p);
    } else {
      const hnd = pit.pitcher.handWorld('R', new THREE.Vector3());
      this.ballObj.mesh.position.copy(hnd);
      this.ballObj.mesh.visible = true;
    }
    for (const f of this.fielders) {
      const tgt = f.target || f.home;
      const d = tgt.clone().sub(f.av.root.position);
      d.y = 0;
      const dist = d.length();
      const sp = Math.min(dist, 9 * dt);
      if (dist > 0.1) f.av.root.position.addScaledVector(d.normalize(), sp);
      f.av.speed = dist > 0.2 ? 9 : 0;
      f.av.update(dt);
    }
    this.crowds.forEach((c) => c.update(dt));

    // mira do arremesso
    const aiming = this.state === 'ready' && pit.pl.kind === 'human';
    this.reticle.visible = aiming;
    this.reticle.position.set(this.aimP.x, this.aimP.y, 0.2);
    // câmera
    if (b && b.mode === 'fly') {
      this.world.setCamera(new THREE.Vector3(b.p.x * 0.5, 6 + b.p.y * 0.4, b.p.z * 0.5 - 12), b.p.clone(), false, 3);
    } else if (pit.pl.kind === 'human' && !(bat.pl.kind === 'human')) {
      this.world.setCamera(new THREE.Vector3(0.6, 2.6, MOUND_Z + 4.5), new THREE.Vector3(0, 0.9, 0), false, 4);
    } else {
      this.world.setCamera(new THREE.Vector3(0, 1.75, -3.4), new THREE.Vector3(0, 1.2, 12), false, 4);
    }
  }

  botBat() {
    const b = this.pb;
    b.swung = true;
    const k = BOT[this.difficulty];
    const p = this.pitchParams;
    const inZone = Math.abs(p.x) <= ZONE.x && p.y >= ZONE.y0 && p.y <= ZONE.y1;
    const swingProb = inZone ? 0.85 : 0.22 - k.aim * 0.1;
    const bat = this.teams[this.battingTeam];
    if (Math.random() > swingProb) { b.swung = false; b.noSwing = true; return; }
    bat.batter.play('bat', 1.3);
    const hard = (p.speed - 22) / 14 + Math.abs(p.curve) / 8;
    const contactProb = k.acc - hard * 0.35 - (inZone ? 0 : 0.3);
    if (Math.random() > contactProb) return; // errou o balanço
    const t = gauss() * (1.1 - k.aim) * 0.9;
    this.later(0.1, () => { if (this.state === 'pitch') this.contact(t, clamp(k.power * 0.85 + gauss() * 0.2, 0.3, 1.05), gauss() * 0.4); });
  }

  onNet(d) {
    if (d.k === 'pitch') { if (this.state === 'ready') this.pitch(d.p); else this.queueRemote(d); }
    else if (d.k === 'hit' && this.state === 'pitch') {
      const bat = this.teams[this.battingTeam];
      bat.batter.play('bat', 1.3);
      this.hitBall(d.r);
      this.pendingResult = null;
      this.remoteResult = d.out;
    } else if (d.k === 'result' && this.state !== 'hit') {
      this.applyingRemote = true;
      this.applyResult(d.out);
      this.applyingRemote = false;
    } else if (d.k === 'result') this.remoteResult = d.out;
  }
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

export function create(ctx) { return new Baseball(ctx); }
