// Materiais "toon" com sombreamento em degraus (visual cartunesco) e utilidades de textura.
import * as THREE from 'three';

let gradient = null;
function gradientMap() {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const cache = new Map();
export function toon(color, opts = {}) {
  const key = String(color) + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...opts });
  m.userData.cached = true;
  cache.set(key, m);
  return m;
}
export function basic(color, opts = {}) {
  const key = 'b' + String(color) + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, ...opts });
  m.userData.cached = true;
  cache.set(key, m);
  return m;
}

export function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

let blobTex = null;
export function shadowBlob(size = 1, opacity = 0.35) {
  if (!blobTex) {
    blobTex = canvasTexture(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(0,0,0,1)');
      r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 64, 64);
    });
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

export function stripes(colA, colB, n = 8, vertical = false) {
  return canvasTexture(128, 128, (g, w, h) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? colB : colA;
      if (vertical) g.fillRect((i * w) / n, 0, w / n + 1, h);
      else g.fillRect(0, (i * h) / n, w, h / n + 1);
    }
  });
}
