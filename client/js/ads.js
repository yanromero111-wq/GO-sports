// Integração com Google AdSense (banner) e Ad Placement API para jogos H5 (intervalo e vídeo premiado).
// Regras: anúncios sempre identificados como "Publicidade", nunca escondidos, nunca colados a botões do jogo,
// vídeo premiado só quando o jogador escolhe assistir.
import { ADS_CONFIG as CFG } from '../ads.config.js';
import { h, toast } from './ui/dom.js';

const BANNER_SCREENS = ['menu', 'shop', 'profile', 'ranking', 'settings'];

export const Ads = {
  consent: null,
  profile: null,
  loaded: false,
  matchesSince: 0,
  lastInterstitial: Date.now(),
  bannerRendered: false,

  get real() { return !!CFG.ADSENSE_CLIENT; },
  get simulate() { return !CFG.ADSENSE_CLIENT && CFG.SIMULATE_WHEN_NO_ID; },
  enabled() { return !this.profile?.entitlements?.noAds; },

  setProfile(p) { this.profile = p; if (!this.enabled()) this.hideBanner(); },

  init(consent) {
    this.consent = consent;
    if (!this.real || this.loaded || !this.enabled()) return;
    window.adsbygoogle = window.adsbygoogle || [];
    // Sem consentimento para personalização (LGPD): anúncios não personalizados.
    if (consent !== 'all') window.adsbygoogle.requestNonPersonalizedAds = 1;
    window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CFG.ADSENSE_CLIENT}`;
    s.crossOrigin = 'anonymous';
    s.setAttribute('data-ad-client', CFG.ADSENSE_CLIENT);
    s.setAttribute('data-ad-frequency-hint', `${CFG.INTERSTITIAL_MIN_SECONDS}s`);
    if (CFG.TEST_MODE) s.setAttribute('data-adbreak-test', 'on');
    document.head.appendChild(s);
    window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
    this.loaded = true;
  },

  onScreen(name) {
    if (BANNER_SCREENS.includes(name) && this.enabled() && (this.real || this.simulate)) this.showBanner();
    else this.hideBanner();
  },

  showBanner() {
    const el = document.getElementById('ad-banner');
    el.classList.remove('hidden');
    document.body.classList.add('has-ad');
    if (this.bannerRendered) return;
    this.bannerRendered = true;
    el.innerHTML = '';
    el.appendChild(h('div.ad-label', {}, 'Publicidade'));
    if (this.real && CFG.BANNER_SLOT) {
      const ins = h('ins.adsbygoogle', {
        style: { display: 'inline-block', width: '312px', height: '60px' },
        'data-ad-client': CFG.ADSENSE_CLIENT,
        'data-ad-slot': CFG.BANNER_SLOT,
      });
      el.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { console.warn(e); }
    } else {
      el.appendChild(h('div.ad-placeholder', {}, 'Espaço de anúncio (configure ads.config.js)'));
    }
  },
  hideBanner() { document.getElementById('ad-banner').classList.add('hidden'); document.body.classList.remove('has-ad'); },

  // Intervalo entre partidas, com limite de frequência.
  async interstitial(audio) {
    if (!this.enabled()) return;
    this.matchesSince++;
    const elapsed = (Date.now() - this.lastInterstitial) / 1000;
    if (this.matchesSince < CFG.INTERSTITIAL_EVERY_N_MATCHES || elapsed < CFG.INTERSTITIAL_MIN_SECONDS) return;
    this.matchesSince = 0;
    this.lastInterstitial = Date.now();
    if (this.real && window.adBreak) {
      await new Promise((resolve) => {
        window.adBreak({
          type: 'next',
          name: 'entre-partidas',
          beforeAd: () => audio?.master && (audio.master.gain.value = 0),
          afterAd: () => audio?.master && (audio.master.gain.value = 1),
          adBreakDone: () => resolve(),
        });
        setTimeout(resolve, 60000);
      });
    } else if (this.simulate) {
      await this.fakeAd('Intervalo comercial (simulado)', 2);
    }
  },

  // Vídeo premiado OPCIONAL. Resolve true somente se o jogador assistiu até o fim.
  rewarded(audio) {
    if (this.real && window.adBreak) {
      return new Promise((resolve) => {
        let done = false;
        const finish = (v) => { if (!done) { done = true; resolve(v); } };
        window.adBreak({
          type: 'reward',
          name: 'moedas-em-dobro',
          beforeAd: () => audio?.master && (audio.master.gain.value = 0),
          afterAd: () => audio?.master && (audio.master.gain.value = 1),
          beforeReward: (showAdFn) => showAdFn(),
          adViewed: () => finish(true),
          adDismissed: () => finish(false),
          adBreakDone: (info) => {
            if (info?.breakStatus && info.breakStatus !== 'viewed') toast('Nenhum vídeo disponível agora. Tente mais tarde!');
            finish(false);
          },
        });
      });
    }
    if (this.simulate) return this.fakeAd('Vídeo premiado (simulado)', 3).then(() => true);
    toast('Vídeos premiados indisponíveis');
    return Promise.resolve(false);
  },

  fakeAd(title, seconds) {
    return new Promise((resolve) => {
      const o = h('div.ad-overlay', {}, h('div.ad-label', { style: { color: '#fff' } }, 'Publicidade · teste'), h('div', {}, title));
      const c = h('div', {}, String(seconds));
      o.appendChild(c);
      document.body.appendChild(o);
      let s = seconds;
      const t = setInterval(() => {
        s--;
        c.textContent = String(s);
        if (s <= 0) { clearInterval(t); o.remove(); resolve(); }
      }, 1000);
    });
  },
};
