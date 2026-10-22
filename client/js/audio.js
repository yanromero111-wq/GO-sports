// Música e efeitos 100% gerados por código (Web Audio API). Nenhum arquivo de áudio externo.
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);

// Músicas originais: progressões simples, alegres, em loop.
const SONGS = {
  menu: { bpm: 112, chords: [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]], melody: [72, 74, 76, 79, 76, 74, 72, 69, 72, 74, 76, 74, 72, 71, 72, -1], swing: 0.1 },
  game: { bpm: 128, chords: [[62, 66, 69], [59, 62, 66], [67, 71, 74], [69, 73, 76]], melody: [74, -1, 78, 76, 74, -1, 71, 73, 74, -1, 76, 78, 81, 78, 76, -1], swing: 0 },
  results: { bpm: 100, chords: [[65, 69, 72], [67, 71, 74], [64, 67, 71], [69, 72, 76]], melody: [77, 76, 74, 72, 74, -1, 72, 69, 72, 74, 76, 77, 79, -1, 77, -1], swing: 0.15 },
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.6;
    this.sfxVol = 0.8;
    this.song = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
  }
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  // Precisa ser chamado dentro de um clique/toque na tela principal (política de autoplay dos navegadores).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicVol * 0.35;
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVol;
      this.sfxBus.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.pendingSong) { const s = this.pendingSong; this.pendingSong = null; this.playMusic(s); }
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (this.ctx) {
      this.musicBus.gain.value = music * 0.35;
      this.sfxBus.gain.value = sfx;
    }
  }

  // ---------- música ----------
  playMusic(name) {
    if (!this.ctx) { this.pendingSong = name; return; }
    if (this.song === SONGS[name]) return;
    this.song = SONGS[name] || null;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    clearInterval(this.timer);
    if (this.song) this.timer = setInterval(() => this.schedule(), 40);
  }
  stopMusic() { clearInterval(this.timer); this.song = null; }

  schedule() {
    const s = this.song;
    if (!s || !this.ctx) return;
    const stepDur = 60 / s.bpm / 2; // colcheias
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      const i = this.step % 32;
      const bar = Math.floor(this.step / 8) % 4;
      const chord = s.chords[bar];
      const t = this.nextTime + (i % 2 ? s.swing * stepDur : 0);
      // baixo
      if (i % 4 === 0) this.tone(NOTE(chord[0] - 24), t, stepDur * 1.8, 'triangle', 0.5, this.musicBus);
      if (i % 4 === 2) this.tone(NOTE(chord[0] - 12), t, stepDur * 0.9, 'triangle', 0.3, this.musicBus);
      // acordes em staccato
      if (i % 4 === 2) for (const n of chord) this.tone(NOTE(n), t, stepDur * 0.6, 'square', 0.05, this.musicBus);
      // melodia
      const m = s.melody[(this.step % 16)];
      if (m > 0 && (this.step % 32) < 30) this.tone(NOTE(m), t, stepDur * 0.9, 'sine', 0.22, this.musicBus, 0.01);
      // bateria
      if (i % 8 === 0 || i % 8 === 5) this.kick(t, this.musicBus, 0.6);
      if (i % 8 === 4) this.snare(t, this.musicBus, 0.25);
      if (i % 2 === 1) this.hat(t, this.musicBus, 0.08);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  // ---------- síntese ----------
  tone(freq, t, dur, type = 'sine', vol = 0.3, bus = this.sfxBus, attack = 0.005, slideTo) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  noiseHit(t, dur, vol, filterType, freq, bus = this.sfxBus, q = 1) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }
  kick(t, bus, vol = 0.8) { this.tone(150, t, 0.25, 'sine', vol, bus, 0.002, 40); }
  snare(t, bus, vol = 0.4) { this.noiseHit(t, 0.15, vol, 'highpass', 1500, bus); this.tone(200, t, 0.08, 'triangle', vol * 0.5, bus); }
  hat(t, bus, vol = 0.1) { this.noiseHit(t, 0.04, vol, 'highpass', 7000, bus); }

  // ---------- efeitos ----------
  play(name, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const v = opts.vol ?? 1;
    const p = opts.pitch ?? 1;
    switch (name) {
      case 'click': this.tone(880 * p, t, 0.06, 'square', 0.12 * v); break;
      case 'hover': this.tone(1320 * p, t, 0.03, 'sine', 0.06 * v); break;
      case 'back': this.tone(520, t, 0.08, 'square', 0.1 * v, undefined, 0.005, 300); break;
      case 'hit': this.noiseHit(t, 0.08, 0.6 * v, 'bandpass', 2200 * p, undefined, 2); this.tone(600 * p, t, 0.08, 'triangle', 0.4 * v, undefined, 0.002, 300); break;
      case 'bigHit': this.noiseHit(t, 0.18, 0.9 * v, 'lowpass', 1800, undefined); this.kick(t, this.sfxBus, 0.9 * v); break;
      case 'bounce': this.tone(300 * p, t, 0.08, 'sine', 0.35 * v, undefined, 0.002, 140 * p); break;
      case 'whoosh': this.noiseHit(t, 0.25, 0.25 * v, 'bandpass', 900 * p, undefined, 0.8); break;
      case 'swish': this.noiseHit(t, 0.35, 0.3 * v, 'highpass', 3000); break;
      case 'pins': for (let i = 0; i < 6; i++) this.noiseHit(t + i * 0.03 + Math.random() * 0.03, 0.12, 0.5 * v, 'bandpass', 1800 + Math.random() * 1500, undefined, 3); break;
      case 'punch': this.kick(t, this.sfxBus, 0.8 * v); this.noiseHit(t, 0.1, 0.6 * v, 'lowpass', 900); break;
      case 'block': this.tone(220, t, 0.1, 'square', 0.2 * v); this.noiseHit(t, 0.06, 0.3, 'bandpass', 600); break;
      case 'arrow': this.noiseHit(t, 0.3, 0.3 * v, 'bandpass', 1800, undefined, 1, 0.5); this.tone(900, t, 0.2, 'sine', 0.05, undefined, 0.01, 600); break;
      case 'thunk': this.tone(180, t, 0.12, 'triangle', 0.6 * v, undefined, 0.002, 90); this.noiseHit(t, 0.05, 0.4, 'lowpass', 1200); break;
      case 'bat': this.noiseHit(t, 0.06, 0.9 * v, 'bandpass', 3000, undefined, 1.5); this.tone(1200, t, 0.05, 'square', 0.25 * v, undefined, 0.001, 500); break;
      case 'whistle': this.tone(2400, t, 0.35, 'sine', 0.2 * v, undefined, 0.01); this.tone(2480, t, 0.35, 'sine', 0.12 * v, undefined, 0.01); break;
      case 'coin': this.tone(988, t, 0.08, 'square', 0.12 * v); this.tone(1319, t + 0.08, 0.25, 'square', 0.12 * v); break;
      case 'point': [0, 4, 7].forEach((n, i) => this.tone(NOTE(72 + n), t + i * 0.07, 0.18, 'triangle', 0.25 * v)); break;
      case 'lose': [7, 4, 0].forEach((n, i) => this.tone(NOTE(67 + n), t + i * 0.12, 0.25, 'triangle', 0.22 * v)); break;
      case 'fanfare': [0, 4, 7, 12, 7, 12].forEach((n, i) => this.tone(NOTE(72 + n), t + i * 0.11, i === 5 ? 0.6 : 0.16, 'square', 0.12 * v)); break;
      case 'levelup': [0, 2, 4, 5, 7, 9, 11, 12].forEach((n, i) => this.tone(NOTE(72 + n), t + i * 0.05, 0.15, 'square', 0.1 * v)); break;
      case 'cheer': this.crowd(t, 1.8, 0.35 * v); break;
      case 'aww': this.tone(330, t, 0.8, 'sawtooth', 0.04 * v, undefined, 0.1, 220); this.crowd(t, 0.8, 0.12 * v); break;
      case 'tick': this.tone(1500, t, 0.03, 'square', 0.08 * v); break;
      case 'splash': this.noiseHit(t, 0.6, 0.5 * v, 'lowpass', 900); break;
      case 'bell': this.tone(1046, t, 1, 'sine', 0.3 * v); this.tone(2093, t, 0.6, 'sine', 0.1 * v); break;
      case 'cup': this.tone(700, t, 0.08, 'triangle', 0.4 * v); this.tone(500, t + 0.09, 0.1, 'triangle', 0.4 * v); this.tone(420, t + 0.2, 0.12, 'triangle', 0.3 * v); break;
    }
  }
  crowd(t, dur, vol) {
    this.noiseHit(t, dur, vol, 'bandpass', 1100, this.sfxBus, 0.6);
    this.noiseHit(t + 0.1, dur * 0.9, vol * 0.6, 'bandpass', 2200, this.sfxBus, 0.8);
  }
}
