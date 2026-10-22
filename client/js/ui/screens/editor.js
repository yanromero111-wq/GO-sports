// Tela de personalização do personagem (corpo, rosto, cabelo, pele, roupa, acessórios) + nome.
import { h, toast } from '../dom.js';
import { tabs } from '../widgets.js';
import { SKINS, HAIR_COLORS, OUTFIT_COLORS, HAIR_STYLES, EYE_STYLES, MOUTH_STYLES, BROW_STYLES, BODY_TYPES, ACCESSORIES, botProfile } from '../../engine/avatar.js';
import { DEFAULT_AVATAR } from '../../../shared/progression.js';
import { itemById, isOwned } from '../../../shared/catalog.js';

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

export function editorScreen(app, root, params = {}) {
  const pm = app.pm;
  const firstTime = !!params.firstTime;
  let cfg = { ...DEFAULT_AVATAR, ...(pm.profile?.avatar || {}) };
  if (firstTime && !pm.profile) cfg = { ...cfg, ...botProfile().avatar, acc: 'none' };
  let name = params.name || pm.profile?.username || '';
  if (name === 'Convidado') name = '';
  let tab = 'body';
  app.plaza.setView('editor');
  app.plaza.setAvatar(cfg);
  app.plaza.targetSpin = 0;

  const apply = () => app.plaza.setAvatar(cfg);
  const set = (k, v) => { cfg[k] = v; apply(); app.audio.play('click'); render(); };

  const opt = (label, sel, onclick, extra = {}) => h('button.opt' + (sel ? '.sel' : '') + (extra.locked ? '.locked' : ''), { onclick }, label);
  const swatches = (key, colors) => colors.map((c) => opt(h('div.swatch', { style: { background: c } }), cfg[key] === c, () => set(key, c)));
  const textOpts = (key, list, icons) => list.map((n, i) => opt(h('div', {}, h('div', {}, icons ? icons[i] : '•'), h('small', {}, n)), cfg[key] === i, () => set(key, i)));

  const nameInput = h('input.name-input', { value: name, maxlength: 16, placeholder: 'Seu nome de jogador', disabled: !firstTime && !pm.isGuest });
  nameInput.addEventListener('input', () => { name = nameInput.value.trim(); });
  const askPhone = async () => {
    if (!app.phoneConnected(0)) return;
    const v = await app.askText({ prompt: 'Digite seu nome de jogador', value: name, max: 16 });
    if (v != null) { name = v.trim(); nameInput.value = name; }
  };
  nameInput.addEventListener('cursorfocus', askPhone);

  const optionsBox = h('div.options');
  const tabsBox = h('div');
  const render = () => {
    tabsBox.innerHTML = '';
    tabsBox.appendChild(tabs([
      { id: 'body', label: '🧍 Corpo' }, { id: 'face', label: '😊 Rosto' }, { id: 'hair', label: '💇 Cabelo' },
      { id: 'skin', label: '🎨 Pele' }, { id: 'clothes', label: '👕 Roupa' }, { id: 'acc', label: '🕶️ Acessórios' },
    ], tab, (t) => { tab = t; app.audio.play('click'); render(); }));
    optionsBox.innerHTML = '';
    let items = [];
    if (tab === 'body') {
      items = [
        ...textOpts('body', BODY_TYPES, ['🥢', '🙂', '🍩']),
        ...[0.9, 0.97, 1.04, 1.1].map((v, i) => opt(h('div', {}, h('div', {}, ['🐭', '🧒', '🧑', '🦒'][i]), h('small', {}, ['Baixinho', 'Médio', 'Alto', 'Altão'][i])), Math.abs(cfg.height - v) < 0.03, () => set('height', v))),
      ];
    } else if (tab === 'face') {
      items = [
        h('div.section-title', { style: { gridColumn: '1/-1' } }, 'Olhos'), ...textOpts('eyes', EYE_STYLES, ['⚫', '✨', '😪', '😊']),
        h('div.section-title', { style: { gridColumn: '1/-1' } }, 'Boca'), ...textOpts('mouth', MOUTH_STYLES, ['🙂', '😁', '😮', '😐']),
        h('div.section-title', { style: { gridColumn: '1/-1' } }, 'Sobrancelha'), ...textOpts('brows', BROW_STYLES, ['〰️', '➖', '🚫']),
        opt(h('div', {}, h('div', {}, '🌸'), h('small', {}, cfg.cheeks ? 'Bochechas: sim' : 'Bochechas: não')), cfg.cheeks, () => set('cheeks', !cfg.cheeks)),
      ];
    } else if (tab === 'hair') {
      items = [
        ...textOpts('hair', HAIR_STYLES, ['🥚', '💇', '⚡', '👩', '🎀', '☁️', '🍡', '🦔']),
        h('div.section-title', { style: { gridColumn: '1/-1' } }, 'Cor do cabelo'), ...swatches('hairColor', HAIR_COLORS),
      ];
    } else if (tab === 'skin') {
      items = swatches('skin', SKINS);
    } else if (tab === 'clothes') {
      items = [
        h('div.section-title', { style: { gridColumn: '1/-1' } }, 'Camiseta'), ...swatches('shirt', OUTFIT_COLORS),
        h('div.section-title', { style: { gridColumn: '1/-1' } }, 'Calça / short'), ...swatches('pants', OUTFIT_COLORS),
        h('div.section-title', { style: { gridColumn: '1/-1' } }, 'Tênis'), ...swatches('shoes', ['#ffffff', '#2b2d42', '#ef476f', '#3a86ff', '#ffd166', '#4cc96f']),
      ];
    } else if (tab === 'acc') {
      items = ACCESSORIES.map((a) => {
        const item = a.item && itemById(a.item);
        const owned = !item || (pm.profile && isOwned(pm.profile, item));
        return opt(h('div', {}, h('div', {}, a.icon), h('small', {}, owned ? a.name : `🔒 ${item.price} 💰`)), cfg.acc === a.id, () => {
          if (!owned) return toast(`Compre "${a.name}" na Loja para usar 🛍️`);
          set('acc', a.id);
        }, { locked: !owned });
      });
    }
    items.forEach((i) => optionsBox.appendChild(i));
  };
  render();

  const done = () => {
    name = nameInput.value.trim();
    if (firstTime || pm.isGuest) {
      if (!NAME_RE.test(name)) {
        toast('Nome: 3 a 16 letras, números ou _ (sem espaços)');
        nameInput.focus();
        return askPhone();
      }
    }
    app.audio.play('coin');
    if (firstTime) return app.go('account', { avatar: cfg, name });
    if (pm.isGuest && name !== pm.profile.username) pm.profile.username = name;
    pm.save({ avatar: cfg });
    toast('Personagem salvo! ✨');
    app.go('menu');
  };

  root.appendChild(h('div.screen.editor', {},
    h('div.panel.side', {},
      h('h2', { style: { fontSize: '34px' } }, firstTime ? 'Crie seu personagem' : 'Personagem'),
      tabsBox,
      h('div.scroll', { style: { maxHeight: '46vh' } }, optionsBox),
      h('label', { style: { fontWeight: 800 } }, 'Nome de jogador', nameInput),
      h('div.row.wrap', {},
        h('button.btn.small', { onclick: () => app.plaza.rotateAvatar(-Math.PI / 3) }, '⟲ Girar'),
        h('button.btn.small', { onclick: () => app.plaza.rotateAvatar(Math.PI / 3) }, 'Girar ⟳'),
        h('button.btn.small', { onclick: () => { cfg = { ...cfg, ...botProfile().avatar, acc: 'none' }; apply(); render(); app.audio.play('whoosh'); } }, '🎲 Aleatório'),
        firstTime || pm.isGuest ? h('button.btn.small', { onclick: () => {
          const a = ['Raio', 'Foguete', 'Tigre', 'Cometa', 'Turbo', 'Faisca', 'Trovao', 'Ninja', 'Panda', 'Fera'];
          name = `${a[Math.floor(Math.random() * a.length)]}_${Math.floor(10 + Math.random() * 90)}`;
          nameInput.value = name;
          app.audio.play('coin');
        } }, '🎲 Nome') : null,
        h('div.grow'),
        !firstTime ? h('button.btn.small.ghost', { onclick: () => app.go('menu') }, 'Cancelar') : null,
        h('button.btn.primary', { onclick: done }, firstTime ? 'Continuar ➜' : 'Salvar ✔'),
      ),
    ),
  ));
  app.onBack = firstTime ? null : () => { app.plaza.setAvatar(pm.profile.avatar); app.go('menu'); };
  return () => app.plaza.setView('menu');
}
