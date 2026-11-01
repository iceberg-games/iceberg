// Glacier Drift audio (RimeAudio-style): Sound Designer pack from ./sfx/*.{ogg,mp3,wav} via the platform's
// shared AudioContext/master (ctx.music.ctx/.master, so HUD mute/volume apply). Every cue has a procedural
// fallback so the game is never silent. Cue names (tip for Sound Designer):
export const CUES = ['bgm_glacier-drift', 'bgm_glacier-lobby', 'sfx_boost', 'sfx_shield', 'sfx_magnet', 'sfx_freeze_rival',
  'sfx_gate_pass', 'sfx_pickup', 'sfx_crash', 'sfx_land', 'sfx_whoosh', 'sfx_countdown', 'sfx_finish', 'sfx_star', 'sfx_powder'];
const URLS = (() => { try { return import.meta.glob('./sfx/*.{ogg,mp3,wav}', { eager: true, query: '?url', import: 'default' }); } catch { return {}; } })();
const GAIN = { sfx_whoosh: 0.5, sfx_powder: 0.4, sfx_land: 0.75, sfx_countdown: 0.7, sfx_star: 0.8, sfx_finish: 0.85 };
const MUSIC_GAIN = 0.5;
const JITTER = new Set(['sfx_whoosh', 'sfx_land', 'sfx_powder', 'sfx_pickup', 'sfx_gate_pass']);

