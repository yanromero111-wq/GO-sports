// Cursor controlado pelo touchpad do celular + navegação por setas (d-pad) nos menus.
const CLICKABLE = 'button:not([disabled]), [data-click], input, select, a[href]';

export class Cursor {
  constructor(audio) {
    this.audio = audio;
    this.el = document.getElementById('cursor');
    this.x = innerWidth / 2;
    this.y = innerHeight / 2;
    this.hoverEl = null;
    this.focusEl = null;
    this.lastMove = 0;
    this.color = '#3a86ff';
    this.enabled = true;
    setInterval(() => {
      if (performance.now() - this.lastMove > 5000) this.el.style.opacity = '0.35';
    }, 1000);
  }

  setColor(c) { this.color = c; this.el.style.setProperty('--c', c); }

  move(dx, dy) {
    if (!this.enabled) return;
    this.x = Math.max(0, Math.min(innerWidth - 4, this.x + dx));
    this.y = Math.max(0, Math.min(innerHeight - 4, this.y + dy));
    this.lastMove = performance.now();
    this.el.classList.remove('hidden');
    this.el.style.opacity = '1';
    this.render();
    this.updateHover();
  }
  render() { this.el.style.transform = `translate(${this.x}px, ${this.y}px)`; }

  // Posição absoluta (mão rastreada pela câmera).
  setPos(x, y) {
    if (!this.enabled) return;
    this.x = Math.max(0, Math.min(innerWidth - 4, x));
    this.y = Math.max(0, Math.min(innerHeight - 4, y));
    this.lastMove = performance.now();
    this.el.classList.remove('hidden');
    this.el.style.opacity = '1';
    this.render();
    this.updateHover();
  }

  // Clique por permanência: segurar o cursor parado sobre um botão por ~1,2 s clica nele.
  dwell(dt, reset = false) {
    const DWELL = 1.2;
    const t = reset ? null : this.target();
    if (t !== this.dwellEl) { this.dwellEl = t; this.dwellT = 0; }
    else if (t) {
      this.dwellT += dt;
      if (this.dwellT >= DWELL) {
        this.audio?.play('click');
        this.click();
        this.dwellT = -0.9; // pausa antes de poder clicar de novo no mesmo botão
      }
    }
    this.el.style.setProperty('--dwell', String(Math.max(0, Math.min(1, (this.dwellT || 0) / DWELL))));
  }

  target() {
    const el = document.elementFromPoint(this.x, this.y);
    return el ? el.closest(CLICKABLE) : null;
  }

  updateHover() {
    const t = this.target();
    if (t === this.hoverEl) return;
    this.hoverEl?.classList.remove('hover');
    this.hoverEl = t;
    if (t) {
      t.classList.add('hover');
      this.audio?.play('hover');
      this.setFocus(null);
    }
  }

  setFocus(el) {
    this.focusEl?.classList.remove('focus');
    this.focusEl = el;
    el?.classList.add('focus');
  }

  // Toque no touchpad: clica onde está o cursor.
  click() {
    if (!this.enabled) return false;
    const t = this.target();
    this.el.classList.add('click');
    setTimeout(() => this.el.classList.remove('click'), 120);
    const r = document.createElement('div');
    r.className = 'ripple';
    r.style.left = this.x + 'px';
    r.style.top = this.y + 'px';
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 500);
    if (!t) return false;
    this.activate(t);
    return true;
  }

  activate(el) {
    if (el.tagName === 'INPUT' && !['checkbox', 'radio', 'range'].includes(el.type)) { el.focus(); el.dispatchEvent(new Event('cursorfocus')); return; }
    if (el.tagName === 'INPUT' && el.type === 'range') {
      const r = el.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (this.x - r.left) / r.width));
      el.value = +el.min + f * (+el.max - +el.min);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), 120);
    el.click();
  }

  // Botão A: ativa o elemento focado (setas) ou o que está sob o cursor.
  pressA() {
    const el = this.focusEl && document.body.contains(this.focusEl) ? this.focusEl : this.target();
    if (el) { this.activate(el); return true; }
    return false;
  }

  visibleClickables() {
    const ui = document.getElementById('ui');
    const overlays = ui.querySelectorAll('.overlay');
    const overlay = overlays[overlays.length - 1]; // se há um overlay, só navega dentro dele
    return [...ui.querySelectorAll(CLICKABLE)].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      if (r.bottom < 0 || r.top > innerHeight) return false;
      return !overlay || overlay.contains(el);
    });
  }

  // Navegação espacial com o d-pad / setas do teclado.
  nav(dir) {
    const items = this.visibleClickables();
    if (!items.length) return;
    const cur = (this.focusEl && document.body.contains(this.focusEl) && this.focusEl) || this.hoverEl || null;
    let next = null;
    if (!cur) next = items[0];
    else {
      const a = cur.getBoundingClientRect();
      const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
      const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      let best = Infinity;
      for (const el of items) {
        if (el === cur) continue;
        const b = el.getBoundingClientRect();
        const dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
        const along = dx * v[0] + dy * v[1];
        if (along <= 4) continue;
        const across = Math.abs(dx * v[1] - dy * v[0]);
        const score = along + across * 2.2;
        if (score < best) { best = score; next = el; }
      }
    }
    if (!next) return;
    this.hoverEl?.classList.remove('hover');
    this.hoverEl = null;
    this.setFocus(next);
    next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const r = next.getBoundingClientRect();
    this.x = r.left + r.width / 2;
    this.y = r.top + r.height / 2;
    this.render();
    this.audio?.play('hover');
  }
}
