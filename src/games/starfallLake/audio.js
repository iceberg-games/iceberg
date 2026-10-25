// Starfall Lake procedural audio: soft pad drone + pentatonic catch plucks that climb with
// combo, a constellation arpeggio, and gentle wink-out / countdown blips.
// Routes through the platform AudioContext + master gain (ctx.music.ctx / .master) so mute works.
// Sound Designer hook: replace sfx(name, arg) bodies or the pad in start().
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];
const scale = (i) => 69 + PENTA[i % 5] + 12 * Math.floor(i / 5);   // A minor-pentatonic-ish ladder

export class StarfallAudio {
  constructor(music) { this.music = music; this.pad = null; }
  get ctx() { return this.music?.ctx; }
  get out() { return this.music?.master; }
  _tone(freq, t, dur, { type = 'sine', vol = 0.06, attack = 0.004, slideTo = null } = {}) {
    const ctx = this.ctx; if (!ctx || !this.out) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.verb || this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  start() {
    const ctx = this.ctx; if (this.pad || !ctx || !this.out) return;
    // cheap "reverb": feedback delay
    const d = ctx.createDelay(1); d.delayTime.value = 0.23; const fb = ctx.createGain(); fb.gain.value = 0.35;
    const wet = ctx.createGain(); wet.gain.value = 0.5; const inp = ctx.createGain();
    inp.connect(this.out); inp.connect(d); d.connect(fb).connect(d); d.connect(wet).connect(this.out);
    this.verb = inp;
    const bus = ctx.createGain(); bus.gain.value = 0; bus.gain.setTargetAtTime(0.05, ctx.currentTime, 2); bus.connect(this.out);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(bus);
    const oscs = [45, 52, 57, 64].map((n, i) => { const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = (i - 1.5) * 6; o.connect(lp); o.start(); return o; });
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 350; lfo.connect(lg).connect(lp.frequency); lfo.start();
    this.pad = { oscs: [...oscs, lfo], bus };
  }
  stop() {
    if (!this.pad) return; const ctx = this.ctx;
    this.pad.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    const p = this.pad; setTimeout(() => p.oscs.forEach(o => { try { o.stop(); } catch {} }), 800);
    this.pad = null;
  }
  sfx(name, arg = 0) {
    const ctx = this.ctx; if (!ctx) return; const t = ctx.currentTime;
    if (name === 'catch') {             // arg = combo (1..8)
      const n = scale(arg + 2);
      this._tone(NOTE(n), t, 0.5, { type: 'triangle', vol: 0.09 });
      this._tone(NOTE(n + 12), t + 0.02, 0.35, { vol: 0.04 });
    } else if (name === 'gold') {
      [0, 4, 7, 12].forEach((k, i) => this._tone(NOTE(81 + k), t + i * 0.04, 0.5, { type: 'triangle', vol: 0.06 }));
    } else if (name === 'constellation') {   // arg = size
      const base = 69; [0, 4, 7, 11, 14, 19].slice(0, arg + 1).forEach((k, i) => this._tone(NOTE(base + k), t + i * 0.07, 1.4, { type: 'sine', vol: 0.08 }));
      this._tone(NOTE(base + 24), t + 0.45, 1.8, { vol: 0.05 });
    } else if (name === 'wink') {
      this._tone(NOTE(64), t, 0.25, { vol: 0.025, slideTo: NOTE(52) });
    } else if (name === 'tick') {
      this._tone(NOTE(arg ? 81 : 69), t, 0.18, { type: 'square', vol: 0.03 });
    } else if (name === 'end') {
      [76, 72, 69, 64].forEach((n, i) => this._tone(NOTE(n), t + i * 0.12, 0.8, { type: 'triangle', vol: 0.06 }));
    } else if (name === 'best') {
      [69, 73, 76, 81, 85, 88].forEach((n, i) => this._tone(NOTE(n), t + i * 0.06, 0.9, { type: 'triangle', vol: 0.07 }));
    }
  }
}