export class GlacierAudio {
  constructor(music) { this.music = music; this.bufs = {}; this.loading = false; this.loop = null; this.track = null; this.hiss = null; this.synthLoop = null; }
  get ctx() { return this.music?.ctx || null; }
  get out() { return this.music?.master || null; }
  _load() {
    if (this.loading || !this.ctx) return; this.loading = true;
    for (const [path, url] of Object.entries(URLS)) {
      const name = path.split('/').pop().replace(/\.(ogg|mp3|wav)$/, '');
      fetch(url).then(r => r.arrayBuffer()).then(d => new Promise((ok, bad) => { const p = this.ctx.decodeAudioData(d, ok, bad); p?.catch?.(bad); }))
        .then(b => { this.bufs[name] = b; if (name === this.track) { this._stopLoop(); this.music_(this.track); } }).catch(() => {});
    }
  }
  /** Play a looping bgm cue (bgm_glacier-drift / bgm_glacier-lobby); procedural pad if the pack isn't there. */
  music_(name) {
    this.track = name; this._load(); const ctx = this.ctx; if (!ctx || !this.out) return;
    if (this.loop?.name === name) return; this._stopLoop();
    const b = this.bufs[name], g = ctx.createGain(); g.gain.value = 0; g.connect(this.out);
    g.gain.setTargetAtTime(MUSIC_GAIN, ctx.currentTime, 0.4);
    if (b) { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.connect(g); s.start(); this.loop = { name, g, stop: () => s.stop() }; return; }
    // procedural: soft arpeggio + pad, faster in race
    const race = name === 'bgm_glacier-drift', notes = race ? [523, 659, 784, 988, 784, 659] : [392, 494, 587, 494];
    let i = 0; const beat = race ? 0.18 : 0.42;
    const tick = () => {
      const t = ctx.currentTime, o = ctx.createOscillator(), e = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = notes[i++ % notes.length] * (i % 12 < 6 ? 1 : 0.89);
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.05, t + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.8);
      o.connect(e).connect(g); o.start(t); o.stop(t + beat * 2);
    };
    const id = setInterval(() => { if (ctx.state === 'running') tick(); }, beat * 1000);
    this.loop = { name, g, stop: () => clearInterval(id) };
  }
  _stopLoop() { if (!this.loop) return; const { g, stop } = this.loop; try { g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); setTimeout(() => { try { stop(); g.disconnect(); } catch {} }, 600); } catch {} this.loop = null; }
  duck(amount = 0.4, secs = 2.5) {
    if (!this.loop) return; const g = this.loop.g.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setTargetAtTime(MUSIC_GAIN * amount, t, 0.08); g.setTargetAtTime(MUSIC_GAIN, t + secs, 0.4);
  }
  play(name, vol = 1, rate = 1) {
    const ctx = this.ctx; if (!ctx || !this.out || ctx.state !== 'running') return; this._load();
    const b = this.bufs[name]; if (name === 'sfx_finish') this.duck();
    if (!b) return this._synth(name, vol, rate);
    const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate * (JITTER.has(name) ? 0.94 + Math.random() * 0.12 : 1);
    const g = ctx.createGain(); g.gain.value = (GAIN[name] ?? 0.7) * vol; s.connect(g).connect(this.out); s.start();
  }
  _noise(t, dur, f0, f1, vol, type = 'bandpass') {
    const ctx = this.ctx, b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out); s.start(t);
  }
  _tone(t, f0, f1, dur, vol, type = 'triangle') {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  _synth(name, vol = 1, rate = 1) {
    const t = this.ctx.currentTime, v = 0.14 * vol, T = (...a) => this._tone(...a), N = (...a) => this._noise(...a);
    switch (name) {
      case 'sfx_boost': T(t, 180, 900, 0.5, v, 'sawtooth'); N(t, 0.6, 600, 4000, v * 0.8); break;
      case 'sfx_shield': [660, 990, 1320].forEach((f, i) => T(t + i * 0.05, f, f * 1.01, 0.6, v * 0.7, 'sine')); break;
      case 'sfx_magnet': T(t, 300, 600, 0.25, v, 'square'); T(t + 0.12, 300, 900, 0.3, v * 0.6, 'square'); break;
      case 'sfx_freeze_rival': N(t, 0.7, 6000, 900, v, 'highpass'); [1760, 2093, 2637].forEach((f, i) => T(t + i * 0.06, f, f, 0.4, v * 0.5, 'sine')); break;
      case 'sfx_gate_pass': T(t, 880 * rate, 1320 * rate, 0.22, v); T(t + 0.06, 1320 * rate, 1760 * rate, 0.2, v * 0.6, 'sine'); break;
      case 'sfx_pickup': [784, 988, 1175, 1568].forEach((f, i) => T(t + i * 0.04, f, f, 0.15, v * 0.8, 'square')); break;
      case 'sfx_crash': N(t, 0.5, 1500, 120, v * 1.6, 'lowpass'); T(t, 160, 50, 0.4, v); break;
      case 'sfx_land': N(t, 0.25, 900, 200, v * 1.2, 'lowpass'); break;
      case 'sfx_whoosh': N(t, 0.5, 400, 2500, v * 0.7); break;
      case 'sfx_powder': N(t, 0.3, 3000, 1200, v * 0.5, 'highpass'); break;
      case 'sfx_countdown': T(t, rate > 1.2 ? 1046 : 660, rate > 1.2 ? 1046 : 660, 0.25, v, 'square'); break;
      case 'sfx_finish': [523, 659, 784, 1046, 1318].forEach((f, i) => T(t + i * 0.09, f, f, 0.5, v, 'triangle')); break;
      case 'sfx_star': T(t, 1046 * rate, 2093 * rate, 0.3, v, 'sine'); T(t + 0.05, 1568 * rate, 3136 * rate, 0.3, v * 0.5, 'sine'); break;
      default: T(t, 500, 500, 0.15, v);
    }
  }
  setSpeed(k, airborne) {
    const ctx = this.ctx; if (!ctx || !this.out) return;
    if (!this.hiss) {
      const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); let last = 0;
      for (let i = 0; i < d.length; i++) { last = last * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = last; }
      const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(this.out); s.start(); this.hiss = { s, f, g };
    }
    const t = ctx.currentTime;
    this.hiss.g.gain.setTargetAtTime(airborne ? 0.01 : 0.02 + k * 0.14, t, 0.08);
    this.hiss.f.frequency.setTargetAtTime(500 + k * 2600, t, 0.1);
  }
  stop() { this._stopLoop(); this.track = null; try { this.hiss?.s.stop(); } catch {} this.hiss = null; }
}
