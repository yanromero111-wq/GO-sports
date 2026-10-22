// Entrada unificada: celulares (por slot), teclado/mouse (slot 0) e câmera (slot 0).
// Eventos emitidos:
//   swing  {slot, power 0..1.3, dx -1..1 (direita +), dy -1..1 (cima +), twist -1..1, hand?, source}
//   button {slot, id: 'A'|'B'|'up'|'down'|'left'|'right'|'pause'|'center', down}
//   action {slot, id, down}   (botões contextuais do celular, ex.: 'guard', 'draw')
//   tap    {slot}
//   pointer {slot, dx, dy}
export class Input {
  constructor() {
    this.handlers = {};
    this.players = new Map(); // slot -> estado
    this.keys = new Set();
    this.spaceDownAt = 0;
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
    this.bindKeyboard();
  }
  on(type, fn) {
    (this.handlers[type] ||= new Set()).add(fn);
    return () => this.handlers[type].delete(fn);
  }
  emit(type, e) { for (const fn of [...(this.handlers[type] || [])]) fn(e); }

  player(slot) {
    if (!this.players.has(slot)) this.players.set(slot, { slot, orient: { y: 0, p: 0, r: 0 }, buttons: {}, actions: {}, orientAt: 0 });
    return this.players.get(slot);
  }
  orient(slot) { return this.player(slot).orient; }
  hasLiveOrient(slot) { return performance.now() - this.player(slot).orientAt < 600; }
  isDown(slot, id) { const p = this.player(slot); return !!(p.buttons[id] || p.actions[id]); }

  // Mensagens vindas do celular
  fromController(slot, d) {
    const p = this.player(slot);
    switch (d.k) {
      case 'o': p.orient = { y: d.y, p: d.p, r: d.r }; p.orientAt = performance.now(); break;
      case 's': this.emit('swing', { slot, power: d.pw, dx: d.dx || 0, dy: d.dy || 0, twist: d.tw || 0, source: 'phone' }); break;
      case 'm': this.emit('pointer', { slot, dx: d.dx, dy: d.dy }); break;
      case 'tap': this.emit('tap', { slot }); break;
      case 'b': p.buttons[d.id] = d.down; this.emit('button', { slot, id: d.id, down: d.down }); break;
      case 'act': p.actions[d.id] = d.down; this.emit('action', { slot, id: d.id, down: d.down }); break;
    }
  }

  // ---------- teclado e mouse (para jogar/testar sem celular) ----------
  bindKeyboard() {
    const btnMap = { Enter: 'A', Escape: 'pause', Backspace: 'B', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const actMap = { KeyL: 'guard', KeyA: 'dodgeL', KeyD: 'dodgeR', ShiftLeft: 'draw', KeyF: 'draw' };
    const punchMap = {
      KeyJ: { power: 0.75, dx: 0, dy: 0, hand: 'L' }, KeyK: { power: 0.75, dx: 0, dy: 0, hand: 'R' },
      KeyU: { power: 0.85, dx: 0.9, dy: 0, hand: 'L' }, KeyO: { power: 0.85, dx: -0.9, dy: 0, hand: 'R' },
      KeyI: { power: 0.9, dx: 0, dy: 0.95 },
    };
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.repeat) return;
      this.keys.add(e.code);
      const p = this.player(0);
      if (e.code === 'Space') { this.spaceDownAt = performance.now(); e.preventDefault(); return; }
      if (btnMap[e.key]) { p.buttons[btnMap[e.key]] = true; this.emit('button', { slot: 0, id: btnMap[e.key], down: true, source: 'key' }); e.preventDefault(); }
      if (actMap[e.code]) { p.actions[actMap[e.code]] = true; this.emit('action', { slot: 0, id: actMap[e.code], down: true }); }
      if (punchMap[e.code]) this.emit('swing', { slot: 0, twist: 0, source: 'key', ...punchMap[e.code] });
    });
    addEventListener('keyup', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.keys.delete(e.code);
      const p = this.player(0);
      if (e.code === 'Space') {
        // Segure espaço para mais força. Setas durante o balanço dão a direção; Q/E dão efeito.
        const held = (performance.now() - this.spaceDownAt) / 1000;
        const power = Math.min(1.2, 0.3 + held * 1.1);
        const dy = this.keys.has('ArrowUp') || this.keys.has('KeyW') ? 0.9 : this.keys.has('ArrowDown') || this.keys.has('KeyS') ? -0.9 : 0.05;
        const dx = this.keys.has('ArrowRight') ? 0.8 : this.keys.has('ArrowLeft') ? -0.8 : 0;
        const twist = this.keys.has('KeyE') ? 0.8 : this.keys.has('KeyQ') ? -0.8 : 0;
        this.emit('swing', { slot: 0, power, dx, dy, twist, source: 'key' });
        return;
      }
      if (btnMap[e.key]) { p.buttons[btnMap[e.key]] = false; this.emit('button', { slot: 0, id: btnMap[e.key], down: false, source: 'key' }); }
      if (actMap[e.code]) { p.actions[actMap[e.code]] = false; this.emit('action', { slot: 0, id: actMap[e.code], down: false }); }
    });
    // Mouse sobre o jogo simula a orientação do celular do jogador 1 (mira no arco, posição no boliche…)
    addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      const p = this.player(0);
      if (this.hasLiveOrientFromPhone(0)) return;
      p.orient = { y: -(e.clientX / innerWidth - 0.5) * 1.2, p: -(e.clientY / innerHeight - 0.5) * 0.9, r: 0 };
    });
    addEventListener('mousedown', (e) => { if (e.button === 2) { this.player(0).actions.draw = true; this.emit('action', { slot: 0, id: 'draw', down: true }); } });
    addEventListener('mouseup', (e) => { if (e.button === 2) { this.player(0).actions.draw = false; this.emit('action', { slot: 0, id: 'draw', down: false }); } });
    addEventListener('contextmenu', (e) => { if (e.target.id === 'gl') e.preventDefault(); });
  }
  hasLiveOrientFromPhone(slot) { return performance.now() - this.player(slot).orientAt < 1500; }

  // Usado pelo modo câmera
  injectSwing(e) { this.emit('swing', { slot: 0, source: 'camera', ...e }); }
  injectAction(id, down) { this.player(0).actions[id] = down; this.emit('action', { slot: 0, id, down }); }
}
