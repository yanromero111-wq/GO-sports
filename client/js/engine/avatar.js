// Avatar redondinho e expressivo (personagem original do GO SPORTS), montado só com primitivas.
// Hierarquia articulada: quadril > tronco > peito > (pescoço > cabeça) / ombros > cotovelos > mãos; quadril > coxas > joelhos.
// O avatar olha para +Z. O lado direito do avatar fica em -X.
import * as THREE from 'three';
import { toon, basic } from './materials.js';

export const SKINS = ['#ffe3cc', '#f6c9a3', '#e8b088', '#d3976b', '#b97b4f', '#93603a', '#6e4428', '#4d2e1a'];
export const HAIR_COLORS = ['#1b1b1b', '#4a2c1a', '#8a5a2b', '#d9a441', '#f4e28c', '#c0392b', '#ff7eb6', '#7b5cff', '#3a86ff', '#e0e0e0'];
export const OUTFIT_COLORS = ['#3a86ff', '#ef476f', '#4cc96f', '#ffd166', '#ff9f1c', '#8e7dff', '#26b5d9', '#2b2d42', '#ffffff', '#ff6bd6', '#06d6a0', '#8d5524'];
export const HAIR_STYLES = ['Careca', 'Curto', 'Espetado', 'Longo', 'Rabo de cavalo', 'Black power', 'Coque', 'Moicano'];
export const EYE_STYLES = ['Bolinha', 'Brilhante', 'Sonolento', 'Alegre'];
export const MOUTH_STYLES = ['Sorriso', 'Risada', 'Surpreso', 'Sério'];
export const BROW_STYLES = ['Normal', 'Grossa', 'Sem'];
export const BODY_TYPES = ['Magrinho', 'Normal', 'Fofinho'];
export const ACCESSORIES = [
  { id: 'none', name: 'Nenhum', icon: '🚫' }, { id: 'glasses', name: 'Óculos', icon: '👓' }, { id: 'sunglasses', name: 'Óculos escuros', icon: '🕶️' },
  { id: 'cap', name: 'Boné', icon: '🧢' }, { id: 'headband', name: 'Faixa', icon: '🎽' }, { id: 'bowtie', name: 'Gravatinha', icon: '🎀' },
  { id: 'crown', name: 'Coroa', icon: '👑', item: 'acc_crown' }, { id: 'starglasses', name: 'Óculos Estrela', icon: '⭐', item: 'acc_star' },
  { id: 'bunny', name: 'Orelhas', icon: '🐰', item: 'acc_bunny' }, { id: 'halo', name: 'Auréola', icon: '😇', item: 'acc_halo' },
];

const DOWN = new THREE.Vector3(0, -1, 0);
const R = 0.28; // raio da cabeça
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpV = new THREE.Vector3();

const caps = (r, len, seg = 10) => new THREE.CapsuleGeometry(r, len, 4, seg);
const sph = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
function mesh(geo, mat, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  return m;
}
function onHead(yaw, pitch, r = R) {
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch) * r, Math.sin(pitch) * r, Math.cos(yaw) * Math.cos(pitch) * r);
}

