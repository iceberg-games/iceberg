// Snowball Siege audio: loads ./sfx/<cue>.ogg|wav when present (Sound Designer pack), else procedural synth.
import GAINS from './sfx/cues.json';   // Sound 2 manifest gains/loops
// Routes through ctx.music.ctx / .master so the platform mute works.
const URLS = (() => { try { return import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }); } catch { return {}; } })();
const urlFor = (n) => Object.entries(URLS).find(([k]) => k.startsWith(`./sfx/${n}.`))?.[1];
const siteMuted = () => window.icebergUi?.isMuted?.() ?? !!window.iceberg?.music?.muted;
export const CUES = ['bgm_snowball-siege', 'bgm_siege-lobby', 'sfx_throw_charge', 'sfx_throw_release', 'sfx_snowball_hit', 'sfx_snowball_whiff',
  'sfx_fort_hit', 'sfx_fort_break', 'sfx_capture_tick', 'sfx_capture_win', 'sfx_respawn', 'sfx_reload', 'sfx_cheer', 'sfx_defeat'];
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// Procedural BGM patterns (bouncy pentatonic, cozy not grim)
const BGM = {
  'bgm_snowball-siege': { bpm: 132, bass: [45, 45, 52, 52, 50, 50, 47, 52], lead: [69, 72, 74, 76, 74, 72, 79, 76, 74, 72, 69, 72, 74, 0, 72, 0], vol: 0.05 },
  'bgm_siege-lobby':    { bpm: 92, bass: [48, 55, 53, 55], lead: [72, 0, 76, 79, 0, 76, 74, 0], vol: 0.04 },
};
export class SiegeAudio {
  constructor(music) { this.music = music; this.bufs = {}; this.loops = {}; this.bgm = null; this._noise = null; this._load(); }
  get ctx() { return this.music?.ctx; }
  get out() { return this.music?.master; }
  _load() {
    const c = this.ctx; if (!c) return;
    for (const n of CUES) { const u = urlFor(n); if (!u) continue;
      fetch(u).then(r => r.arrayBuffer()).then(a => c.decodeAudioData(a)).then(b => { this.bufs[n] = b; if (this.bgm === n) { this._stopBgm(); this.music_(n); } }).catch(() => {}); }
  }
  play(n, vol = 1, rate = 1) {
    const c = this.ctx, b = this.bufs[n]; if (!c || !b || !this.out) return false;
    if (siteMuted()) return true;
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; const g = c.createGain(); g.gain.value = (GAINS[n]?.gain ?? 1) * vol;
    s.connect(g).connect(this.out); s.start(); return true;
  }
  noiseBuf() { if (this._noise) return this._noise; const c = this.ctx, b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (this._noise = b); }
  tone(f, t, dur, { type = 'sine', vol = 0.06, slideTo = null, dest = null } = {}) {
    const c = this.ctx; if (!c || !this.out) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t, dur, { vol = 0.1, type = 'bandpass', f = 1200, fTo = null, q = 1 } = {}) {
    const c = this.ctx; if (!c || !this.out) return;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf(); s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // ---- music ----
  music_(name) {
    if (this.bgm === name && (this.loops.bgm || this._seq)) return;
    this._stopBgm(); this.bgm = name; const c = this.ctx; if (!c || !this.out) return;
    if (this.bufs[name]) { const s = c.createBufferSource(); s.buffer = this.bufs[name]; s.loop = true; const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(GAINS[name]?.gain ?? 0.5, c.currentTime, 0.6); s.connect(g).connect(this.out); s.start(); this.loops.bgm = { s, g }; return; }
    const P = BGM[name], bus = c.createGain(); bus.gain.value = 0; bus.gain.setTargetAtTime(1, c.currentTime, 0.5); bus.connect(this.out);
    const step = 60 / P.bpm / 2; let i = 0, next = c.currentTime + 0.1;
    this._seq = { bus, id: setInterval(() => {
      if (siteMuted()) { next = c.currentTime + 0.1; return; }
      while (next < c.currentTime + 0.25) {
        if (i % 2 === 0) this.tone(NOTE(P.bass[(i / 2 | 0) % P.bass.length]), next, step * 1.8, { type: 'triangle', vol: P.vol * 1.3, dest: bus });
        const l = P.lead[i % P.lead.length]; if (l) this.tone(NOTE(l), next, step * 0.9, { type: 'square', vol: P.vol * 0.45, dest: bus });
        if (i % 4 === 2) this.noise(next, 0.04, { vol: P.vol * 0.8, type: 'highpass', f: 7000 });
        i++; next += step;
      }
    }, 60) };
  }
  _stopBgm() {
    const c = this.ctx;
    if (this.loops.bgm) { const l = this.loops.bgm; l.g.gain.setTargetAtTime(0, c.currentTime, 0.3); setTimeout(() => { try { l.s.stop(); } catch {} }, 1200); delete this.loops.bgm; }
    if (this._seq) { clearInterval(this._seq.id); const b = this._seq.bus; b.gain.setTargetAtTime(0, c.currentTime, 0.2); setTimeout(() => b.disconnect(), 1000); this._seq = null; }
  }
  stop() { this._stopBgm(); this.bgm = null; this._chargeStop(); }
  // ---- charge whine (held) ----
  chargeStart() {
    const c = this.ctx; if (!c || !this.out || this._ch || siteMuted()) return;
    if (this.bufs.sfx_throw_charge) { const s = c.createBufferSource(); s.buffer = this.bufs.sfx_throw_charge; const g = c.createGain(); g.gain.value = GAINS.sfx_throw_charge?.gain ?? 0.7; s.connect(g).connect(this.out); s.start(); this._ch = { o: s, g }; return; }
    const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(NOTE(64), c.currentTime);
    o.frequency.exponentialRampToValueAtTime(NOTE(84), c.currentTime + 0.75); g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.035, c.currentTime + 0.05);
    o.connect(g).connect(this.out); o.start(); this._ch = { o, g };
  }
  _chargeStop() { const c = this.ctx; if (!this._ch) return; const { o, g } = this._ch; g.gain.setTargetAtTime(0.0001, c.currentTime, 0.02); setTimeout(() => { try { o.stop(); } catch {} }, 150); this._ch = null; }
  // ---- one-shots ----
  sfx(name, arg = 0) {
    const c = this.ctx; if (!c) return; const t = c.currentTime;
    if (name === 'sfx_throw_release') this._chargeStop();
    if (this.play(name, 1, name === 'sfx_snowball_hit' ? 1.05 - arg * 0.15 : 1)) return;
    if (siteMuted()) return;
    switch (name) {
      case 'sfx_throw_release': this.noise(t, 0.16, { vol: 0.08 + arg * 0.07, f: 800, fTo: 2800, q: 2 }); break;
      case 'sfx_snowball_hit': this.noise(t, 0.12, { vol: 0.2, type: 'lowpass', f: 1800 }); this.tone(NOTE(76 + arg * 7), t, 0.18, { type: 'triangle', vol: 0.07, slideTo: NOTE(88) }); this.tone(NOTE(48), t, 0.2, { type: 'square', vol: 0.06, slideTo: NOTE(38) }); break;
      case 'sfx_snowball_whiff': this.noise(t, 0.1, { vol: 0.07, type: 'lowpass', f: 1300 }); break;
      case 'sfx_fort_hit': this.noise(t, 0.2, { vol: 0.16, type: 'lowpass', f: 700 }); this.tone(NOTE(40), t, 0.25, { type: 'sine', vol: 0.12, slideTo: NOTE(33) }); break;
      case 'sfx_fort_break': this.noise(t, 1.2, { vol: 0.3, type: 'lowpass', f: 2500, fTo: 120 }); [55, 50, 43].forEach((n, i) => this.tone(NOTE(n), t + i * 0.1, 0.6, { type: 'sawtooth', vol: 0.06 })); break;
      case 'sfx_capture_tick': this.tone(NOTE(79 + arg * 12), t, 0.08, { type: 'square', vol: 0.03 }); break;
      case 'sfx_capture_win': [72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), t + i * 0.09, 0.5, { type: 'triangle', vol: 0.08 })); break;
      case 'sfx_respawn': this.tone(NOTE(67), t, 0.3, { vol: 0.06, slideTo: NOTE(86) }); this.noise(t, 0.3, { vol: 0.05, type: 'highpass', f: 5000 }); break;
      case 'sfx_reload': [0, 0.08, 0.16].forEach(d => this.noise(t + d, 0.05, { vol: 0.09, type: 'lowpass', f: 1600 })); this.tone(NOTE(84), t + 0.24, 0.1, { vol: 0.04 }); break;
      case 'sfx_cheer': [67, 71, 74, 79, 83, 86].forEach((n, i) => this.tone(NOTE(n), t + i * 0.08, 0.8, { type: 'triangle', vol: 0.08 })); this.noise(t, 1.4, { vol: 0.06, f: 2500, q: 0.5 }); break;
      case 'sfx_defeat': [67, 64, 60, 55].forEach((n, i) => this.tone(NOTE(n), t + i * 0.16, 0.6, { type: 'triangle', vol: 0.06 })); break;
      case 'tick': this.tone(NOTE(arg ? 81 : 69), t, 0.18, { type: 'square', vol: 0.04 }); break;
      case 'ow': this.tone(NOTE(70), t, 0.2, { type: 'triangle', vol: 0.06, slideTo: NOTE(58) }); break;
      case 'emote': this.tone(NOTE(84), t, 0.1, { vol: 0.04 }); this.tone(NOTE(88), t + 0.07, 0.12, { vol: 0.04 }); break;
    }
  }
}
