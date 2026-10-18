// Original procedural music, synthesized live with WebAudio (no audio files).
// Themes: 'winter' (bells + soft pads, D minor), 'cozy' (piano-like arpeggios
// in C major + crackling fireplace ambience), 'none'.
// Audio starts only after the first user gesture (browser autoplay rules).

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function makeImpulse(ctx, seconds, decay) {
  const len = ctx.sampleRate * seconds, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}
function noiseBuffer(ctx, seconds = 2) {
  const len = ctx.sampleRate * seconds, buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // brown-ish
  return buf;
}
function whiteBuffer(ctx, seconds = 0.2) {
  const len = ctx.sampleRate * seconds, buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// ---------- voices ----------
function bell(ctx, out, t, note, vel = 0.2, decay = 2.6) {
  const g = ctx.createGain(); g.connect(out);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  [[1, 1], [2.0, 0.35], [3.01, 0.12], [4.2, 0.05]].forEach(([m, a]) => {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sine'; o.frequency.value = midi(note) * m; og.gain.value = a;
    o.connect(og).connect(g); o.start(t); o.stop(t + decay + 0.1);
  });
}
function pad(ctx, out, t, notes, dur, vel = 0.05) {
  const g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.3;
  g.connect(f).connect(out);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 1.2);
  g.gain.setValueAtTime(vel, t + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5);
  for (const n of notes) for (const det of [-6, 6]) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(n); o.detune.value = det;
    o.connect(g); o.start(t); o.stop(t + dur + 1.6);
  }
}
function piano(ctx, out, t, note, vel = 0.15, decay = 1.8) {
  const g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(900, t + decay);
  g.connect(f).connect(out);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  [['triangle', 1, 1], ['sine', 2, 0.3], ['sine', 3, 0.08]].forEach(([type, m, a]) => {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = type; o.frequency.value = midi(note) * m; og.gain.value = a;
    o.connect(og).connect(g); o.start(t); o.stop(t + decay + 0.1);
  });
}

// ---------- themes ----------
const THEMES = {
  winter: {
    bpm: 70, stepsPerBeat: 2,
    chords: [[50, 53, 57, 60, 64], [46, 50, 53, 57], [41, 57, 60, 64], [48, 52, 55, 62]],
    bass: [38, 34, 41, 36],
    melody: [69, 0, 74, 0, 76, 0, 77, 76, 74, 0, 0, 72, 74, 0, 0, 0, 72, 0, 69, 0, 72, 0, 74, 76, 77, 0, 76, 0, 72, 0, 0, 0],
    step(ctx, out, t, i, dur) {
      const bar = Math.floor(i / 8) % 4, s = i % 8, loop = Math.floor(i / 32);
      if (s === 0) {
        pad(ctx, out, t, this.chords[bar].map(n => n + 12), dur * 8, 0.035);
        bell(ctx, out, t, this.bass[bar], 0.12, 4);
      }
      const m = this.melody[i % 32];
      if (m && loop % 4 !== 3) bell(ctx, out, t, m + (loop % 2 ? 12 : 0), 0.13);
      if (Math.random() < 0.12 && s % 2 === 1) bell(ctx, out, t, [86, 88, 93, 91][Math.floor(Math.random() * 4)], 0.04, 1.5);
    },
  },
  cozy: {
    bpm: 84, stepsPerBeat: 2,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 64]],
    bass: [36, 33, 29, 31],
    arp: [0, 1, 2, 3, 2, 1, 2, 3],
    melody: [76, 0, 0, 74, 72, 0, 0, 0, 72, 0, 71, 0, 69, 0, 0, 0, 69, 0, 72, 0, 77, 0, 76, 0, 74, 0, 0, 0, 79, 0, 0, 0],
    step(ctx, out, t, i, dur) {
      const bar = Math.floor(i / 8) % 4, s = i % 8, loop = Math.floor(i / 32);
      const ch = this.chords[bar];
      if (s === 0) piano(ctx, out, t, this.bass[bar], 0.16, 3);
      if (s === 4) piano(ctx, out, t, this.bass[bar] + 7, 0.08, 2);
      piano(ctx, out, t + (s % 2 ? 0.02 : 0), ch[this.arp[s]], 0.06 + (s === 0 ? 0.03 : 0), 1.6);
      const m = this.melody[i % 32];
      if (m && loop % 2 === 1) piano(ctx, out, t, m + 12, 0.1, 2.2);
      // fireplace crackles
      const n = Math.random() < 0.6 ? 1 + Math.floor(Math.random() * 2) : 0;
      for (let k = 0; k < n; k++) this.crackle(ctx, out, t + Math.random() * dur);
    },
    crackle(ctx, out, t) {
      const src = ctx.createBufferSource(); src.buffer = this._white || (this._white = whiteBuffer(ctx));
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200 + Math.random() * 3500; f.Q.value = 1.5;
      const g = ctx.createGain(); const v = 0.03 + Math.random() * 0.1;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02 + Math.random() * 0.05);
      src.connect(f).connect(g).connect(this._dry || out); src.start(t, Math.random() * 0.1); src.stop(t + 0.1);
    },
    start(ctx, out, dry) { // continuous low fire rumble
      this._dry = dry;
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, 3); src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      const g = ctx.createGain(); g.gain.value = 0.05;
      src.connect(f).connect(g).connect(dry); src.start();
      return () => { try { src.stop(); } catch {} };
    },
  },
};
export const MUSIC_THEMES = [
  { id: 'winter', name: 'Winter Chimes' },
  { id: 'cozy', name: 'Cozy Cabin' },
  { id: 'none', name: 'No music' },
];

