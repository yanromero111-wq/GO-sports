// Núcleo dos esportes de raquete (Tênis e Tênis de Mesa): física da bola, regras de quique,
// posicionamento automático, janela de rebatida pelo tempo do balanço, bots e partida online.
//
// Coordenadas: lado 0 (jogador local) em z<0 olhando para +Z; lado 1 (rival) em z>0. Rede em z=0.
// Online: cada jogador se vê como lado 0. Cada cliente envia as próprias rebatidas e decide os pontos
// das bolas que vão para o SEU lado (autoridade do recebedor).
import { SportBase, THREE, BOT, clamp, lerp, rand, gauss, solveLaunch, heightAt, mirror, vec, plain } from './common.js';
import { Trail } from '../engine/fx.js';
import { banner } from '../ui/dom.js';

const STEP = 1 / 240;
const TENNIS_CALL = ['0', '15', '30', '40'];

export class RacketGame extends SportBase {
  constructor(ctx, cfg) {
    super(ctx);
    this.cfg = cfg;
    const arena = cfg.buildArena(this);
    this.crowd = arena?.crowd;
    const gear = ctx.equip(cfg.gearSlot);
    const ballItem = ctx.equip('ball');
    this.ballObj = this.ball(cfg.ballVisualR, (ballItem && ballItem.sport === ctx.setup.sport && ballItem.color) || cfg.ballColor);
    this.trail = new Trail(this.root, '#ffffff', 12, cfg.ballVisualR * 0.8);

    this.sides = [0, 1].map((i) => {
      const pl = this.players[i];
      const g = cfg.makeGear(i === 0 ? gear?.color : ['#3a86ff', '#4cc96f', '#8e7dff'][Math.floor(Math.random() * 3)]);
      const av = this.makeAvatar(pl, g);
      av.armMode.R = 'idle';
      const dir = i === 0 ? -1 : 1;
      const s = { i, pl, av, dir, x: 0, z: dir * cfg.homeZ, tx: 0, tz: dir * cfg.homeZ, intercept: null, botPlan: null };
      av.root.position.set(0, 0, s.z);
      av.root.rotation.y = i === 0 ? 0 : Math.PI;
      return s;
    });

    this.ballState = { p: new THREE.Vector3(), v: new THREE.Vector3(), spin: 0, curve: 0 };
    this.lastHitter = 0;
    this.bounces = 0;
    this.isServe = false;
    this.faults = 0;
    this.state = 'idle';
    this.server = this.net ? (this.net.isHost ? 0 : 1) : 0;
    this.serveCount = 0;
    this.pts = [0, 0];
    this.games = [0, 0];
    this.rallyHits = 0;
    this.posTimer = 0;

    this.hud.scoreboard(this.sides.map((s) => ({ name: s.pl.name, color: s.pl.color, score: 0 })));
    this.updateHud();

    for (const s of this.sides) {
      if (s.pl.kind !== 'human') continue;
      this.on('swing', (e) => { if (e.slot === s.pl.slot) this.humanSwing(s, e); });
      this.on('tap', (e) => { if (e.slot === s.pl.slot) this.humanToss(s); });
      this.on('button', (e) => { if (e.slot === s.pl.slot && e.down && e.id === 'A') this.humanToss(s); });
    }
  }

  start() {
    super.start();
    this.audio.play('whistle');
    banner(this.cfg.title, 'Bom jogo!');
    this.later(1.2, () => this.prepareServe());
  }

  // ---------------- regras e placar ----------------
  get receiver() { return 1 - this.lastHitter; }

