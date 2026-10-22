// Escolha de modo (BOT/local/online), dificuldade, controle, arena e duração antes da partida.
import { h, toast } from '../dom.js';
import { panelTitle, leagueBadge } from '../widgets.js';
import { SPORTS, DIFFICULTIES } from '../../../shared/progression.js';
import { itemsFor, isOwned, equipped } from '../../../shared/catalog.js';
import { levelFromXp } from '../../../shared/progression.js';
import { SPORT_META } from '../../sports/registry.js';
import { SLOT_COLORS } from '../../constants.js';

const last = {};

export function setupScreen(app, root, params) {
  const p = app.pm.profile;
  const sport = SPORTS.find((s) => s.id === params.sport);
  const meta = SPORT_META[sport.id];
  const arenas = itemsFor(sport.id, 'arena');
  const st = last[sport.id] || {
    mode: 'bot', difficulty: 'medium', control: p.settings.controlMode === 'camera' ? 'camera' : 'motion',
    arena: arenas[0].id, length: (meta.lengths.find((l) => l.def) || meta.lengths[0]).id,
  };
  last[sport.id] = st;
  app.plaza.setView('menu');

  const render = () => {
    root.innerHTML = '';
    const sel = (cond) => (cond ? '.sel' : '');
    const modeBtn = (id, em, label) => h('button.btn.mode-btn' + sel(st.mode === id), { onclick: () => { st.mode = id; app.audio.play('click'); render(); } }, h('span.em', {}, em), label);
    const humans = [...app.controllers.keys()].sort();
    const localPlayers = Math.min(meta.maxLocal, 1 + humans.filter((s) => s !== 0).length); // J1 = celular 1 ou teclado

    const sections = [
      h('div.section-title', {}, 'Modo de jogo'),
      h('div.setup-grid', {}, modeBtn('bot', '🤖', 'Contra BOT'), modeBtn('local', '👥', 'Com amigos'), modeBtn('online', '🌍', 'Online')),
    ];
    if (st.mode === 'bot') {
      sections.push(h('div.section-title', {}, 'Dificuldade'), h('div.setup-grid', {}, Object.entries(DIFFICULTIES).map(([id, d]) =>
        h('button.btn' + sel(st.difficulty === id) + (st.difficulty === id ? '.blue' : ''), { onclick: () => { st.difficulty = id; render(); } }, { easy: '😊 ', medium: '😎 ', hard: '🔥 ' }[id] + d.name))));
    } else if (st.mode === 'local') {
      const others = humans.filter((s) => s !== 0);
      sections.push(h('div.section-title', {}, `Jogadores (até ${meta.maxLocal})`),
        h('div.row.wrap', {},
          h('span.player-pill', { style: { background: SLOT_COLORS[0] } }, `J1 · ${p.username}`),
          ...others.slice(0, meta.maxLocal - 1).map((s) => h('span.player-pill', { style: { background: SLOT_COLORS[s] } }, `J${s + 1} · 📱`)),
          localPlayers < meta.maxLocal ? h('button.btn.small', { onclick: () => app.go('pairing', { returnTo: 'menu' }) }, '➕ Conectar celular de amigo') : null,
        ),
        others.length ? null : h('p.tiny', { style: { margin: 0, fontWeight: 800, color: '#ef476f' } }, 'Peça para um amigo escanear o QR code com o celular dele (sala ' + (app.room || '…') + ').'));
    } else {
      sections.push(h('p', { style: { margin: 0, fontWeight: 700 } }, 'Partida contra alguém da sua liga ', leagueBadge(p.ratings[sport.id]?.lp || 0),
        '. Se ninguém aparecer em alguns segundos, você joga contra um BOT reserva.'));
      if (app.pm.isGuest) sections.push(h('p.tiny', { style: { margin: 0, color: '#ef476f', fontWeight: 800 } }, 'Dica: crie uma conta para aparecer no ranking global.'));
    }

    if (app.cameraOnly) sections.push(h('div.section-title', {}, 'Controle'), h('p', { style: { margin: 0, fontWeight: 800 } }, '📷 Modo só câmera: você joga com o corpo inteiro, sem celular.'));
    else sections.push(h('div.section-title', {}, 'Controle'), h('div.setup-grid', {},
      h('button.btn' + sel(st.control === 'motion') + (st.control === 'motion' ? '.blue' : ''), { onclick: () => { st.control = 'motion'; render(); } }, '📱 Sem câmera'),
      h('button.btn' + sel(st.control === 'camera') + (st.control === 'camera' ? '.blue' : ''), { onclick: () => { st.control = 'camera'; render(); } }, '📷 Com câmera'),
    ));
    if (st.control === 'camera') sections.push(h('p.tiny', { style: { margin: 0, fontWeight: 700 } }, '📷 A webcam é processada só neste aparelho; o vídeo não é enviado para lugar nenhum. Dá para desligar a qualquer momento na pausa.'));

    const lv = levelFromXp(p.xp).level;
    sections.push(h('div.section-title', {}, 'Arena'), h('div.setup-grid', {}, arenas.map((a) => {
      const owned = isOwned(p, a);
      const lock = owned ? '' : a.level && lv < a.level ? `🔒 Nível ${a.level}` : `🔒 ${a.price} 💰 (Loja)`;
      return h('button.btn.small' + (st.arena === a.id ? '.blue' : ''), {
        onclick: () => { if (!owned) return toast(a.level && lv < a.level ? `Chegue ao nível ${a.level} para desbloquear` : 'Compre esta arena na Loja 🛍️'); st.arena = a.id; render(); },
        style: { flexDirection: 'column', opacity: owned ? 1 : 0.6 },
      }, a.name, lock ? h('small', {}, lock) : null);
    })));

    sections.push(h('div.section-title', {}, 'Duração'), h('div.setup-grid', {}, meta.lengths.map((l) =>
      h('button.btn.small' + (st.length === l.id ? '.blue' : ''), { onclick: () => { st.length = l.id; render(); } }, l.label))));

    const start = () => {
      app.audio.play('coin');
      const setup = { sport: sport.id, ...st };
      if (st.mode === 'online') return app.go('matchmaking', { setup });
      if (st.mode === 'local' && localPlayers < 2) return toast('Conecte o celular de um amigo para jogar junto (ou escolha BOT)');
      app.go('game', { setup });
    };

    root.appendChild(h('div.screen', {}, h('div.panel.col', { style: { width: 'min(860px, 96vw)', maxHeight: '92vh' } },
      panelTitle(`${sport.icon} ${sport.name}`, () => app.go('menu')),
      h('div.col.scroll', { style: { gap: '10px' } }, sections),
      h('div.row', {},
        h('span.chip', {}, '🎒 ', ['racket', 'paddle', 'ball', 'bat', 'gloves', 'bow', 'club'].map((s) => equipped(p, sport.id, s)?.name).filter(Boolean).slice(0, 2).join(' · ') || 'Equipamento padrão'),
        h('div.grow'),
        h('button.btn.big.primary', { onclick: start }, st.mode === 'online' ? 'Procurar partida 🌍' : 'Jogar! ▶'),
      ),
    )));
  };
  render();
  app.onBack = () => app.go('menu');
}
