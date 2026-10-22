// Página do celular: só interface de controle (touchpad, botões, sensores). Nada de gráficos pesados.
import { Socket } from '../net.js';
import { Motion, runCalibration, DEFAULT_CAL } from './motion.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const store = {
  get(k, d) { try { const v = localStorage.getItem('gsc_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gsc_' + k, JSON.stringify(v)); } catch {} },
};

const SLOT_COLORS = ['#3a86ff', '#ef476f', '#4cc96f', '#ff9f1c'];
let room = (params.get('room') || store.get('room', '') || '').toUpperCase();
let cid = store.get('cid', null) || Math.random().toString(36).slice(2, 12);
store.set('cid', cid);
let slot = null;
let joined = false;
let sensorsOn = false;
let screen = 'connect';
let settings = store.get('settings', { sens: 1.4, lefty: false, sim: false });

const motion = new Motion({
  onSwing: (g) => { send({ k: 's', ...g }); buzz(15); },
  onOrient: (o) => { if (screen === 'pad') send({ k: 'o', ...o }); },
});
motion.leftHanded = settings.lefty;
const savedCal = store.get('cal', null);
if (savedCal) Object.assign(motion.cal, savedCal);

// ---------- conexão ----------
const sock = new Socket({
  onOpen: () => { if (room) sock.send({ t: 'join', room, cid }); },
  onStatus: (s) => {
    $('dot').className = 'dot ' + (s === 'online' && joined ? 'online' : s === 'offline' ? 'offline' : '');
    if (s !== 'online') { joined = false; $('status').textContent = s === 'offline' ? 'Sem conexão… tentando de novo' : 'Conectando…'; }
  },
  onMessage: onMessage,
});

function send(d) { if (joined) sock.send({ t: 'c', d }); }

function onMessage(m) {
  if (m.t === 'joined') {
    joined = true;
    slot = m.slot;
    store.set('room', m.room);
    $('dot').className = 'dot online';
    $('status').textContent = `Conectado à sala ${m.room}`;
    $('slot').textContent = 'J' + (slot + 1);
    $('slot').style.background = SLOT_COLORS[slot];
    $('slot').classList.remove('hidden');
    send({ k: 'hello', cal: store.get('cal', null), sensors: sensorsOn, ua: navigator.userAgent.slice(0, 80) });
    if (screen === 'connect') show(sensorsOn ? 'pad' : 'perm');
  } else if (m.t === 'error') {
    joined = false;
    toast(m.msg);
    if (m.code === 'no_room' || m.code === 'host_gone') {
      store.set('room', '');
      room = '';
      show('connect');
      $('codeForm').classList.remove('hidden');
      $('connectMsg').textContent = m.msg;
    }
  } else if (m.t === 'h') onHost(m.d || {});
}

function onHost(d) {
  switch (d.k) {
    case 'ui': return applyUi(d);
    case 'vibrate': return buzz(d.ms || 30);
    case 'text': return askText(d);
    case 'calibrate': return startCalibration();
    case 'recenter': motion.recenter(); return;
    case 'toast': return toast(d.msg);
  }
}

// ---------- telas ----------
function show(name) {
  screen = name;
  for (const s of ['connect', 'perm', 'cal', 'pad']) $('s-' + s).classList.toggle('hidden', s !== name);
}

if (!room) {
  $('codeForm').classList.remove('hidden');
} else {
  $('connectMsg').textContent = `Entrando na sala ${room}…`;
}
$('codeBtn').onclick = () => {
  const c = $('codeInput').value.trim().toUpperCase();
  if (c.length !== 4) return toast('O código tem 4 letras');
  room = c;
  $('connectMsg').textContent = `Entrando na sala ${room}…`;
  sock.send({ t: 'join', room, cid });
};