  prepareServe() {
    if (this.over) return;
    this.state = 'serve';
    this.isServe = true;
    this.rallyHits = 0;
    this.trail.reset();
    for (const s of this.sides) {
      s.intercept = null;
      s.botPlan = null;
      const serving = s.i === this.server;
      const side = this.serveCount % 2 === 0 ? 1 : -1;
      s.tx = serving ? side * this.cfg.serveX * -s.dir : -side * this.cfg.serveX * -s.dir * 0.8;
      s.tz = s.dir * (serving ? this.cfg.serveZ : this.cfg.homeZ);
      s.x = s.tx;
      s.z = s.tz;
    }
    const sv = this.sides[this.server];
    if (sv.pl.kind === 'human') {
      this.hud.hint('☝️ Toque (ou A) para lançar a bola e balance para sacar!');
      this.vibrate(sv.pl.slot, 30);
    } else if (sv.pl.kind === 'bot') {
      this.hud.hint('');
      this.later(1.3 + rand(0, 0.6), () => this.botServe(sv));
    } else this.hud.hint('Aguardando o saque do adversário…');
  }

  humanToss(s) {
    if (this.state !== 'serve' || this.server !== s.i) return;
    this.state = 'toss';
    this.tossT = 0;
    this.ballState.v.set(0, this.cfg.tossV, 0);
    this.audio.play('whoosh', { pitch: 1.5 });
    this.hud.hint('Agora balance! 🎾');
  }

  serveHit(s, q, power, twist) {
    const c = this.cfg;
    const b = this.ballState;
    const side = this.serveCount % 2 === 0 ? 1 : -1;
    let tz = -s.dir * lerp(c.serviceLine * 0.55, c.serviceLine * 0.95, clamp(power, 0, 1));
    let tx = side * c.W * 0.5 * s.dir * -1 + gauss() * c.W * 0.15 * (1.2 - q);
    tx = clamp(tx, -c.W * 0.95, c.W * 0.95);
    const faultChance = (q < 0.3 ? 0.7 : 0) + (power > 1.12 ? (power - 1.12) * 2.5 : 0);
    if (Math.random() < faultChance) tz = -s.dir * (c.serviceLine + rand(0.6, 2));
    const hs = lerp(c.serveSpeed[0], c.serveSpeed[1], clamp(power * 0.8 + q * 0.2, 0, 1.1));
    this.launch(s, new THREE.Vector3(tx, c.surfaceY + c.ballR, tz), hs, twist * 0.5, 0, q, true);
    s.av.play('over', 1.2);
  }

  botServe(s) {
    if (this.state !== 'serve' || this.server !== s.i || this.over) return;
    const k = BOT[this.difficulty];
    this.state = 'toss';
    this.tossT = 0;
    this.ballState.v.set(0, this.cfg.tossV, 0);
    this.later(this.cfg.tossV / 9.8, () => {
      if (this.state !== 'toss') return;
      this.serveHit(s, clamp(k.aim + gauss() * 0.15, 0.35, 1), clamp(k.power + gauss() * 0.1, 0.3, 1.05), gauss() * 0.3);
    });
  }

  pointTo(w, reason) {
    if (this.state === 'dead' || this.over) return;
    // Online: só o recebedor decide; ele avisa o outro lado.
    if (this.net && !this.applyingRemote) this.net.send({ k: 'point', w: w === 0 ? 'me' : 'you', reason });
    this.state = 'dead';
    this.hud.hint('');
    const winnerSide = this.sides[w];
    const loserSide = this.sides[1 - w];
    if (this.isServe && this.rallyHits <= 1 && w === this.server && reason !== 'fault') {
      if (winnerSide.pl.kind === 'human' && winnerSide.i === 0) this.ev('ace');
      reason = 'ace';
    }
    if (this.rallyHits >= 10 && this.sides[0].pl.kind === 'human') this.ev('rally10');
    const label = { out: 'FORA!', net: 'REDE!', ace: 'ACE!', double: 'DUPLA FALTA', fault: 'FALTA', winner: 'PONTO!', twice: 'PONTO!' }[reason] || 'PONTO!';
    banner(label, `Ponto para ${winnerSide.pl.name}`, w === 0 ? '#ffd166' : '#ffffff');
    this.audio.play(w === 0 ? 'point' : 'lose');
    this.audio.play(w === 0 ? 'cheer' : 'aww');
    this.crowd?.cheer(w === 0 ? 1 : 0.4);
    winnerSide.av.celebrate();
    loserSide.av.sad();
    this.vibrate(this.sides[0].pl.slot, w === 0 ? 60 : 150);
    this.addPoint(w);
    this.updateHud();
    if (!this.checkEnd()) this.later(1.8, () => this.prepareServe());
  }

