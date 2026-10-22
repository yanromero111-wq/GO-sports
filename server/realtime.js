// WebSocket: pareamento tela principal <-> celulares (salas) e matchmaking online.
import { WebSocketServer } from 'ws';
import crypto from 'node:crypto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_CONTROLLERS = 4;
const ROOM_GRACE_MS = 2 * 60 * 1000; // sala sobrevive a uma queda rápida da tela principal
const MM_TIMEOUT_MS = Number(process.env.MM_TIMEOUT_MS || 8000);

const rooms = new Map(); // code -> { host, hostKey, controllers: Map(slot -> ws), expireTimer }
const queue = new Map(); // sport -> [{ ws, lp, info, since, timer }]
const matches = new Map(); // matchId -> [wsA, wsB]

const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };

function newCode() {
  for (let tries = 0; tries < 1000; tries++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
  throw new Error('sem códigos livres');
}

function handleHost(ws, msg) {
  let room = msg.room && rooms.get(String(msg.room).toUpperCase());
  if (room && room.hostKey === msg.hostKey) {
    clearTimeout(room.expireTimer);
    if (room.host && room.host !== ws) room.host.close();
  } else {
    const code = newCode();
    room = { code, hostKey: crypto.randomBytes(12).toString('hex'), host: null, controllers: new Map() };
    rooms.set(code, room);
  }
  room.host = ws;
  ws.role = 'host';
  ws.room = room;
  send(ws, { t: 'hosted', room: room.code, hostKey: room.hostKey, controllers: [...room.controllers.entries()].map(([slot, c]) => ({ slot, cid: c.cid })) });
}

function handleJoin(ws, msg) {
  const room = rooms.get(String(msg.room || '').toUpperCase());
  if (!room) return send(ws, { t: 'error', code: 'no_room', msg: 'Sala não encontrada. Confira o código na TV.' });
  const cid = String(msg.cid || crypto.randomBytes(6).toString('hex')).slice(0, 32);
  // Reconexão do mesmo celular mantém o mesmo jogador.
  let slot = [...room.controllers.entries()].find(([, c]) => c.cid === cid)?.[0];
  if (slot === undefined) {
    for (let s = 0; s < MAX_CONTROLLERS; s++) if (!room.controllers.has(s)) { slot = s; break; }
  }
  if (slot === undefined) return send(ws, { t: 'error', code: 'full', msg: 'Sala cheia (máximo 4 celulares).' });
  const old = room.controllers.get(slot);
  if (old && old !== ws) { old.replaced = true; old.close(); }
  ws.role = 'ctrl';
  ws.room = room;
  ws.slot = slot;
  ws.cid = cid;
  room.controllers.set(slot, ws);
  send(ws, { t: 'joined', slot, cid, room: room.code });
  send(room.host, { t: 'ctrl_join', slot, cid });
}

function leaveQueue(ws) {
  for (const [sport, list] of queue) {
    const i = list.findIndex((e) => e.ws === ws);
    if (i >= 0) { clearTimeout(list[i].timer); list.splice(i, 1); }
    if (!list.length) queue.delete(sport);
  }
}

function endMatch(ws, notify = true) {
  const id = ws.matchId;
  if (!id) return;
  const pair = matches.get(id);
  matches.delete(id);
  for (const p of pair || []) {
    if (p !== ws && notify) send(p, { t: 'mm_left' });
    p.matchId = null;
  }
}

function handleFind(ws, msg) {
  leaveQueue(ws);
  endMatch(ws);
  const sport = String(msg.sport || '');
  const lp = Number(msg.lp) || 0;
  const info = { name: String(msg.name || 'Jogador').slice(0, 16), avatar: msg.avatar || null, lp };
  const list = queue.get(sport) || [];
  const now = Date.now();
  // Faixa de liga aceita aumenta com o tempo de espera.
  const idx = list.findIndex((e) => e.ws !== ws && e.ws.readyState === 1 && Math.abs(e.lp - lp) <= 400 + (now - e.since) / 10);
  if (idx >= 0) {
    const other = list.splice(idx, 1)[0];
    clearTimeout(other.timer);
    const matchId = crypto.randomBytes(8).toString('hex');
    const seed = crypto.randomInt(1, 2 ** 31);
    matches.set(matchId, [other.ws, ws]);
    other.ws.matchId = matchId;
    ws.matchId = matchId;
    send(other.ws, { t: 'mm_found', matchId, role: 'A', seed, opponent: info, options: other.options });
    send(ws, { t: 'mm_found', matchId, role: 'B', seed, opponent: other.info, options: other.options });
    return;
  }
  const entry = { ws, lp, info, since: now, options: msg.options || {} };
  entry.timer = setTimeout(() => {
    leaveQueue(ws);
    send(ws, { t: 'mm_bot' }); // ninguém encontrado: o cliente joga contra um bot reserva
  }, MM_TIMEOUT_MS);
  list.push(entry);
  queue.set(sport, list);
  send(ws, { t: 'mm_wait', timeoutMs: MM_TIMEOUT_MS });
}

function relayMatch(ws, msg) {
  const pair = matches.get(ws.matchId);
  if (!pair) return;
  for (const p of pair) if (p !== ws) send(p, { t: 'mm_msg', d: msg.d });
}

function onClose(ws) {
  leaveQueue(ws);
  endMatch(ws);
  const room = ws.room;
  if (!room) return;
  if (ws.role === 'ctrl' && room.controllers.get(ws.slot) === ws) {
    room.controllers.delete(ws.slot);
    if (!ws.replaced) send(room.host, { t: 'ctrl_leave', slot: ws.slot });
  }
  if (ws.role === 'host' && room.host === ws) {
    room.host = null;
    room.expireTimer = setTimeout(() => {
      for (const c of room.controllers.values()) { send(c, { t: 'error', code: 'host_gone', msg: 'A tela principal foi fechada.' }); c.close(); }
      rooms.delete(room.code);
    }, ROOM_GRACE_MS);
  }
}

export function attachRealtime(servers) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  for (const server of servers) {
    server.on('upgrade', (req, socket, head) => {
      if (!req.url.startsWith('/ws')) return socket.destroy();
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    });
  }

  wss.on('connection', (ws) => {
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      switch (msg.t) {
        case 'host': return handleHost(ws, msg);
        case 'join': return handleJoin(ws, msg);
        case 'c': // celular -> tela
          if (ws.role === 'ctrl' && ws.room) send(ws.room.host, { t: 'c', slot: ws.slot, d: msg.d });
          return;
        case 'h': // tela -> celular(es)
          if (ws.role === 'host' && ws.room) {
            for (const [slot, c] of ws.room.controllers) if (msg.slot === 'all' || msg.slot === slot) send(c, { t: 'h', d: msg.d });
          }
          return;
        case 'mm_find': return handleFind(ws, msg);
        case 'mm_cancel': leaveQueue(ws); endMatch(ws); return;
        case 'mm_msg': return relayMatch(ws, msg);
        case 'ping': return send(ws, { t: 'pong', ts: msg.ts });
      }
    });
    ws.on('close', () => onClose(ws));
    ws.on('error', () => {});
  });

  const hb = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, 25000);
  wss.on('close', () => clearInterval(hb));
  return wss;
}
