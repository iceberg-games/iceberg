// Original procedural music + sound effects for the Giant Rainbow Obby.
// Plays through the platform's shared AudioContext and master gain
// (ctx.music.ctx / ctx.music.master), so the HUD mute/volume controls apply.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// I - V - vi - IV in C major, bouncy 2016-obby energy.
const CHORDS = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
const LEAD = [72, 76, 79, 76, 74, 79, 83, 79, 76, 72, 76, 81, 77, 81, 84, 81];

export class ObbyAudio {
  constructor(music) { this.music = music; this.timer = null; this.step = 0; this.next = 0; }
  get ctx() { return this.music.ctx; }
  get out() { return this.music.master; }

  _tone(freq, t, dur, { type = 'square', vol = 0.05, attack = 0.005, slideTo = null, dest = null } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  _noise(t, dur, vol, freq = 6000, type = 'highpass') {
    const ctx = this.ctx; if (!ctx) return;
    if (!this._nb) { const b = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this._nb = b; }
    const s = ctx.createBufferSource(); s.buffer = this._nb;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out); s.start(t); s.stop(t + dur + 0.02);
  }

  /** Start the music loop (safe to call repeatedly; waits until audio is unlocked). */
  start() {
    if (this.timer || !this.ctx) return;
    this.bus = this.ctx.createGain(); this.bus.gain.value = 0; this.bus.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.6); this.bus.connect(this.out);
    const bpm = 132, stepDur = 60 / bpm / 4;
    this.next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => {
      const ctx = this.ctx; if (!ctx) return;
      while (this.next < ctx.currentTime + 0.3) { this._step(this.next, this.step++, stepDur); this.next += stepDur; }
    }, 50);
  }
  _step(t, i, sd) {
    const bar = Math.floor(i / 16) % 4, s = i % 16, chord = CHORDS[bar], b = this.bus;
    if (s % 4 === 0) this._tone(NOTE(chord[0] - 24), t, sd * 3, { type: 'triangle', vol: 0.16, dest: b });   // bass
    if (s % 4 === 2) this._tone(NOTE(chord[0] - 12), t, sd * 1.5, { type: 'triangle', vol: 0.09, dest: b });
    if (s % 2 === 0) this._tone(NOTE(chord[(s / 2) % 3] + 12), t, sd * 1.2, { type: 'square', vol: 0.018, dest: b }); // arp
    const section = Math.floor(i / 64) % 2;
    if (section === 1 && s % 2 === 0) { const n = LEAD[(s / 2 + bar * 2) % LEAD.length]; this._tone(NOTE(n), t, sd * 1.8, { type: 'sawtooth', vol: 0.022, attack: 0.02, dest: b }); }
    // drums
    if (s % 8 === 0) this._tone(150, t, 0.18, { type: 'sine', vol: 0.35, slideTo: 40, dest: b });
    if (s % 8 === 4) this._noiseTo(t, 0.12, 0.12, 1800);
    if (s % 2 === 1) this._noiseTo(t, 0.03, 0.03, 8000);
  }
  _noiseTo(t, dur, vol, freq) { this._noise(t, dur, vol, freq); }
  stop() {
    clearInterval(this.timer); this.timer = null;
    if (this.bus && this.ctx) { const b = this.bus; b.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); setTimeout(() => b.disconnect(), 1500); }
    this.bus = null;
  }

  // ---------- SFX ----------
  sfx(name) {
    const ctx = this.ctx; if (!ctx) return; const t = ctx.currentTime;
    switch (name) {
      case 'jump': this._tone(330, t, 0.12, { type: 'square', vol: 0.03, slideTo: 660 }); break;
      case 'checkpoint': [72, 76, 79, 84].forEach((n, k) => this._tone(NOTE(n), t + k * 0.06, 0.25, { type: 'triangle', vol: 0.12 })); break;
      case 'death': // a short descending "uh-oh" (original synth, not a sample)
        this._tone(520, t, 0.16, { type: 'square', vol: 0.09, slideTo: 300 });
        this._tone(300, t + 0.14, 0.28, { type: 'square', vol: 0.09, slideTo: 120 });
        this._noise(t, 0.25, 0.08, 900, 'lowpass'); break;
      case 'buy': [84, 88, 91, 96].forEach((n, k) => this._tone(NOTE(n), t + k * 0.05, 0.3, { type: 'sine', vol: 0.12 })); break;
      case 'skip': this._noise(t, 0.35, 0.12, 1200, 'bandpass'); this._tone(400, t, 0.3, { type: 'sine', vol: 0.06, slideTo: 1200 }); break;
      case 'milestone': [60, 64, 67, 72, 76, 79, 84].forEach((n, k) => this._tone(NOTE(n), t + k * 0.08, 0.5, { type: 'square', vol: 0.06 })); break;
      case 'deny': this._tone(180, t, 0.2, { type: 'square', vol: 0.06 }); break;
      case 'equip': this._tone(660, t, 0.1, { type: 'triangle', vol: 0.1, slideTo: 990 }); break;
    }
  }
}