  addPoint(w) {
    const c = this.cfg;
    this.pts[w]++;
    this.serveCount++;
    if (c.scoring === 'tennis') {
      const [a, b] = [this.pts[w], this.pts[1 - w]];
      if (a >= 4 && a - b >= 2) {
        this.games[w]++;
        this.pts = [0, 0];
        this.server = 1 - this.server;
        this.serveCount = 0;
        if (!this.isOver()) banner('GAME!', `${this.sides[w].pl.name} vence o game`);
      }
    } else {
      const total = this.pts[0] + this.pts[1];
      const deuce = this.pts[0] >= this.target - 1 && this.pts[1] >= this.target - 1;
      if (deuce || total % 2 === 0) this.server = 1 - this.server;
    }
  }
  get target() { return this.setup.length || 7; }
  isOver() {
    if (this.cfg.scoring === 'tennis') return Math.max(...this.games) >= (this.setup.length || 2);
    const [a, b] = this.pts;
    return Math.max(a, b) >= this.target && Math.abs(a - b) >= 2;
  }
  checkEnd() {
    if (!this.isOver()) return false;
    const tennis = this.cfg.scoring === 'tennis';
    const mine = tennis ? this.games[0] : this.pts[0];
    const theirs = tennis ? this.games[1] : this.pts[1];
    const won = mine > theirs;
    this.later(1.2, () => {
      banner(won ? 'VITÓRIA!' : 'FIM DE JOGO', `${mine} x ${theirs}`);
      if (won) this.fx.confetti(this.sides[0].av.root.position.clone().add(new THREE.Vector3(0, 2, 0)));
      this.end({ won, myScore: mine, oppScore: theirs, label: tennis ? `${mine} x ${theirs} em games` : `${mine} x ${theirs}`, winnerName: this.sides[won ? 0 : 1].pl.name });
    });
    return true;
  }
  updateHud() {
    const tennis = this.cfg.scoring === 'tennis';
    this.sides.forEach((s, i) => this.hud.setScore(i, tennis ? this.games[i] : this.pts[i], tennis ? 'games' : ''));
    this.hud.setActive(this.server);
    if (tennis) {
      const [a, b] = this.pts;
      let call;
      if (a >= 3 && b >= 3) call = a === b ? 'Iguais (deuce)' : `Vantagem ${this.sides[a > b ? 0 : 1].pl.name}`;
      else call = `${TENNIS_CALL[Math.min(a, 3)]} - ${TENNIS_CALL[Math.min(b, 3)]}`;
      this.hud.center(`🎾 ${call}`);
    } else this.hud.center(`🏓 Até ${this.target} · saque: ${this.sides[this.server].pl.name}`);
  }

  // ---------------- rebatidas ----------------
  // Coordenada "à frente" do jogador: positiva = bola ainda vindo (cedo), negativa = já passou (tarde).
  ahead(s) { return (this.ballState.p.z - s.z) * -s.dir; }

  inWindow(s) {
    if (this.state !== 'play' || this.lastHitter === s.i || this.bounces < 1) return null;
    const c = this.cfg;
    const u = this.ahead(s);
    const k = c.window;
    if (u > k.early || u < -k.late) return null;
    const y = this.ballState.p.y - c.surfaceY;
    if (y < 0.02 || y > c.reachH) return null;
    const t = u > k.ideal ? (u - k.ideal) / (k.early - k.ideal) : (u - k.ideal) / (k.ideal + k.late);
    return { t: clamp(t, -1, 1), u };
  }

