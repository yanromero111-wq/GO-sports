// Aviso de cookies/consentimento (LGPD). Guarda a escolha neste aparelho.
import { h } from './ui/dom.js';

const KEY = 'gs_consent';

export const Consent = {
  value: null,
  onChange: null,
  init(onChange) {
    this.onChange = onChange;
    try { this.value = JSON.parse(localStorage.getItem(KEY))?.ads || null; } catch { this.value = null; }
    if (this.value) onChange(this.value);
    else this.open();
  },
  set(v) {
    this.value = v;
    try { localStorage.setItem(KEY, JSON.stringify({ ads: v, at: Date.now() })); } catch {}
    document.getElementById('consent').classList.add('hidden');
    this.onChange?.(v);
  },
  open() {
    const box = document.getElementById('consent');
    box.innerHTML = '';
    box.appendChild(h('div.box', {},
      h('p', {}, '🍪 Usamos armazenamento local para salvar seu progresso e, se você permitir, cookies de anúncios para manter o jogo gratuito. A câmera (opcional) é processada só no seu aparelho. ',
        h('a', { href: 'privacy.html', target: '_blank' }, 'Política de Privacidade')),
      h('button.btn.small.ghost', { onclick: () => this.set('essential') }, 'Só essenciais'),
      h('button.btn.small.primary', { onclick: () => this.set('all') }, 'Aceitar todos'),
    ));
    box.classList.remove('hidden');
  },
};
