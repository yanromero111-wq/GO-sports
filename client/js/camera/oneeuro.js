// Filtro "One Euro" (Casiez et al.): suaviza tremores parados sem atrasar movimentos rápidos.
class LowPass {
  constructor() { this.y = null; }
  filter(x, a) { this.y = this.y == null ? x : a * x + (1 - a) * this.y; return this.y; }
}
const alpha = (cutoff, dt) => { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); };

export class OneEuro {
  constructor(minCutoff = 1.0, beta = 0.01, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPass();
    this.dx = new LowPass();
    this.t = null;
  }
  filter(x, t) {
    const dt = this.t == null ? 1 / 30 : Math.max(1e-3, t - this.t);
    const prev = this.x.y;
    this.t = t;
    const dx = prev == null ? 0 : (x - prev) / dt;
    const edx = this.dx.filter(dx, alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(x, alpha(cutoff, dt));
  }
}