  humanSwing(s, e) {
    if (this.state === 'serve' && this.server === s.i) {
      // Balançou sem lançar: lança e saca automaticamente no ponto alto.
      this.humanToss(s);
      const power = e.power;
      this.later(this.cfg.tossV / 9.8, () => { if (this.state === 'toss') this.serveHit(s, 0.75, power, e.twist); });
      return;
    }
    if (this.state === 'toss' && this.server === s.i) {
      const apex = this.cfg.tossV / 9.8;
      const q = clamp(1 - Math.abs(this.tossT - apex) / apex, 0, 1);
      this.serveHit(s, q, e.power, e.twist);
      return;
    }
    const w = this.inWindow(s);
    const b = this.ballState.p;
    const right = (b.x - s.x) * s.dir > 0; // bola do lado direito do corpo?
    const overhead = b.y - this.cfg.surfaceY > this.cfg.reachH * 0.72;
    s.av.play(overhead ? 'over' : right ? 'fore' : 'back', 1.15);
    if (!w) { this.audio.play('whoosh'); return; }
    this.hit(s, w.t, e.power, e.dx, e.twist);
  }

  hit(s, t, power, dx = 0, twist = 0) {
    const c = this.cfg;
    const q = clamp(1 - Math.pow(Math.abs(t), 1.5) * 0.9, 0, 1);
    const pw = clamp(power, 0.15, 1.3);
    let depth = c.L * (0.4 + 0.5 * clamp(pw, 0, 1));
    if (pw > 1.05) depth += (pw - 1.05) * c.L * 0.9 * (1.15 - q);
    let tx = c.W * (t * 0.75 - dx * 0.45) * -s.dir; // cedo = cruzada; balanço para a direita manda para a direita
    tx += gauss() * c.W * 0.12 * (1.25 - q);
    if (q < 0.3) tx += Math.sign(tx || 1) * c.W * (0.3 - q) * 2.5;
    const target = new THREE.Vector3(tx, c.surfaceY + c.ballR, -s.dir * depth);
    const hs = lerp(c.speed[0], c.speed[1], clamp(pw * 0.75 + q * 0.25, 0, 1.15));
    const spin = clamp(twist * 0.8 + 0.25 * pw, -0.8, 1);
    this.launch(s, target, hs, spin, twist * c.curve, q, false);
  }

  launch(s, target, hs, spin, curve, q, serve) {
    const c = this.cfg;
    const b = this.ballState;
    if (b.p.y < c.surfaceY + 0.25) b.p.y = c.surfaceY + 0.25;
    const g = c.g * (1 + spin * 0.35);
    let v = solveLaunch(b.p, target, hs, g);
    // Garante que a bola passe da rede (exceto golpes muito ruins)
    const netTop = c.surfaceY + c.netH + c.netMargin * (0.3 + q);
    for (let i = 0; i < 8 && q > 0.2 && heightAt(b.p, v, g, 0) < netTop; i++) {
      hs *= 0.9;
      v = solveLaunch(b.p, target, hs, g);
    }
    v.x -= 0.5 * curve * (Math.abs(target.z - b.p.z) / Math.max(1, Math.abs(v.z)));
    b.v.copy(v);
    b.spin = spin;
    b.curve = curve;
    this.lastHitter = s.i;
    this.bounces = 0;
    this.isServe = serve;
    this.state = 'play';
    this.rallyHits++;
    for (const x of this.sides) { x.intercept = null; x.botPlan = null; }
    this.audio.play('hit', { pitch: c.hitPitch * (0.9 + q * 0.2) });
    this.fx.burst(b.p, '#ffffff', 6, 2, 0.06);
    this.vibrate(s.pl.slot, 35);
    if (this.net && s.i === 0) this.net.send({ k: 'hit', p: plain(b.p), v: plain(b.v), spin, curve, serve });
    this.hud.hint('');
  }

