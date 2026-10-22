// Tênis: simples (1x1), placar oficial (15-30-40, iguais/vantagem), segundo saque.
import * as THREE from 'three';
import { RacketGame } from './racket.js';
import { makeRacket } from '../engine/avatar.js';
import { toon, basic } from '../engine/materials.js';
import { ground, lineRect, crowd, tree, hills, lightPole, skyClouds } from '../engine/props.js';

const CFG = {
  title: 'TÊNIS', scoring: 'tennis', gearSlot: 'racket', makeGear: (c) => makeRacket(c || '#e63946'),
  W: 4.115, L: 11.885, netH: 0.914, netExtra: 1.4, surfaceY: 0, table: false,
  ballR: 0.033, ballVisualR: 0.08, ballColor: '#d8ff3a',
  g: 9.8, bounce: 0.74, friction: 0.82, lineTol: 0.06,
  speed: [13, 26], serveSpeed: [16, 29], tossV: 5.2,
  serviceLine: 6.4, secondServe: true, netMargin: 0.7, curve: 1.6,
  window: { early: 3.4, ideal: 0.8, late: 1.4 }, reachH: 2.6, reachX: 1,
  homeZ: 12.4, serveZ: 12.2, serveX: 1.2, minZ: 3, backRoom: 4, outFar: 9,
  moveSpeed: 8, hitPitch: 1,
  camera: { h: 3.8, back: 7.6, ahead: 10, lookH: 0.5, follow: 0.6 },
  buildArena(game) {
    const t = game.theme;
    const g = game.root;
    game.world.setShadowArea(new THREE.Vector3(0, 0, 0), 18);
    game.world.setFog(60, 300);
    ground(g, t.ground || '#58b368');
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(18, 36), toon(shade(t.court || '#3d8bd9')));
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = 0.004;
    apron.receiveShadow = true;
    g.add(apron);
    const court = new THREE.Mesh(new THREE.PlaneGeometry(10.97, 23.77), toon(t.court || '#3d8bd9'));
    court.rotation.x = -Math.PI / 2;
    court.position.y = 0.008;
    court.receiveShadow = true;
    g.add(court);
    const lc = t.lines || '#ffffff';
    const add = lineRect(g, 10.97, 23.77, 0.07, lc);
    add(0.07, 23.77, -4.115, 0);
    add(0.07, 23.77, 4.115, 0);
    add(8.23, 0.07, 0, -6.4);
    add(8.23, 0.07, 0, 6.4);
    add(0.07, 12.8, 0, 0);
    // rede
    const net = new THREE.Mesh(new THREE.PlaneGeometry(12.8, 0.9, 32, 4), new THREE.MeshBasicMaterial({ color: '#1d1d2b', transparent: true, opacity: 0.55, side: THREE.DoubleSide, wireframe: true }));
    net.position.set(0, 0.47, 0);
    g.add(net);
    const band = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.07, 0.03), basic('#ffffff'));
    band.position.set(0, 0.93, 0);
    g.add(band);
    for (const x of [-6.4, 6.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.07, 8), toon('#2b2d42'));
      post.position.set(x, 0.53, 0);
      post.castShadow = true;
      g.add(post);
    }
    // cerca baixa e torcida
    const fenceMat = toon(t.night ? '#22305a' : '#2a6f97');
    for (const z of [-18, 18]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(20, 1.2, 0.2), fenceMat);
      f.position.set(0, 0.6, z);
      g.add(f);
    }
    const c1 = crowd(g, { width: 26, rows: 4, x: -10.5, z: 0, rotY: Math.PI / 2 });
    const c2 = crowd(g, { width: 26, rows: 4, x: 10.5, z: 0, rotY: -Math.PI / 2 });
    if (t.night) {
      for (const [x, z] of [[-12, -16], [12, -16], [-12, 16], [12, 16]]) lightPole(g, x, z, 14);
    } else {
      for (let i = 0; i < 14; i++) {
        const tr = tree(1.4 + Math.random(), '#3fae5a');
        const a = (i / 14) * Math.PI * 2;
        tr.position.set(Math.cos(a) * 34, 0, Math.sin(a) * 34);
        g.add(tr);
      }
      game.world.updaters.add(skyClouds(g, 8, 40, 120));
    }
    hills(g, shade(t.ground || '#58b368', 0.9), 140, 14);
    return { crowd: { update: (dt) => { c1.update(dt); c2.update(dt); }, cheer: (v) => { c1.cheer(v); c2.cheer(v); } } };
  },
};

function shade(hex, f = 0.82) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

export function create(ctx) { return new RacketGame(ctx, CFG); }
