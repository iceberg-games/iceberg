// Corner Bakery Rush: original procedural café music ("Morning Rush") and SFX.
// Everything is synthesized live with Web Audio and routed through the
// platform's shared AudioContext and master gain (ctx.music.ctx / .master), so
// the HUD mute and volume controls apply. A send to the shared reverb is used
// when it exists.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// ii - V - I - vi in F major, jazzy voicings (MIDI notes)
const CHORDS = [
  { root: 43, notes: [58, 62, 65, 69] },  // Gm9   (G Bb D F A)
  { root: 36, notes: [58, 62, 64, 69] },  // C13-ish (Bb D E A)
  { root: 41, notes: [57, 60, 64, 67] },  // Fmaj9 (A C E G)
  { root: 38, notes: [57, 60, 65, 69] },  // Dm7   (A C F A)
];
// two-bar melody phrases over the 4-chord loop (8th-note steps, 0 = rest), F major pentatonic-ish
const MELODY = [
  [74, 0, 72, 69, 0, 67, 69, 0, 72, 0, 0, 74, 77, 0, 0, 0],
  [76, 0, 74, 72, 0, 69, 72, 0, 74, 0, 72, 0, 69, 0, 0, 0],
  [72, 0, 74, 0, 77, 0, 79, 77, 76, 0, 74, 0, 72, 0, 69, 0],
  [74, 0, 72, 0, 69, 67, 65, 0, 67, 0, 69, 0, 65, 0, 0, 0],
];
const BASS = [[0, 7, 12, 10], [0, 4, 7, 9], [0, 7, 9, 12], [0, 3, 7, 5]];

export class BakeryAudio {
  constructor(music) { this.music = music; this.timer = null; this.step = 0; this.intensity = 0; this.targetIntensity = 0; this.tempo = 1; }
  get ctx() { return this.music?.ctx || null; }
  get out() { return this.music?.master || null; }
  get ready() { return !!(this.ctx && this.out && this.ctx.state === 'running'); }

