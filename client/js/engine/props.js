// Objetos de cenário low-poly reutilizados pelos esportes e pelo menu.
import * as THREE from 'three';
import { toon, basic } from './materials.js';

export function tree(scale = 1, color = '#3fae5a', snow = false) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.2, 6), toon('#8d5a3b'));
  trunk.position.y = 0.6;
  trunk.castShadow = true;
  g.add(trunk);
  const leaf = toon(snow ? '#e8f4ff' : color);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 - i * 0.18, 0), leaf);
    c.position.set((i - 1) * 0.25, 1.6 + i * 0.55, (i % 2) * 0.2);
    c.castShadow = true;
    g.add(c);
  }
  g.scale.setScalar(scale);
  return g;
}

export function pine(scale = 1, snow = false) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6), toon('#7a4b2a'));
  trunk.position.y = 0.4;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.9 - i * 0.22, 1.1, 7), toon(snow && i === 2 ? '#ffffff' : '#2f8f5b'));
    c.position.y = 1.1 + i * 0.6;
    c.castShadow = true;
    g.add(c);
  }
  g.scale.setScalar(scale);
  return g;
}

export function cloud(scale = 1) {
  const g = new THREE.Group();
  const m = basic('#ffffff');
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random() * 0.6, 10, 8), m);
    s.position.set((i - 2) * 1.3, Math.random() * 0.6, Math.random() * 0.8);
    s.scale.y = 0.7;
    g.add(s);
  }
  g.scale.setScalar(scale);
  return g;
}

export function hills(parent, color = '#7cc576', dist = 160, count = 14, snow = false) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.2;
    const r = dist + Math.random() * 60;
    const h = new THREE.Mesh(new THREE.SphereGeometry(30 + Math.random() * 30, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(snow && i % 2 ? '#f2f8ff' : color));
    h.position.set(Math.cos(a) * r, -4, Math.sin(a) * r);
    h.scale.y = 0.4 + Math.random() * 0.4;
    parent.add(h);
  }
}

export function skyClouds(parent, n = 8, height = 40, radius = 120) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const c = cloud(2 + Math.random() * 2);
    const a = Math.random() * Math.PI * 2;
    c.position.set(Math.cos(a) * radius * (0.5 + Math.random() * 0.5), height + Math.random() * 20, Math.sin(a) * radius * (0.5 + Math.random() * 0.5));
    parent.add(c);
    list.push(c);
  }
  return (dt) => { for (const c of list) { c.position.x += dt * 1.5; if (c.position.x > radius) c.position.x = -radius; } };
}

// Torcida: arquibancada com bonequinhos que pulam quando chamamos cheer().
export function crowd(parent, { width = 30, rows = 4, x = 0, z = 0, rotY = 0, y = 0, step = 0.9 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
  for (let r = 0; r < rows; r++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, 0.9), toon(r % 2 ? '#8d99ae' : '#adb5bd'));
    s.position.set(0, r * 0.5 + 0.25, -r * step);
    s.receiveShadow = true;
    g.add(s);
  }
  const perRow = Math.floor(width / 0.75);
  const n = perRow * rows;
  const bodyGeo = new THREE.CapsuleGeometry(0.18, 0.25, 3, 6);
  const headGeo = new THREE.SphereGeometry(0.17, 8, 6);
  const bodies = new THREE.InstancedMesh(bodyGeo, toon('#ffffff'), n);
  const heads = new THREE.InstancedMesh(headGeo, toon('#f6c9a3'), n);
  const colors = ['#ef476f', '#3a86ff', '#ffd166', '#4cc96f', '#8e7dff', '#ff9f1c', '#ffffff', '#26b5d9'];
  const skins = ['#ffe3cc', '#e8b088', '#b97b4f', '#6e4428', '#f6c9a3'];
  const base = [];
  const d = new THREE.Object3D();
  const c = new THREE.Color();
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < perRow; k++) {
      if (Math.random() < 0.12) continue;
      const px = -width / 2 + 0.4 + k * 0.75 + (Math.random() - 0.5) * 0.2;
      const py = r * 0.5 + 0.75;
      const pz = -r * step;
      base.push({ x: px, y: py, z: pz, ph: Math.random() * 6, amp: 0 });
      bodies.setColorAt(i, c.set(colors[(Math.random() * colors.length) | 0]));
      heads.setColorAt(i, c.set(skins[(Math.random() * skins.length) | 0]));
      i++;
    }
  }
  bodies.count = heads.count = i;
  g.add(bodies, heads);
  let excite = 0;
  let t = 0;
  const update = (dt) => {
    t += dt;
    excite = Math.max(0, excite - dt * 0.5);
    for (let j = 0; j < base.length; j++) {
      const b = base[j];
      const jump = Math.max(0, Math.sin(t * 9 + b.ph)) * 0.25 * excite + Math.sin(t * 2 + b.ph) * 0.02;
      d.position.set(b.x, b.y + jump, b.z);
      d.updateMatrix();
      bodies.setMatrixAt(j, d.matrix);
      d.position.y += 0.38;
      d.updateMatrix();
      heads.setMatrixAt(j, d.matrix);
    }
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { group: g, update, cheer: (v = 1) => { excite = Math.min(1.2, excite + v); } };
}

export function ground(parent, color, size = 400, y = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), toon(color));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function lightPole(parent, x, z, h = 12) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, h, 8), toon('#6c757d'));
  pole.position.y = h / 2;
  g.add(pole);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.4), basic('#fffbe0'));
  lamp.position.y = h + 0.3;
  g.add(lamp);
  g.position.set(x, 0, z);
  g.lookAt(0, 0, 0);
  parent.add(g);
  return g;
}

// Linha retangular desenhada com caixas finas (linhas de quadra).
export function lineRect(parent, w, l, thick = 0.06, color = '#ffffff', y = 0.012) {
  const m = basic(color);
  const add = (sx, sz, x, z) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.005, sz), m);
    b.position.set(x, y, z);
    parent.add(b);
  };
  add(w + thick, thick, 0, -l / 2);
  add(w + thick, thick, 0, l / 2);
  add(thick, l, -w / 2, 0);
  add(thick, l, w / 2, 0);
  return add;
}

export function textPlane(text, { w = 4, h = 1, color = '#ffffff', bg = 'rgba(0,0,0,0)', font = 'bold 80px Fredoka, sans-serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = color;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
}
