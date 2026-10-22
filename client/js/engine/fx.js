// Efeitos visuais leves: confete, poeira/impacto, rastro de bola.
import * as THREE from 'three';

const CONFETTI_COLORS = ['#ef476f', '#ffd166', '#06d6a0', '#3a86ff', '#8e7dff', '#ff9f1c'];

export class FX {
  constructor(world) {
    this.world = world;
    this.parts = [];
    const max = 600;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.max = max;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    world.scene.add(this.mesh);
  }

  spawn(pos, opts) {
    if (this.parts.length >= this.max) this.parts.shift();
    this.parts.push({
      p: pos.clone(), v: opts.v, life: opts.life, max: opts.life, size: opts.size, color: opts.color,
      rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6), spin: opts.spin || 0, g: opts.g ?? 9.8, drag: opts.drag ?? 0.5,
    });
  }

  confetti(pos, n = 120, spread = 4) {
    for (let i = 0; i < n; i++) {
      this.spawn(pos, {
        v: new THREE.Vector3((Math.random() - 0.5) * spread, 4 + Math.random() * 6, (Math.random() - 0.5) * spread),
        life: 2.5 + Math.random(), size: 0.12, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], spin: 8, g: 4, drag: 1.5,
      });
    }
  }
  burst(pos, color = '#ffffff', n = 14, speed = 3, size = 0.12) {
    for (let i = 0; i < n; i++) {
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      this.spawn(pos, { v: d, life: 0.5 + Math.random() * 0.3, size, color, spin: 4, g: 6, drag: 2 });
    }
  }
  dust(pos, n = 8) { this.burst(pos, '#e8dcc0', n, 1.5, 0.18); }
  stars(pos) { this.burst(pos, '#ffd166', 10, 2.5, 0.16); }

  update(dt) {
    const d = this.dummy;
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.v.y -= p.g * dt;
      p.v.multiplyScalar(1 - p.drag * dt);
      p.p.addScaledVector(p.v, dt);
      p.rot.x += p.spin * dt;
      p.rot.y += p.spin * dt * 0.7;
    }
    for (const p of this.parts) {
      const s = p.size * Math.min(1, p.life / (p.max * 0.3));
      d.position.copy(p.p);
      d.rotation.copy(p.rot);
      d.scale.setScalar(s);
      d.updateMatrix();
      this.mesh.setMatrixAt(n, d.matrix);
      this.mesh.setColorAt(n, this.color.set(p.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.parts.length = 0; this.mesh.count = 0; }
}

// Rastro simples para bolas rápidas.
export class Trail {
  constructor(parent, color = '#ffffff', len = 14, width = 0.06) {
    this.len = len;
    this.points = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(len * 2 * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const idx = [];
    for (let i = 0; i < len - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    this.mesh.frustumCulled = false;
    this.width = width;
    parent.add(this.mesh);
  }
  reset() { this.points.length = 0; }
  push(p) {
    this.points.unshift(p.clone());
    if (this.points.length > this.len) this.points.pop();
    for (let i = 0; i < this.len; i++) {
      const q = this.points[Math.min(i, this.points.length - 1)] || p;
      const w = this.width * (1 - i / this.len);
      this.pos.set([q.x, q.y + w, q.z, q.x, q.y - w, q.z], i * 6);
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
