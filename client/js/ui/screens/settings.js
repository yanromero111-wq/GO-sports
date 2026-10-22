// Ajustes: volume, FPS, modo de controle padrão, calibração, privacidade.
import { h, toast } from '../dom.js';
import { topbar, panelTitle } from '../widgets.js';
import { Consent } from '../../consent.js';

export function settingsScreen(app, root) {
  const p = app.pm.profile;
  const s = { ...p.settings };
  const save = () => { app.pm.save({ settings: { ...s } }); app.audio.setVolumes(s.music, s.sfx); };
  const range = (key, label) => {
    const r = h('input.range', { type: 'range', min: 0, max: 1, step: 0.05, value: s[key] });
    r.addEventListener('input', () => { s[key] = +r.value; save(); if (key === 'sfx') app.audio.play('click'); });
    return h('div.toggle-row', {}, h('span', { style: { minWidth: '140px' } }, label), r);
  };
  const toggle = (key, label, on = 'Ligado', off = 'Desligado') => h('div.toggle-row', {}, label,
    h('button.btn.small' + (s[key] ? '.green' : ''), { onclick: (e) => { s[key] = !s[key]; save(); e.target.textContent = s[key] ? on : off; e.target.classList.toggle('green', s[key]); } }, s[key] ? on : off));

  root.appendChild(h('div.screen', { style: { alignItems: 'flex-start' } },
    topbar(app),
    h('div.panel.big-panel', { style: { maxWidth: '760px' } },
      panelTitle('⚙️ Ajustes', () => app.go('menu')),
      h('div.col.scroll', { style: { gap: '10px' } },
        range('music', '🎵 Música'),
        range('sfx', '🔊 Efeitos'),
        h('div.toggle-row', {}, '🎮 Controle padrão',
          h('div.row', {},
            h('button.btn.small' + (s.controlMode !== 'camera' ? '.blue' : ''), { onclick: () => { s.controlMode = 'motion'; save(); app.go('settings'); } }, '📱 Sem câmera'),
            h('button.btn.small' + (s.controlMode === 'camera' ? '.blue' : ''), { onclick: () => { s.controlMode = 'camera'; save(); app.go('settings'); } }, '📷 Com câmera'))),
        toggle('showFps', '📈 Mostrar FPS'),
        h('div.toggle-row', {}, '📱 Celular', h('div.row', {},
          h('button.btn.small', { onclick: () => { if (!app.phoneConnected(0)) return toast('Nenhum celular conectado'); app.sendCtrl(0, { k: 'calibrate' }); toast('Siga a calibração no celular 📱'); } }, 'Recalibrar'),
          h('button.btn.small', { onclick: () => app.go('pairing', { returnTo: 'settings' }) }, 'Conectar outro'))),
        h('div.toggle-row', {}, '🍪 Privacidade', h('div.row', {},
          h('button.btn.small', { onclick: () => Consent.open() }, 'Cookies e anúncios'),
          h('a.btn.small', { href: 'privacy.html', target: '_blank' }, 'Política'))),
        h('p.tiny.muted', {}, 'Teclado: Espaço = balançar (segure para força) · setas = direção · Q/E = efeito · Enter = OK · Esc = pausa · J/K/U/O/I = socos · L = guarda · A/D = desviar · F ou botão direito = puxar o arco.'),
      ),
    ),
  ));
  app.onBack = () => app.go('menu');
}
