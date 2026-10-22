// Boxe: soco reto (alterna mãos), gancho (balanço lateral), uppercut (para cima); guarda, esquiva,
// knockdowns e rounds. Bot "avisa" o golpe (luva brilha) para dar tempo de defender.
// Online: cada lado decide se o soco recebido acertou (pela sua própria guarda/esquiva).
import { SportBase, THREE, BOT, clamp, lerp, rand, gauss } from './common.js';
import { makeGlove } from '../engine/avatar.js';
import { toon, basic } from '../engine/materials.js';
import { crowd, ground } from '../engine/props.js';
import { banner, h } from '../ui/dom.js';

const PUNCH = {
  straight: { dmg: 6, cost: 7, anim: { L: 'punchL', R: 'punchR' }, t: 0.13 },
  hook: { dmg: 9, cost: 11, anim: { L: 'hookL', R: 'hookR' }, t: 0.17 },
  upper: { dmg: 12, cost: 14, anim: { L: 'upperL', R: 'upperR' }, t: 0.17 },
};
const ROUND_SEC = 60;

class Fighter {
  constructor(game, pl, side) {
    this.game = game;
    this.pl = pl;
    this.side = side; // 0 = você (z<0), 1 = rival
    const glove = game.ctx.equip('gloves');
    const color = side === 0 ? glove?.color || '#e63946' : '#3a86ff';
    this.av = game.makeAvatar(pl);
    this.gloves = {};
    for (const s of ['L', 'R']) {
      const gl = makeGlove(color);
      gl.children[0].material = new THREE.MeshToonMaterial({ color, emissive: '#000000' });
      this.av.hold(s, gl);
      this.av.setHandVisible(s, false);
      this.gloves[s] = gl.children[0].material;
    }
    this.av.armMode.L = this.av.armMode.R = 'guard';
    this.hp = 100;
    this.stamina = 100;
    this.guard = false;
    this.dodge = 0;
    this.dodgeT = 0;
    this.dodgeCd = 0;
    this.stun = 0;
    this.cooldown = 0;
    this.nextHand = 'L';
    this.down = false;
    this.knockdowns = 0;
    this.dealt = 0;
    this.counter = 0;
    this.downT = 0;
    this.lean = 0;
  }
  get z() { return this.side === 0 ? -0.75 : 0.75; }
}

class Boxing extends SportBase {
  constructor(ctx) {
    super(ctx);
    this.rounds = this.setup.length || 2;
    this.buildRing();
    this.f = [new Fighter(this, this.players[0], 0), new Fighter(this, this.players[1], 1)];
    this.round = 1;
    this.clock = ROUND_SEC;
    this.state = 'idle';
    this.punchId = 0;
    this.pending = new Map();
    this.ai = { t: 1.5, windup: null };
    this.hud.center('');
    const bar = (f) => h('div.col', { style: { gap: '4px' } }, h('div.healthbar', {}, h('div')), h('div.healthbar.stam', {}, h('div')));
    this.bars = this.f.map((f) => bar(f));
    this.hud.block('bars', h('div', { style: { position: 'absolute', top: '74px', left: '18px', right: '18px', display: 'flex', justifyContent: 'space-between' } }, this.bars[0], this.bars[1]));
    this.hud.scoreboard(this.f.map((f) => ({ name: f.pl.name, color: f.pl.color, score: 0, extra: '' })));

    for (const fi of this.f) {
      if (fi.pl.kind !== 'human') continue;
      const slot = fi.pl.slot;
      this.on('swing', (e) => { if (e.slot === slot) this.humanPunch(fi, e); });
      this.on('action', (e) => {
        if (e.slot !== slot) return;
        if (e.id === 'dodgeL' && e.down) this.tryDodge(fi, 1);
        if (e.id === 'dodgeR' && e.down) this.tryDodge(fi, -1);
      });
    }
  }

