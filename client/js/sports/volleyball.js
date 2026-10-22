// Vôlei 2x2: você recebe (manchete) e ataca (cortada); seu colega levanta automaticamente.
// Lado 0 (você) em z<0. Pontuação corrida até N, vence por 2. Online: cada lado envia seus toques.
import { SportBase, THREE, BOT, clamp, lerp, rand, gauss, mirror, vec, plain } from './common.js';
import { Avatar, botProfile } from '../engine/avatar.js';
import { toon, basic, stripes } from '../engine/materials.js';
import { ground, lineRect, crowd, tree, cloud, skyClouds } from '../engine/props.js';
import { Trail } from '../engine/fx.js';
import { banner } from '../ui/dom.js';

const W = 4.5; // meia largura
const L = 9; // comprimento de cada lado
const NET_H = 2.3;
const G = 8.2;
const R = 0.11;

function solveApex(p0, target, apexH, g = G) {
  const h = Math.max(apexH, p0.y + 0.2, target.y + 0.2);
  const vy = Math.sqrt(2 * g * (h - p0.y));
  const T = vy / g + Math.sqrt((2 * (h - target.y)) / g);
  return new THREE.Vector3((target.x - p0.x) / T, vy, (target.z - p0.z) / T);
}
function solveSpeed(p0, target, hs, g = G) {
  const d = Math.hypot(target.x - p0.x, target.z - p0.z);
  const T = Math.max(0.1, d / hs);
  return new THREE.Vector3((target.x - p0.x) / T, (target.y - p0.y + 0.5 * g * T * T) / T, (target.z - p0.z) / T);
}

class Volleyball extends SportBase {
  constructor(ctx) {
    super(ctx);
    this.buildArena();
    const ballItem = ctx.equip('ball');
    this.ballObj = this.ball(R, ballItem?.color || '#ffd166', 20);
    this.ballObj.mesh.material = new THREE.MeshToonMaterial({ map: stripes(ballItem?.color || '#ffd166', '#3a86ff', 6, true) });
    this.trail = new Trail(this.root, '#ffffff', 12, 0.06);
    const uniform = ctx.equip('uniform');

    // times: [atacante/receptor, levantador]
    this.teams = [0, 1].map((ti) => {
      const pl = this.players[ti];
      const dir = ti === 0 ? -1 : 1;
      const mate = botProfile(ti * 101 + 7);
      const shirt = ti === 0 ? (uniform?.color || pl.avatar?.shirt) : '#ef476f';
      const a = this.makeAvatar(pl);
      const b = new Avatar({ ...mate.avatar, shirt });
      if (ti === 0 && uniform) a.setShirt(uniform.color);
      if (ti === 1) a.setShirt('#ef476f');
      b.setRingColor(pl.color, 0.3);
      this.root.add(b.root);
      const mk = (av, role) => ({ av, role, x: role === 'hitter' ? 0 : 0, z: dir * (role === 'hitter' ? 6 : 1.2), tx: 0, tz: dir * 6, jump: 0 });
      return { ti, pl, dir, members: [mk(a, 'hitter'), mk(b, 'setter')], mateName: mate.name };
    });
    this.ballS = { p: new THREE.Vector3(0, 1, -7), v: new THREE.Vector3() };
    this.state = 'idle';
    this.lastTeam = 0;
    this.touch = 0; // toques do time com a bola
    this.phase = null; // 'receive' | 'set' | 'spike' | 'over'
    this.score = [0, 0];
    this.server = this.net ? (this.net.isHost ? 0 : 1) : 0;
    this.rally = 0;
    this.blockTry = 0;
    this.hud.scoreboard(this.teams.map((t) => ({ name: t.pl.name, color: t.pl.color, score: 0 })));
    this.updateHud();

    for (const t of this.teams) {
      if (t.pl.kind !== 'human') continue;
      this.on('swing', (e) => { if (e.slot === t.pl.slot) this.humanSwing(t, e); });
      this.on('tap', (e) => { if (e.slot === t.pl.slot) this.toss(t); });
      this.on('button', (e) => { if (e.slot === t.pl.slot && e.down && e.id === 'A') this.toss(t); });
    }
  }

