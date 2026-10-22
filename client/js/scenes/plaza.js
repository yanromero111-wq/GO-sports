// Cenário 3D dos menus: uma praça ensolarada com o avatar do jogador num pódio.
import * as THREE from 'three';
import { Avatar } from '../engine/avatar.js';
import { toon } from '../engine/materials.js';
import { tree, hills, skyClouds, ground } from '../engine/props.js';

const VIEWS = {
  pairing: { pos: [3.2, 1.6, 4.2], look: [1.4, 1.1, 0] },
  menu: { pos: [0, 2.2, 7.5], look: [0, 1.3, 0] },
  editor: { pos: [-1.0, 1.25, 3.1], look: [-0.7, 1.0, 0] },
  center: { pos: [0, 1.5, 4.2], look: [0, 1.0, 0] },
};

export class Plaza {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    this.built = false;
    this.spin = 0;
    this.targetSpin = 0;
    this.waveT = 4;
  }

  build() {
    const w = this.app.world;
    w.clearStage();
    w.setSky('#5fb8ff', '#e6f6ff');
    w.setFog(80, 400);
    w.setShadowArea(new THREE.Vector3(0, 0, 0), 12);
    this.group = new THREE.Group();
    w.stage.add(this.group);
    const g = this.group;
    ground(g, '#7cd27c');
    // caminho e pódio
    const path = new THREE.Mesh(new THREE.CircleGeometry(4.5, 40), toon('#f4e1b5'));
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.01;
    path.receiveShadow = true;
    g.add(path);
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.35, 32), toon('#ffd166'));
    podium.position.y = 0.175;
    podium.receiveShadow = true;
    podium.castShadow = true;
    g.add(podium);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.06, 8, 40), toon('#ff9f1c'));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.35;
    g.add(rim);
    for (const [x, z, s] of [[-6, -4, 1.3], [6.5, -5, 1.1], [-9, -10, 1.6], [9, -12, 1.8], [-3.5, -9, 1], [4, -8, 0.9], [-12, -3, 1.4], [12, -2, 1.2]]) {
      const t = tree(s, ['#3fae5a', '#56c271', '#2f9e4f'][Math.floor(Math.abs(x)) % 3]);
      t.position.set(x, 0, z);
      g.add(t);
    }
    // bolas decorativas
    const balls = [['#ffffff', 0.12, -2.4, 1.5], ['#ff8c42', 0.24, 2.6, 1.2], ['#ffd166', 0.2, -3, -1.5], ['#3a86ff', 0.18, 3.2, -1]];
    for (const [c, r, x, z] of balls) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), toon(c));
      b.position.set(x, r, z);
      b.castShadow = true;
      g.add(b);
    }
    hills(g, '#6cc06c', 120, 16);
    w.updaters.add(skyClouds(g, 8, 35, 100));
    this.avatar = new Avatar(this.cfg || this.app.pm.profile?.avatar || {});
    this.avatar.root.position.y = 0.35;
    g.add(this.avatar.root);
    this.built = true;
    this.setView(this.app.screen === 'pairing' ? 'pairing' : 'menu', true);
  }

  // Nunca reconstrói a praça durante uma partida (isso apagaria a quadra do esporte).
  get busy() { return !!this.app.sport || this.app.screen === 'game'; }
  ensure() { if (!this.busy && (!this.built || !this.group.parent)) this.build(); }

  setAvatar(cfg) {
    this.cfg = cfg;
    if (this.busy) return; // aplica quando voltar ao menu
    this.ensure();
    this.avatar.build(cfg);
  }

  setView(name, instant = false) {
    if (this.busy) return;
    this.ensure();
    const v = VIEWS[name] || VIEWS.menu;
    this.app.world.setCamera(new THREE.Vector3(...v.pos), new THREE.Vector3(...v.look), instant, 3);
    this.view = name;
  }

  rotateAvatar(d) { this.targetSpin += d; }

  update(dt) {
    if (this.busy) return;
    this.ensure();
    this.spin += (this.targetSpin - this.spin) * Math.min(1, dt * 6);
    this.avatar.root.rotation.y = this.spin + (this.view === 'editor' ? 0 : Math.sin(performance.now() / 2500) * 0.25);
    this.waveT -= dt;
    if (this.waveT < 0) {
      this.waveT = 6 + Math.random() * 6;
      this.avatar.play(Math.random() < 0.5 ? 'cheer' : 'fore', 0.6);
      this.avatar.setExpression('happy', 1.2);
    }
    this.avatar.update(dt);
  }
}
