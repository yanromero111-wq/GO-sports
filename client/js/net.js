// Conexão WebSocket com reconexão automática + helpers de URL do backend.
import { CONFIG } from '../config.js';

export const apiBase = () => (CONFIG.SERVER_URL || location.origin).replace(/\/$/, '');
export const wsUrl = () => apiBase().replace(/^http/, 'ws') + '/ws';

export class Socket {
  constructor({ onOpen, onMessage, onStatus } = {}) {
    this.onOpen = onOpen;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.retry = 0;
    this.queue = [];
    this.closed = false;
    this.connect();
  }
  connect() {
    this.onStatus?.('connecting');
    const ws = (this.ws = new WebSocket(wsUrl()));
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus?.('online');
      this.onOpen?.();
      for (const m of this.queue.splice(0)) ws.send(m);
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.onMessage?.(msg);
    };
    ws.onclose = () => {
      if (this.closed) return;
      this.onStatus?.('offline');
      const wait = Math.min(8000, 500 * 2 ** this.retry++);
      setTimeout(() => this.connect(), wait);
    };
    ws.onerror = () => {};
  }
  get open() { return this.ws && this.ws.readyState === 1; }
  send(obj) {
    const s = JSON.stringify(obj);
    if (this.open) this.ws.send(s);
    else if (this.queue.length < 50 && obj.t !== 'c') this.queue.push(s);
  }
  close() { this.closed = true; this.ws?.close(); }
}