// Animações de golpe por quadros-chave: direção do braço (no espaço do corpo), dobra do cotovelo e giro do tronco.
const v = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
export const SWINGS = {
  fore: { dur: 0.42, keys: [{ t: 0, R: [v(-0.85, 0.05, -0.55), 0.5], tw: -0.6 }, { t: 0.45, R: [v(-0.25, 0.05, 1), 0.15], tw: 0 }, { t: 1, R: [v(0.75, 0.35, 0.45), 0.9], tw: 0.6 }] },
  back: { dur: 0.42, keys: [{ t: 0, R: [v(0.7, 0.15, -0.35), 1.2], tw: 0.6 }, { t: 0.45, R: [v(0.1, 0.05, 1), 0.2], tw: 0 }, { t: 1, R: [v(-0.85, 0.45, 0.3), 0.3], tw: -0.5 }] },
  over: { dur: 0.45, keys: [{ t: 0, R: [v(-0.3, 0.85, -0.4), 1.6], tw: -0.4 }, { t: 0.4, R: [v(-0.1, 0.95, 0.35), 0.2], tw: 0 }, { t: 1, R: [v(0.2, -0.6, 0.75), 0.3], tw: 0.4 }] },
  under: { dur: 0.55, keys: [{ t: 0, R: [v(-0.1, -0.5, -0.85), 0.1], tw: -0.2 }, { t: 0.5, R: [v(-0.05, -0.85, 0.5), 0.1], tw: 0 }, { t: 1, R: [v(0, 0.55, 0.85), 0.3], tw: 0.1 }] },
  bump: { dur: 0.4, keys: [{ t: 0, R: [v(-0.15, -0.8, 0.5), 0.05], L: [v(0.15, -0.8, 0.5), 0.05], tw: 0 }, { t: 0.5, R: [v(-0.1, -0.1, 1), 0.05], L: [v(0.1, -0.1, 1), 0.05], tw: 0 }, { t: 1, R: [v(-0.15, -0.7, 0.6), 0.1], L: [v(0.15, -0.7, 0.6), 0.1], tw: 0 }] },
  set: { dur: 0.4, keys: [{ t: 0, R: [v(-0.2, 0.7, 0.4), 1.8], L: [v(0.2, 0.7, 0.4), 1.8], tw: 0 }, { t: 0.5, R: [v(-0.1, 1, 0.2), 0.2], L: [v(0.1, 1, 0.2), 0.2], tw: 0 }, { t: 1, R: [v(-0.2, 0.7, 0.4), 1.4], L: [v(0.2, 0.7, 0.4), 1.4], tw: 0 }] },
  punchR: { dur: 0.28, keys: [{ t: 0, R: [v(-0.2, 0.2, 0.5), 2.2], tw: 0 }, { t: 0.4, R: [v(-0.05, 0.25, 1), 0.05], tw: 0.35 }, { t: 1, R: [v(-0.2, 0.2, 0.5), 2.2], tw: 0 }] },
  punchL: { dur: 0.28, keys: [{ t: 0, L: [v(0.2, 0.2, 0.5), 2.2], tw: 0 }, { t: 0.4, L: [v(0.05, 0.25, 1), 0.05], tw: -0.35 }, { t: 1, L: [v(0.2, 0.2, 0.5), 2.2], tw: 0 }] },
  hookR: { dur: 0.36, keys: [{ t: 0, R: [v(-0.9, 0.2, 0.2), 1.4], tw: -0.4 }, { t: 0.5, R: [v(0.25, 0.3, 1), 1.3], tw: 0.5 }, { t: 1, R: [v(-0.2, 0.2, 0.5), 2.2], tw: 0 }] },
  hookL: { dur: 0.36, keys: [{ t: 0, L: [v(0.9, 0.2, 0.2), 1.4], tw: 0.4 }, { t: 0.5, L: [v(-0.25, 0.3, 1), 1.3], tw: -0.5 }, { t: 1, L: [v(0.2, 0.2, 0.5), 2.2], tw: 0 }] },
  upperR: { dur: 0.36, keys: [{ t: 0, R: [v(-0.25, -0.7, 0.4), 1.8], tw: -0.2 }, { t: 0.5, R: [v(-0.1, 0.8, 0.6), 1.4], tw: 0.3 }, { t: 1, R: [v(-0.2, 0.2, 0.5), 2.2], tw: 0 }] },
  upperL: { dur: 0.36, keys: [{ t: 0, L: [v(0.25, -0.7, 0.4), 1.8], tw: 0.2 }, { t: 0.5, L: [v(0.1, 0.8, 0.6), 1.4], tw: -0.3 }, { t: 1, L: [v(0.2, 0.2, 0.5), 2.2], tw: 0 }] },
  bat: { dur: 0.45, keys: [{ t: 0, R: [v(-0.6, 0.6, -0.4), 1.4], L: [v(-0.3, 0.5, -0.2), 1.6], tw: -0.8 }, { t: 0.45, R: [v(-0.2, 0, 1), 0.3], L: [v(0.1, 0, 1), 0.6], tw: 0 }, { t: 1, R: [v(0.7, 0.5, 0.2), 1.2], L: [v(0.8, 0.4, 0.1), 0.6], tw: 0.9 }] },
  golf: { dur: 0.6, keys: [{ t: 0, R: [v(-0.6, 0.7, 0.2), 0.6], L: [v(-0.5, 0.75, 0.2), 0.4], tw: -0.7 }, { t: 0.45, R: [v(-0.05, -1, 0.25), 0.05], L: [v(0.05, -1, 0.25), 0.05], tw: 0 }, { t: 1, R: [v(0.6, 0.75, 0.2), 0.6], L: [v(0.65, 0.7, 0.2), 0.5], tw: 0.8 }] },
  shoot: { dur: 0.45, keys: [{ t: 0, R: [v(-0.15, 0.6, 0.4), 2.2], L: [v(0.25, 0.6, 0.4), 2.0], tw: 0 }, { t: 0.5, R: [v(-0.05, 1, 0.45), 0.1], L: [v(0.2, 0.8, 0.4), 1.2], tw: 0 }, { t: 1, R: [v(-0.05, 0.85, 0.6), 0.6], L: [v(0.2, 0.3, 0.5), 1.2], tw: 0 }] },
  pitch: { dur: 0.5, keys: [{ t: 0, R: [v(-0.6, 0.6, -0.6), 1.4], tw: -0.6 }, { t: 0.45, R: [v(-0.2, 0.7, 0.7), 0.4], tw: 0.1 }, { t: 1, R: [v(0.4, -0.7, 0.6), 0.2], tw: 0.6 }] },
  cheer: { dur: 0.9, keys: [{ t: 0, R: [v(-0.4, 1, 0), 0.3], L: [v(0.4, 1, 0), 0.3], tw: 0 }, { t: 0.5, R: [v(-0.6, 0.8, 0.1), 0.6], L: [v(0.6, 0.8, 0.1), 0.6], tw: 0 }, { t: 1, R: [v(-0.4, 1, 0), 0.3], L: [v(0.4, 1, 0), 0.3], tw: 0 }] },
};