  _env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  _osc(type, f, t, dur, dest, vol, { attack = 0.005, slideTo = null, detune = 0 } = {}) {
    const ctx = this.ctx; const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    this._env(g, t, attack, vol, dur); o.connect(g).connect(dest); o.start(t); o.stop(t + attack + dur + 0.05);
    return o;
  }
  _noiseBuf() {
    if (!this._nb) { const ctx = this.ctx, b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this._nb = b; }
    return this._nb;
  }
  _noise(t, dur, vol, { freq = 4000, type = 'bandpass', q = 1, dest = null, attack = 0.002, sweepTo = null } = {}) {
    const ctx = this.ctx; const s = ctx.createBufferSource(); s.buffer = this._noiseBuf();
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain(); this._env(g, t, attack, vol, dur);
    s.connect(f).connect(g).connect(dest || this.sfxBus || this.out); s.start(t, Math.random() * 0.5); s.stop(t + attack + dur + 0.05);
  }
  /** FM electric piano voice (Rhodes-like tine). */
  _ep(note, t, dur, vol, dest) {
    const ctx = this.ctx, f = NOTE(note);
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.type = 'sine'; mod.type = 'sine'; car.frequency.value = f; mod.frequency.value = f * 14.0;
    mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.35);
    const body = ctx.createOscillator(), bg = ctx.createGain(); body.type = 'sine'; body.frequency.value = f; // warm fundamental
    bg.gain.value = 0.6;
    mod.connect(mg).connect(car.frequency); car.connect(g); body.connect(bg).connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dest);
    for (const o of [car, mod, body]) { o.start(t); o.stop(t + dur + 0.05); }
  }
  _whistle(note, t, dur, vol, dest) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(NOTE(note) * 0.985, t); o.frequency.exponentialRampToValueAtTime(NOTE(note), t + 0.05);
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(NOTE(note) * 0.012, t + 0.25);
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
  }

  /** Start the café loop. Safe to call every frame; waits for the platform audio unlock. */
  start() {
    if (this.timer || !this.ready) return;
    const ctx = this.ctx;
    this.bus = ctx.createGain(); this.bus.gain.value = 0; this.bus.gain.setTargetAtTime(0.75, ctx.currentTime, 0.8); this.bus.connect(this.out);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.out);
    if (this.music.reverb) { this.send = ctx.createGain(); this.send.gain.value = 0.28; this.bus.connect(this.send).connect(this.music.reverb); }
    // gentle low-pass on the whole band for warmth
    this.next = ctx.currentTime + 0.12; this.step = 0;
    this.timer = setInterval(() => this._tick(), 40);
  }
  _tick() {
    const ctx = this.ctx; if (!ctx || !this.bus) return;
    this.intensity += (this.targetIntensity - this.intensity) * 0.05;
    const bpm = 104 * (1 + this.intensity * 0.06), eighth = 60 / bpm / 2;
    while (this.next < ctx.currentTime + 0.25) {
      const i = this.step++, swing = (i % 2) ? eighth * 0.16 : 0;
      this._step(this.next + swing, i, eighth);
      this.next += eighth;
    }
  }
  _step(t, i, e) {
    const b = this.bus, bar = Math.floor(i / 8) % 4, s = i % 8, loop = Math.floor(i / 32);
    const ch = CHORDS[bar], hot = this.intensity;
    // EP comping: chord on beat 1 and the "and" of 2, little stab on 4
    if (s === 0) ch.notes.forEach((n, k) => this._ep(n, t + k * 0.012, e * 5, 0.05, b));
    if (s === 3) ch.notes.slice(1).forEach((n, k) => this._ep(n, t + k * 0.01, e * 2.5, 0.035, b));
    if (s === 6 && (bar % 2 === 1)) ch.notes.slice(2).forEach((n) => this._ep(n + 12, t, e * 1.5, 0.025, b));
    // walking bass on beats
    if (s % 2 === 0) { const n = ch.root + BASS[bar][s / 2]; this._osc('triangle', NOTE(n), t, e * 1.7, b, 0.2, { attack: 0.01 }); this._osc('sine', NOTE(n - 12), t, e * 1.5, b, 0.12, { attack: 0.01 }); }
    // brushes: swish on 2 & 4, shaker 8ths
    if (s === 2 || s === 6) this._noise(t, 0.22, 0.07 + hot * 0.04, { freq: 2600, q: 0.6, dest: b, attack: 0.03, sweepTo: 1200 });
    this._noise(t, 0.05, (s % 2 ? 0.018 : 0.03) + hot * 0.02, { freq: 7000, type: 'highpass', dest: b });
    if (s === 0 && bar % 2 === 0) this._osc('sine', 110, t, 0.18, b, 0.12 + hot * 0.1, { slideTo: 50 }); // soft kick
    if (hot > 0.4 && s % 2 === 1) this._noise(t, 0.04, 0.02 * hot, { freq: 9500, type: 'highpass', dest: b }); // rush hats
    // whistled melody every other loop (and always when the rush is on)
    if (loop % 2 === 1 || hot > 0.5) {
      const phrase = MELODY[(bar + loop) % MELODY.length], n = phrase[(s + (bar % 2) * 8) % 16];
      if (n) this._whistle(n, t, e * 1.8, 0.045, b);
    }
  }
  setIntensity(v) { this.targetIntensity = Math.max(0, Math.min(1, v)); }
  stop() {
    clearInterval(this.timer); this.timer = null;
    const ctx = this.ctx;
    for (const node of [this.bus, this.sfxBus]) if (node && ctx) { node.gain.setTargetAtTime(0, ctx.currentTime, 0.25); setTimeout(() => { try { node.disconnect(); } catch { /* gone */ } }, 1500); }
    if (this.send) setTimeout(() => { try { this.send.disconnect(); } catch { /* gone */ } }, 1500);
    this.bus = this.sfxBus = this.send = null;
  }

  // ---------- SFX ----------
  sfx(name) {
    if (!this.ready) return;
    if (!this.sfxBus) { this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.out); }
    const ctx = this.ctx, t = ctx.currentTime, o = this.sfxBus;
    const bell = (n, tt, vol = 0.12, dec = 1.2) => { [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([mm, a]) => this._osc('sine', NOTE(n) * mm, tt, dec / mm, o, vol * a, { attack: 0.002 })); };
    switch (name) {
      case 'doorbell': bell(88, t, 0.1, 1.1); bell(84, t + 0.14, 0.09, 1.3); bell(88, t + 0.3, 0.06, 1.0); break;
      case 'ding': bell(93, t, 0.13, 1.4); break;                                              // oven timer
      case 'start': this._noise(t, 0.35, 0.12, { freq: 500, type: 'lowpass', attack: 0.05 }); this._osc('sine', 180, t, 0.2, o, 0.06, { slideTo: 120 }); break; // oven door thunk
      case 'fry': for (let k = 0; k < 10; k++) this._noise(t + k * 0.05 + Math.random() * 0.03, 0.06, 0.05, { freq: 3000 + Math.random() * 3000, q: 2 }); this._noise(t, 0.8, 0.05, { freq: 5000, type: 'highpass', attack: 0.1 }); break;
      case 'brew': this._noise(t, 0.9, 0.06, { freq: 900, q: 3, attack: 0.1, sweepTo: 2200 }); for (let k = 0; k < 6; k++) this._osc('sine', 300 + Math.random() * 200, t + 0.15 + k * 0.11, 0.06, o, 0.05, { slideTo: 600 }); break;
      case 'steam': this._noise(t, 0.7, 0.06, { freq: 6000, type: 'highpass', attack: 0.05 }); break;
      case 'pickup': this._osc('triangle', 520, t, 0.1, o, 0.12, { slideTo: 880 }); this._osc('sine', 1040, t + 0.05, 0.08, o, 0.05); break;
      case 'frost': this._osc('sine', 700, t, 0.18, o, 0.08, { slideTo: 1400 }); this._noise(t, 0.15, 0.04, { freq: 3000 }); break;
      case 'trash': this._noise(t, 0.25, 0.12, { freq: 400, type: 'lowpass' }); this._osc('square', 140, t, 0.12, o, 0.04, { slideTo: 70 }); break;
      case 'give': this._osc('triangle', 660, t, 0.12, o, 0.1); this._osc('triangle', 990, t + 0.07, 0.14, o, 0.08); break;
      case 'chaching': // register: metallic bell + coin rattle
        bell(91, t, 0.12, 0.9); bell(96, t + 0.09, 0.1, 1.0);
        for (let k = 0; k < 7; k++) this._osc('sine', 2400 + Math.random() * 1800, t + 0.12 + k * 0.035 + Math.random() * 0.02, 0.05, o, 0.04);
        this._noise(t, 0.08, 0.06, { freq: 5000, q: 4 }); break;
      case 'happy': this._osc('sine', 700, t, 0.08, o, 0.07, { slideTo: 1000 }); this._osc('sine', 1000, t + 0.09, 0.1, o, 0.06, { slideTo: 1300 }); break;
      case 'angry': this._osc('sawtooth', 220, t, 0.25, o, 0.05, { slideTo: 150 }); this._osc('sawtooth', 160, t + 0.18, 0.3, o, 0.05, { slideTo: 110 }); break;
      case 'deny': this._osc('square', 200, t, 0.12, o, 0.04); this._osc('square', 150, t + 0.1, 0.14, o, 0.04); break;
      case 'buzzer': for (let k = 0; k < 3; k++) this._osc('square', 120, t + k * 0.22, 0.16, o, 0.07); this._noise(t, 0.6, 0.05, { freq: 300, type: 'lowpass' }); break;
      case 'warn': bell(81, t, 0.06, 0.4); break;
      case 'tick': this._osc('sine', 1600, t, 0.03, o, 0.05); break;
      case 'go': [72, 76, 79, 84].forEach((n, k) => this._ep(n, t + k * 0.07, 0.6, 0.09, o)); break;
      case 'closing': bell(84, t, 0.1, 1.2); bell(79, t + 0.25, 0.1, 1.2); bell(72, t + 0.5, 0.12, 1.6); break;
      case 'clear': [65, 69, 72, 77, 81].forEach((n, k) => this._ep(n, t + k * 0.09, 1.2, 0.09, o)); break;
      case 'star': bell(96 + (this._starN = ((this._starN || 0) + 4) % 12), t, 0.12, 1.0); break;
      case 'fanfare': [[65, 0], [69, 0.12], [72, 0.24], [77, 0.36], [72, 0.6], [77, 0.72], [81, 0.84]].forEach(([n, d]) => { this._ep(n, t + d, 1.0, 0.1, o); this._whistle(n + 12, t + d, 0.22, 0.04, o); }); break;
      case 'fail': [69, 65, 62, 57].forEach((n, k) => this._ep(n, t + k * 0.16, 0.8, 0.08, o)); break;
      case 'ui': this._osc('sine', 880, t, 0.06, o, 0.05); break;
    }
  }
}
