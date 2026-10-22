// Componentes de interface reutilizados pelas telas.
import { h } from './dom.js';
import { levelFromXp, leagueFor } from '../../shared/progression.js';

export function leagueBadge(lp) {
  const l = leagueFor(lp);
  return h('span.league-badge', { style: { background: l.color } }, `${l.icon} ${l.name}`);
}

export function faceIcon(avatar = {}, name = '?') {
  return h('div.face', { style: { background: avatar.skin || '#f6c9a3', border: `4px solid ${avatar.hairColor || '#4a2c1a'}` } },
    h('span', { style: { fontFamily: 'Fredoka', fontWeight: 700, color: '#1d2b53', fontSize: '24px' } }, (name || '?')[0].toUpperCase()));
}

export function topbar(app, extra = []) {
  const p = app.pm.profile;
  if (!p) return h('div');
  const lv = levelFromXp(p.xp);
  return h('div.topbar', {},
    h('div.me', {},
      faceIcon(p.avatar, p.username),
      h('div.col', { style: { gap: '4px' } },
        h('div.name', {}, p.username, app.pm.isGuest ? h('span.tiny.muted', { style: { marginLeft: '8px' } }, '(convidado)') : null),
        h('div.row', { style: { gap: '8px' } }, h('b', {}, `Nível ${lv.level}`), h('div.xpbar', {}, h('div', { style: { width: `${(lv.into / lv.need) * 100}%` } }))),
      ),
    ),
    h('div.grow'),
    ...extra,
    h('div.coins', {}, `💰 ${p.coins}`),
  );
}

export function tabs(list, active, onSelect) {
  return h('div.tabs', {}, list.map((t) => h('button.btn.small.tab' + (t.id === active ? '.active' : ''), { onclick: () => onSelect(t.id) }, t.label)));
}

export function panelTitle(text, onBack) {
  return h('div.row', {},
    onBack ? h('button.btn.small.ghost', { onclick: onBack }, '← Voltar') : null,
    h('h2.grow', { style: { fontSize: '34px' } }, text),
  );
}
