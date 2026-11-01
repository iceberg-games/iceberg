// Pengu Plaza audio: Sound Designer pack (./sfx/<cue>.ogg) through the shared music ctx/master,
// with a procedural WebAudio fallback for every cue (incl. a gentle music-box BGM loop).
const URLS = (() => { try { return import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }); } catch { return {}; } })();
export const CUES = ['bgm_pengu-plaza', 'sfx_emote_wave', 'sfx_emote_dance', 'sfx_emote_cheer', 'sfx_sit', 'sfx_skate_loop', 'sfx_skate_stop', 'sfx_cocoa', 'sfx_penguin_honk', 'sfx_camera_shutter', 'sfx_foot_crunch', 'sfx_bell_chime'];
const GAIN = { sfx_foot_crunch: 0.6, sfx_skate_loop: 0.45 };   // Sound Designer manifest gains (others 1.0)
const BGM_GAIN = 0.4;
const JITTER = new Set(['sfx_foot_crunch', 'sfx_penguin_honk', 'sfx_emote_wave']);

export class PlazaAudio {
  constructor(music) { this.music = music; this.bufs = {}; this.loading = false; this.bgm = null; this.skate = null; this.played = 0; this._noise = null; }
  get ctx() { return this.music?.ctx || null; }
  get out() { return this.music?.master || null; }
  _load() {
    if (this.loading || !this.ctx) return; this.loading = true;
    for (const [path, url] of Object.entries(URLS)) {
      const name = path.split('/').pop().replace('.ogg', '');
      fetch(url).then(r => r.arrayBuffer()).then(d => new Promise((ok, bad) => { const p = this.ctx.decodeAudioData(d, ok, bad); p?.catch?.(bad); }))
        .then(b => { this.bufs[name] = b; if (name === 'bgm_pengu-plaza' && this.wantMusic) { this.stopMusic(true); this.startMusic(); } }).catch(() => {});
    }
  }
  ok() { const c = this.ctx; if (!c || !this.out) return false; if (c.state !== 'running') c.resume?.(); return c.state === 'running'; }
  play(name, vol = 1) {
    if (!this.ok()) return; this._load(); this.played++;
    const b = this.bufs[name], ctx = this.ctx;
    if (!b) return this._synth(name, vol);
    const s = ctx.createBufferSource(); s.buffer = b; if (JITTER.has(name)) s.playbackRate.value = 0.9 + Math.random() * 0.2;
    const g = ctx.createGain(); g.gain.value = (GAIN[name] ?? 1.0) * vol; s.connect(g).connect(this.out); s.start();
  }
  // ---- procedural voices ----
  _tone(f, t, dur, { type = 'sine', vol = 0.12, f2 = null, attack = 0.005 } = {}) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05); return { o, g };
  }
  _noiseBuf() { if (this._noise) return this._noise; const c = this.ctx, b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (this._noise = b); }
  _hiss(t, dur, { freq = 2000, q = 1, vol = 0.1, type = 'bandpass' } = {}) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this._noiseBuf(); const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(this.out); s.start(t); s.stop(t + dur + 0.05);
  }
  _synth(name, vol) {
    const t = this.ctx.currentTime, v = vol;
    switch (name) {
      case 'sfx_emote_wave': [784, 988].forEach((f, i) => this._tone(f, t + i * 0.09, 0.25, { type: 'triangle', vol: 0.1 * v })); break;
      case 'sfx_emote_dance': [523, 659, 784, 659, 523, 784].forEach((f, i) => this._tone(f, t + i * 0.12, 0.14, { type: 'square', vol: 0.04 * v })); break;
      case 'sfx_emote_cheer': [523, 659, 784, 1046].forEach((f, i) => this._tone(f, t + i * 0.07, 0.4, { type: 'triangle', vol: 0.09 * v })); this._hiss(t + 0.2, 0.5, { freq: 5000, vol: 0.05 * v }); break;
      case 'sfx_sit': this._hiss(t, 0.18, { freq: 400, q: 0.6, vol: 0.18 * v, type: 'lowpass' }); this._tone(180, t, 0.15, { vol: 0.08 * v, f2: 120 }); break;
      case 'sfx_skate_stop': this._hiss(t, 0.45, { freq: 3500, q: 0.8, vol: 0.16 * v }); break;
      case 'sfx_cocoa': this._tone(1400, t, 0.12, { vol: 0.07 * v }); for (let i = 0; i < 6; i++) this._tone(300 + Math.random() * 500, t + 0.15 + i * 0.06, 0.08, { vol: 0.05 * v, f2: 900 }); this._tone(392, t + 0.6, 0.5, { type: 'triangle', vol: 0.07 * v, f2: 523 }); break;
      case 'sfx_penguin_honk': { const r = 0.85 + Math.random() * 0.3; this._tone(420 * r, t, 0.22, { type: 'sawtooth', vol: 0.05 * v, f2: 300 * r }); this._tone(440 * r, t + 0.02, 0.2, { type: 'square', vol: 0.02 * v, f2: 340 * r }); break; }
      case 'sfx_camera_shutter': this._hiss(t, 0.05, { freq: 3000, vol: 0.25 * v }); this._hiss(t + 0.09, 0.07, { freq: 1800, vol: 0.2 * v }); this._tone(2400, t + 0.2, 0.15, { vol: 0.03 * v }); break;
      case 'sfx_foot_crunch': this._hiss(t, 0.09, { freq: 900 + Math.random() * 600, q: 1.5, vol: 0.08 * v }); break;
      case 'sfx_bell_chime': [1046, 1318, 1568].forEach((f, i) => { this._tone(f, t + i * 0.18, 1.8, { vol: 0.08 * v }); this._tone(f * 2.76, t + i * 0.18, 0.6, { vol: 0.015 * v }); }); break;
      default: this._tone(660, t, 0.2, { type: 'triangle', vol: 0.08 * v });
    }
  }
  startMusic() {
    this.wantMusic = true; if (!this.ok() || this.bgm) return; this._load();
    const ctx = this.ctx, b = this.bufs['bgm_pengu-plaza'], g = ctx.createGain(); g.gain.value = b ? BGM_GAIN : 0.45; g.connect(this.out);
    if (b) { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.connect(g); s.start(); this.bgm = { s, g }; return; }
    // procedural music box: I–vi–IV–V in C, plinky arps + soft pad, scheduled ahead
    const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], hz = (m) => 440 * 2 ** ((m - 69) / 12), beat = 0.42;
    let next = ctx.currentTime + 0.1, bar = 0;
    const tick = () => {
      while (next < ctx.currentTime + 1.2) {
        const ch = chords[bar % 4];
        for (let i = 0; i < 8; i++) { const n = ch[[0, 1, 2, 1, 0, 2, 1, 2][i]] + 12 + (i === 6 && bar % 2 ? 12 : 0); const o = ctx.createOscillator(), e = ctx.createGain(); o.type = 'sine'; o.frequency.value = hz(n); const t = next + i * beat / 2; e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.05, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); o.connect(e).connect(g); o.start(t); o.stop(t + 1); }
        for (const m of ch) { const o = ctx.createOscillator(), e = ctx.createGain(); o.type = 'triangle'; o.frequency.value = hz(m - 12); e.gain.setValueAtTime(0.0001, next); e.gain.linearRampToValueAtTime(0.018, next + 0.6); e.gain.linearRampToValueAtTime(0.0001, next + beat * 4); o.connect(e).connect(g); o.start(next); o.stop(next + beat * 4 + 0.1); }
        next += beat * 4; bar++;
      }
    };
    tick(); this.bgm = { g, timer: setInterval(tick, 400) };
  }
  stopMusic(keepWant = false) { if (!keepWant) this.wantMusic = false; const b = this.bgm; if (!b) return; clearInterval(b.timer); try { b.s?.stop(); } catch {} try { b.g.disconnect(); } catch {} this.bgm = null; }
  setSkating(on, speed = 0) {
    if (!this.ok()) return; const ctx = this.ctx;
    if (on && !this.skate) {
      const s = ctx.createBufferSource(), b = this.bufs.sfx_skate_loop; const g = ctx.createGain(); g.gain.value = 0; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.value = 3000;
      if (b) { s.buffer = b; s.connect(g); } else { s.buffer = this._noiseBuf(); s.connect(f).connect(g); }
      s.loop = true; g.connect(this.out); s.start(); this.skate = { s, g, f, real: !!b };
    }
    if (!this.skate) return;
    const t = ctx.currentTime; const k = this.skate.real ? GAIN.sfx_skate_loop * (0.35 + Math.min(1, speed) * 0.65) : 0.02 + Math.min(1, speed) * 0.09;
    this.skate.g.gain.setTargetAtTime(on ? k : 0, t, 0.08); if (this.skate.real) this.skate.s.playbackRate.setTargetAtTime(0.85 + Math.min(1, speed) * 0.3, t, 0.1); this.skate.f.frequency.setTargetAtTime(2200 + speed * 2500, t, 0.1);
  }
  stop() { this.stopMusic(); try { this.skate?.s.stop(); } catch {} this.skate = null; }
}