  buildArena() {
    const t = this.theme;
    const g = this.root;
    this.world.setShadowArea(new THREE.Vector3(0, 0, 0), 16);
    ground(g, t.ground || '#d9a066');
    const court = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, L * 2), toon(t.court || '#f4c27a'));
    court.rotation.x = -Math.PI / 2;
    court.position.y = 0.006;
    court.receiveShadow = true;
    g.add(court);
    const add = lineRect(g, W * 2, L * 2, 0.08, t.lines || '#ffffff');
    add(W * 2, 0.08, 0, -3);
    add(W * 2, 0.08, 0, 3);
    add(W * 2, 0.08, 0, 0);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 + 1, 1, 30, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    net.position.set(0, NET_H - 0.5, 0);
    g.add(net);
    const band = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 1, 0.08, 0.03), basic('#ffffff'));
    band.position.set(0, NET_H, 0);
    g.add(band);
    for (const x of [-W - 0.6, W + 0.6]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, NET_H + 0.1, 8), toon('#2b2d42'));
      p.position.set(x, (NET_H + 0.1) / 2, 0);
      p.castShadow = true;
      g.add(p);
    }
    for (const x of [-W, W]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6), toon('#ef476f'));
      ant.position.set(x, NET_H + 0.2, 0);
      g.add(ant);
    }
    if (t.beach) {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), toon('#2bb5e8'));
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(0, 0.02, 170);
      g.add(sea);
      for (let i = 0; i < 10; i++) {
        const palm = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 5, 7), toon('#a0522d'));
        trunk.position.y = 2.5;
        trunk.rotation.z = 0.15;
        palm.add(trunk);
        for (let k = 0; k < 6; k++) {
          const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.6, 4), toon('#2e9e4f'));
          leaf.position.set(0.35, 5, 0);
          leaf.rotation.set(0, (k / 6) * Math.PI * 2, Math.PI / 2.4);
          palm.add(leaf);
        }
        palm.position.set((i % 2 ? -1 : 1) * (10 + Math.random() * 6), 0, -16 + i * 4);
        g.add(palm);
      }
      this.world.updaters.add(skyClouds(g, 6, 40, 120));
    } else if (t.indoor) {
      const room = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 44), toon('#c8d6e5', { side: THREE.BackSide }));
      room.position.y = 7;
      g.add(room);
    }
    this.crowdA = crowd(g, { width: 20, rows: 4, x: -9, z: 0, rotY: Math.PI / 2 });
    this.crowdB = crowd(g, { width: 20, rows: 4, x: 9, z: 0, rotY: -Math.PI / 2 });
  }

  start() {
    super.start();
    this.audio.play('whistle');
    banner('VÔLEI', 'Manchete, levantamento e cortada!');
    this.later(1.3, () => this.prepareServe());
  }

  get target() { return this.setup.length || 11; }

  updateHud() {
    this.teams.forEach((t, i) => this.hud.setScore(i, this.score[i]));
    this.hud.setActive(this.server);
    this.hud.center(`🏐 Até ${this.target} pontos`);
  }

  prepareServe() {
    if (this.over) return;
    this.state = 'serve';
    this.phase = null;
    this.rally = 0;
    this.trail.reset();
    for (const t of this.teams) {
      const [hit, set] = t.members;
      hit.tx = hit.x = t.ti === this.server ? 1.5 * -t.dir : 0;
      hit.tz = hit.z = t.dir * (t.ti === this.server ? 9.6 : 6);
      set.tx = set.x = -1.5 * -t.dir;
      set.tz = set.z = t.dir * 1.3;
    }
    const t = this.teams[this.server];
    if (t.pl.kind === 'human') this.hud.hint('☝️ Toque para lançar e balance POR CIMA para sacar!');
    else if (t.pl.kind === 'bot') { this.hud.hint(''); this.later(1.4, () => this.botServe(t)); }
    else this.hud.hint('Aguardando o saque do adversário…');
  }

  toss(t) {
    if (this.state !== 'serve' || this.server !== t.ti) return;
    this.state = 'toss';
    this.ballS.v.set(0, 5.5, 0);
    this.tossT = 0;
    this.hud.hint('Agora! Balance por cima 💥');
  }

  serve(t, q, power) {
    const target = new THREE.Vector3(rand(-W * 0.8, W * 0.8), R, -t.dir * lerp(4, 8.4, clamp(power, 0, 1)));
    if (q < 0.25 || power > 1.15) target.z = -t.dir * rand(9.3, 11);
    let apex = lerp(4.8, 3.5, clamp(power, 0, 1));
    if (power < 0.25) { target.z = -t.dir * 1; apex = NET_H; } // fraco demais: na rede
    const v = solveApex(this.ballS.p, target, apex);
    this.sendBall(t, v, 'serve', t.members[0]);
    t.members[0].av.play('over', 1.1);
  }
  botServe(t) {
    if (this.state !== 'serve' || this.over) return;
    this.toss(t);
    this.later(0.55, () => { if (this.state === 'toss') this.serve(t, BOT[this.difficulty].aim, BOT[this.difficulty].power); });
  }

  // Aplica um toque. who = membro que tocou.
  sendBall(t, v, kind, who, remote = false) {
    const b = this.ballS;
    b.v.copy(v);
    this.state = 'play';
    if (this.lastTeam !== t.ti) this.touch = 0;
    this.lastTeam = t.ti;
    this.touch++;
    this.phase = kind;
    this.rally++;
    for (const x of this.teams) x.plan = null;
    this.audio.play(kind === 'spike' ? 'bigHit' : 'hit', { pitch: kind === 'spike' ? 0.7 : 0.6 });
    this.fx.burst(b.p, '#ffffff', 6, 2, 0.08);
    if (kind === 'spike') { this.world.addShake(0.3); if (t.ti === 0 && t.pl.kind === 'human') this.ev('spike'); }
    if (this.net && t.ti === 0 && !remote) this.net.send({ k: 'touch', kind, who: who.role, p: plain(b.p), v: plain(v) });
    if (t.pl.kind === 'human') this.vibrate(t.pl.slot, kind === 'spike' ? 70 : 30);
  }

  // ----------- decisões de jogo -----------
  humanSwing(t, e) {
    if (this.state === 'serve' && this.server === t.ti) {
      this.toss(t);
      const pw = e.power;
      this.later(0.55, () => { if (this.state === 'toss') this.serve(t, 0.75, pw); });
      return;
    }
    if (this.state === 'toss' && this.server === t.ti) {
      const q = clamp(1 - Math.abs(this.tossT - 0.56) / 0.56, 0, 1);
      return this.serve(t, q, e.power);
    }
    const hitter = t.members[0];
    const b = this.ballS;
    if (this.state !== 'play') return;
    // Bloqueio: rival acabou de cortar
    if (this.lastTeam !== t.ti && this.phase === 'spike' && Math.abs(b.p.z) < 3.5) {
      this.blockTry = 0.35;
      t.members[1].av.play('set', 1.3);
      return;
    }
    const w = this.window(t);
    if (!w) { hitter.av.play(e.dy > 0.3 ? 'over' : 'bump', 1.2); this.audio.play('whoosh'); return; }
    const overhand = e.dy > 0.25;
    if (w.kind === 'receive') this.receive(t, w.q, e);
    else if (w.kind === 'spike') this.spike(t, clamp(w.q + (overhand ? 0.1 : -0.15), 0, 1), e.power, e.dx);
  }

  // Janela de toque do atacante/receptor do time t.
  window(t) {
    const b = this.ballS;
    const hit = t.members[0];
    const comingDown = b.v.y < 1;
    const dist = Math.hypot(b.p.x - hit.x, b.p.z - hit.z);
    const onMySide = Math.sign(b.p.z) === t.dir;
    if (!onMySide) return null;
    if (this.lastTeam !== t.ti && dist < 2.2 && b.p.y < 2.2 && b.p.y > 0.3 && comingDown) {
      const tight = this.phase === 'spike' ? 0.55 : 1; // cortada forte: janela mais apertada
      return { kind: 'receive', q: clamp(1 - Math.abs(b.p.y - 1.0) / (1.2 * tight), 0, 1) };
    }
    if (this.lastTeam === t.ti && this.phase === 'set' && dist < 2.5 && b.p.y > 2.0 && b.p.y < 4.0) {
      return { kind: 'spike', q: clamp(1 - Math.abs(b.p.y - 3.0) / 1.0, 0, 1) };
    }
    return null;
  }

  receive(t, q, e = {}) {
    const hit = t.members[0];
    const setter = t.members[1];
    hit.av.play('bump', 1.2);
    // Manchete ruim: bola vai para longe/fora
    const err = (1 - q) * 3.2;
    const target = new THREE.Vector3(setter.x + gauss() * err, 2.3, t.dir * 1.4 + gauss() * err * 0.5);
    if (q < 0.15) target.z = -t.dir * rand(1, 6);
    const v = solveApex(this.ballS.p, target, 4.6 + q * 0.6);
    this.sendBall(t, v, 'receive', hit);
  }

  setBall(t) {
    const setter = t.members[1];
    const hit = t.members[0];
    setter.av.play('set', 1.2);
    hit.tx = clamp(setter.x + (Math.random() < 0.5 ? 1.8 : -1.8), -W + 0.8, W - 0.8);
    hit.tz = t.dir * 1.9;
    const target = new THREE.Vector3(hit.tx, 3.0, t.dir * 1.5);
    const v = solveApex(this.ballS.p, target, 4.6);
    this.sendBall(t, v, 'set', setter);
    if (t.pl.kind === 'human') this.hud.hint('💥 Corte! Balance por cima com força');
  }

  spike(t, q, power, dx = 0) {
    const hit = t.members[0];
    hit.jump = 0.6;
    hit.av.play('over', 1.4);
    const pw = clamp(power, 0.2, 1.3);
    let tx = clamp((-dx * 0.7 * -t.dir) * W + gauss() * (1.2 - q) * 1.5, -W - 1, W + 1);
    let tz = -t.dir * lerp(3, 8.5, clamp(pw, 0, 1));
    if (pw > 1.1 && q < 0.6) tz = -t.dir * rand(9.2, 11);
    if (q < 0.2) tz = t.dir * 0.3; // rede
    const target = new THREE.Vector3(tx, R, tz);
    let hs = lerp(8, 17, clamp(pw * 0.8 + q * 0.2, 0, 1.1));
    let v = solveSpeed(this.ballS.p, target, hs);
    // passa por cima da rede (a não ser que o golpe tenha sido muito ruim)
    for (let i = 0; i < 12 && q >= 0.2 && this.heightAtNet(v) < NET_H + 0.3; i++) {
      hs *= 0.9;
      target.z *= 1.04;
      v = solveSpeed(this.ballS.p, target, hs);
    }
    this.sendBall(t, v, 'spike', hit);
    this.hud.hint('');
  }

  heightAtNet(v) {
    const p = this.ballS.p;
    if (Math.abs(v.z) < 0.01) return 0;
    const tt = -p.z / v.z;
    return tt < 0 ? 99 : p.y + v.y * tt - 0.5 * G * tt * tt;
  }

  freeBall(t) {
    const hit = t.members[0];
    hit.av.play('set', 1.2);
    const v = solveApex(this.ballS.p, new THREE.Vector3(rand(-W * 0.6, W * 0.6), R, -t.dir * rand(4, 7)), 4.5);
    this.sendBall(t, v, 'free', hit);
  }

  pointTo(w, why) {
    if (this.state === 'dead' || this.over) return;
    if (this.net && !this.applyingRemote) this.net.send({ k: 'point', w: w === 0 ? 'me' : 'you', why });
    this.state = 'dead';
    this.hud.hint('');
    this.score[w]++;
    this.server = w;
    if (this.rally >= 10 && this.teams[0].pl.kind === 'human') this.ev('rally10');
    const txt = { out: 'FORA!', net: 'REDE!', block: 'BLOQUEIO!', floor: 'PONTO!' }[why] || 'PONTO!';
    banner(txt, `Ponto para ${this.teams[w].pl.name}`);
    this.audio.play(w === 0 ? 'point' : 'lose');
    this.audio.play(w === 0 ? 'cheer' : 'aww');
    this.crowdA.cheer(w === 0 ? 1 : 0.4);
    this.crowdB.cheer(w === 0 ? 0.4 : 1);
    this.teams[w].members.forEach((m) => m.av.celebrate());
    this.teams[1 - w].members.forEach((m) => m.av.sad());
    this.updateHud();
    const [a, b] = this.score;
    if (Math.max(a, b) >= this.target && Math.abs(a - b) >= 2) {
      const won = a > b;
      this.later(1.4, () => {
        banner(won ? 'VITÓRIA!' : 'FIM DE JOGO', `${a} x ${b}`);
        if (won) this.fx.confetti(new THREE.Vector3(0, 3, -5));
        this.end({ won, myScore: a, oppScore: b, winnerName: this.teams[won ? 0 : 1].pl.name });
      });
    } else this.later(1.9, () => this.prepareServe());
  }

  // ----------- atualização -----------
  update(dt) {
    super.update(dt);
    const b = this.ballS;
    if (this.state === 'serve') {
      const t = this.teams[this.server];
      const h = t.members[0].av.handWorld('L', new THREE.Vector3());
      b.p.set(h.x, Math.max(h.y, 0.9), h.z);
    } else if (this.state === 'toss') {
      this.tossT += dt;
      b.v.y -= 9.8 * dt;
      b.p.addScaledVector(b.v, dt);
      if (b.p.y < 1.0 && b.v.y < 0) { this.state = 'serve'; if (this.teams[this.server].pl.kind === 'bot') this.later(0.5, () => this.botServe(this.teams[this.server])); }
    } else if (this.state === 'play' || this.state === 'dead') {
      const pz = b.p.z;
      b.v.y -= G * dt;
      b.p.addScaledVector(b.v, dt);
      // rede / antenas
      if (Math.sign(pz) !== Math.sign(b.p.z) && pz !== 0) {
        if (b.p.y < NET_H + R && Math.abs(b.p.x) < W + 0.6) {
          b.p.z = pz;
          b.v.z *= -0.25;
          b.v.x *= 0.4;
          this.audio.play('thunk', { vol: 0.5 });
          this.netTouch = true;
        } else if (this.state === 'play') {
          this.netTouch = false;
          // Bloqueio do levantador (rede) quando o rival corta
          const defender = this.teams[b.p.z < 0 ? 0 : 1];
          if (this.phase === 'spike' && defender.pl.kind !== 'remote' && !(this.net && defender.ti !== 0)) {
            const k = defender.pl.kind === 'bot' ? BOT[this.difficulty].acc * 0.28 : 0.08 + this.blockTry;
            if (Math.random() < k) {
              defender.members[1].av.play('set', 1.4);
              b.p.z = pz;
              b.v.set(gauss() * 1.5, -2, -b.v.z * 0.3);
              this.lastTeam = defender.ti;
              this.phase = 'block';
              this.audio.play('block');
              banner('BLOQUEIO!');
            }
          }
          this.blockTry = 0;
        }
      }
      if (b.p.y <= R && this.state === 'play') {
        b.p.y = R;
        const side = b.p.z < 0 ? 0 : 1;
        const inside = Math.abs(b.p.x) <= W + 0.05 && Math.abs(b.p.z) <= L + 0.05;
        this.fx.dust(b.p, 6);
        this.audio.play('bounce', { pitch: 0.6 });
        if (!this.net || side === 0) {
          if (!inside && this.lastTeam !== side) this.pointTo(side, 'out');
          else if (!inside) this.pointTo(1 - this.lastTeam, 'out');
          else this.pointTo(1 - side, this.phase === 'block' ? 'block' : 'floor');
        }
        b.v.set(b.v.x * 0.4, Math.abs(b.v.y) * 0.4, b.v.z * 0.4);
      } else if (b.p.y <= R) { b.p.y = R; b.v.multiplyScalar(0.5); b.v.y = Math.abs(b.v.y); }
      this.trail.push(b.p);
      if (this.state === 'play') this.thinkTeams();
    }

    // Movimento e animação dos jogadores
    for (const t of this.teams) {
      for (const m of t.members) {
        if (t.pl.kind === 'remote' && m.role === 'hitter' && this.remotePos) { m.tx = this.remotePos.x; m.tz = this.remotePos.z; }
        if (t.ti === 0 && m.role === 'hitter' && this.cameraMode && this.app.camera?.pose && this.state === 'play') {
          m.tx = lerp(this.app.camera.bodyX * W, m.tx, 0.5);
        }
        const speed = (m.role === 'hitter' ? 5.8 : 6.5) * (t.pl.kind === 'bot' ? BOT[this.difficulty].speed : 1);
        const dx = m.tx - m.x, dz = m.tz - m.z;
        const d = Math.hypot(dx, dz);
        const step = Math.min(d, speed * dt);
        if (d > 0.01) { m.x += (dx / d) * step; m.z += (dz / d) * step; }
        m.jump = Math.max(0, m.jump - dt);
        const jy = m.jump > 0 ? Math.sin((m.jump / 0.6) * Math.PI) * 0.7 : 0;
        m.av.root.position.set(m.x, jy, m.z);
        m.av.root.rotation.y = t.ti === 0 ? 0 : Math.PI;
        m.av.speed = d > 0.05 ? speed : 0;
        m.av.lookYaw = clamp(Math.atan2(b.p.x - m.x, Math.abs(b.p.z - m.z) + 0.5) * -t.dir * 0.5, -0.7, 0.7);
        m.av.lookPitch = clamp((b.p.y - 1.5) / 6, -0.2, 0.5);
        m.av.update(dt);
      }
    }
    this.applyCamera(this.teams[0].members[0].av);
    this.ballObj.mesh.position.copy(b.p);
    this.ballObj.mesh.rotation.x += dt * 4;
    this.ballObj.shadow.position.set(b.p.x, 0.01, b.p.z);
    this.crowdA.update(dt);
    this.crowdB.update(dt);
    if (this.net) {
      this.posT = (this.posT || 0) - dt;
      const h = this.teams[0].members[0];
      if (this.posT <= 0) { this.posT = 0.12; this.net.send({ k: 'pos', x: +h.x.toFixed(2), z: +h.z.toFixed(2) }); }
    }
    const me = this.teams[0].members[0];
    this.world.setCamera(new THREE.Vector3(me.x * 0.4, 5.2, -15), new THREE.Vector3(b.p.x * 0.15, 1.6, 0), false, 3);
  }

  // Posicionamento automático + IA dos dois times.
  thinkTeams() {
    const b = this.ballS;
    for (const t of this.teams) {
      if (t.pl.kind === 'remote') continue;
      if (this.net && t.ti !== 0) continue;
      const hit = t.members[0];
      const setter = t.members[1];
      const mySide = Math.sign(b.p.z) === t.dir || (Math.sign(b.v.z) === t.dir && this.lastTeam !== t.ti);
      if (this.lastTeam !== t.ti && mySide) {
        // Receptor vai até onde a bola vai cair (altura 1m)
        const land = this.predict(1.0);
        if (land) { hit.tx = clamp(land.x, -W - 1, W + 1); hit.tz = clamp(land.z, t.dir < 0 ? -L - 1.5 : 0.5, t.dir < 0 ? -0.5 : L + 1.5); }
        setter.tx = lerp(setter.tx, 0, 0.05);
        setter.tz = t.dir * 1.3;
        if (t.pl.kind === 'bot') this.botAct(t, 'receive');
      } else if (this.lastTeam === t.ti && this.phase === 'receive' && t.plan !== 'set') {
        const land = this.predict(2.3);
        if (land) { setter.tx = clamp(land.x, -W, W); setter.tz = clamp(land.z, -L, L); }
        if (b.v.y < 0 && b.p.y < 2.5 && Math.hypot(b.p.x - setter.x, b.p.z - setter.z) < 1.8 && Math.sign(b.p.z) === t.dir) {
          t.plan = 'set';
          this.setBall(t);
        }
      } else if (this.lastTeam === t.ti && this.phase === 'set') {
        if (t.pl.kind === 'bot') this.botAct(t, 'spike');
        else if (b.v.y < 0 && b.p.y < 1.7 && Math.sign(b.p.z) === t.dir && t.plan !== 'free') {
          // não cortou: o próprio time devolve uma bola fácil
          t.plan = 'free';
          this.freeBall(t);
        }
      } else if (this.lastTeam !== t.ti) {
        hit.tx = lerp(hit.tx, 0, 0.02);
        hit.tz = lerp(hit.tz, t.dir * 6, 0.03);
      }
    }
  }

  botAct(t, what) {
    const w = this.window(t);
    if (!w || w.kind !== what) return;
    const k = BOT[this.difficulty];
    if (!t.plan) t.plan = { at: what === 'receive' ? 1.0 + gauss() * 0.15 : 3.0 + gauss() * 0.15, ok: Math.random() < (what === 'receive' ? k.acc - (this.phase === 'spike' ? 0.12 : 0) : 0.95) };
    if (t.plan.done) return;
    if (this.ballS.p.y > t.plan.at) return;
    t.plan.done = true;
    if (!t.plan.ok) { t.members[0].av.play('bump', 1.2); return; }
    if (what === 'receive') this.receive(t, clamp(k.aim + gauss() * 0.15, 0.2, 1));
    else {
      // mira longe do receptor adversário
      const opp = this.teams[1 - t.ti].members[0];
      const dx = clamp((opp.x > 0 ? 1 : -1) * t.dir * -1 * (0.5 + k.aim * 0.6) + gauss() * (1 - k.aim), -1.4, 1.4);
      this.spike(t, clamp(k.aim + gauss() * 0.15, 0.25, 1), clamp(k.power + gauss() * 0.15, 0.3, 1.05), dx);
    }
  }

  predict(height) {
    const p = this.ballS.p.clone(), v = this.ballS.v.clone();
    for (let i = 0; i < 400; i++) {
      v.y -= G / 120;
      p.addScaledVector(v, 1 / 120);
      if (v.y < 0 && p.y <= height) return p;
    }
    return null;
  }

  onNet(d) {
    const far = this.teams[1];
    if (d.k === 'pos') this.remotePos = mirror({ x: d.x, y: 0, z: d.z });
    else if (d.k === 'touch') {
      this.ballS.p.copy(vec(mirror(d.p)));
      const who = far.members.find((m) => m.role === d.who) || far.members[0];
      who.av.play(d.kind === 'spike' || d.kind === 'serve' ? 'over' : d.kind === 'set' ? 'set' : 'bump', 1.2);
      this.sendBall(far, vec(mirror(d.v)), d.kind, who, true);
    } else if (d.k === 'point') {
      this.applyingRemote = true;
      this.pointTo(d.w === 'me' ? 1 : 0, d.why);
      this.applyingRemote = false;
    }
  }
}

export function create(ctx) { return new Volleyball(ctx); }
