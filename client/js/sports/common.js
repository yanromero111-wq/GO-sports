// Base comum dos esportes: ciclo de vida, entrada por jogador, timers, avatares, câmera e utilidades de física.
import * as THREE from 'three';
import { Avatar } from '../engine/avatar.js';
import { toon, shadowBlob } from '../engine/materials.js';
import { banner } from '../ui/dom.js';

export { THREE };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
// Espelha posição/velocidade do ponto de vista do adversário online (lado oposto da quadra).
export const mirror = (v) => ({ x: -v.x, y: v.y, z: -v.z });
export const vec = (o) => new THREE.Vector3(o.x, o.y, o.z);
export const plain = (v) => ({ x: +v.x.toFixed(4), y: +v.y.toFixed(4), z: +v.z.toFixed(4) });

export class SportBase {
  constructor(ctx) {
    this.ctx = ctx;
    this.app = ctx.app;
    this.world = ctx.app.world;
    this.fx = ctx.app.fx;
    this.audio = ctx.app.audio;
    this.input = ctx.app.input;
    this.hud = ctx.hud;
    this.setup = ctx.setup;
    this.players = ctx.players;
    this.net = ctx.online;
    this.difficulty = ctx.setup.difficulty || 'medium';
    this.theme = ctx.arena?.theme || {};
    this.root = new THREE.Group();
    this.world.stage.add(this.root);
    this.subs = [];
    this.timers = [];
    this.time = 0;
    this.events = {};
    this.started = false;
    this.over = false;
    this.cameraMode = false;
    this.remoteQ = []; // ações do rival online que chegaram antes da hora
    const sky = this.theme.sky || ['#5fb8ff', '#e6f6ff'];
    this.world.setSky(sky[0], sky[1], !!this.theme.night);
    if (this.net) {
      this.subs.push(this.net.on((d) => this.onNet(d)));
      this.subs.push(this.net.onLeft(() => this.opponentLeft()));
    }
  }

  // Assina um evento de entrada. Os handlers só rodam com o jogo ativo (não pausado/terminado).
  on(type, fn) {
    this.subs.push(this.input.on(type, (e) => {
      if (!this.started || this.over || this.app.paused) return;
      fn(e);
    }));
  }
  later(sec, fn) { const t = { t: sec, fn }; this.timers.push(t); return t; }
  cancel(t) { this.timers = this.timers.filter((x) => x !== t); }
  ev(name, n = 1) { this.events[name] = (this.events[name] || 0) + n; }
  vibrate(slot, ms = 40) { if (slot != null) this.app.vibrate(slot, ms); }
  isHuman(p) { return p.kind === 'human'; }
  slotOf(p) { return p.kind === 'human' ? p.slot : -99; }

  makeAvatar(player, gear) {
    const a = new Avatar(player.avatar || {});
    a.setRingColor(player.color, 0.55);
    this.root.add(a.root);
    if (gear) a.hold('R', gear);
    return a;
  }

  ball(radius, color, segments = 16) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.round(segments * 0.75)), toon(color));
    m.castShadow = true;
    this.root.add(m);
    const sh = shadowBlob(radius * 4, 0.3);
    this.root.add(sh);
    return { mesh: m, shadow: sh };
  }

  // Modo câmera: aplica a pose detectada ao avatar do jogador 1.
  applyCamera(avatar) {
    const cam = this.app.camera;
    if (this.cameraMode && cam?.pose) avatar.setPose(cam.pose);
    else avatar.setPose(null);
  }
  setCameraMode(on) { this.cameraMode = on; }

  start() { this.started = true; }
  update(dt) {
    this.time += dt;
    for (const t of [...this.timers]) {
      t.t -= dt;
      if (t.t <= 0) { this.timers.splice(this.timers.indexOf(t), 1); t.fn(); }
    }
  }
  onNet() {}
  // Guarda uma ação remota para processar quando for a vez dela (mantém os dois aparelhos em sincronia).
  queueRemote(d) { this.remoteQ.push(d); }
  drainRemote(kind, delay = 0.35) {
    const i = this.remoteQ.findIndex((x) => x.k === kind);
    if (i < 0) return;
    const d = this.remoteQ.splice(i, 1)[0];
    this.later(delay, () => this.onNet(d));
  }
  opponentLeft() {
    if (this.over) return;
    banner('Adversário saiu', 'Vitória por W.O.');
    this.end({ won: true, myScore: 1, oppScore: 0, label: 'Vitória por W.O.' });
  }
  end(result) {
    if (this.over) return;
    this.over = true;
    this.hud.hint('');
    this.ctx.finish({ ...result, events: this.events });
  }
  dispose() { for (const f of this.subs) f(); this.subs = []; }
}

// Tempo de reação/ precisão dos bots por dificuldade (cada esporte usa o que precisa).
export const BOT = {
  easy: { acc: 0.78, aim: 0.45, power: 0.55, speed: 0.65, react: 0.35, err: 1.6 },
  medium: { acc: 0.9, aim: 0.7, power: 0.75, speed: 0.85, react: 0.22, err: 1.0 },
  hard: { acc: 0.97, aim: 0.92, power: 0.92, speed: 1.05, react: 0.12, err: 0.5 },
};

// Velocidade de lançamento para a bola cair em `target` (no plano y=target.y) com velocidade horizontal `hs`.
export function solveLaunch(p0, target, hs, g) {
  const dx = target.x - p0.x, dz = target.z - p0.z;
  const dist = Math.hypot(dx, dz);
  const T = Math.max(0.05, dist / hs);
  return new THREE.Vector3(dx / T, (target.y - p0.y + 0.5 * g * T * T) / T, dz / T);
}
export function heightAt(p0, v, g, z) {
  const t = (z - p0.z) / v.z;
  return p0.y + v.y * t - 0.5 * g * t * t;
}
