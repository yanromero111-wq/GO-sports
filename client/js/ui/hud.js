// HUD dos jogos (placar, dicas, medidor de força) em DOM sobre o canvas.
import { h } from './dom.js';

export class Hud {
  constructor(root) {
    this.root = root;
    this.root.innerHTML = '';
    this.els = {};
  }
  clear() { this.root.innerHTML = ''; this.els = {}; }

  // players: [{name, color, score}] -> lado esquerdo (até 2) e direito (até 2)
  scoreboard(players, opts = {}) {
    this.els.score?.forEach((e) => e.remove());
    const left = h('div.score-box.left');
    const right = h('div.score-box.right');
    this.lines = players.map((p, i) => {
      const val = h('span.val', {}, String(p.score ?? 0));
      const extra = h('span.extra', { style: { fontSize: '14px', opacity: 0.75 } }, p.extra || '');
      const line = h('div.score-line', {}, h('span.dot', { style: { background: p.color } }), h('span', {}, p.name), extra, val);
      (opts.allLeft || i % 2 === 0 ? left : right).appendChild(line);
      return { line, val, extra };
    });
    this.root.append(left, right);
    this.els.score = [left, right];
  }
  setScore(i, v, extra) {
    const l = this.lines?.[i];
    if (!l) return;
    if (l.val.textContent !== String(v)) {
      l.val.textContent = String(v);
      l.line.animate([{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 300 });
    }
    if (extra !== undefined) l.extra.textContent = extra;
  }
  setActive(i) { this.lines?.forEach((l, j) => l.line.classList.toggle('active', i === j)); }

  center(text) {
    if (!this.els.center) { this.els.center = h('div.hud-center'); this.root.appendChild(this.els.center); }
    this.els.center.innerHTML = text;
    this.els.center.style.display = text ? '' : 'none';
  }
  hint(text) {
    if (!this.els.hint) { this.els.hint = h('div.hud-hint'); this.root.appendChild(this.els.hint); }
    this.els.hint.textContent = text || '';
    this.els.hint.style.display = text ? '' : 'none';
  }
  meter(v) {
    if (v == null) { this.els.meter?.remove(); this.els.meter = null; return; }
    if (!this.els.meter) { this.els.meter = h('div.meter', {}, h('div')); this.root.appendChild(this.els.meter); }
    this.els.meter.firstChild.style.height = Math.round(Math.max(0, Math.min(1, v)) * 100) + '%';
  }
  wind(text) {
    if (!this.els.wind) { this.els.wind = h('div.wind'); this.root.appendChild(this.els.wind); }
    this.els.wind.innerHTML = text;
  }
  // Bloco livre (cartela de pontos, barras de vida...)
  block(id, el) {
    this.els[id]?.remove();
    this.els[id] = el;
    if (el) this.root.appendChild(el);
    return el;
  }
}
