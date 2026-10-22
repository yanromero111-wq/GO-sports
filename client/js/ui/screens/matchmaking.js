// Procura adversário online na mesma liga; se ninguém aparecer, entra um BOT reserva.
import { h, toast } from '../dom.js';
import { leagueBadge } from '../widgets.js';
import { sportName } from '../../../shared/progression.js';

export function matchmakingScreen(app, root, params) {
  const { setup } = params;
  const p = app.pm.profile;
  const lp = p.ratings[setup.sport]?.lp || 0;
  let left = 8;
  const count = h('b', {}, '');
  const status = h('p', { style: { fontWeight: 800, margin: 0 } }, 'Procurando adversário…');
  root.appendChild(h('div.screen', {}, h('div.panel.col.center', { style: { minWidth: '420px' } },
    h('div', { style: { fontSize: '70px', animation: 'spin 2s linear infinite' } }, '🌍'),
    h('h2', {}, `Online · ${sportName(setup.sport)}`),
    h('div.row', {}, 'Sua liga: ', leagueBadge(lp)),
    status, count,
    h('button.btn', { onclick: () => app.back() }, 'Cancelar'),
  )));

  const timer = setInterval(() => { left = Math.max(0, left - 1); count.textContent = left ? `${left}s` : ''; }, 1000);
  const off = app.on('net', (m) => {
    if (m.t === 'mm_wait') left = Math.round(m.timeoutMs / 1000);
    if (m.t === 'mm_found') {
      app.audio.play('fanfare');
      status.textContent = `Adversário encontrado: ${m.opponent.name}!`;
      setTimeout(() => app.go('game', { setup: { ...setup, ...(m.role === 'B' ? { length: m.options?.length ?? setup.length, arena: m.options?.arena ?? setup.arena } : {}) }, online: m }), 900);
    }
    if (m.t === 'mm_bot') {
      toast('Ninguém online na sua liga agora — jogando contra um BOT reserva 🤖', 3500);
      app.go('game', { setup, online: null });
    }
  });
  app.sock.send({ t: 'mm_find', sport: setup.sport, lp, name: p.username, avatar: p.avatar, options: { length: setup.length, arena: setup.arena } });
  if (!app.sock.open) status.textContent = 'Sem conexão com o servidor… tentando';
  app.onBack = () => { app.sock.send({ t: 'mm_cancel' }); app.go('setup', { sport: setup.sport }); };
  return () => { clearInterval(timer); off(); };
}