const BOT_NAMES = ['Bia', 'Léo', 'Tuca', 'Duda', 'Kiko', 'Mel', 'Juju', 'Rafa', 'Nina', 'Caco', 'Lola', 'Beto', 'Tati', 'Zeca', 'Lia', 'Dani'];
export function botProfile(seed = Math.random() * 1e9) {
  let s = Math.floor(seed) || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  return {
    name: pick(BOT_NAMES),
    avatar: {
      body: Math.floor(rnd() * 3), height: 0.92 + rnd() * 0.16, skin: pick(SKINS), eyes: Math.floor(rnd() * 4), mouth: Math.floor(rnd() * 3),
      brows: Math.floor(rnd() * 3), hair: Math.floor(rnd() * 8), hairColor: pick(HAIR_COLORS), shirt: pick(OUTFIT_COLORS), pants: pick(OUTFIT_COLORS),
      shoes: '#ffffff', acc: pick(['none', 'none', 'glasses', 'cap', 'headband', 'sunglasses']), cheeks: rnd() > 0.4,
    },
  };
}

export class Avatar {
  constructor(cfg = {}, opts = {}) {
    this.root = new THREE.Group();
    this.opts = opts;
    this.anim = null;
    this.walkPhase = 0;
    this.speed = 0; // velocidade de deslocamento (m/s) para animar a corrida
    this.time = Math.random() * 10;
    this.nextBlink = 2;
    this.react = null;
    this.armMode = { R: 'idle', L: 'idle' };
    this.armOrient = { y: 0, p: 0, r: 0 };
    this.guard = 0; // 0..1 (boxe)
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.lean = 0;
    this.crouch = 0;
    this.pose = null; // pose vinda da câmera
    this.build(cfg);
  }