  // ---------------- física ----------------
  stepBall(b, h, onBounce, onNet) {
    const c = this.cfg;
    const g = c.g * (1 + b.spin * 0.35);
    const pz = b.p.z;
    b.v.y -= g * h;
    b.v.x += b.curve * h;
    b.p.addScaledVector(b.v, h);
    // rede
    if (Math.sign(pz) !== Math.sign(b.p.z) && pz !== 0 && Math.abs(b.p.x) < c.W + c.netExtra) {
      if (b.p.y < c.surfaceY + c.netH + c.ballR) {
        b.p.z = pz;
        b.v.z *= -0.15;
        b.v.x *= 0.3;
        onNet?.();
      }
    }
    const onTable = !c.table || (Math.abs(b.p.x) <= c.W && Math.abs(b.p.z) <= c.L);
    const surf = (onTable ? c.surfaceY : 0) + c.ballR;
    if (b.p.y < surf && b.v.y < 0 && (onTable || b.p.y > -1)) {
      if (c.table && !onTable && b.p.y > c.surfaceY - 0.05 && pz !== 0) { /* passou da borda */ }
      b.p.y = surf;
      b.v.y = -b.v.y * c.bounce;
      b.v.x *= c.friction;
      b.v.z *= c.friction * (1 + b.spin * 0.08);
      b.curve *= 0.5;
      onBounce?.(onTable);
    }
  }

  onBounce(onTable) {
    const c = this.cfg;
    const p = this.ballState.p;
    const half = p.z < 0 ? 0 : 1;
    const inside = onTable && Math.abs(p.x) <= c.W + c.lineTol && Math.abs(p.z) <= c.L + c.lineTol;
    if (this.state !== 'play') return;
    this.audio.play('bounce', { pitch: c.table ? 2 : 1, vol: 0.7 });
    if (!c.table) this.fx.dust(p, 3);
    const recv = this.receiver;
    // Online: o lado remoto decide as bolas que vão para ele.
    if (this.net && recv !== 0) { this.bounces++; return; }
    if (this.bounces === 0) {
      const serveOk = !this.isServe || Math.abs(p.z) <= c.serviceLine + c.lineTol;
      if (half !== recv || !inside || !serveOk) {
        if (this.isServe && c.secondServe && this.faults === 0) {
          this.faults = 1;
          return this.serveFault();
        }
        this.faults = 0;
        return this.pointTo(recv, this.isServe ? (c.secondServe ? 'double' : 'out') : half !== recv ? 'net' : 'out');
      }
      this.faults = 0;
      this.bounces = 1;
      for (const s of this.sides) s.intercept = null;
    } else {
      this.pointTo(this.lastHitter, 'twice');
    }
  }

  serveFault() {
    this.state = 'dead';
    banner('FALTA', 'Segundo saque');
    this.audio.play('whistle');
    if (this.net && !this.applyingRemote) this.net.send({ k: 'fault' });
    this.later(1.4, () => {
      const keep = this.faults;
      this.prepareServe();
      this.faults = keep;
    });
  }

  // Previsão do ponto de contato do lado s (simula a bola adiante).
  predictIntercept(s) {
    const c = this.cfg;
    const b = { p: this.ballState.p.clone(), v: this.ballState.v.clone(), spin: this.ballState.spin, curve: this.ballState.curve };
    let bounced = this.bounces;
    let lastGood = null;
    for (let i = 0; i < 4 / (STEP * 2); i++) {
      this.stepBall(b, STEP * 2, () => { bounced++; }, null);
      const u = (b.p.z - s.z) * -s.dir;
      if (bounced >= 1 && b.p.y - c.surfaceY < c.reachH && b.p.y > c.surfaceY) {
        lastGood = b.p.clone();
        if (u <= c.window.ideal + 0.2) return b.p.clone();
      }
      if (bounced >= 2) break;
    }
    return lastGood;
  }

