// Tela 1: QR code para o celular virar o controle.
import { h, toast } from '../dom.js';
import { apiBase } from '../../net.js';
import { CONFIG } from '../../../config.js';
import { SLOT_COLORS } from '../../constants.js';

async function controllerBase() {
  if (CONFIG.PUBLIC_URL) return CONFIG.PUBLIC_URL.replace(/\/$/, '');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!local) return location.origin;
  try {
    const info = await (await fetch(apiBase() + '/api/info')).json();
    if (info.publicUrl) return info.publicUrl.replace(/\/$/, '');
    if (info.httpsPort && info.lan?.length) return `https://${info.lan[0]}:${info.httpsPort}`;
  } catch {}
  return location.origin;
}

export function pairingScreen(app, root, params = {}) {
  app.plaza.setView('pairing');
  const returning = !!params.returnTo;
  const qr = h('img', { alt: 'QR code para conectar o celular' });
  const code = h('div.room-code', {}, '····');
  const url = h('div.url', {}, 'Gerando endereço…');
  const players = h('div.players-row');
  const status = h('div', { style: { fontWeight: 800, minHeight: '24px' } }, 'Aguardando o celular…');
  let advanced = false;

  const refreshQr = async () => {
    if (!app.room) return;
    code.textContent = app.room;
    const u = `${await controllerBase()}/controller.html?room=${app.room}`;
    url.textContent = u;
    qr.src = `${apiBase()}/api/qr?text=${encodeURIComponent(u)}`;
  };

  const refreshPlayers = () => {
    players.innerHTML = '';
    for (const c of [...app.controllers.values()].sort((a, b) => a.slot - b.slot)) {
      const st = c.ready ? '✅ pronto' : c.calStep ? `calibrando ${c.calStep.step + 1}/3` : 'conectado';
      players.appendChild(h('div.player-pill', { style: { background: SLOT_COLORS[c.slot] } }, `📱 J${c.slot + 1} · ${st}`));
    }
    const p0 = app.controllers.get(0);
    if (!p0) status.textContent = 'Aguardando o celular…';
    else if (!p0.ready) status.textContent = 'Celular conectado! Siga as instruções no celular 👉';
    else {
      status.textContent = 'Tudo pronto! 🎉';
      if (!returning && !advanced) {
        advanced = true;
        app.audio.play('fanfare');
        setTimeout(() => app.screen === 'pairing' && app.afterPairing(), 1100);
      }
    }
  };

  root.appendChild(h('div.screen', {},
    h('div.row.pair', {},
      h('div.brand', {},
        h('div.logo-big', {}, 'GO ', h('span', {}, 'SPORTS')),
        h('div.steps', {},
          h('div', {}, h('span', {}, '1'), 'Aponte a câmera do celular para o QR code'),
          h('div', {}, h('span', {}, '2'), 'Toque em "Ativar sensores" no celular'),
          h('div', {}, h('span', {}, '3'), 'Siga a calibração e pronto: o celular é o controle!'),
        ),
        h('div.row.wrap', {},
          returning
            ? h('button.btn.primary', { onclick: () => app.go(params.returnTo) }, '← Voltar')
            : h('div.row.wrap', {},
              h('button.btn.primary', { onclick: async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                const ok = await app.startCameraOnly();
                if (ok) app.afterPairing();
                else btn.disabled = false;
              } }, '📷 Jogar só com a câmera'),
              h('button.btn.ghost', { onclick: () => { app.keyboardMode = true; app.afterPairing(); } }, '⌨️ Teclado e mouse'),
            ),
        ),
        h('div.tiny', { style: { color: '#fff', fontWeight: 700, opacity: 0.9 } }, 'Celular e computador precisam estar na mesma rede Wi‑Fi (no jogo local). Se aparecer um aviso de segurança, toque em "Avançado" › "Continuar".'),
      ),
      h('div.panel.qr-card', {},
        h('h2', {}, returning ? 'Conectar mais um celular' : 'Conecte seu celular'),
        qr,
        h('div', { style: { fontWeight: 800 } }, 'ou digite o código'),
        code,
        url,
        players,
        status,
      ),
    ),
  ));

  const offs = [app.on('room', refreshQr), app.on('controllers', refreshPlayers), app.on('calstep', refreshPlayers)];
  refreshQr();
  refreshPlayers();
  if (returning) app.onBack = () => app.go(params.returnTo);
  if (!app.room) setTimeout(() => !app.room && toast('Conectando ao servidor…'), 1500);
  return () => offs.forEach((f) => f());
}
