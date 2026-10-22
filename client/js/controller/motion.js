// Leitura dos sensores do celular e detecção de gestos (balanço, direção, giro de pulso).
// Convenção: o celular é segurado como um controle remoto, tela para cima, topo apontando para a TV.
//  - rotationRate.alpha (eixo Z, perpendicular à tela)  -> giro horizontal (balanço para os lados)
//  - rotationRate.beta  (eixo X, largura do celular)     -> giro vertical (balanço para cima/baixo)
//  - rotationRate.gamma (eixo Y, comprimento)            -> giro do pulso (efeito)

export const DEFAULT_CAL = { noise: 20, trigger: 200, swingPeak: 650, twistRange: 70, refAlpha: 0, restPitch: 20 };

export class Motion {
  constructor({ onSwing, onOrient, onRaw } = {}) {
    this.onSwing = onSwing;
    this.onOrient = onOrient;
    this.onRaw = onRaw;
    this.cal = { ...DEFAULT_CAL };
    this.leftHanded = false;
    this.started = false;
    this.gotMotion = false;
    this.swing = null;
    this.cooldownUntil = 0;
    this.orient = { alpha: 0, beta: 0, gamma: 0 };
    this.lastSent = 0;
    this.lastOrientSent = { y: 0, p: 0, r: 0 };
  }

  static needsPermission() {
    return typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
  }

  // No iPhone (iOS 13+) a permissão precisa ser pedida dentro de um toque do usuário.
  async requestPermission() {
    try {
      if (Motion.needsPermission()) {
        const a = await DeviceMotionEvent.requestPermission();
        if (a !== 'granted') return false;
        if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
          const b = await DeviceOrientationEvent.requestPermission();
          if (b !== 'granted') return false;
        }
      }
      return 'DeviceMotionEvent' in window;
    } catch (e) {
      console.warn('permissão negada', e);
      return false;
    }
  }

  start() {
    if (this.started) return;
    this.started = true;
    window.addEventListener('devicemotion', (e) => this.handleMotion(e));
    window.addEventListener('deviceorientation', (e) => this.handleOrientation(e));
  }

  handleOrientation(e) {
    if (e.alpha == null && e.beta == null) return;
    this.orient = { alpha: e.alpha || 0, beta: e.beta || 0, gamma: e.gamma || 0 };
    const now = performance.now();
    if (now - this.lastSent < 33) return;
    const o = this.relativeOrientation();
    const d = Math.abs(o.y - this.lastOrientSent.y) + Math.abs(o.p - this.lastOrientSent.p) + Math.abs(o.r - this.lastOrientSent.r);
    if (d < 0.008) return;
    this.lastSent = now;
    this.lastOrientSent = o;
    this.onOrient?.(o);
  }

  // Orientação relativa à calibração, em radianos (y = guinada, p = inclinação, r = giro do pulso).
  relativeOrientation() {
    let yaw = this.orient.alpha - this.cal.refAlpha;
    yaw = ((yaw + 540) % 360) - 180;
    const k = Math.PI / 180;
    const s = this.leftHanded ? -1 : 1;
    return {
      y: +(yaw * k * s).toFixed(3),
      p: +((this.orient.beta - this.cal.restPitch) * k).toFixed(3),
      r: +(this.orient.gamma * k * s).toFixed(3),
    };
  }

  recenter() {
    this.cal.refAlpha = this.orient.alpha;
    this.cal.restPitch = this.orient.beta;
  }

  handleMotion(e) {
    const rr = e.rotationRate;
    if (!rr || (rr.alpha == null && rr.beta == null)) return;
    this.gotMotion = true;
    const a = rr.alpha || 0, b = rr.beta || 0, g = rr.gamma || 0;
    const acc = e.acceleration || {};
    const accMag = Math.hypot(acc.x || 0, acc.y || 0, acc.z || 0);
    const mag = Math.hypot(a, b, g);
    const now = performance.now();
    const iv = e.interval || 16; // Chrome informa em ms; iOS antigo em segundos
    const dt = Math.min(0.05, iv > 1 ? iv / 1000 : iv);
    this.onRaw?.({ mag, a, b, g, accMag, dt, now });

    const score = Math.max(mag / this.cal.trigger, accMag / 18);
    if (!this.swing) {
      if (score > 1 && now > this.cooldownUntil) {
        this.swing = { start: now, peak: mag, peakAcc: accMag, sa: 0, sb: 0, twist: 0 };
      } else return;
    }
    const s = this.swing;
    s.peak = Math.max(s.peak, mag);
    s.peakAcc = Math.max(s.peakAcc, accMag);
    // Pondera pelas partes mais rápidas do movimento (o "golpe" em si, não a preparação).
    s.sa += a * Math.abs(a) * dt;
    s.sb += b * Math.abs(b) * dt;
    s.twist += g * dt;
    const dur = now - s.start;
    if ((dur > 140 && score < 0.55) || dur > 420) this.finishSwing();
  }

  finishSwing() {
    const s = this.swing;
    this.swing = null;
    this.cooldownUntil = performance.now() + 280;
    const norm = Math.hypot(s.sa, s.sb) || 1;
    const lr = this.leftHanded ? -1 : 1;
    const power = Math.min(1.3, Math.max(0.15, Math.max(s.peak / this.cal.swingPeak, s.peakAcc / 40)));
    const g = {
      pw: +power.toFixed(3),
      dx: +((-s.sa / norm) * lr).toFixed(3), // + = para a direita
      dy: +(s.sb / norm).toFixed(3), // + = para cima
      tw: +Math.max(-1, Math.min(1, (s.twist / this.cal.twistRange) * lr)).toFixed(3),
    };
    this.onSwing?.(g);
  }
}

