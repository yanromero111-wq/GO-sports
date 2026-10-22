// Ranking global (pontos de liga somados) e por esporte.
import { h, esc } from '../dom.js';
import { topbar, tabs, panelTitle, leagueBadge } from '../widgets.js';
import { SPORTS } from '../../../shared/progression.js';

export function rankingScreen(app, root) {
  let tab = 'all';
  const render = async () => {
    root.innerHTML = '';
    const list = h('div.scroll', {}, h('div.spinner', { style: { margin: '40px auto', borderColor: '#dfe6ff', borderTopColor: '#3a86ff' } }));
    root.appendChild(h('div.screen', { style: { alignItems: 'flex-start' } },
      topbar(app),
      h('div.panel.big-panel', {},
        panelTitle('🏆 Ranking', () => app.go('menu')),
        tabs([{ id: 'all', label: '🌍 Global' }, ...SPORTS.map((s) => ({ id: s.id, label: s.icon }))], tab, (t) => { tab = t; render(); }),
        list,
      ),
    ));
    try {
      const rows = await app.pm.leaderboard(tab);
      list.innerHTML = '';
      if (!rows.length) { list.appendChild(h('p', { style: { fontWeight: 800 } }, 'Ninguém no ranking ainda. Seja o primeiro! 🚀')); return; }
      const me = app.pm.profile?.username;
      list.appendChild(h('table.rank', {},
        h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Jogador'), h('th', {}, 'Nível'), h('th', {}, 'Liga'), h('th', {}, 'PL'), tab !== 'all' ? h('th', {}, 'V/D') : null)),
        h('tbody', {}, rows.map((r, i) => h('tr' + (r.username === me ? '.me' : ''), {},
          h('td', {}, i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1), h('td', { html: esc(r.username) }), h('td', {}, r.level),
          h('td', {}, leagueBadge(tab === 'all' ? r.lp / SPORTS.length : r.lp)), h('td', {}, r.lp), tab !== 'all' ? h('td', {}, `${r.wins}/${r.losses}`) : null))),
      ));
      if (app.pm.isGuest) list.appendChild(h('p.tiny', { style: { fontWeight: 800 } }, 'Convidados não aparecem no ranking. Crie uma conta no Perfil!'));
    } catch {
      list.innerHTML = '';
      list.appendChild(h('p', { style: { fontWeight: 800 } }, 'Sem conexão com o servidor do ranking agora.'));
    }
  };
  render();
  app.onBack = () => app.go('menu');
}