export class Music {
  constructor(settings = { musicVolume: 0.5, muted: false }, onSettings = () => {}) {
    this.volume = settings.musicVolume; this.muted = settings.muted; this.onSettings = onSettings;
    this.ctx = null; this.theme = 'none'; this.current = null;
  }
  get started() { return !!this.ctx && this.ctx.state === 'running'; }

  /** Call from a user gesture handler. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.reverb = this.ctx.createConvolver(); this.reverb.buffer = makeImpulse(this.ctx, 3.5, 2.5);
      const wet = this.ctx.createGain(); wet.gain.value = 0.5;
      this.reverb.connect(wet).connect(this.master);
      this._applyVolume();
      this._start(this.theme);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  play(theme) {
    if (theme === this.theme && this.current) return;
    this.theme = theme;
    if (this.ctx) this._start(theme);
  }
  _start(theme) {
    if (this.current) { // fade out old
      const c = this.current; clearInterval(c.timer); c.stopExtra?.();
      c.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
      setTimeout(() => c.bus.disconnect(), 3000);
      this.current = null;
    }
    const def = THEMES[theme]; if (!def) return;
    const ctx = this.ctx, bus = ctx.createGain();
    bus.gain.value = 0; bus.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
    const dry = ctx.createGain(); dry.gain.value = 0.8; bus.connect(dry).connect(this.master);
    const send = ctx.createGain(); send.gain.value = 0.6; bus.connect(send).connect(this.reverb);
    const stepDur = 60 / def.bpm / def.stepsPerBeat;
    const state = { bus, i: 0, next: ctx.currentTime + 0.1 };
    const dryOut = ctx.createGain(); dryOut.connect(this.master);
    state.stopExtra = def.start ? def.start(ctx, bus, dryOut) : null;
    state.timer = setInterval(() => {
      while (state.next < ctx.currentTime + 0.5) {
        def.step(ctx, bus, state.next, state.i++, stepDur);
        state.next += stepDur;
      }
    }, 60);
    // fade the dry fire bus too
    const origStop = state.stopExtra;
    state.stopExtra = () => { origStop?.(); dryOut.gain.setTargetAtTime(0, ctx.currentTime, 0.3); };
    this.current = state;
  }
  /** Ice Rocket thruster: filtered noise whoosh while flying (sound effect). */
  rocket(on) {
    if (!this.ctx) return;
    if (on && !this._rocket) {
      const src = this.ctx.createBufferSource(); src.buffer = whiteBuffer(this.ctx, 1); src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.7;
      const g = this.ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(this.muted ? 0 : 0.25, this.ctx.currentTime, 0.08);
      src.connect(f).connect(g).connect(this.ctx.destination); src.start();
      this._rocket = { src, g, f };
    } else if (!on && this._rocket) {
      const r = this._rocket; this._rocket = null;
      r.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); setTimeout(() => { try { r.src.stop(); } catch {} }, 500);
    }
    if (this._rocket) this._rocket.f.frequency.value = 600 + Math.random() * 300;
  }
  _applyVolume() { if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.8, this.ctx.currentTime, 0.05); }
  setVolume(v) { this.volume = v; if (v > 0) this.muted = false; this._applyVolume(); this._save(); }
  toggleMute() { this.muted = !this.muted; this._applyVolume(); this._save(); return this.muted; }
  _save() { this.onSettings({ musicVolume: this.volume, muted: this.muted }); }
}
