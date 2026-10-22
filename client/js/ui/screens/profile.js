// Perfil: estatísticas por esporte, conquistas, missões diárias e conta.
import { h } from '../dom.js';
import { topbar, tabs, panelTitle, leagueBadge } from '../widgets.js';
import { SPORTS, ACHIEVEMENTS, levelFromXp, ensureDailyMissions, EVENT_NAMES } from '../../../shared/progression.js';

export function profileScreen(app, root, params = {}) {
  let tab = params.tab || 'stats';
  const render = () => {
    const p = app.pm.profile;
    root.innerHTML = '';
    let body;
    if (tab === 'stats') {
      const lv = levelFromXp(p.xp);
      body = h('div.col', {},
        h('div.stat-grid', {},
          h('div.stat', {}, 'Nível', h('b', {}, lv.level)),
          h('div.stat', {}, 'Partidas', h('b', {}, p.stats.matches)),
          h('div.stat', {}, 'Vitórias', h('b', {}, p.stats.wins)),
          h('div.stat', {}, 'Moedas', h('b', {}, `💰 ${p.coins}`)),
          ...Object.entries(p.stats.events).map(([k, n]) => h('div.stat', {}, EVENT_NAMES[k] || k, h('b', {}, n))),
        ),
        h('div.section-title', {}, 'Por esporte'),
        h('table.rank', {}, h('tbody', {}, SPORTS.map((s) => {
          const r = p.ratings[s.id] || { lp: 0, w: 0, l: 0 };
          return h('tr', {}, h('td', {}, `${s.icon} ${s.name}`), h('td', {}, leagueBadge(r.lp)), h('td', {}, `${r.lp} PL`), h('td', {}, `${r.w}V / ${r.l}D`));
        }))),
      );
    } else if (tab === 'ach') {
      body = h('div.stat-grid', {}, ACHIEVEMENTS.map((a) => h('div.ach' + (p.achievements.includes(a.id) ? '' : '.locked'), {},
        h('span.em', {}, a.icon), h('div', {}, h('div', {}, a.name), h('div.tiny.muted', {}, a.desc)))));
    } else if (tab === 'missions') {
      const ms = ensureDailyMissions(p);
      body = h('div.col', {},
        h('p', { style: { margin: 0, fontWeight: 700 } }, 'Missões novas todo dia. Recompensas entram automaticamente ao completar!'),
        ...ms.list.map((m) => h('div.mission' + (m.done ? '.done' : ''), {},
          h('span', { style: { fontSize: '28px' } }, m.done ? '✅' : '📅'),
          h('div.grow', {}, m.text, h('div.tiny.muted', {}, `+${m.coins} 💰 · +40 XP`)),
          h('div.bar', {}, h('div', { style: { width: `${(m.progress / m.goal) * 100}%` } })),
          h('b', {}, `${m.progress}/${m.goal}`))),
      );
    } else {
      body = h('div.col', {},
        app.pm.isGuest
          ? h('div.col', {},
            h('p', { style: { margin: 0, fontWeight: 800 } }, '🎮 Você está jogando como convidado: o progresso fica salvo só neste aparelho.'),
            h('div.row.wrap', {},
              h('button.btn.primary', { onclick: () => app.go('account', { mode: 'register', name: p.username, avatar: p.avatar, from: 'profile' }) }, '✨ Criar conta (leva seu progresso)'),
              h('button.btn.blue', { onclick: () => app.go('account', { mode: 'login', name: '', from: 'profile' }) }, '🔑 Entrar'),
            ))
          : h('div.col', {},
            h('p', { style: { margin: 0, fontWeight: 800 } }, `✅ Conta: ${p.username} — progresso salvo na nuvem.`),
            h('button.btn.red', { onclick: async () => { await app.pm.logout(); app.go(app.pm.profile ? 'menu' : 'editor', { firstTime: true }); } }, 'Sair da conta'),
          ),
      );
    }
    root.appendChild(h('div.screen', { style: { alignItems: 'flex-start' } },
      topbar(app),
      h('div.panel.big-panel', {},
        panelTitle('🏅 Perfil', () => app.go('menu')),
        tabs([{ id: 'stats', label: '📊 Estatísticas' }, { id: 'ach', label: '🏆 Conquistas' }, { id: 'missions', label: '📅 Missões' }, { id: 'account', label: '👤 Conta' }], tab, (t) => { tab = t; app.audio.play('click'); render(); }),
        h('div.scroll', {}, body),
      ),
    ));
  };
  render();
  app.onBack = () => app.go('menu');
}