$('permBtn').onclick = async () => {
  keepAwake();
  const ok = await motion.requestPermission();
  if (!ok) {
    toast('Sensores indisponíveis. Usando gestos por toque.');
    return enterPad(true);
  }
  motion.start();
  sensorsOn = true;
  send({ k: 'sensors', on: true });
  // Se nenhum evento chegar (ex.: computador), cai para os gestos por toque.
  setTimeout(() => { if (!motion.gotMotion) { toast('Não detectamos sensores. Usando gestos por toque.'); settings.sim = true; } }, 1500);
  if (store.get('cal', null)) enterPad(false);
  else startCalibration();
};
$('noSensorBtn').onclick = () => { keepAwake(); enterPad(true); };

function enterPad(sim) {
  if (sim) settings.sim = true;
  store.set('settings', settings);
  $('sim').classList.toggle('hidden', !settings.sim);
  show('pad');
  send({ k: 'ready', sensors: sensorsOn && motion.gotMotion });
}

// ---------- calibração ----------
const CAL_STEPS = [
  { emoji: '✋', title: 'Segure parado', desc: 'Segure o celular como um controle: tela para cima, topo apontando para a TV. Fique parado.' },
  { emoji: '🎾', title: 'Balance para frente', desc: 'Balance o celular para frente 3 vezes, como uma raquete. Segure firme!' },
  { emoji: '🔄', title: 'Gire o pulso', desc: 'Gire o pulso para a esquerda e para a direita algumas vezes.' },
];
async function startCalibration() {
  if (!sensorsOn) { toast('Ative os sensores primeiro'); show('perm'); return; }
  show('cal');
  const cal = await runCalibration(motion, (i, p) => {
    const st = CAL_STEPS[i];
    $('calCount').textContent = `Passo ${i + 1} de 3`;
    $('calEmoji').textContent = st.emoji;
    $('calTitle').textContent = st.title;
    $('calDesc').textContent = st.desc;
    $('calBar').style.width = Math.round(p * 100) + '%';
    send({ k: 'calstep', step: i, p });
  });
  Object.assign(motion.cal, cal);
  store.set('cal', cal);
  send({ k: 'cal', data: cal });
  buzz([40, 60, 40]);
  toast('Calibração salva! ✅');
  enterPad(false);
}
$('calSkip').onclick = () => {
  if (runCalibration.cancel) runCalibration.cancel();
  else { store.set('cal', DEFAULT_CAL); send({ k: 'cal', data: DEFAULT_CAL, skipped: true }); enterPad(false); }
};

// ---------- touchpad ----------
const pad = $('pad');
let touch = null;
let pending = { dx: 0, dy: 0 };
pad.addEventListener('pointerdown', (e) => {
  pad.setPointerCapture(e.pointerId);
  touch = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 };
  pad.classList.add('active');
  dot(e);
});
pad.addEventListener('pointermove', (e) => {
  if (!touch || e.pointerId !== touch.id) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  touch.x = e.clientX; touch.y = e.clientY;
  touch.moved += Math.abs(dx) + Math.abs(dy);
  pending.dx += dx * settings.sens;
  pending.dy += dy * settings.sens;
  dot(e);
});
const endTouch = (e) => {
  if (!touch || e.pointerId !== touch.id) return;
  if (performance.now() - touch.t < 280 && touch.moved < 14) { send({ k: 'tap' }); buzz(12); }
  touch = null;
  pad.classList.remove('active');
  $('padDot').style.display = 'none';
};
pad.addEventListener('pointerup', endTouch);
pad.addEventListener('pointercancel', endTouch);
function dot(e) {
  const r = pad.getBoundingClientRect();
  const d = $('padDot');
  d.style.display = 'block';
  d.style.left = e.clientX - r.left + 'px';
  d.style.top = e.clientY - r.top + 'px';
}
(function flush() {
  if (pending.dx || pending.dy) {
    send({ k: 'm', dx: Math.round(pending.dx * 10) / 10, dy: Math.round(pending.dy * 10) / 10 });
    pending = { dx: 0, dy: 0 };
  }
  requestAnimationFrame(flush);
})();

