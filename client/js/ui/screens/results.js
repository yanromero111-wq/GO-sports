// Resultado: placar, XP, moedas, liga, conquistas e missões. Salva automaticamente ao fim da partida.
import { h, toast } from '../dom.js';
import { leagueBadge } from '../widgets.js';
import { LEAGUES, levelFromXp, sportName } from '../../../shared/progression.js';
import { Ads } from '../../ads.js';

export function resultsScreen(app, root, params) {
  const { result, setup } = params;
  const pm = app.pm;
  app.audio.playMusic('results');
  app.plaza.setView('center');
  app.plaza.ensure();
  if (result.won) { app.plaza.avatar.celebrate(); app.audio.play('fanfare'); app.fx.confetti(new (app.plaza.avatar.root.position.constructor)(0, 2.5, 0)); }
  else if (!result.draw) app.plaza.avatar.sad();

  const panel = h('div.panel.results', {}, h('div.spinner', { style: { margin: '30px auto', borderColor: '#dfe6ff', borderTopColor: '#3a86ff' } }));
  root.appendChild(h('div.screen', {}, panel));

  const title = result.draw ? 'Empate!' : result.won ? 'Vitória! 🎉' : 'Derrota';
  const cls = result.draw ? '' : result.won ? '.win' : '.lose';

  pm.reportMatch(result).then((s) => {
    const lv = levelFromXp(pm.profile.xp);
    const league = LEAGUES.find((l) => l.id === s.leagueAfter);
    const leagueUp = s.leagueAfter !== s.leagueBefore;
    const rewards = h('div.rewards', {},
      h('div.reward', { style: { animationDelay: '0.1s' } }, '⭐ XP', h('b', {}, `+${s.xp}`)),
      h('div.reward', { style: { animationDelay: '0.25s' } }, '💰 Moedas', h('b', {}, `+${s.coins}`)),
      result.mode !== 'local' ? h('div.reward', { style: { animationDelay: '0.4s' } }, `${league.icon} Liga`, h('b', { style: { color: s.lpDelta >= 0 ? '#2a9d55' : '#ef476f' } }, `${s.lpDelta >= 0 ? '+' : ''}${s.lpDelta} PL`)) : null,
    );
    panel.innerHTML = '';
    panel.append(
      h('div.big' + cls, {}, title),
      h('div', { style: { fontWeight: 900, fontSize: '22px' } }, `${sportName(result.sport)} · ${result.label || `${result.myScore} x ${result.oppScore}`}`),
      rewards,
      h('div.row.center', {}, h('b', {}, `Nível ${lv.level}`), h('div.xpbar', { style: { width: '260px', height: '14px' } }, h('div', { style: { width: `${(lv.into / lv.need) * 100}%` } })), leagueBadge(s.lp), h('span.chip', {}, `${s.lp} PL`)),
    );
    if (s.levelAfter > s.levelBefore) { panel.append(h('div.ach-item', {}, `⬆️ Subiu para o nível ${s.levelAfter}!`)); app.audio.play('levelup'); }
    if (leagueUp) panel.append(h('div.ach-item', {}, s.lpDelta > 0 ? `🎊 Promovido para a liga ${league.name}!` : `Caiu para a liga ${league.name}. Bora recuperar! 💪`));
    if (s.achievements.length || s.missions.length) {
      panel.append(h('div.ach-list', {},
        s.achievements.map((a, i) => h('div.ach-item', { style: { animationDelay: `${0.5 + i * 0.15}s` } }, `${a.icon} Conquista: ${a.name} (+50 💰)`)),
        s.missions.map((m, i) => h('div.ach-item', { style: { animationDelay: `${0.7 + i * 0.15}s` } }, `📅 Missão completa: ${m.text} (+${m.coins} 💰)`)),
      ));
    }
    const doubleBtn = s.coins > 0 && Ads.enabled()
      ? h('button.btn.green', { onclick: async () => {
        doubleBtn.disabled = true;
        const ok = await Ads.rewarded(app.audio);
        if (!ok) { doubleBtn.disabled = false; return; }
        try {
          const extra = await pm.claimDouble();
          if (extra) { app.audio.play('coin'); toast(`+${extra} moedas! 💰`); doubleBtn.textContent = '✅ Moedas dobradas'; }
        } catch (e) { toast(e.message); }
      } }, `🎬 Assistir vídeo: moedas em dobro (+${s.coins})`)
      : null;
    panel.append(
      h('div.row.center.wrap', { style: { marginTop: '14px' } },
        h('button.btn.big.primary', { onclick: async () => { await Ads.interstitial(app.audio); app.go('game', { setup }); } }, '🔄 Jogar de novo'),
        h('button.btn.big', { onclick: async () => { await Ads.interstitial(app.audio); app.go('menu'); } }, '🏠 Menu'),
      ),
      doubleBtn ? h('div.col.center', { style: { marginTop: '10px', gap: '4px' } }, h('div.ad-label', {}, 'Publicidade · opcional'), doubleBtn) : null,
      pm.isGuest ? h('p.tiny.muted', {}, '💾 Progresso salvo neste aparelho. Crie uma conta no Perfil para salvar na nuvem.') : h('p.tiny.muted', {}, '💾 Progresso salvo na sua conta.'),
    );
    setTimeout(() => app.cursor.nav('down'), 60);
  }).catch((e) => {
    panel.innerHTML = '';
    panel.append(h('div.big' + cls, {}, title), h('p', {}, 'Não foi possível salvar: ' + e.message), h('button.btn', { onclick: () => app.go('menu') }, 'Menu'));
  });

  app.onBack = () => app.go('menu');
}