  build(cfg) {
    this.cfg = cfg = { body: 1, height: 1, skin: '#f6c9a3', eyes: 0, mouth: 0, brows: 0, hair: 1, hairColor: '#4a2c1a', shirt: '#3a86ff', pants: '#2b2d42', shoes: '#ffffff', acc: 'none', cheeks: true, ...cfg };
    this.root.clear();
    const skin = toon(cfg.skin);
    const shirt = toon(cfg.shirt);
    const pants = toon(cfg.pants);
    const shoes = toon(cfg.shoes);
    const bw = [0.85, 1, 1.22][cfg.body] ?? 1;

    const body = (this.body = new THREE.Group());
    body.scale.setScalar(cfg.height);
    this.root.add(body);

    const hips = (this.hips = new THREE.Group());
    hips.position.y = 0.62;
    body.add(hips);
    const pelvis = mesh(caps(0.2 * bw, 0.06), pants);
    pelvis.scale.set(1, 0.9, 0.85);
    pelvis.position.y = 0.04;
    hips.add(pelvis);

    const spine = (this.spine = new THREE.Group());
    spine.position.y = 0.08;
    hips.add(spine);
    const torso = mesh(caps(0.21 * bw, 0.22, 14), shirt);
    torso.scale.set(1, 1, 0.85);
    torso.position.y = 0.2;
    spine.add(torso);
    this.torsoMesh = torso;

    const chest = (this.chest = new THREE.Group());
    chest.position.y = 0.36;
    spine.add(chest);

    // Cabeça
    const neck = (this.neck = new THREE.Group());
    neck.position.y = 0.1;
    chest.add(neck);
    const head = (this.head = new THREE.Group());
    head.position.y = 0.26;
    neck.add(head);
    head.add(mesh(sph(R, 28, 20), skin));
    this.buildFace(cfg, skin);
    this.buildHair(cfg);
    this.buildAccessory(cfg);

    // Braços
    this.arms = {};
    for (const side of ['R', 'L']) {
      const sx = side === 'R' ? -1 : 1;
      const shoulder = new THREE.Group();
      shoulder.position.set(sx * (0.22 * bw + 0.05), 0, 0);
      chest.add(shoulder);
      const upper = mesh(caps(0.062, 0.14), shirt);
      upper.position.y = -0.1;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.23;
      shoulder.add(elbow);
      const fore = mesh(caps(0.056, 0.13), skin);
      fore.position.y = -0.1;
      elbow.add(fore);
      const wrist = new THREE.Group();
      wrist.position.y = -0.22;
      elbow.add(wrist);
      const hand = mesh(sph(0.078, 14, 10), skin);
      hand.scale.set(1, 1.1, 0.9);
      wrist.add(hand);
      const grip = new THREE.Group();
      grip.position.y = -0.03;
      wrist.add(grip);
      this.arms[side] = { shoulder, elbow, wrist, hand, grip, dir: new THREE.Vector3(sx * 0.15, -1, 0.05).normalize(), bend: 0.15, roll: 0 };
    }

    // Pernas
    this.legs = {};
    for (const side of ['R', 'L']) {
      const sx = side === 'R' ? -1 : 1;
      const hip = new THREE.Group();
      hip.position.set(sx * 0.1 * bw, 0, 0);
      hips.add(hip);
      const thigh = mesh(caps(0.075, 0.16), pants);
      thigh.position.y = -0.13;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.28;
      hip.add(knee);
      const shin = mesh(caps(0.065, 0.16), pants);
      shin.position.y = -0.13;
      knee.add(shin);
      const foot = mesh(sph(0.085, 14, 10), shoes);
      foot.scale.set(0.95, 0.6, 1.45);
      foot.position.set(0, -0.28, 0.04);
      knee.add(foot);
      this.legs[side] = { hip, knee };
    }

    // Sombra de contato
    const ring = (this.ring = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), basic('#000000', { transparent: true, opacity: 0.18, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.root.add(ring);
    this.root.traverse((o) => { if (o.isMesh && o !== ring) o.receiveShadow = false; });
  }

  buildFace(cfg, skin) {
    const head = this.head;
    const dark = toon('#1d1d2b');
    const white = basic('#ffffff');
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      g.position.copy(onHead(sx * 0.33, 0.08));
      g.lookAt(g.position.clone().multiplyScalar(2));
      head.add(g);
      if (cfg.eyes === 3) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 12, Math.PI), dark);
        arc.position.z = 0.005;
        g.add(arc);
      } else {
        const e = new THREE.Mesh(sph(cfg.eyes === 1 ? 0.058 : 0.045, 12, 10), dark);
        e.scale.set(0.85, cfg.eyes === 2 ? 0.45 : 1.15, 0.4);
        g.add(e);
        if (cfg.eyes === 1) {
          const hl = new THREE.Mesh(sph(0.018, 8, 6), white);
          hl.position.set(0.018, 0.024, 0.02);
          g.add(hl);
        }
        if (cfg.eyes === 2) {
          const lid = new THREE.Mesh(sph(0.05, 12, 8, 0), skin);
          lid.scale.set(1.05, 0.5, 0.5);
          lid.position.set(0, 0.02, 0.005);
          g.add(lid);
        }
      }
      this.eyes.push(g);
      if (cfg.brows !== 2) {
        const b = new THREE.Mesh(caps(cfg.brows === 1 ? 0.017 : 0.01, 0.05, 6), toon(cfg.hairColor));
        b.rotation.z = Math.PI / 2 + sx * 0.15;
        b.position.copy(onHead(sx * 0.33, 0.27, R + 0.005));
        b.lookAt(b.position.clone().multiplyScalar(2));
        b.rotateZ(Math.PI / 2 + sx * 0.15);
        head.add(b);
      }
      if (cfg.cheeks) {
        const c = new THREE.Mesh(new THREE.CircleGeometry(0.04, 14), basic('#ff8fa3', { transparent: true, opacity: 0.55 }));
        c.position.copy(onHead(sx * 0.55, -0.1, R + 0.003));
        c.lookAt(c.position.clone().multiplyScalar(2));
        head.add(c);
      }
    }
    const nose = mesh(sph(0.032, 10, 8), skin, false);
    nose.position.copy(onHead(0, -0.05, R + 0.01));
    head.add(nose);

    // Bocas (uma visível por vez; expressões trocam temporariamente)
    const mouths = (this.mouths = {});
    const mouthPos = onHead(0, -0.28, R - 0.005);
    const mk = (geo, rotZ = 0, sc = [1, 1, 1]) => {
      const m = new THREE.Mesh(geo, dark);
      m.position.copy(mouthPos);
      m.lookAt(mouthPos.clone().multiplyScalar(2));
      m.rotateZ(rotZ);
      m.scale.set(...sc);
      m.visible = false;
      head.add(m);
      return m;
    };
    mouths.smile = mk(new THREE.TorusGeometry(0.06, 0.013, 6, 14, Math.PI), Math.PI);
    mouths.grin = mk(new THREE.CircleGeometry(0.07, 16, Math.PI, Math.PI), 0, [1, 0.9, 1]);
    mouths.o = mk(sph(0.035, 10, 8), 0, [1, 1.2, 0.3]);
    mouths.flat = mk(caps(0.011, 0.07, 4), Math.PI / 2);
    mouths.sad = mk(new THREE.TorusGeometry(0.05, 0.013, 6, 14, Math.PI), 0);
    this.baseMouth = ['smile', 'grin', 'o', 'flat'][cfg.mouth] || 'smile';
    this.setExpression(null);
  }

  buildHair(cfg) {
    const mat = toon(cfg.hairColor);
    const h = this.head;
    const cap = (thetaLen = Math.PI * 0.5, rx = -0.35, r = R * 1.07) => {
      const m = mesh(new THREE.SphereGeometry(r, 26, 14, 0, Math.PI * 2, 0, thetaLen), mat);
      m.rotation.x = rx;
      h.add(m);
      return m;
    };
    switch (cfg.hair) {
      case 0: break;
      case 1: cap(); break;
      case 2: {
        cap(Math.PI * 0.42);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const c = mesh(new THREE.ConeGeometry(0.06, 0.16, 6), mat);
          const p = onHead(a, 1.05, R * 0.98);
          c.position.set(p.x * 0.9, p.y + 0.02, p.z * 0.9 - 0.03);
          c.lookAt(c.position.clone().multiplyScalar(2).add(new THREE.Vector3(0, 0.2, 0)));
          c.rotateX(Math.PI / 2);
          h.add(c);
        }
        break;
      }
      case 3: {
        cap(Math.PI * 0.55, -0.25);
        const back = mesh(caps(R * 0.95, 0.25, 16), mat);
        back.scale.set(1.05, 1, 0.55);
        back.position.set(0, -0.12, -0.12);
        h.add(back);
        break;
      }
      case 4: {
        cap();
        const tail = mesh(sph(0.11), mat);
        tail.position.set(0, 0.05, -0.33);
        h.add(tail);
        const t2 = mesh(caps(0.07, 0.18), mat);
        t2.position.set(0, -0.12, -0.36);
        t2.rotation.x = 0.3;
        h.add(t2);
        break;
      }
      case 5: {
        const afro = mesh(sph(R * 1.45, 20, 14), mat);
        afro.position.set(0, 0.1, -0.08);
        afro.scale.set(1, 0.95, 0.95);
        h.add(afro);
        break;
      }
      case 6: {
        cap();
        const bun = mesh(sph(0.11), mat);
        bun.position.set(0, R + 0.08, -0.06);
        h.add(bun);
        break;
      }
      case 7: {
        const m = mesh(caps(0.05, 0.3, 8), mat);
        m.rotation.x = Math.PI / 2;
        m.position.set(0, R * 0.95, -0.02);
        m.scale.set(1, 1, 2.2);
        h.add(m);
        break;
      }
    }
  }

  buildAccessory(cfg) {
    const h = this.head;
    const a = cfg.acc;
    if (a === 'glasses' || a === 'starglasses') {
      const mat = toon(a === 'starglasses' ? '#ffd166' : '#2b2d42');
      for (const sx of [-1, 1]) {
        const g = a === 'starglasses'
          ? new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 5, 5), mat)
          : new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 18), mat);
        g.position.copy(onHead(sx * 0.33, 0.08, R + 0.03));
        g.lookAt(g.position.clone().multiplyScalar(2));
        h.add(g);
      }
      const br = new THREE.Mesh(caps(0.01, 0.06, 4), mat);
      br.rotation.z = Math.PI / 2;
      br.position.copy(onHead(0, 0.1, R + 0.03));
      h.add(br);
    } else if (a === 'sunglasses') {
      const mat = toon('#111');
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.04), mat);
      bar.position.copy(onHead(0, 0.08, R + 0.02));
      h.add(bar);
    } else if (a === 'cap') {
      const mat = toon(cfg.shirt);
      const c = mesh(new THREE.SphereGeometry(R * 1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mat);
      c.rotation.x = -0.2;
      h.add(c);
      const brim = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 20, 1, false, -Math.PI / 2, Math.PI), mat);
      brim.position.set(0, R * 0.62, 0.15);
      brim.scale.set(1.1, 1, 1.2);
      h.add(brim);
    } else if (a === 'headband') {
      const b = mesh(new THREE.TorusGeometry(R * 1.01, 0.03, 8, 30), toon('#ef476f'));
      b.rotation.x = Math.PI / 2 - 0.25;
      b.position.y = 0.12;
      h.add(b);
    } else if (a === 'bowtie') {
      const mat = toon('#ef476f');
      for (const sx of [-1, 1]) {
        const c = mesh(new THREE.ConeGeometry(0.05, 0.1, 4), mat);
        c.rotation.z = sx * Math.PI / 2;
        c.position.set(sx * 0.05, -R - 0.02, 0.18);
        h.add(c);
      }
    } else if (a === 'crown') {
      const c = mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.12, 8, 1, true), toon('#ffd166', { side: THREE.DoubleSide }));
      c.position.y = R + 0.04;
      h.add(c);
      for (let i = 0; i < 8; i++) {
        const sp = mesh(new THREE.ConeGeometry(0.03, 0.08, 4), toon('#ffd166'));
        sp.position.set(Math.cos((i / 8) * Math.PI * 2) * 0.15, R + 0.13, Math.sin((i / 8) * Math.PI * 2) * 0.15);
        h.add(sp);
      }
    } else if (a === 'bunny') {
      for (const sx of [-1, 1]) {
        const e = mesh(caps(0.05, 0.25), toon('#ffffff'));
        e.position.set(sx * 0.1, R + 0.15, -0.03);
        e.rotation.z = -sx * 0.2;
        h.add(e);
        const inner = mesh(caps(0.025, 0.18), toon('#ffb3c6'));
        inner.position.set(sx * 0.1, R + 0.16, 0.0);
        inner.rotation.z = -sx * 0.2;
        h.add(inner);
      }
    } else if (a === 'halo') {
      const hl = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 24), basic('#fff3a3'));
      hl.rotation.x = Math.PI / 2;
      hl.position.y = R + 0.18;
      h.add(hl);
      this.halo = hl;
    }
  }

  setExpression(expr, duration = 0) {
    const map = { happy: 'grin', sad: 'sad', hurt: 'o', surprised: 'o', neutral: 'flat' };
    const show = (expr && map[expr]) || this.baseMouth;
    for (const [k, m] of Object.entries(this.mouths)) m.visible = k === show;
    clearTimeout(this.exprTimer);
    if (duration) this.exprTimer = setTimeout(() => this.setExpression(null), duration * 1000);
  }

  setShirt(color) { this.torsoMesh.material = toon(color); for (const s of ['R', 'L']) this.arms[s].shoulder.children[0].material = toon(color); }
  setRingColor(color, opacity = 0.5) { this.ring.material = basic(color, { transparent: true, opacity, depthWrite: false }); }

  // Equipamento na mão (o modelo deve ter o cabo na origem e se estender para -Y).
  hold(side, obj) {
    const g = this.arms[side].grip;
    g.clear();
    if (obj) g.add(obj);
  }
  setHandVisible(side, v) { this.arms[side].hand.visible = v; }

  // Toca uma animação de golpe. speed > 1 acelera.
  play(name, speed = 1) {
    const sw = SWINGS[name];
    if (!sw) return;
    this.anim = { sw, t: 0, dur: sw.dur / speed };
  }
  get swinging() { return !!this.anim; }

  celebrate() { this.react = { type: 'win', t: 0 }; this.setExpression('happy', 2.5); this.play('cheer', 0.7); }
  sad() { this.react = { type: 'lose', t: 0 }; this.setExpression('sad', 2.5); }
  flinch() { this.react = { type: 'hit', t: 0 }; this.setExpression('hurt', 0.6); }

  setArmDir(side, dir, bend = 0.15, roll = 0) {
    const a = this.arms[side];
    a.dir.copy(dir).normalize();
    a.bend = bend;
    a.roll = roll;
  }

  applyArm(side, dir, bend, roll, k = 1) {
    const a = this.arms[side];
    tmpQ.setFromUnitVectors(DOWN, tmpV.copy(dir).normalize());
    if (roll) tmpQ.multiply(tmpQ2.setFromAxisAngle(DOWN, roll));
    if (k >= 1) a.shoulder.quaternion.copy(tmpQ);
    else a.shoulder.quaternion.slerp(tmpQ, k);
    a.elbow.rotation.x = THREE.MathUtils.lerp(a.elbow.rotation.x, -bend, k);
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    // Piscar
    this.nextBlink -= dt;
    const blink = this.nextBlink < 0.12 && this.nextBlink > 0;
    if (this.nextBlink < 0) this.nextBlink = 2 + Math.random() * 3;
    for (const e of this.eyes) e.scale.y = blink ? 0.15 : 1;
    if (this.halo) this.halo.position.y = R + 0.18 + Math.sin(t * 2) * 0.02;

    // Corrida
    const moving = Math.min(1, this.speed / 3);
    this.walkPhase += dt * (4 + this.speed * 2.2) * (moving > 0.05 ? 1 : 0);
    const ph = this.walkPhase;
    const bob = moving * Math.abs(Math.sin(ph)) * 0.05 + Math.sin(t * 2) * 0.008;

    let jump = 0, slump = 0, flinch = 0;
    if (this.react) {
      this.react.t += dt;
      const rt = this.react.t;
      if (this.react.type === 'win') jump = Math.max(0, Math.sin(rt * 7)) * 0.25 * (rt < 2 ? 1 : 0);
      if (this.react.type === 'lose') slump = Math.min(1, rt * 3) * (rt < 2.2 ? 1 : Math.max(0, 1 - (rt - 2.2) * 3));
      if (this.react.type === 'hit') flinch = Math.max(0, 1 - rt * 3);
      if (rt > 2.6) this.react = null;
    }

    if (this.pose) return this.applyCameraPose(dt, bob);

    this.hips.position.y = 0.62 + bob + jump - this.crouch * 0.18;
    this.spine.rotation.x = 0.08 * moving + slump * 0.35 + this.lean - flinch * 0.3 + this.crouch * 0.25;
    this.neck.rotation.x = slump * 0.4 - this.lookPitch - flinch * 0.4 - this.crouch * 0.2;
    this.neck.rotation.y = this.lookYaw;

    // Pernas
    for (const side of ['R', 'L']) {
      const s = side === 'R' ? 1 : -1;
      const L = this.legs[side];
      L.hip.rotation.x = Math.sin(ph) * 0.7 * moving * s - this.crouch * 0.7;
      L.knee.rotation.x = Math.max(0, Math.sin(ph + (s > 0 ? 0 : Math.PI) + 1.2)) * 0.9 * moving + this.crouch * 1.2;
    }

    // Braços
    let twist = 0;
    let animArms = {};
    if (this.anim) {
      const a = this.anim;
      a.t += dt / a.dur;
      const k = Math.min(1, a.t);
      const keys = a.sw.keys;
      let i = 0;
      while (i < keys.length - 2 && k > keys[i + 1].t) i++;
      const k0 = keys[i], k1 = keys[i + 1];
      const f = THREE.MathUtils.smoothstep((k - k0.t) / (k1.t - k0.t), 0, 1);
      twist = THREE.MathUtils.lerp(k0.tw || 0, k1.tw || 0, f);
      for (const side of ['R', 'L']) {
        if (k0[side] && k1[side]) {
          animArms[side] = { dir: k0[side][0].clone().lerp(k1[side][0], f).normalize(), bend: THREE.MathUtils.lerp(k0[side][1], k1[side][1], f) };
        }
      }
      if (a.t >= 1) this.anim = null;
    }
    this.spine.rotation.y = THREE.MathUtils.lerp(this.spine.rotation.y, twist, Math.min(1, dt * 18));

    for (const side of ['R', 'L']) {
      const s = side === 'R' ? -1 : 1;
      if (animArms[side]) {
        this.applyArm(side, animArms[side].dir, animArms[side].bend, 0, Math.min(1, dt * 30));
        continue;
      }
      const mode = this.armMode[side];
      let dir, bend, roll = 0;
      if (mode === 'orient') {
        const o = this.armOrient;
        const yaw = THREE.MathUtils.clamp(o.y, -1.6, 1.6);
        const el = THREE.MathUtils.clamp(o.p - 0.45, -1.4, 1.45);
        dir = tmpV.set(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).clone();
        bend = 0.25;
        roll = o.r;
      } else if (mode === 'guard') {
        const g = this.guard;
        dir = new THREE.Vector3(s * 0.25, 0.15 + g * 0.55, 0.6).normalize();
        bend = 2.1 + g * 0.3;
      } else if (mode === 'hold') {
        dir = this.arms[side].dir.clone();
        bend = this.arms[side].bend;
        roll = this.arms[side].roll;
      } else {
        // solto: balança com a corrida
        const swing = Math.sin(ph) * 0.6 * moving * (side === 'R' ? -1 : 1);
        dir = new THREE.Vector3(s * (0.18 + slump * 0.05), -1, swing + 0.05 + Math.sin(t * 2 + s) * 0.02).normalize();
        bend = 0.2 + moving * 0.6;
      }
      this.applyArm(side, dir, bend, roll, Math.min(1, dt * 14));
    }
  }

  // ----- Modo câmera: o corpo inteiro segue a pose detectada -----
  setPose(pose) { this.pose = pose; }
  applyCameraPose(dt, bob) {
    const p = this.pose;
    const k = Math.min(1, dt * 20);
    this.hips.position.y = 0.62 + bob - (p.crouch || 0) * 0.25;
    this.spine.rotation.x = THREE.MathUtils.lerp(this.spine.rotation.x, p.leanX || 0, k);
    this.spine.rotation.z = THREE.MathUtils.lerp(this.spine.rotation.z, p.leanZ || 0, k);
    this.spine.rotation.y = THREE.MathUtils.lerp(this.spine.rotation.y, p.twist || 0, k);
    this.neck.rotation.y = THREE.MathUtils.lerp(this.neck.rotation.y, p.headYaw || 0, k);
    this.neck.rotation.x = THREE.MathUtils.lerp(this.neck.rotation.x, p.headPitch || 0, k);
    this.neck.rotation.z = THREE.MathUtils.lerp(this.neck.rotation.z, p.headRoll || 0, k);
    for (const side of ['R', 'L']) {
      const arm = p.arms?.[side];
      if (arm && !(this.anim && this.anim.sw.keys[0][side])) {
        const a = this.arms[side];
        tmpQ.setFromUnitVectors(DOWN, arm.upper);
        a.shoulder.quaternion.slerp(tmpQ, k);
        // antebraço no espaço local do braço
        const local = arm.lower.clone().applyQuaternion(a.shoulder.quaternion.clone().invert());
        tmpQ2.setFromUnitVectors(DOWN, local.normalize());
        a.elbow.quaternion.slerp(tmpQ2, k);
      }
      const leg = p.legs?.[side];
      if (leg) {
        const L = this.legs[side];
        tmpQ.setFromUnitVectors(DOWN, leg.upper);
        L.hip.quaternion.slerp(tmpQ, k);
        const local = leg.lower.clone().applyQuaternion(L.hip.quaternion.clone().invert());
        tmpQ2.setFromUnitVectors(DOWN, local.normalize());
        L.knee.quaternion.slerp(tmpQ2, k);
      }
    }
    if (this.anim) {
      this.anim.t += dt / this.anim.dur;
      if (this.anim.t >= 1) this.anim = null;
    }
  }

  // Posição mundial da mão (para colisões com bola).
  handWorld(side, out = new THREE.Vector3()) {
    return this.arms[side].wrist.getWorldPosition(out);
  }
}