  // ---------------- atualização ----------------
  update(dt) {
    super.update(dt);
    const c = this.cfg;
    const b = this.ballState;
    const me = this.sides[0];

    if (this.state === 'serve' || this.state === 'idle') {
      const sv = this.sides[this.server];
      const hand = sv.av.handWorld('L', new THREE.Vector3());
      b.p.set(hand.x, Math.max(hand.y, c.surfaceY + 0.2), hand.z + sv.dir * -0.05);
      b.v.set(0, 0, 0);
    } else if (this.state === 'toss') {
      this.tossT += dt;
      b.v.y -= 9.8 * dt;
      b.p.addScaledVector(b.v, dt);
      const sv = this.sides[this.server];
      if (b.p.y < sv.av.handWorld('L', new THREE.Vector3()).y - 0.1 && b.v.y < 0) {
        this.state = 'serve';
        if (sv.pl.kind === 'human') this.hud.hint('Lance de novo e balance no alto! ☝️');
        else this.later(0.5, () => this.botServe(sv));
      }
    } else if (this.state === 'play' || this.state === 'dead') {
      let n = Math.ceil(dt / STEP);
      const h = dt / n;
      while (n--) this.stepBall(b, h, (t) => this.onBounce(t), () => { if (this.state === 'play') this.audio.play('thunk', { vol: 0.5 }); });
      if (this.state === 'play') {
        // Bola morta (parada ou muito longe)
        const far = Math.abs(b.p.z) > c.L + c.outFar || Math.abs(b.p.x) > c.W + c.outFar;
        const stopped = b.v.lengthSq() < 0.05;
        if ((far || stopped) && (!this.net || this.receiver === 0)) {
          if (this.bounces >= 1) this.pointTo(this.lastHitter, 'winner');
          else this.pointTo(this.receiver, Math.sign(b.p.z) === (this.lastHitter === 0 ? -1 : 1) ? 'net' : 'out');
        }
      }
      this.trail.push(b.p);
    }

    // Movimento dos jogadores
    for (const s of this.sides) {
      const incoming = this.state === 'play' && this.lastHitter !== s.i;
      if (s.pl.kind === 'remote') {
        // posição vem da rede
      } else if (incoming) {
        if (!s.intercept) s.intercept = this.predictIntercept(s) || new THREE.Vector3(b.p.x, 0, s.z);
        const ip = s.intercept;
        // fica de lado para a bola: forehand (bola à direita do corpo) ou backhand, o que exigir menos corrida
        const candF = ip.x - 0.6 * s.dir * c.reachX;
        const candB = ip.x + 0.6 * s.dir * c.reachX;
        s.tx = Math.abs(candF - s.x) <= Math.abs(candB - s.x) + 0.3 ? candF : candB;
        s.tz = clamp(ip.z + s.dir * 0.5, s.dir < 0 ? -c.L - c.backRoom : c.minZ, s.dir < 0 ? -c.minZ : c.L + c.backRoom);
      } else if (this.state === 'play') {
        s.tx *= 0.98;
        s.tz = lerp(s.tz, s.dir * c.homeZ, 0.02);
      }
      if (s.i === 0 && this.cameraMode && this.app.camera?.pose && this.state === 'play') {
        // Modo câmera: o jogador anda pela quadra com o próprio corpo (com uma ajudinha para alcançar a bola).
        const bodyX = this.app.camera.bodyX * c.W * 1.1;
        s.tx = incoming && s.intercept ? lerp(bodyX, s.tx, 0.35) : bodyX;
      }
      let speed = c.moveSpeed;
      if (s.pl.kind === 'bot') speed *= BOT[this.difficulty].speed;
      const dx = s.tx - s.x, dz = s.tz - s.z;
      const d = Math.hypot(dx, dz);
      const step = Math.min(d, speed * dt);
      if (d > 0.001) { s.x += (dx / d) * step; s.z += (dz / d) * step; }
      s.av.speed = d > 0.05 ? speed : 0;
      s.av.root.position.set(s.x, 0, s.z);
      const look = Math.atan2(b.p.x - s.x, (b.p.z - s.z)) - (s.i === 0 ? 0 : Math.PI);
      s.av.root.rotation.y = (s.i === 0 ? 0 : Math.PI) + clamp(look * 0.3, -0.5, 0.5);
      s.av.lookYaw = clamp(Math.atan2(b.p.x - s.x, Math.abs(b.p.z - s.z) + 0.1) * -s.dir * 0.4, -0.6, 0.6);
      if (s.pl.kind === 'bot') this.botThink(s);
      // braço segue o celular quando parado (só jogador humano com sensores)
      if (s.pl.kind === 'human' && this.input.hasLiveOrient(s.pl.slot) && !s.av.swinging) {
        s.av.armMode.R = 'orient';
        s.av.armOrient = this.input.orient(s.pl.slot);
      } else s.av.armMode.R = 'idle';
      s.av.update(dt);
    }
    this.applyCamera(me.av);

    // Online: envia posição
    if (this.net) {
      this.posTimer -= dt;
      if (this.posTimer <= 0) { this.posTimer = 0.12; this.net.send({ k: 'pos', x: +me.x.toFixed(2), z: +me.z.toFixed(2) }); }
    }

    // Bola e sombra
    this.ballObj.mesh.position.copy(b.p);
    const onTable = !c.table || (Math.abs(b.p.x) <= c.W && Math.abs(b.p.z) <= c.L);
    this.ballObj.shadow.position.set(b.p.x, (onTable ? c.surfaceY : 0) + 0.005, b.p.z);
    this.crowd?.update(dt);

    // Câmera atrás do jogador 1
    const cam = c.camera;
    this.world.setCamera(
      new THREE.Vector3(me.x * cam.follow, cam.h, me.z - cam.back),
      new THREE.Vector3(me.x * cam.follow * 0.5 + b.p.x * 0.12, cam.lookH, me.z + cam.ahead),
      false, 5,
    );
  }