  buildRing() {
    const t = this.theme;
    const g = this.root;
    this.world.setShadowArea(new THREE.Vector3(0, 0, 0), 6);
    this.world.setFog(20, 80);
    ground(g, t.indoor ? '#2b2d42' : '#6c757d');
    const base = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.8, 6.4), toon('#3d405b'));
    base.position.y = -0.4;
    g.add(base);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), toon(t.floor || '#3d5a80'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.005;
    floor.receiveShadow = true;
    g.add(floor);
    const logo = new THREE.Mesh(new THREE.CircleGeometry(1, 32), basic('#ffffff', { transparent: true, opacity: 0.25 }));
    logo.rotation.x = -Math.PI / 2;
    logo.position.y = 0.01;
    g.add(logo);
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), toon('#e9ecef'));
      post.position.set(x, 0.8, z);
      g.add(post);
    }
    const ropeMat = toon(t.ropes || '#ee6c4d');
    for (const y of [0.5, 0.9, 1.3]) {
      for (const [x, z, rot] of [[0, -3, 0], [0, 3, 0], [-3, 0, Math.PI / 2], [3, 0, Math.PI / 2]]) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 6, 6), ropeMat);
        r.rotation.z = Math.PI / 2;
        r.rotation.y = rot;
        r.position.set(x, y, z);
        g.add(r);
      }
    }
    this.crowds = [];
    for (const [x, z, r] of [[0, 7, Math.PI], [-7, 0, Math.PI / 2], [7, 0, -Math.PI / 2], [0, -8, 0]]) this.crowds.push(crowd(g, { width: 14, rows: t.stands ? 6 : 3, x, z, rotY: r }));
    if (t.indoor) {
      const room = new THREE.Mesh(new THREE.BoxGeometry(30, 14, 30), toon(t.sky?.[0] || '#293241', { side: THREE.BackSide }));
      room.position.y = 6;
      g.add(room);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 4), basic('#fff6d5'));
      lamp.position.y = 6;
      g.add(lamp);
    }
  }

  start() {
    super.start();
    this.audio.play('bell');
    banner('ROUND 1', 'Lute!');
    this.later(1.2, () => { this.state = 'fight'; });
  }

  // ---------- ações ----------
  humanPunch(fi, e) {
    if (this.state !== 'fight' || fi.down || fi.stun > 0 || fi.cooldown > 0) return;
    let type = 'straight', hand;
    if (e.dy > 0.55) type = 'upper';
    else if (Math.abs(e.dx) > 0.45) { type = 'hook'; hand = e.dx > 0 ? 'L' : 'R'; }
    hand = e.hand || hand || fi.nextHand;
    this.throwPunch(fi, type, hand, clamp(e.power, 0.2, 1.3));
  }

  throwPunch(fi, type, hand, power) {
    const P = PUNCH[type];
    fi.nextHand = hand === 'L' ? 'R' : 'L';
    let mult = 0.6 + 0.6 * Math.min(1, power);
    if (fi.stamina < P.cost) mult *= 0.45;
    fi.stamina = Math.max(0, fi.stamina - P.cost);
    fi.cooldown = 0.36;
    fi.av.play(P.anim[hand], 1);
    this.audio.play('whoosh', { pitch: 1.3, vol: 0.5 });
    const target = this.f[1 - fi.side];
    const id = ++this.punchId;
    if (this.net && fi.pl.kind === 'human') this.net.send({ k: 'punch', id, type, hand, mult });
    if (target.pl.kind === 'remote') return; // o outro lado decide
    this.later(P.t, () => this.resolvePunch(fi, target, type, hand, mult));
    if (target.pl.kind === 'bot') this.botReact(target, type, hand);
  }

  resolvePunch(att, def, type, hand, mult, remoteId) {
    if (this.state !== 'fight' || def.down) return;
    const P = PUNCH[type];
    let result = 'hit';
    let dmg = P.dmg * mult;
    if (def.dodgeT > 0) {
      result = 'dodge';
      def.counter = 0.9; // esquivou: janela de contra-golpe
      dmg = 0;
    } else if (def.guard) {
      if (type === 'upper') { result = 'break'; dmg *= 0.5; def.stun = 0.35; }
      else { result = 'block'; dmg *= 0.12; }
    }
    if (att.counter > 0 && result === 'hit') { dmg *= 1.6; result = 'counter'; }
    if (remoteId) this.net.send({ k: 'pres', id: remoteId, result, dmg, hp: Math.max(0, def.hp - dmg) });
    this.applyHit(att, def, result, dmg);
  }

  applyHit(att, def, result, dmg) {
    const head = def.av.head.getWorldPosition(new THREE.Vector3());
    if (result === 'dodge') {
      this.audio.play('whoosh', { vol: 0.4 });
      if (def.side === 0) banner('ESQUIVOU!', 'Contra-ataque!');
      return;
    }
    def.hp = Math.max(0, def.hp - dmg);
    att.dealt += dmg;
    if (result === 'block') {
      this.audio.play('block');
      this.fx.burst(head.clone().add(new THREE.Vector3(0, -0.3, 0)), '#ffffff', 5, 1.5, 0.06);
    } else {
      this.audio.play(dmg > 10 ? 'bigHit' : 'punch');
      this.fx.stars(head);
      def.av.flinch();
      def.stun = Math.max(def.stun, result === 'counter' ? 0.6 : 0.25);
      def.lean = -0.25;
      this.world.addShake(def.side === 0 ? 0.5 : 0.2);
      if (result === 'counter' && att.side === 0) banner('CONTRA-GOLPE!');
      this.crowds.forEach((c) => c.cheer(0.4));
    }
    this.vibrate(def.pl.kind === 'human' ? def.pl.slot : null, result === 'block' ? 30 : 90);
    this.vibrate(att.pl.kind === 'human' ? att.pl.slot : null, 40);
    if (def.hp <= 0 && !(this.net && def.pl.kind === 'remote')) this.knockdown(def);
    this.updateBars();
  }

  knockdown(fi) {
    if (fi.down) return;
    fi.down = true;
    fi.downT = 0;
    fi.knockdowns++;
    this.state = 'count';
    if (this.net && fi.side === 0) this.net.send({ k: 'down' });
    this.audio.play('bigHit');
    this.crowds.forEach((c) => c.cheer(1.2));
    banner('KNOCKDOWN!', fi.pl.name);
    this.f.forEach((x) => this.hud.setScore(x.side, this.f[1 - x.side].knockdowns, `KD`));
    if (fi.knockdowns >= 3) {
      this.later(2.5, () => this.finish(fi.side === 1 ? 'ko_win' : 'ko_lose'));
      return;
    }
    let n = 0;
    const count = () => {
      n++;
      this.hud.center(`<span style="font-size:40px">${n}</span>`);
      this.audio.play('tick');
      if (n >= 4 + fi.knockdowns) {
        fi.down = false;
        fi.hp = fi.knockdowns === 1 ? 50 : 30;
        fi.stamina = 70;
        this.hud.center('');
        banner('DE PÉ!', 'A luta continua');
        this.later(1, () => { this.state = 'fight'; });
        this.updateBars();
      } else this.later(0.8, count);
    };
    this.later(1, count);
  }

  tryDodge(fi, dir) {
    if (this.state !== 'fight' || fi.down || fi.dodgeCd > 0) return;
    fi.dodge = dir;
    fi.dodgeT = 0.45;
    fi.dodgeCd = 0.8;
  }

  // ---------- IA ----------
  botReact(bot, type) {
    const k = BOT[this.difficulty];
    if (bot.down || bot.stun > 0 || this.ai.windup) return;
    const defend = { easy: 0.3, medium: 0.5, hard: 0.7 }[this.difficulty];
    if (Math.random() < defend) {
      const delay = Math.max(0.02, k.react * 0.5 + gauss() * 0.03);
      if (delay > PUNCH[type].t) return;
      if (Math.random() < 0.35) this.later(delay, () => this.tryDodge(bot, Math.random() < 0.5 ? 1 : -1));
      else { this.later(delay, () => { bot.guard = true; }); this.later(delay + 0.5, () => { bot.guard = false; }); }
    }
  }

  botThink(dt) {
    const bot = this.f[1];
    if (bot.pl.kind !== 'bot' || this.state !== 'fight' || bot.down) return;
    const k = BOT[this.difficulty];
    const ai = this.ai;
    if (ai.windup) {
      ai.windup.t -= dt;
      const glow = Math.sin(this.time * 30) > 0 ? '#ffe066' : '#ff6b00';
      bot.gloves[ai.windup.hand].emissive.set(glow);
      if (ai.windup.t <= 0) {
        bot.gloves[ai.windup.hand].emissive.set('#000000');
        const w = ai.windup;
        ai.windup = null;
        if (bot.stun <= 0) this.throwPunch(bot, w.type, w.hand, k.power + gauss() * 0.1);
        ai.t = rand(0.6, 1.6) / k.speed;
      }
      return;
    }
    ai.t -= dt;
    if (ai.t > 0 || bot.stun > 0 || bot.cooldown > 0) return;
    // guarda aleatória quando cansado
    if (bot.stamina < 25 && Math.random() < 0.5) { bot.guard = true; this.later(1.2, () => { bot.guard = false; }); ai.t = 1.3; return; }
    const r = Math.random();
    const type = r < 0.55 ? 'straight' : r < 0.82 ? 'hook' : 'upper';
    const hand = Math.random() < 0.5 ? 'L' : 'R';
    // golpes rápidos sem aviso no difícil, às vezes
    const tele = { easy: 0.75, medium: 0.5, hard: 0.36 }[this.difficulty];
    ai.windup = { type, hand, t: tele + rand(0, 0.15) };
    bot.av.setExpression('neutral', tele);
  }

  // ---------- fim ----------
  finish(how) {
    if (this.over) return;
    this.state = 'end';
    const me = this.f[0], op = this.f[1];
    let won, label;
    if (how === 'ko_win' || how === 'ko_lose') {
      won = how === 'ko_win';
      label = won ? 'Vitória por nocaute!' : 'Derrota por nocaute';
      if (won) this.ev('ko');
    } else {
      won = me.dealt > op.dealt;
      label = `Decisão por pontos (${Math.round(me.dealt)} x ${Math.round(op.dealt)})`;
    }
    banner(won ? (how === 'ko_win' ? 'NOCAUTE!' : 'VITÓRIA!') : 'FIM DE LUTA', label);
    this.audio.play('bell');
    (won ? me : op).av.celebrate();
    (won ? op : me).av.sad();
    if (won) this.fx.confetti(new THREE.Vector3(0, 2.5, 0));
    const draw = how === 'points' && Math.round(me.dealt) === Math.round(op.dealt);
    this.end({ won, draw, myScore: Math.round(me.dealt), oppScore: Math.round(op.dealt), label, winnerName: (won ? me : op).pl.name });
  }

  endRound() {
    if (this.round >= this.rounds) return this.finish('points');
    this.state = 'break';
    this.audio.play('bell');
    banner(`FIM DO ROUND ${this.round}`, 'Respire…');
    this.later(2.5, () => {
      this.round++;
      this.clock = ROUND_SEC;
      for (const f of this.f) { f.hp = Math.min(100, f.hp + 20); f.stamina = 100; }
      this.updateBars();
      banner(`ROUND ${this.round}`, 'Lute!');
      this.audio.play('bell');
      this.later(1, () => { this.state = 'fight'; });
    });
  }

  updateBars() {
    this.f.forEach((f, i) => {
      this.bars[i].children[0].firstChild.style.width = f.hp + '%';
      this.bars[i].children[1].firstChild.style.width = f.stamina + '%';
    });
  }

  // ---------- atualização ----------
  update(dt) {
    super.update(dt);
    if (this.state === 'fight') {
      if (!this.net || this.net.isHost) {
        this.clock -= dt;
        this.clockSendT = (this.clockSendT || 0) - dt;
        if (this.net && this.clockSendT <= 0) { this.clockSendT = 1; this.net.send({ k: 'clock', c: this.clock, r: this.round }); }
        if (this.clock <= 0) { this.clock = 0; if (this.net) this.net.send({ k: 'endround' }); this.endRound(); }
      }
      this.hud.center(`🥊 Round ${this.round}/${this.rounds} · ${Math.ceil(this.clock)}s`);
    }
    this.botThink(dt);
    for (const f of this.f) {
      f.cooldown = Math.max(0, f.cooldown - dt);
      f.stun = Math.max(0, f.stun - dt);
      f.counter = Math.max(0, f.counter - dt);
      f.dodgeCd = Math.max(0, f.dodgeCd - dt);
      f.dodgeT = Math.max(0, f.dodgeT - dt);
      if (f.dodgeT <= 0) f.dodge = 0;
      f.stamina = Math.min(100, f.stamina + dt * (f.guard ? 5 : 8));
      // jogador humano: guarda por botão ou celular em pé; esquiva inclinando o celular
      if (f.pl.kind === 'human') {
        const o = this.input.orient(f.pl.slot);
        const live = this.input.hasLiveOrient(f.pl.slot);
        f.guard = this.input.isDown(f.pl.slot, 'guard') || (live && o.p > 0.95);
        if (live && Math.abs(o.r) > 0.65 && f.dodgeCd <= 0) this.tryDodge(f, o.r > 0 ? 1 : -1);
      }
      const av = f.av;
      av.guard = f.guard ? 1 : 0.2;
      av.armMode.L = av.armMode.R = 'guard';
      // queda no knockdown
      // knockdown: cai de costas
      const fall = f.down ? (Math.PI / 2) * 0.95 : 0;
      f.downT += dt;
      av.root.rotation.x = lerp(av.root.rotation.x, f.side === 0 ? -fall : fall, Math.min(1, dt * 6));
      const dodgeX = f.dodge * 0.35 * Math.min(1, f.dodgeT * 6);
      f.lean = lerp(f.lean, 0, Math.min(1, dt * 5));
      av.root.position.set((f.side === 0 ? -1 : 1) * -dodgeX, 0, f.z);
      av.root.rotation.y = f.side === 0 ? 0 : Math.PI;
      av.lean = f.lean + (f.guard ? 0.1 : 0);
      av.spine.rotation.z = dodgeX * 0.8;
      av.speed = 0.6; // pulinho de boxeador
      av.update(dt);
    }
    if (this.state === 'fight' || this.state === 'count') this.updateBars();
    this.applyCamera(this.f[0].av);
    this.crowds.forEach((c) => c.update(dt));
    const me = this.f[0];
    const dodgeX = me.dodge * 0.35;
    this.world.setCamera(new THREE.Vector3(1.05 + dodgeX * 0.5, 2.25, -3.3), new THREE.Vector3(-0.25, 1.25, 1.1), false, 6);
  }

  setCameraMode(on) {
    super.setCameraMode(on);
  }

  // ---------- online ----------
  onNet(d) {
    const me = this.f[0], op = this.f[1];
    if (d.k === 'punch') {
      op.av.play(PUNCH[d.type].anim[d.hand], 1);
      this.later(PUNCH[d.type].t, () => this.resolvePunch(op, me, d.type, d.hand, d.mult, d.id));
    } else if (d.k === 'pres') {
      // resultado do MEU soco, decidido pelo rival
      this.applyHit(me, op, d.result, d.dmg);
      op.hp = d.hp;
    } else if (d.k === 'down') this.knockdown(op);
    else if (d.k === 'clock') { this.clock = d.c; this.round = d.r; }
    else if (d.k === 'endround') this.endRound();
  }
}

export function create(ctx) { return new Boxing(ctx); }
