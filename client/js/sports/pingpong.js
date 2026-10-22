// Tênis de mesa: bola rápida, mesa oficial, saque troca a cada 2 pontos.
import * as THREE from 'three';
import { RacketGame } from './racket.js';
import { makePaddle } from '../engine/avatar.js';
import { toon, basic } from '../engine/materials.js';
import { ground, lineRect, crowd, tree } from '../engine/props.js';

const H = 0.76;
const CFG = {
  title: 'TÊNIS DE MESA', scoring: 'points', gearSlot: 'paddle', makeGear: (c) => makePaddle(c || '#d62828'),
  W: 0.7625, L: 1.37, netH: 0.1525, netExtra: 0.15, surfaceY: H, table: true,
  ballR: 0.02, ballVisualR: 0.035, ballColor: '#ffffff',
  g: 9.8, bounce: 0.88, friction: 0.94, lineTol: 0.015,
  speed: [3.4, 7.2], serveSpeed: [3.2, 5.6], tossV: 2.6,
  serviceLine: 1.37, secondServe: false, netMargin: 0.1, curve: 0.9,
  window: { early: 1.15, ideal: 0.42, late: 0.55 }, reachH: 0.95, reachX: 0.55,
  homeZ: 2.05, serveZ: 1.75, serveX: 0.25, minZ: 1.45, backRoom: 1.4, outFar: 3,
  moveSpeed: 3.4, hitPitch: 2.2,
  camera: { h: 2.05, back: 2.3, ahead: 3.2, lookH: 0.7, follow: 0.5 },
  buildArena(game) {
    const t = game.theme;
    const g = game.root;
    game.world.setShadowArea(new THREE.Vector3(0, 0, 0), 6);
    game.world.setFog(25, 120);
    ground(g, t.floor || '#8d6e63');
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(7, 12), toon(t.indoor ? '#a3392d' : '#4caf50'));
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = 0.005;
    rug.receiveShadow = true;
    g.add(rug);
    // mesa
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.525, 0.04, 2.74), toon(t.table || '#1565c0'));
    top.position.y = H - 0.02;
    top.receiveShadow = true;
    top.castShadow = true;
    g.add(top);
    const tg = new THREE.Group();
    tg.position.y = H - 0.005;
    g.add(tg);
    const add = lineRect(tg, 1.525 - 0.02, 2.74 - 0.02, 0.02, '#ffffff', 0.01);
    add(0.006, 2.72, 0, 0);
    for (const [x, z] of [[-0.65, -1.2], [0.65, -1.2], [-0.65, 1.2], [0.65, 1.2]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, H - 0.04, 0.05), toon('#2b2d42'));
      leg.position.set(x, (H - 0.04) / 2, z);
      g.add(leg);
    }
    const net = new THREE.Mesh(new THREE.PlaneGeometry(1.83, 0.1525, 20, 3), new THREE.MeshBasicMaterial({ color: '#1d1d2b', transparent: true, opacity: 0.6, side: THREE.DoubleSide, wireframe: true }));
    net.position.set(0, H + 0.076, 0);
    g.add(net);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.83, 0.015, 0.01), basic('#ffffff'));
    band.position.set(0, H + 0.1525, 0);
    g.add(band);
    // barreiras e paredes
    const barrier = toon(t.indoor ? '#283593' : '#2e7d32');
    for (const z of [-4.8, 4.8]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(6, 0.7, 0.05), barrier);
      b.position.set(0, 0.35, z);
      g.add(b);
    }
    for (const x of [-3, 3]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 9.6), barrier);
      b.position.set(x, 0.35, 0);
      g.add(b);
    }
    let cr = null;
    if (t.stands) cr = crowd(g, { width: 12, rows: 5, x: -5, z: 0, rotY: Math.PI / 2 });
    if (t.indoor) {
      const wallMat = toon(t.sky?.[0] || '#cfd8dc', { side: THREE.BackSide });
      const room = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 22), wallMat);
      room.position.y = 4;
      g.add(room);
      for (const z of [-2, 2]) {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.25, 12), basic('#fff8d6'));
        lamp.position.set(0, 3.2, z);
        g.add(lamp);
      }
    } else {
      for (let i = 0; i < 10; i++) {
        const tr = tree(1 + Math.random() * 0.6, '#43a047');
        const a = (i / 10) * Math.PI * 2;
        tr.position.set(Math.cos(a) * 9, 0, Math.sin(a) * 11);
        g.add(tr);
      }
    }
    return cr ? { crowd: cr } : null;
  },
};

export function create(ctx) { return new RacketGame(ctx, CFG); }