// ---------- botões ----------
function bindButton(el, id, kind = 'b') {
  const down = (e) => {
    e.preventDefault();
    el.classList.add('down');
    buzz(10);
    if (id === 'center') { motion.recenter(); toast('Centralizado 🎯'); }
    send({ k: kind, id, down: true });
  };
  const up = (e) => {
    e.preventDefault();
    if (!el.classList.contains('down')) return;
    el.classList.remove('down');
    send({ k: kind, id, down: false });
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', up);
  el.addEventListener('pointercancel', up);
}
document.querySelectorAll('[data-btn]').forEach((el) => bindButton(el, el.dataset.btn));

function applyUi(d) {
  if (d.hint !== undefined) $('hint').textContent = d.hint;
  if (d.color) $('slot').style.background = d.color;
  const box = $('actions');
  box.innerHTML = '';
  for (const a of d.actions || []) {
    const b = document.createElement('button');
    b.textContent = a.label;
    if (a.color) b.style.background = a.color;
    box.appendChild(b);
    bindButton(b, a.id, 'act');
  }
}

// ---------- gestos por toque (sem sensores / teste) ----------
const SIMS = {
  soft: { pw: 0.35, dx: 0, dy: 0.1, tw: 0 },
  mid: { pw: 0.65, dx: 0, dy: 0.1, tw: 0 },
  hard: { pw: 1.0, dx: 0, dy: 0.15, tw: 0 },
  up: { pw: 0.8, dx: 0, dy: 0.9, tw: 0 },
  down: { pw: 0.7, dx: 0, dy: -0.9, tw: 0 },
  twist: { pw: 0.7, dx: 0, dy: 0, tw: 0.8 },
  left: { pw: 0.7, dx: -0.9, dy: 0, tw: 0 },
  right: { pw: 0.7, dx: 0.9, dy: 0, tw: 0 },
};
document.querySelectorAll('[data-sim]').forEach((el) => {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    send({ k: 's', ...SIMS[el.dataset.sim], sim: true });
    buzz(15);
  });
});

// ---------- texto ----------
let textReq = null;
function askText(d) {
  textReq = d;
  $('textPrompt').textContent = d.prompt || 'Digite';
  const inp = $('textInput');
  inp.type = d.type === 'password' ? 'password' : 'text';
  inp.value = d.value || '';
  inp.maxLength = d.max || 32;
  $('s-text').classList.remove('hidden');
  setTimeout(() => inp.focus(), 50);
}
function closeText(ok) {
  if (!textReq) return;
  send({ k: 'text', id: textReq.id, value: ok ? $('textInput').value : null });
  textReq = null;
  $('textInput').value = '';
  $('textInput').blur();
  $('s-text').classList.add('hidden');
}
$('textOk').onclick = () => closeText(true);
$('textCancel').onclick = () => closeText(false);
$('textInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') closeText(true); });

// ---------- ajustes ----------
$('menuBtn').onclick = () => {
  $('sens').value = settings.sens;
  $('lefty').checked = settings.lefty;
  $('simToggle').checked = settings.sim;
  $('s-settings').classList.remove('hidden');
};
$('closeSettings').onclick = () => {
  settings = { sens: +$('sens').value, lefty: $('lefty').checked, sim: $('simToggle').checked };
  motion.leftHanded = settings.lefty;
  store.set('settings', settings);
  $('sim').classList.toggle('hidden', !settings.sim);
  $('s-settings').classList.add('hidden');
};
$('recal').onclick = () => { $('s-settings').classList.add('hidden'); startCalibration(); };

// ---------- utilidades ----------
function buzz(ms) { try { navigator.vibrate?.(ms); } catch {} }
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}
let wakeLock = null;
async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wakeLock) keepAwake(); });

// Ganchos de teste (usados no modo de desenvolvimento para simular o celular).
window.__ctrl = {
  send, motion, sims: SIMS, state: () => ({ joined, slot, screen }),
  testCalibration: () => { motion.start(); sensorsOn = true; return startCalibration(); },
};
if (params.get('sim') === '1') { settings.sim = true; }