// Calibração guiada em 3 passos. Chama onStep(stepIndex, progress 0..1) e resolve com a calibração.
export function runCalibration(motion, onStep) {
  return new Promise((resolve) => {
    const cal = { ...DEFAULT_CAL };
    let step = 0;
    let t0 = performance.now();
    const still = [];
    const peaks = [];
    let curPeak = 0;
    let inSwing = false;
    let gMin = 0, gMax = 0;
    let tick;

    const prevRaw = motion.onRaw;
    const prevSwing = motion.onSwing;
    motion.onSwing = null;
    motion.onRaw = (r) => {
      const now = r.now;
      if (step === 0) {
        still.push(r.mag);
      } else if (step === 1) {
        const th = Math.max(cal.noise * 3, 110);
        if (r.mag > th) { inSwing = true; curPeak = Math.max(curPeak, r.mag); }
        else if (inSwing && r.mag < th * 0.5) {
          inSwing = false;
          peaks.push(curPeak);
          curPeak = 0;
          onStep(1, peaks.length / 3);
          if (peaks.length >= 3) next();
        }
      } else if (step === 2) {
        gMin = Math.min(gMin, motion.orient.gamma);
        gMax = Math.max(gMax, motion.orient.gamma);
        onStep(2, Math.min(1, (now - t0) / 3500));
        if (now - t0 > 3500) next();
      }
    };

    function next() {
      step++;
      t0 = performance.now();
      if (step === 1) onStep(1, 0);
      if (step === 2) { gMin = gMax = motion.orient.gamma; onStep(2, 0); }
      if (step === 3) finish();
    }
    function finish() {
      clearInterval(tick);
      motion.onRaw = prevRaw;
      motion.onSwing = prevSwing;
      if (peaks.length) {
        const avg = peaks.reduce((a, b) => a + b, 0) / peaks.length;
        cal.trigger = Math.min(420, Math.max(120, avg * 0.38));
        cal.swingPeak = Math.max(300, avg * 1.1);
      }
      cal.twistRange = Math.max(30, Math.min(150, (gMax - gMin) / 2 || 70));
      resolve(cal);
    }

    onStep(0, 0);
    tick = setInterval(() => {
      if (step !== 0) return;
      const p = (performance.now() - t0) / 2000;
      onStep(0, Math.min(1, p));
      if (p >= 1) {
        if (still.length) {
          const mean = still.reduce((a, b) => a + b, 0) / still.length;
          const sd = Math.sqrt(still.reduce((a, b) => a + (b - mean) ** 2, 0) / still.length);
          cal.noise = Math.max(5, mean + 3 * sd);
        }
        cal.refAlpha = motion.orient.alpha;
        cal.restPitch = motion.orient.beta;
        motion.cal.refAlpha = cal.refAlpha;
        motion.cal.restPitch = cal.restPitch;
        next();
      }
    }, 100);

    runCalibration.cancel = () => { step = 99; finish(); };
  });
}