// ----- Equipamentos (cabo na origem, estende para -Y) -----
export function makeRacket(color = '#e63946', size = 1) {
  const g = new THREE.Group();
  const handle = mesh(caps(0.022, 0.16, 6), toon('#2b2d42'));
  handle.position.y = -0.08;
  g.add(handle);
  const frame = mesh(new THREE.TorusGeometry(0.13 * size, 0.018, 8, 24), toon(color));
  frame.position.y = -0.3 * size;
  frame.scale.y = 1.25;
  g.add(frame);
  const strings = new THREE.Mesh(new THREE.CircleGeometry(0.125 * size, 20), basic('#ffffff', { transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  strings.position.copy(frame.position);
  strings.scale.y = 1.25;
  g.add(strings);
  return g; // a face (normal +Z) fica para frente quando o braço aponta para o lado
}
export function makePaddle(color = '#d62828') {
  const g = new THREE.Group();
  const handle = mesh(new THREE.BoxGeometry(0.03, 0.1, 0.025), toon('#c68642'));
  handle.position.y = -0.04;
  g.add(handle);
  const face = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 22), toon(color));
  face.rotation.x = Math.PI / 2;
  face.position.y = -0.16;
  face.scale.set(1, 1, 1.1);
  g.add(face);
  return g;
}
export function makeBat(color = '#c68642') {
  const g = new THREE.Group();
  const b = mesh(new THREE.CylinderGeometry(0.045, 0.02, 0.85, 12), toon(color));
  b.position.y = -0.4;
  g.add(b);
  const knob = mesh(sph(0.03, 8, 6), toon(color));
  knob.position.y = 0.02;
  g.add(knob);
  return g;
}
export function makeClub(color = '#c0c7d0') {
  const g = new THREE.Group();
  const shaft = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 6), toon(color));
  shaft.position.y = -0.47;
  g.add(shaft);
  const grip = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), toon('#2b2d42'));
  grip.position.y = -0.08;
  g.add(grip);
  const head = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.05), toon(color));
  head.position.set(0.035, -0.95, 0);
  g.add(head);
  return g;
}
export function makeGlove(color = '#e63946') {
  const g = new THREE.Group();
  const m = mesh(sph(0.13, 16, 12), toon(color));
  m.scale.set(1, 1.1, 1.15);
  m.position.y = -0.04;
  g.add(m);
  const cuff = mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 12), toon('#ffffff'));
  cuff.position.y = 0.06;
  g.add(cuff);
  return g;
}
export function makeBow(color = '#8d5524') {
  // Segurado na mão esquerda com o braço esticado: -Y local = direção do alvo, +Z local = para cima.
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.22, -0.6), new THREE.Vector3(0, 0.04, -0.32), new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.04, 0.32), new THREE.Vector3(0, 0.22, 0.6),
  ]);
  g.add(mesh(new THREE.TubeGeometry(curve, 24, 0.022, 6), toon(color)));
  const grip = mesh(caps(0.032, 0.1, 6), toon('#2b2d42'));
  grip.rotation.x = Math.PI / 2;
  g.add(grip);
  const pts = [new THREE.Vector3(0, 0.22, -0.6), new THREE.Vector3(0, 0.22, 0), new THREE.Vector3(0, 0.22, 0.6)];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const string = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffffff' }));
  g.add(string);
  g.userData.setDraw = (d) => {
    const pos = geo.attributes.position;
    pos.setY(1, 0.22 + d * 0.55);
    pos.needsUpdate = true;
  };
  return g;
}
