// Modo câmera: MediaPipe Pose + Face Landmarker rodando 100% no navegador (o vídeo nunca sai do aparelho).
// Produz: pose do corpo inteiro para o avatar, posição lateral (bodyX), agachamento, direção da cabeça
// e gestos (balanço/soco, guarda, esquiva) injetados como entrada do jogador 1.
import * as THREE from 'three';
import { OneEuro } from './oneeuro.js';
import { h, toast } from '../ui/dom.js';

const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const clamp = THREE.MathUtils.clamp;
const IDX = { nose: 0, earL: 7, earR: 8, shL: 11, shR: 12, elL: 13, elR: 14, wrL: 15, wrR: 16, hipL: 23, hipR: 24, knL: 25, knR: 26, anL: 27, anR: 28 };

export class CameraTracker {
  constructor(app) {
    this.app = app;
    this.pose = null; // pose pronta para Avatar.setPose
    this.bodyX = 0; // -1..1 (negativo = direita do jogador/da tela)
    this.crouch = 0;
    this.running = false;
    this.filters = new Map();
    this.wrist = { L: null, R: null };
    this.cool = 0;
    this.guard = false;
    this.lastDodge = 0;
    this.baseHipY = null;
    this.frame = 0;
    this.cursorMode = false; // modo só câmera: a mão levantada move o cursor dos menus
    this.handsUpT = 0;
    this.drawing = false;
    this.armAim = { y: 0, p: 0 }; // mira do arco: direção do braço esquerdo esticado
    this.seen = false;
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Câmera não suportada neste navegador');
    this.showNotice('Pedindo permissão da câmera… o vídeo é processado só neste aparelho.');
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    const video = (this.video = h('video.cam-preview', { autoplay: true, muted: true, playsinline: true }));
    video.srcObject = this.stream;
    document.body.appendChild(video);
    await video.play();
    this.badge = h('div.cam-badge', {}, h('span.chip', {}, '📷 Câmera ligada · processada só aqui'));
    document.body.appendChild(this.badge);
    document.body.classList.add('cam-on');
    this.showNotice('Carregando o rastreamento de corpo…');
    const vision = await import(/* @vite-ignore */ `${VISION}/vision_bundle.mjs`);
    const files = await vision.FilesetResolver.forVisionTasks(`${VISION}/wasm`);
    this.poseLm = await vision.PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 1,
    });
    try {
      this.faceLm = await vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numFaces: 1, outputFacialTransformationMatrixes: true,
      });
    } catch (e) { console.warn('rastreamento de rosto indisponível; usando a pose para a cabeça', e); }
    this.hideNotice();
    this.running = true;
    toast('Fique de corpo inteiro na frente da câmera 🙆');
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.video?.remove();
    this.badge?.remove();
    document.body.classList.remove('cam-on');
    this.hideNotice();
    this.poseLm?.close?.();
    this.faceLm?.close?.();
    if (this.guard) this.app.input.injectAction('guard', false);
    this.app.cursor?.dwell(0, true);
    this.pose = null;
  }

  showNotice(msg) {
    this.hideNotice();
    this.notice = h('div.toast', { style: { position: 'fixed', top: '90px', left: '50%', transform: 'translateX(-50%)', zIndex: 60 } }, msg);
    document.body.appendChild(this.notice);
  }
  hideNotice() { this.notice?.remove(); this.notice = null; }

  f(key, v, t) {
    let fl = this.filters.get(key);
    if (!fl) { fl = new OneEuro(1.2, 0.02); this.filters.set(key, fl); }
    return fl.filter(v, t);
  }

  // Converte um ponto do MediaPipe (mundo, metros) para o espaço do corpo do avatar, já suavizado.
  pt(lm, i, t) {
    const p = lm[i];
    return new THREE.Vector3(this.f(i + 'x', p.x, t), this.f(i + 'y', -p.y, t), this.f(i + 'z', -p.z, t));
  }

  update() {
    if (!this.running || !this.video || this.video.readyState < 2) return;
    const now = performance.now();
    if (now - (this.lastT || 0) < 33) return;
    const dt = Math.min(0.1, (now - (this.lastT || now)) / 1000) || 0.033;
    this.lastT = now;
    this.frame++;
    let res;
    try { res = this.poseLm.detectForVideo(this.video, now); } catch { return; }
    const world = res.worldLandmarks?.[0];
    const img = res.landmarks?.[0];
    if (!world || !img) return;
    this.process(world, img, now, dt);
  }

  // Processa um quadro de pontos do corpo (também usado nos testes automáticos com pontos sintéticos).
  process(world, img, now, dt = 0.033) {
    const t = now / 1000;
    const P = {};
    for (const [k, i] of Object.entries(IDX)) P[k] = this.pt(world, i, t);
    const dir = (a, b) => b.clone().sub(a).normalize();
    const hipMid = P.hipL.clone().add(P.hipR).multiplyScalar(0.5);
    const shMid = P.shL.clone().add(P.shR).multiplyScalar(0.5);
    const spine = shMid.clone().sub(hipMid);
    const shLine = P.shL.clone().sub(P.shR);

    // posição lateral e agachamento pela imagem
    const hipImgX = this.f('hx', (img[IDX.hipL].x + img[IDX.hipR].x) / 2, t);
    const hipImgY = this.f('hy', (img[IDX.hipL].y + img[IDX.hipR].y) / 2, t);
    this.bodyX = THREE.MathUtils.clamp((hipImgX - 0.5) * 2.6, -1, 1);
    if (this.baseHipY == null || hipImgY < this.baseHipY) this.baseHipY = this.baseHipY == null ? hipImgY : THREE.MathUtils.lerp(this.baseHipY, hipImgY, 0.05);
    this.crouch = THREE.MathUtils.clamp((hipImgY - this.baseHipY) * 5, 0, 1);

    // cabeça: rosto (se disponível) ou nariz vs orelhas
    let headYaw = THREE.MathUtils.clamp((img[IDX.nose].x - (img[IDX.earL].x + img[IDX.earR].x) / 2) * 6, -1, 1);
    let headPitch = 0, headRoll = 0;
    if (this.faceLm && this.video && this.frame % 2 === 0) {
      try {
        const fr = this.faceLm.detectForVideo(this.video, now);
        const m = fr.facialTransformationMatrixes?.[0]?.data;
        if (m) {
          const mat = new THREE.Matrix4().fromArray(m);
          const e = new THREE.Euler().setFromRotationMatrix(mat, 'YXZ');
          this.faceRot = { yaw: -e.y, pitch: e.x, roll: -e.z };
        }
      } catch {}
    }
    if (this.faceRot) { headYaw = this.faceRot.yaw; headPitch = this.faceRot.pitch; headRoll = this.faceRot.roll; }

    this.pose = {
      arms: {
        R: { upper: dir(P.shR, P.elR), lower: dir(P.elR, P.wrR) },
        L: { upper: dir(P.shL, P.elL), lower: dir(P.elL, P.wrL) },
      },
      legs: {
        R: { upper: dir(P.hipR, P.knR), lower: dir(P.knR, P.anR) },
        L: { upper: dir(P.hipL, P.knL), lower: dir(P.knL, P.anL) },
      },
      leanX: THREE.MathUtils.clamp(Math.atan2(spine.z, spine.y), -0.6, 0.6),
      leanZ: THREE.MathUtils.clamp(-Math.atan2(spine.x, spine.y), -0.5, 0.5),
      twist: THREE.MathUtils.clamp(-Math.atan2(shLine.z, shLine.x), -0.8, 0.8),
      headYaw: this.f('hyaw', headYaw, t), headPitch: this.f('hp', headPitch, t), headRoll: this.f('hr', headRoll, t),
      crouch: this.crouch,
    };

    this.seen = true;
    this.detectGestures(P, dt);
    this.detectArchery(P);
    this.detectPause(P, dt);
    if (this.cursorMode) this.driveCursor(img, t, dt);
  }

  // Cursor pela mão levantada (imagem espelhada: mover a mão para a direita leva o cursor para a direita).
  driveCursor(img, t, dt) {
    const app = this.app;
    const cur = app.cursor;
    if (!app.uiActive || !cur.enabled) { cur.dwell(0, true); return; }
    const shY = (img[IDX.shL].y + img[IDX.shR].y) / 2;
    const hipY = (img[IDX.hipL].y + img[IDX.hipR].y) / 2;
    // Mão "levantada" = acima da linha da cintura. Toda a tela cabe nessa faixa:
    // topo da tela = mão acima da cabeça, base da tela = mão na altura da cintura.
    const top = shY - (hipY - shY) * 0.9;
    const bottom = hipY - (hipY - shY) * 0.15;
    const raised = [IDX.wrR, IDX.wrL].map((i) => img[i]).filter((w) => w.y < bottom);
    if (!raised.length) { cur.dwell(0, true); return; }
    const hand = raised.reduce((a, b) => (a.y < b.y ? a : b));
    const sx = clamp(((1 - hand.x) - 0.2) / 0.6, 0, 1);
    const sy = clamp((hand.y - top) / (bottom - top), 0, 1);
    const x = this.f('cx', sx, t) * innerWidth;
    const y = this.f('cy', sy, t) * innerHeight;
    cur.setPos(x, y);
    cur.dwell(dt);
  }

  // Arco: braço esquerdo esticado aponta a mira; afastar as mãos puxa a corda; juntar as mãos solta.
  detectArchery(P) {
    const arm = P.wrL.clone().sub(P.shL).normalize();
    this.armAim = { y: Math.atan2(arm.x, Math.max(0.2, arm.z)), p: Math.asin(clamp(arm.y, -1, 1)) };
    const apart = P.wrL.distanceTo(P.wrR);
    const bowArm = P.wrL.z - P.shL.z > 0.3; // braço do arco esticado para a frente (para a câmera)
    if (!this.drawing && bowArm && apart > 0.5) this.drawing = true;
    else if (this.drawing && (!bowArm || apart < 0.3)) this.drawing = false;
  }

  // Pausa: as duas mãos acima da cabeça por 1 segundo (só durante a partida).
  detectPause(P, dt) {
    const up = P.wrL.y > P.nose.y + 0.12 && P.wrR.y > P.nose.y + 0.12;
    this.handsUpT = up ? this.handsUpT + dt : 0;
    if (this.handsUpT > 1.1 && this.app.sport) {
      this.handsUpT = -1.5; // espera antes de poder pausar/continuar de novo
      this.app.input.emit('button', { slot: 0, id: 'pause', down: true, source: 'camera' });
    }
  }

  detectGestures(P, dt) {
    const input = this.app.input;
    this.cool = Math.max(0, this.cool - dt);
    for (const side of ['R', 'L']) {
      const w = side === 'R' ? P.wrR : P.wrL;
      const sh = side === 'R' ? P.shR : P.shL;
      const rel = w.clone().sub(sh);
      const prev = this.wrist[side];
      this.wrist[side] = rel;
      if (!prev) continue;
      const v = rel.clone().sub(prev).divideScalar(dt);
      const sp = v.length();
      if (sp > 2.4 && this.cool <= 0) {
        this.cool = 0.38;
        const n = v.clone().normalize();
        input.injectSwing({ power: Math.min(1.3, sp / 6), dx: -n.x, dy: n.y, twist: 0, hand: side });
      }
    }
    // guarda: os dois punhos perto do rosto
    const nose = P.nose;
    const guard = P.wrL.distanceTo(nose) < 0.28 && P.wrR.distanceTo(nose) < 0.28;
    if (guard !== this.guard) { this.guard = guard; input.injectAction('guard', guard); }
    // esquiva: cabeça bem deslocada para o lado
    const hipMid = P.hipL.clone().add(P.hipR).multiplyScalar(0.5);
    const off = nose.x - hipMid.x;
    const now = performance.now();
    if (Math.abs(off) > 0.2 && now - this.lastDodge > 700) {
      this.lastDodge = now;
      const id = off > 0 ? 'dodgeL' : 'dodgeR';
      input.injectAction(id, true);
      setTimeout(() => input.injectAction(id, false), 100);
    }
  }
}
