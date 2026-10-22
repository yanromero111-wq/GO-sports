// Loja: arenas, equipamentos por esporte e acessórios do avatar, comprados com moedas do jogo.
import { h, toast } from '../dom.js';
import { topbar, tabs, panelTitle } from '../widgets.js';
import { SPORTS } from '../../../shared/progression.js';
import { CATALOG, isOwned, canBuy, equipped } from '../../../shared/catalog.js';

const SLOT_ICON = { arena: '🏟️', racket: '🎾', paddle: '🏓', ball: '⚪', uniform: '👕', bat: '🏏', gloves: '🥊', bow: '🏹', club: '🏌️', acc: '✨' };

export function shopScreen(app, root, params = {}) {
  let tab = params.tab || 'avatar';
  const render = () => {
    const p = app.pm.profile;
    root.innerHTML = '';
    const items = CATALOG.filter((i) => i.sport === tab);
    const grid = h('div.shop-grid', {}, items.map((it) => {
      const owned = isOwned(p, it);
      const isEq = it.slot === 'acc' ? p.avatar.acc === it.value : it.slot !== 'arena' && equipped(p, it.sport, it.slot)?.id === it.id;
      const c = canBuy(p, it);
      let action;
      if (owned && it.slot === 'arena') action = h('span.chip', {}, '✅ Disponível');
      else if (owned) action = isEq ? h('span.chip', {}, '✅ Em uso') : h('button.btn.small.blue', { onclick: () => equip(it) }, 'Usar');
      else action = h('button.btn.small.primary', { disabled: !c.ok, onclick: () => buy(it) }, c.ok ? `Comprar · ${it.price} 💰` : c.reason === 'Moedas insuficientes' ? `${it.price} 💰` : c.reason);
      return h('div.item' + (isEq ? '.equipped' : ''), {},
        h('div.prev', { style: { background: it.color || it.theme?.court || it.theme?.lane || it.theme?.ground || it.theme?.floor || '#ffd166' } }, SLOT_ICON[it.slot] || '🎁'),
        h('b', {}, it.name),
        h('span.tiny.muted', {}, it.slot === 'arena' ? 'Arena' : it.slot === 'acc' ? 'Acessório' : 'Equipamento', it.level ? ` · nível ${it.level}` : ''),
        action,
      );
    }));
    const noAds = h('div.item', {}, h('div.prev', { style: { background: '#dfe6ff' } }, '🚫'), h('b', {}, 'Remover anúncios'), h('span.tiny.muted', {}, 'Compra única — em breve'), h('button.btn.small', { disabled: true }, 'Em breve'));
    root.appendChild(h('div.screen', { style: { alignItems: 'flex-start' } },
      topbar(app),
      h('div.panel.big-panel', {},
        panelTitle('🛍️ Loja', () => app.go('menu')),
        tabs([{ id: 'avatar', label: '✨ Avatar' }, ...SPORTS.map((s) => ({ id: s.id, label: s.icon }))], tab, (t) => { tab = t; app.audio.play('click'); render(); }),
        h('div.scroll', {}, grid, tab === 'avatar' ? h('div.shop-grid', { style: { marginTop: '14px' } }, noAds) : null),
      ),
    ));
  };
  const buy = async (it) => {
    try {
      const r = await app.pm.buy(it.id);
      if (r.ok === false) return toast(r.reason);
      app.audio.play('coin');
      toast(`Você comprou ${it.name}! 🎉`);
      if (it.slot !== 'arena') equip(it);
      else render();
    } catch (e) { toast(e.message); }
  };
  const equip = (it) => {
    const p = app.pm.profile;
    if (it.slot === 'acc') app.pm.save({ avatar: { ...p.avatar, acc: it.value } });
    else app.pm.save({ equipped: { ...p.equipped, [it.sport]: { ...(p.equipped[it.sport] || {}), [it.slot]: it.id } } });
    app.audio.play('click');
    render();
  };
  render();
  app.onBack = () => app.go('menu');
}
