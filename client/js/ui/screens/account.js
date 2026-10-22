// Conta: criar conta, entrar com senha ou jogar como convidado.
import { h, toast } from '../dom.js';

export function accountScreen(app, root, params = {}) {
  const pm = app.pm;
  let mode = params.mode || 'choose';
  const avatar = params.avatar || pm.profile?.avatar;
  let name = params.name || '';
  app.plaza.setView('center');

  // Campos de texto: digita no teclado da TV/PC ou no celular (a senha nunca aparece na TV).
  const field = (label, type, value, onInput, prompt) => {
    const inp = h('input', { type, value: value || '', maxlength: type === 'password' ? 72 : 16, autocomplete: 'off' });
    inp.addEventListener('input', () => onInput(inp.value));
    inp.addEventListener('cursorfocus', async () => {
      if (!app.phoneConnected(0)) return;
      const v = await app.askText({ prompt, type, value: type === 'password' ? '' : inp.value, max: type === 'password' ? 72 : 16 });
      if (v != null) { inp.value = v; onInput(v); }
    });
    return h('label', {}, label, inp);
  };

  const render = () => {
    root.innerHTML = '';
    const err = h('div.error');
    let body;
    if (mode === 'choose') {
      body = h('div.col.center', { style: { width: 'min(560px, 90vw)' } },
        h('h2', { style: { fontSize: '36px' } }, `Olá, ${name || 'jogador'}! 👋`),
        h('p', { style: { fontWeight: 700, margin: 0 } }, 'Como você quer salvar seu progresso?'),
        h('button.btn.big.primary', { style: { width: '100%' }, onclick: () => { mode = 'register'; render(); } }, '✨ Criar conta'),
        h('button.btn.big.blue', { style: { width: '100%' }, onclick: () => { mode = 'login'; render(); } }, '🔑 Já tenho conta'),
        h('button.btn.ghost', { style: { width: '100%' }, onclick: () => { pm.startGuest(name, avatar); toast('Modo convidado: progresso salvo só neste aparelho'); app.go('menu'); } }, '🎮 Jogar como convidado'),
        h('p.tiny.muted', {}, 'Com uma conta você entra no ranking global, joga online e não perde o progresso. Convidado: progresso salvo só neste aparelho (dá para criar conta depois e levar tudo junto).'),
      );
    } else if (mode === 'register') {
      let pass = '', pass2 = '';
      const avail = h('div.tiny', { style: { fontWeight: 800, minHeight: '18px' } });
      let checkT;
      const check = (v) => {
        name = v.trim();
        clearTimeout(checkT);
        checkT = setTimeout(async () => {
          try {
            const r = await pm.checkUsername(name);
            avail.textContent = r.available ? '✅ Nome disponível' : `❌ ${r.reason}`;
            avail.style.color = r.available ? '#2a9d55' : '#ef476f';
          } catch { avail.textContent = 'Sem conexão com o servidor'; }
        }, 300);
      };
      check(name);
      const submit = async () => {
        if (pass.length < 6) return (err.textContent = 'A senha precisa ter pelo menos 6 caracteres');
        if (pass !== pass2) return (err.textContent = 'As senhas não conferem');
        err.textContent = 'Criando conta…';
        try {
          await pm.register(name, pass, avatar);
          app.audio.play('fanfare');
          toast(`Conta criada! Bem-vindo, ${name} 🎉`);
          app.go('menu');
        } catch (e) { err.textContent = e.message; }
      };
      body = h('div.form', {},
        h('h2', {}, '✨ Criar conta'),
        field('Nome de usuário (único)', 'text', name, check, 'Nome de usuário'), avail,
        field('Senha', 'password', '', (v) => (pass = v), 'Crie uma senha (mín. 6)'),
        field('Confirmar senha', 'password', '', (v) => (pass2 = v), 'Repita a senha'),
        h('p.tiny.muted', { style: { margin: 0 } }, '🔒 Dica: toque no campo com o cursor para digitar no celular. Senhas são guardadas com criptografia (hash).'),
        err,
        h('div.row', {}, h('button.btn.ghost', { onclick: () => { mode = 'choose'; render(); } }, '← Voltar'), h('div.grow'), h('button.btn.primary', { onclick: submit }, 'Criar conta')),
      );
    } else {
      let pass = '';
      let user = name;
      const merge = h('input', { type: 'checkbox', checked: true });
      const submit = async () => {
        err.textContent = 'Entrando…';
        try {
          await pm.login(user.trim(), pass, merge.checked);
          app.audio.play('fanfare');
          toast(`Bem-vindo de volta, ${pm.profile.username}! 👋`);
          app.go('menu');
        } catch (e) { err.textContent = e.message; }
      };
      body = h('div.form', {},
        h('h2', {}, '🔑 Entrar'),
        field('Nome de usuário', 'text', user, (v) => (user = v), 'Nome de usuário'),
        field('Senha', 'password', '', (v) => (pass = v), 'Sua senha'),
        pm.guest ? h('label', { style: { flexDirection: 'row', alignItems: 'center', gap: '10px' } }, merge, 'Trazer o progresso de convidado deste aparelho') : null,
        err,
        h('div.row', {}, h('button.btn.ghost', { onclick: () => { mode = 'choose'; render(); } }, '← Voltar'), h('div.grow'), h('button.btn.primary', { onclick: submit }, 'Entrar')),
      );
    }
    root.appendChild(h('div.screen', {}, h('div.panel', {}, body)));
  };
  render();
  app.onBack = () => {
    if (mode !== 'choose' && !params.mode) { mode = 'choose'; render(); }
    else if (params.from) app.go(params.from);
    else app.go('editor', { firstTime: true, name });
  };
}
