// Tela de jogo: carrega o módulo do esporte, mostra tutorial na 1ª vez, pausa e termina a partida.
import { h, toast } from '../dom.js';
import { Hud } from '../hud.js';
import { loadSport, SPORT_META } from '../../sports/registry.js';
import { SPORTS } from '../../../shared/progression.js';
import { equipped } from '../../../shared/catalog.js';
import { botProfile } from '../../engine/avatar.js';
import { SLOT_COLORS } from '../../constants.js';
import { OnlineLink } from '../../online.js';

export function gameScreen(app, root, params) {
  const { setup, online } = params;
  const p = app.pm.profile;
  const meta = SPORT_META[setup.sport];
  const info = SPORTS.find((s) => s.id === setup.sport);
  let disposed = false;
  let sport = null;
  let pauseEl = null;
  let finished = false;

  app.uiActive = false;
  app.cursor.el.classList.add('hidden');
  app.cursor.enabled = false;
  app.audio.playMusic('game');

  // ---------- jogadores ----------
  const players = [{ slot: 0, name: p.username, avatar: p.avatar, kind: 'human', color: SLOT_COLORS[0] }];
  const botFallback = setup.mode === 'online' && !online;
  let difficulty = setup.difficulty;
  if (botFallback) difficulty = (p.ratings[setup.sport]?.lp || 0) >= 700 ? 'hard' : 'medium';
  if (setup.mode === 'bot' || botFallback) {
    const b = botProfile(Math.random() * 1e9);
    players.push({ slot: null, kind: 'bot', name: botFallback ? `${b.name} (BOT)` : `${b.name} (BOT)`, avatar: b.avatar, difficulty, color: '#ef476f' });
  } else if (setup.mode === 'local') {
    for (const slot of [...app.controllers.keys()].filter((s) => s !== 0).sort().slice(0, meta.maxLocal - 1)) {
      const b = botProfile(slot * 977 + 13);
      players.push({ slot, kind: 'human', name: `Jogador ${slot + 1}`, avatar: b.avatar, color: SLOT_COLORS[slot] });
    }
  } else if (online) {
    players.push({ slot: null, kind: 'remote', name: online.opponent.name, avatar: online.opponent.avatar || botProfile(online.seed).avatar, color: '#ef476f' });
  }
  const link = online ? new OnlineLink(app, online) : null;

  const hudRoot = document.getElementById('hud');
  const ctx = {
    app,
    setup: { ...setup, difficulty },
    players,
    online: link,
    hud: new Hud(hudRoot),
    meta,
    equip: (slot) => equipped(p, setup.sport, slot),
    arena: equipped({ ...p, equipped: { [setup.sport]: { arena: setup.arena } } }, setup.sport, 'arena'),
    finish: (r) => finish(r),
  };

  const loading = h('div.overlay', {}, h('div.panel.col.center', {}, h('div', { style: { fontSize: '64px' } }, info.icon), h('h2', {}, `Preparando ${info.name}…`), h('div.spinner', { style: { borderColor: '#dfe6ff', borderTopColor: '#3a86ff' } })));
  root.appendChild(loading);

  loadSport(setup.sport).then(async (mod) => {
    if (disposed) return;
    app.world.clearStage();
    app.fx.clear();
    sport = mod.create(ctx);
    app.sport = sport;
    loading.remove();
    app.ctrlUi({ hint: meta.hint, actions: meta.actions || [] });
    if (setup.control === 'camera' || app.cameraOnly) await startCamera();
    if (!p.tutorialsSeen.includes(setup.sport) && !link) showTutorial(() => sport.start());
    else sport.start();
  }).catch((e) => {
    console.error(e);
    toast('Erro ao carregar o esporte 😢');
    app.go('menu');
  });

  async function startCamera() {
    if (app.tracker) { // modo só câmera: reaproveita o rastreamento que já está ligado
      app.camera = app.tracker;
      sport?.setCameraMode?.(true);
      return;
    }
    try {
      const { CameraTracker } = await import('../../camera/tracker.js');
      app.camera = new CameraTracker(app);
      await app.camera.start();
      sport?.setCameraMode?.(true);
      toast('📷 Modo câmera ligado (processado só neste aparelho)');
    } catch (e) {
      console.warn('câmera indisponível', e);
      app.camera?.stop();
      app.camera = null;
      sport?.setCameraMode?.(false);
      toast('Câmera indisponível ou negada — voltando ao modo sem câmera 📱', 4000);
    }
  }
  function stopCamera() {
    if (app.camera !== app.tracker) app.camera?.stop();
    app.camera = null;
    sport?.setCameraMode?.(false);
    toast('Câmera desligada');
  }

  function showTutorial(onDone) {
    app.uiActive = true;
    app.cursor.enabled = true;
    const o = h('div.overlay', {}, h('div.panel.tutorial', {},
      h('h2', { style: { fontSize: '40px' } }, `${info.icon} Como jogar ${info.name}`),
      h('div.tut-steps', {}, (app.camera ? meta.cameraTutorial || meta.tutorial : meta.tutorial).map((s) => h('div.tut-step', {}, h('span.em', {}, s.em), s.text))),
      app.camera ? h('p', { style: { fontWeight: 800, margin: '0 0 10px' } }, '📷 Modo câmera: fique de corpo inteiro na frente da câmera. 🙌 Mãos acima da cabeça = pausa.') : null,
      h('p.tiny.muted', {}, 'Sem celular? Espaço = balançar (segure para mais força) · setas = mirar/direção · Enter = A · Esc = pausa'),
      h('button.btn.big.primary', { onclick: () => {
        o.remove();
        app.uiActive = false;
        app.cursor.enabled = false;
        app.cursor.el.classList.add('hidden');
        if (!p.tutorialsSeen.includes(setup.sport)) app.pm.save({ tutorialsSeen: [...p.tutorialsSeen, setup.sport] });
        onDone?.();
      } }, 'Entendi! ▶'),
    ));
    root.appendChild(o);
    setTimeout(() => app.cursor.nav('down'), 50);
  }

  // ---------- pausa ----------
  const offPause = app.on('pause', () => {
    app.cursor.enabled = true;
    pauseEl = h('div.overlay', {}, h('div.panel.col.center', { style: { minWidth: '360px' } },
      h('h2', { style: { fontSize: '40px' } }, '⏸ Pausa'),
      h('button.btn.big.primary', { style: { width: '100%' }, onclick: () => app.resume() }, '▶ Continuar'),
      h('button.btn', { style: { width: '100%' }, onclick: () => { pauseEl.remove(); pauseEl = null; showTutorial(() => app.resume()); } }, '❓ Como jogar'),
      link || app.cameraOnly ? null : h('button.btn', { style: { width: '100%' }, onclick: () => { app.camera ? stopCamera() : startCamera(); app.resume(); } }, app.camera ? '📷 Desligar câmera' : '📷 Ligar câmera'),
      link ? null : h('button.btn', { style: { width: '100%' }, onclick: () => { app.resume(); app.go('game', { setup }); } }, '🔄 Reiniciar'),
      h('button.btn.red', { style: { width: '100%' }, onclick: () => { app.resume(); app.go('menu'); } }, '🚪 Sair da partida'),
    ));
    root.appendChild(pauseEl);
    app.ctrlUi({ hint: 'Pausado: use o cursor para escolher', actions: [] });
    setTimeout(() => app.cursor.nav('down'), 50);
  });
  const offResume = app.on('resume', () => {
    pauseEl?.remove();
    pauseEl = null;
    app.cursor.enabled = false;
    app.cursor.el.classList.add('hidden');
    app.ctrlUi({ hint: meta.hint, actions: meta.actions || [] });
  });
  app.onBack = () => app.pause();

  // ---------- fim ----------
  function finish(r) {
    if (finished || disposed) return;
    finished = true;
    const result = {
      sport: setup.sport,
      mode: botFallback ? 'bot' : setup.mode,
      difficulty,
      won: !!r.won,
      draw: !!r.draw,
      myScore: r.myScore ?? 0,
      oppScore: r.oppScore ?? 0,
      durationSec: Math.round(sport?.time || 0),
      events: r.events || sport?.events || {},
      label: r.label,
      local: setup.mode === 'local' ? r.winnerName : null,
    };
    setTimeout(() => { if (!disposed) app.go('results', { result, setup }); }, 2600);
  }

  return () => {
    disposed = true;
    offPause();
    offResume();
    try { sport?.dispose?.(); } catch (e) { console.error(e); }
    app.sport = null;
    app.paused = false;
    if (app.camera !== app.tracker) app.camera?.stop();
    app.camera = null;
    link?.close();
    app.world.clearStage();
    app.fx.clear();
    app.cursor.enabled = true;
    document.getElementById('hud').innerHTML = '';
    app.ctrlUi({ hint: 'Arraste para mover o cursor · toque para clicar', actions: [] });
  };
}
