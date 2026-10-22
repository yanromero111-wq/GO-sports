// Canal de uma partida online (via servidor). Cada lado é a "autoridade" das jogadas do seu próprio jogador;
// os esportes trocam apenas eventos pequenos (rebatidas, lançamentos, pontos), não vídeo nem física completa.
export class OnlineLink {
  constructor(app, info) {
    this.app = app;
    this.role = info.role; // 'A' (anfitrião da partida: saca primeiro / controla o relógio) ou 'B'
    this.seed = info.seed;
    this.opponent = info.opponent;
    this.handlers = new Set();
    this.leftHandlers = new Set();
    this.gone = false;
    this.off = app.on('net', (m) => {
      if (m.t === 'mm_msg') for (const fn of this.handlers) fn(m.d);
      if (m.t === 'mm_left') { this.gone = true; for (const fn of this.leftHandlers) fn(); }
    });
  }
  get isHost() { return this.role === 'A'; }
  send(d) { this.app.sock.send({ t: 'mm_msg', d }); }
  on(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }
  onLeft(fn) { this.leftHandlers.add(fn); return () => this.leftHandlers.delete(fn); }
  close() {
    this.off();
    this.handlers.clear();
    this.leftHandlers.clear();
    if (!this.gone) this.app.sock.send({ t: 'mm_cancel' });
  }
}
