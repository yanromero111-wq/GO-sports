// Menu principal: grade de esportes + loja, perfil, ranking, ajustes.
import { h } from '../dom.js';
import { topbar, leagueBadge } from '../widgets.js';
import { SPORTS, ensureDailyMissions } from '../../../shared/progression.js';

export function menuScreen(app, root) {
  const p = app.pm.profile;
  if (!p) return app.go('editor', { firstTime: true });
  app.plaza.setView('menu');
  app.plaza.setAvatar(p.avatar);
  app.audio.playMusic('menu');
  app.ctrlUi({ hint: 'Arraste para mover o cursor · toque para clicar', actions: [] });
  const missions = ensureDailyMissions(p);
  const open = missions.list.filter((m) => !m.done).length;

  const grid = h('div.sports-grid', {}, SPORTS.map((s) => h('button.sport-card', {
    style: { background: `linear-gradient(160deg, ${s.color}, ${shade(s.color)})` },
    onclick: () => { app.audio.play('click'); app.go('setup', { sport: s.id }); },
  }, h('div.icon', {}, s.icon), h('div', {}, s.name), h('div.league', {}, leagueBadge(p.ratings[s.id]?.lp || 0)))));

  root.appendChild(h('div.screen', { style: { alignItems: 'flex-start', overflow: 'auto' } },
    topbar(app),
    h('div.menu-wrap', {},
      h('div.panel', { style: { width: '100%', padding: '20px' } },
        h('div.row', { style: { marginBottom: '12px' } }, h('h2', { style: { fontSize: '32px' } }, 'Escolha um esporte'), h('div.grow'),
          app.cameraOnly ? h('span.chip', {}, '📷 Só câmera') : app.controllers.size ? h('span.chip', {}, `📱 ${app.controllers.size} celular(es)`) : h('span.chip', {}, '⌨️ Teclado e mouse')),
        grid,
      ),
      h('div.menu-bottom', {},
        h('button.btn', { onclick: () => app.go('shop') }, '🛍️ Loja'),
        h('button.btn', { onclick: () => app.go('profile', { tab: 'missions' }) }, '📅 Missões', open ? h('span.badge', {}, String(open)) : null),
        h('button.btn', { onclick: () => app.go('profile') }, '🏅 Perfil'),
        h('button.btn', { onclick: () => app.go('ranking') }, '🏆 Ranking'),
        h('button.btn', { onclick: () => app.go('editor') }, '🎨 Personagem'),
        h('button.btn', { onclick: () => app.go('pairing', { returnTo: 'menu' }) }, '📱 Conectar celular'),
        h('button.btn', { onclick: () => app.go('settings') }, '⚙️ Ajustes'),
      ),
    ),
  ));
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * 0.72));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
