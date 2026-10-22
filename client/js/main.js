// GO SPORTS - tela principal (TV/computador). Toda a imagem do jogo roda aqui; o celular é só o controle.
import { World } from './engine/world.js';
import { FX } from './engine/fx.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { Cursor } from './ui/cursor.js';
import { Socket } from './net.js';
import { ProfileManager } from './profile.js';
import { Plaza } from './scenes/plaza.js';
import { SCREENS } from './ui/screens.js';
import { toast, h } from './ui/dom.js';
import { Ads } from './ads.js';
import { Consent } from './consent.js';

import { SLOT_COLORS } from './constants.js';
// Sala da TV fica por aba (sessionStorage): recarregar mantém o pareamento, duas abas não disputam a mesma sala.
const tab = {
  get(k) { try { return JSON.parse(sessionStorage.getItem('gs_' + k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem('gs_' + k, JSON.stringify(v)); } catch {} },
};
export { SLOT_COLORS };

const app = {
  world: null, fx: null, audio: new Audio(), input: new Input(), cursor: null, pm: new ProfileManager(),
  sock: null, room: null, hostKey: tab.get('hostKey'), controllers: new Map(),
  screen: null, cleanup: null, uiActive: true, sport: null, paused: false, onBack: null,
  listeners: {}, textWaiters: new Map(), keyboardMode: false, pendingCal: null, camera: null,
  on(type, fn) { (this.listeners[type] ||= new Set()).add(fn); return () => this.listeners[type].delete(fn); },
  emit(type, e) { for (const fn of [...(this.listeners[type] || [])]) fn(e); },
};
window.app = app; // útil para depuração e testes automatizados

// ---------- navegação entre telas ----------
app.go = (name, params = {}) => {
  try { app.cleanup?.(); } catch (e) { console.error(e); }
  app.cleanup = null;
  app.onBack = null;
  const root = document.getElementById('ui');
  root.innerHTML = '';
  document.getElementById('hud').innerHTML = '';
  app.screen = name;
  app.uiActive = name !== 'game';
  app.cursor?.setFocus(null);
  const fn = SCREENS[name];
  if (!fn) throw new Error('tela desconhecida: ' + name);
  app.cleanup = fn(app, root, params) || null;
  Ads.onScreen(name);
};
app.back = () => { if (app.onBack) { app.audio.play('back'); app.onBack(); } };

// ---------- comunicação com os celulares ----------
app.sendCtrl = (slot, d) => app.sock?.send({ t: 'h', slot, d });
app.ctrlUi = (d, slot = 'all') => app.sendCtrl(slot, { k: 'ui', ...d });
app.vibrate = (slot, ms = 40) => app.sendCtrl(slot, { k: 'vibrate', ms });
app.phoneConnected = (slot = 0) => app.controllers.has(slot);
// Pede um texto ao celular (teclado do celular). Resolve com o texto ou null.
app.askText = (opts, slot = 0) => new Promise((resolve) => {
  const id = Math.random().toString(36).slice(2, 8);
  app.textWaiters.set(id, resolve);
  app.sendCtrl(slot, { k: 'text', id, ...opts });
});

function onSocketMessage(m) {
  switch (m.t) {
    case 'hosted':
      app.room = m.room;
      app.hostKey = m.hostKey;
      tab.set('hostKey', m.hostKey);
      tab.set('room', m.room);
      for (const c of m.controllers || []) app.controllers.set(c.slot, { slot: c.slot, cid: c.cid, ready: true });
      app.emit('room', m.room);
      app.emit('controllers');
      break;
    case 'ctrl_join': {
      const known = app.controllers.get(m.slot);
      app.controllers.set(m.slot, { slot: m.slot, cid: m.cid, ready: known?.ready || false, calStep: null });
      toast(`📱 Jogador ${m.slot + 1} conectou!`);
      app.audio.play('coin');
      app.ctrlUi({ hint: app.uiActive ? 'Arraste para mover o cursor · toque para clicar' : '', color: SLOT_COLORS[m.slot] }, m.slot);
      app.emit('controllers');
      break;
    }
    case 'ctrl_leave':
      app.controllers.delete(m.slot);
      toast(`Jogador ${m.slot + 1} desconectou`);
      app.emit('controllers');
      if (app.sport && !app.paused && m.slot === 0) app.pause();
      break;
    case 'c': onController(m.slot, m.d || {}); break;
    default: app.emit('net', m); // matchmaking/online
  }
}

function onController(slot, d) {
  const c = app.controllers.get(slot) || { slot };
  app.controllers.set(slot, c);
  switch (d.k) {
    case 'hello':
      c.sensors = d.sensors;
      if (d.cal) { c.cal = d.cal; }
      app.emit('controllers');
      return;
    case 'sensors': c.sensors = d.on; app.emit('controllers'); return;
    case 'calstep': c.calStep = { step: d.step, p: d.p }; app.emit('calstep', { slot, ...c.calStep }); return;
    case 'cal':
      c.cal = d.data;
      c.ready = true;
      if (slot === 0) {
        if (app.pm.profile) app.pm.save({ calibration: d.data });
        else app.pendingCal = d.data;
      }
      app.emit('controllers');
      app.emit('calibrated', { slot });
      return;
    case 'ready': c.ready = true; app.emit('controllers'); app.emit('calibrated', { slot }); return;
    case 'text': {
      const fn = app.textWaiters.get(d.id);
      app.textWaiters.delete(d.id);
      fn?.(d.value);
      return;
    }
  }
  app.input.fromController(slot, d);
}

// ---------- entrada global (menus) ----------
function bindGlobalInput() {
  const { input, cursor } = app;
  input.on('pointer', (e) => { if (app.uiActive) cursor.move(e.dx, e.dy); });
  input.on('tap', () => { if (app.uiActive) cursor.click(); });
  input.on('button', (e) => {
    if (!e.down) return;
    if (e.id === 'pause') {
      if (app.sport) return app.paused ? app.resume() : app.pause();
      if (app.uiActive) return app.back();
    }
    if (!app.uiActive) return;
    if (['up', 'down', 'left', 'right'].includes(e.id)) {
      if (e.source === 'key' && document.activeElement?.tagName === 'INPUT') return;
      cursor.nav(e.id);
    } else if (e.id === 'A') {
      if (e.source === 'key' && document.activeElement?.tagName === 'INPUT') return;
      cursor.pressA();
    } else if (e.id === 'B') app.back();
  });
  // Qualquer clique na tela principal libera o áudio (política de autoplay).
  const unlock = () => {
    app.audio.unlock();
    document.getElementById('soundGate').classList.add('hidden');
  };
  addEventListener('pointerdown', unlock);
  addEventListener('keydown', unlock);
  document.getElementById('soundGate').onclick = unlock;
  setTimeout(() => { if (!app.audio.ready) document.getElementById('soundGate').classList.remove('hidden'); }, 1500);
}

// ---------- pausa ----------
app.pause = () => {
  if (!app.sport || app.paused) return;
  app.paused = true;
  app.uiActive = true;
  app.sport.onPause?.();
  app.emit('pause');
};
app.resume = () => {
  if (!app.paused) return;
  app.paused = false;
  app.uiActive = false;
  app.sport?.onResume?.();
  app.emit('resume');
};

// ---------- loop principal ----------
function loop() {
  let last = performance.now();
  let fpsT = 0, frames = 0;
  const fpsEl = h('div.fps.hidden');
  document.body.appendChild(fpsEl);
  const frame = (dt, render = true) => {
    try {
      if (app.sport && !app.paused) app.sport.update(dt);
      else if (!app.sport) app.plaza.update(dt);
      app.camera?.update?.(dt);
      if (app.tracker && app.tracker !== app.camera) app.tracker.update();
      app.world.update(dt);
      app.fx.update(dt);
      if (render) app.world.render();
    } catch (e) {
      console.error(e);
    }
  };
  // Avança a simulação manualmente (testes automatizados / aba em segundo plano).
  app.step = (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) frame(dt, i === n - 1); };
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame(dt);
    frames++;
    fpsT += dt;
    if (fpsT > 0.5) {
      fpsEl.textContent = Math.round(frames / fpsT) + ' FPS';
      fpsEl.classList.toggle('hidden', !app.pm.profile?.settings?.showFps);
      frames = 0;
      fpsT = 0;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- inicialização ----------
async function boot() {
  app.world = new World(document.getElementById('gl'));
  app.fx = new FX(app.world);
  app.cursor = new Cursor(app.audio);
  app.cursor.setColor(SLOT_COLORS[0]);
  app.plaza = new Plaza(app);
  bindGlobalInput();
  loop();

  app.pm.onChange((p) => {
    if (!p) return;
    app.audio.setVolumes(p.settings.music, p.settings.sfx);
    if (app.pendingCal && !p.calibration) { const c = app.pendingCal; app.pendingCal = null; app.pm.save({ calibration: c }); }
    app.plaza.setAvatar(p.avatar);
    Ads.setProfile(p);
  });

  app.sock = new Socket({
    onOpen: () => app.sock.send({ t: 'host', room: tab.get('room'), hostKey: app.hostKey }),
    onMessage: onSocketMessage,
    onStatus: (s) => app.emit('netstatus', s),
  });

  Consent.init((c) => Ads.init(c));
  // Restaura perfil salvo em segundo plano (para a TV já mostrar seu avatar).
  app.restoring = app.pm.restore().then((ok) => { if (ok) app.pm.flushPending(); return ok; }).catch(() => false);

  document.getElementById('loading').classList.add('out');
  setTimeout(() => document.getElementById('loading').remove(), 600);
  app.audio.playMusic('menu');
  app.go('pairing');
}

// Modo só câmera: sem celular. A webcam move o cursor (mão levantada) e controla os jogos com o corpo.
app.startCameraOnly = async () => {
  let tr = null;
  try {
    const { CameraTracker } = await import('./camera/tracker.js');
    tr = new CameraTracker(app);
    await tr.start();
    tr.cursorMode = true;
    app.tracker = tr;
    app.cameraOnly = true;
    document.body.appendChild(h('div.cam-help', {}, '✋ Levante a mão: cursor · Pare sobre um botão: clica · 🙌 Mãos acima da cabeça: pausa'));
    toast('📷 Modo só câmera ligado! Levante a mão para mover o cursor ✋', 4000);
    return true;
  } catch (e) {
    console.warn('modo só câmera indisponível', e);
    tr?.stop();
    app.tracker = null;
    toast(e.name === 'NotAllowedError' ? 'Permissão da câmera negada. Libere a câmera no navegador para usar este modo.' : 'Não foi possível ligar a câmera 😢 Use o celular ou o teclado.', 4500);
    return false;
  }
};

// Depois que o celular foi pareado (ou o jogador escolheu teclado/mouse).
app.afterPairing = async () => {
  const ok = await app.restoring;
  if (ok && app.pm.profile) {
    toast(`Bem-vindo de volta, ${app.pm.profile.username}! 👋`);
    app.go('menu');
  } else {
    app.go('editor', { firstTime: true });
  }
};

boot().catch((e) => {
  console.error(e);
  document.getElementById('loading').innerHTML = '<div class="logo-big">Ops!</div><p style="color:#fff;font-weight:800">Não foi possível iniciar o jogo (WebGL indisponível?). Tente atualizar a página.</p>';
});