  botThink(s) {
    if (this.state !== 'play' || this.lastHitter === s.i) return;
    const w = this.inWindow(s);
    if (!w) return;
    const k = BOT[this.difficulty];
    if (!s.botPlan) {
      const reach = Math.abs(this.ballState.p.x - s.x) < this.cfg.reachX * 1.6;
      s.botPlan = { go: reach && Math.random() < k.acc, at: this.cfg.window.ideal + gauss() * 0.3 * (1 - k.aim) * this.cfg.window.early };
    }
    if (w.u <= s.botPlan.at && !s.botPlan.done) {
      s.botPlan.done = true;
      const b = this.ballState.p;
      const right = (b.x - s.x) * s.dir > 0;
      s.av.play(right ? 'fore' : 'back', 1.15);
      if (!s.botPlan.go) return;
      // Mira longe do adversário
      const opp = this.sides[1 - s.i];
      const away = opp.x > 0 ? -1 : 1;
      const dxAim = clamp((away * k.aim * 0.85) / (0.45 * s.dir), -1.8, 1.8); // converte o alvo no "dx" do golpe
      this.hit(s, gauss() * (1 - k.aim) * 0.8, clamp(k.power + gauss() * 0.15, 0.25, 1.1), dxAim, gauss() * 0.3);
    }
  }

  // ---------------- online ----------------
  onNet(d) {
    const far = this.sides[1];
    if (d.k === 'pos') { const m = mirror({ x: d.x, y: 0, z: d.z }); far.x = far.tx = m.x; far.z = far.tz = m.z; }
    else if (d.k === 'hit') {
      const b = this.ballState;
      b.p.copy(vec(mirror(d.p)));
      b.v.copy(vec(mirror(d.v)));
      b.spin = d.spin;
      b.curve = -d.curve;
      this.lastHitter = 1;
      this.bounces = 0;
      this.isServe = !!d.serve;
      this.state = 'play';
      this.rallyHits++;
      far.av.play(d.serve ? 'over' : 'fore', 1.15);
      this.audio.play('hit', { pitch: this.cfg.hitPitch });
      for (const x of this.sides) { x.intercept = null; }
      this.hud.hint('');
    } else if (d.k === 'point') {
      this.applyingRemote = true;
      this.pointTo(d.w === 'me' ? 1 : 0, d.reason);
      this.applyingRemote = false;
    } else if (d.k === 'fault') {
      this.applyingRemote = true;
      this.faults = 1;
      this.serveFault();
      this.applyingRemote = false;
    }
  }
}
