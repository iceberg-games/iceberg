// Original procedural music + SFX for Natural Disaster Survival. Uses the platform's
// shared AudioContext/master gain (ctx.music.ctx / .master) so the HUD volume applies.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// calm lobby: Dm9 - Bbmaj7 - F - C (icy, hopeful); storm: D minor drone with pulsing toms
const CALM = [[62, 65, 69, 76], [58, 62, 65, 69], [53, 57, 60, 64], [60, 64, 67, 71]];
const STORM = [[50, 57, 62], [46, 53, 58], [48, 55, 60], [45, 52, 57]];

export class DisasterAudio {
  constructor(music, { dir = '', files = null } = {}) { this.music = music; this.timer = null; this.step = 0; this.mode = 'calm'; this.loops = {}; this.setAssets(dir, files); }
  get ctx() { return this.music?.ctx; }
  get out() { return this.music?.master; }
  // ---------------- external samples (lazy, Web Audio buffers) ----------------
  setAssets(dir, files) { this.dir = dir; this.files = files; this.bank = {}; this.sl = {}; this.track = files?.music ? { state: 'idle', src: null, gain: null } : null; }
  _bufState(name) { return this.bank[name]?.state || 'idle'; }
  _load(name) {
    const ent = this.files?.[name]; if (!ent || !this.ctx) return null;
    if (this.bank[name]) return this.bank[name].p;
    const rec = this.bank[name] = { state: 'loading', buffer: null, file: null, error: null };
    rec.p = (async () => {
      if (typeof location === 'undefined' || location.protocol === 'file:') throw new Error('file:// (no separate assets)');
      const canOgg = typeof Audio !== 'undefined' && new Audio().canPlayType('audio/ogg; codecs="vorbis"');
      const list = canOgg ? ent.files : [...ent.files].reverse();
      const bases = /\/play\//.test(location.pathname) ? ['../', './'] : ['./', '../'];
      let err = null;
      for (const f of list) for (const base of bases) {
        try {
          const res = await fetch(new URL(base + this.dir + f, location.href)); if (!res.ok) continue;
          const data = await res.arrayBuffer();
          const buf = await new Promise((ok, bad) => { const pr = this.ctx.decodeAudioData(data, ok, bad); pr?.catch?.(bad); });
          rec.buffer = buf; rec.file = f; rec.state = 'ready'; return buf;
        } catch (e) { err = e; }
      }
      throw err || new Error('not found');
    })().catch((e) => { rec.state = 'failed'; rec.error = String(e?.message || e); return null; });
    return rec.p;
  }
  _loopPoints(src, buf, loopSeconds) {
    const d = buf.getChannelData(0); let i0 = 0; const lim = Math.min(d.length, buf.sampleRate * 0.06);
    while (i0 < lim && Math.abs(d[i0]) < 1e-4) i0++; // skip decoder padding (MP3/AAC fallbacks)
    const ls = i0 / buf.sampleRate; src.loopStart = ls; src.loopEnd = loopSeconds ? Math.min(buf.duration, ls + loopSeconds) : buf.duration; return ls;
  }
  /** Disaster ambience loop by name ('tornado' | 'tsunami'); call every frame with the wanted level (0 = fade out).
   *  Falls back to the procedural noise bed while the file loads or if it can't be decoded. Returns true if the sample is used. */
  sampleLoop(name, level, fallback) {
    const ctx = this.ctx; if (!ctx) return false;
    let L = this.sl[name];
    const rec = this.bank[name];
    if (level > 0.001 && !rec) this._load(name);
    if (!L && level > 0.001 && rec?.state === 'ready') {
      const src = ctx.createBufferSource(); src.buffer = rec.buffer; src.loop = true;
      const ls = this._loopPoints(src, rec.buffer, this.files[name].loopSeconds);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(level, ctx.currentTime + 1.8);   // fade in ~1.8 s
      src.connect(g).connect(this.out); src.start(ctx.currentTime, ls);
      L = this.sl[name] = { src, g, born: ctx.currentTime, level };
      if (fallback) this.loop(fallback.name, 0);
    }
    if (L) {
      const t = ctx.currentTime;
      if (level <= 0.001) { // fade out ~2 s, then stop
        delete this.sl[name]; L.g.gain.cancelScheduledValues(t); L.g.gain.setValueAtTime(L.g.gain.value, t); L.g.gain.linearRampToValueAtTime(0.0001, t + 2);
        setTimeout(() => { try { L.src.stop(); } catch { /* */ } L.g.disconnect(); }, 2600);
      } else if (t - L.born > 1.8 && !this._ducking) L.g.gain.setTargetAtTime(level, t, 0.4);
      return true;
    }
    if (fallback) this.loop(fallback.name, level, fallback);
    return false;
  }
  stopSampleLoops() { for (const k of Object.keys(this.sl)) this.sampleLoop(k, 0); }
  /** One-shot stinger ('win' | 'lose'); ducks loops + music first. Procedural fallback if not loaded. */
  stinger(name, vol, fallbackSfx) {
    const ctx = this.ctx; if (!ctx) return false;
    const rec = this.bank[name];
    if (rec?.state !== 'ready') { this._load(name); if (fallbackSfx) this.sfx(fallbackSfx); return false; }
    const t = ctx.currentTime;
    this._ducking = true; setTimeout(() => { this._ducking = false; }, 1200);
    for (const L of Object.values(this.sl)) { L.g.gain.cancelScheduledValues(t); L.g.gain.setTargetAtTime(Math.min(0.2, L.level), t, 0.08); }
    if (this.track?.gain) { this.track.gain.gain.setTargetAtTime(0.25, t, 0.08); this.track.gain.gain.setTargetAtTime(0.85, t + 1.0, 0.4); }
    const src = ctx.createBufferSource(); src.buffer = rec.buffer; const g = ctx.createGain(); g.gain.value = vol;
    src.connect(g).connect(this.out); src.start(t + 0.12);
    return true;
  }
  /** Lazily load the disaster music track. */
  async _loadTrack() {
    const tr = this.track; if (!tr || tr.state !== 'idle' || !this.ctx) return;
    tr.state = 'loading';
    const buf = await this._load('music');
    if (!buf) { tr.state = 'failed'; tr.error = this.bank.music?.error; return; }
    tr.buffer = buf; tr.state = 'ready'; tr.file = this.bank.music.file;
    if (this.mode === 'storm') this._syncTrack();
  }
  preload() { if (!this.ctx || !this.files) return; this._loadTrack(); for (const k of Object.keys(this.files)) if (k !== 'music') this._load(k); }
  get usingTrack() { return !!(this.track?.src && this.mode === 'storm'); }
  _syncTrack() {
    const tr = this.track, ctx = this.ctx; if (!tr || !ctx) return;
    if (tr.state === 'idle') { this._loadTrack(); return; }
    const t = ctx.currentTime;
    if (this.mode === 'storm' && tr.state === 'ready' && !tr.src) {
      const src = ctx.createBufferSource(); src.buffer = tr.buffer; src.loop = true;
      const ls = this._loopPoints(src, tr.buffer, this.files.music.loopSeconds);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.85, t + 1.5);
      src.connect(g).connect(this.out); src.start(t, ls);
      tr.src = src; tr.gain = g;
      if (this.bus) this.bus.gain.setTargetAtTime(0, t, 0.5); // crossfade out the procedural music
    } else if (this.mode !== 'storm' && tr.src) {
      const { src, gain } = tr; tr.src = null; tr.gain = null;
      gain.gain.setTargetAtTime(0, t, 0.6); setTimeout(() => { try { src.stop(); } catch { /* */ } gain.disconnect(); }, 3000);
      if (this.bus) this.bus.gain.setTargetAtTime(0.8, t, 0.6);
    }
  }
  _tone(freq, t, dur, { type = 'sine', vol = 0.05, attack = 0.01, slideTo = null, dest = null } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  _buf() {
    if (!this._nb) { const ctx = this.ctx, b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = i % 2 ? w : last * 3.5 + w * 0.3; } this._nb = b; }
    return this._nb;
  }
  _noise(t, dur, vol, freq = 2000, type = 'lowpass', q = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = this._buf();
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  /** Continuous filtered-noise bed (wind, rumble, rain, water). level 0..1 */
  loop(name, level, { freq = 600, type = 'lowpass', q = 0.7, lfo = 0 } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    let L = this.loops[name];
    if (!L && level <= 0.001) return;
    if (!L) {
      const s = ctx.createBufferSource(); s.buffer = this._buf(); s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(f).connect(g).connect(this.out); s.start();
      L = this.loops[name] = { s, f, g, freq, lfo };
    }
    const t = ctx.currentTime;
    L.g.gain.setTargetAtTime(level * 0.5, t, 0.3);
    if (L.lfo) L.f.frequency.setTargetAtTime(L.freq * (1 + Math.sin(t * L.lfo) * 0.6 + Math.sin(t * L.lfo * 2.7) * 0.25), t, 0.2);
  }
  stopLoops() { for (const k in this.loops) this.loop(k, 0); }

  start() {
    if (this.timer || !this.ctx) return;
    this.bus = this.ctx.createGain(); this.bus.gain.value = 0; this.bus.gain.setTargetAtTime(0.8, this.ctx.currentTime, 0.8); this.bus.connect(this.out);
    this.next = this.ctx.currentTime + 0.1;
    this.preload(); // fetch the disaster music + SFX kit while the lobby plays
    this.timer = setInterval(() => {
      const ctx = this.ctx; if (!ctx) return;
      const sd = this.mode === 'storm' ? 60 / 120 / 4 : 60 / 84 / 4;
      while (this.next < ctx.currentTime + 0.3) { this._step(this.next, this.step++, sd); this.next += sd; }
    }, 50);
  }
  setMode(m) { if (m === this.mode) return; this.mode = m; this._syncTrack(); }
  _step(t, i, sd) {
    const b = this.bus, s = i % 16, bar = Math.floor(i / 16) % 4;
    if (this.mode === 'storm' && this.usingTrack) return; // external disaster track is playing
    if (this.mode === 'calm') {
      const ch = CALM[bar];
      if (s === 0) ch.forEach(n => this._tone(NOTE(n - 12), t, sd * 15, { type: 'triangle', vol: 0.03, attack: 0.4, dest: b }));
      if (s % 2 === 0) { const n = ch[(s / 2 + bar) % 4] + 12 + (s % 8 === 6 ? 12 : 0); this._tone(NOTE(n), t, sd * 3, { type: 'sine', vol: 0.045, dest: b }); }   // music-box arp
      if (s === 0 || s === 10) this._tone(NOTE(ch[0] - 24), t, sd * 6, { type: 'sine', vol: 0.12, dest: b });
      if (s % 4 === 2) this._noise(t, 0.04, 0.012, 9000, 'highpass');
    } else {
      const ch = STORM[bar];
      if (s === 0) { ch.forEach(n => this._tone(NOTE(n - 12), t, sd * 16, { type: 'sawtooth', vol: 0.018, attack: 0.3, dest: b })); }
      if (s % 4 === 0 || s === 14) this._tone(NOTE(ch[0] - 24), t, sd * 2.5, { type: 'sine', vol: 0.2, slideTo: NOTE(ch[0] - 26), dest: b });    // pulse bass
      if (s === 0 || s === 6 || s === 10) this._tone(120, t, 0.3, { type: 'sine', vol: 0.25, slideTo: 50, dest: b }); // toms
      if (s === 4 || s === 12) this._noise(t, 0.16, 0.08, 1500, 'bandpass', 0.8);
      if (s % 2 === 1) this._noise(t, 0.03, 0.02, 7000, 'highpass');
      if (bar % 2 === 1 && s % 4 === 0) this._tone(NOTE(ch[2] + 12 + (s === 8 ? 1 : 0)), t, sd * 3.5, { type: 'square', vol: 0.014, dest: b });
    }
  }
  stop() {
    for (const L of Object.values(this.sl || {})) { try { L.src.stop(); L.g.disconnect(); } catch { /* */ } } this.sl = {};
    if (this.track?.src) { try { this.track.src.stop(); this.track.gain.disconnect(); } catch { /* */ } this.track.src = null; }
    clearInterval(this.timer); this.timer = null;
    for (const k in this.loops) { const L = this.loops[k]; try { L.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); setTimeout(() => { try { L.s.stop(); } catch { /* */ } L.g.disconnect(); }, 600); } catch { /* */ } }
    this.loops = {};
    if (this.bus && this.ctx) { const bb = this.bus; bb.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); setTimeout(() => bb.disconnect(), 1500); }
    this.bus = null;
  }

  sfx(name, vol = 1) {
    const ctx = this.ctx; if (!ctx) return; const t = ctx.currentTime;
    switch (name) {
      case 'siren': for (let k = 0; k < 3; k++) { this._tone(500, t + k * 0.9, 0.45, { type: 'sawtooth', vol: 0.05, slideTo: 900 }); this._tone(900, t + k * 0.9 + 0.45, 0.45, { type: 'sawtooth', vol: 0.05, slideTo: 500 }); } break;
      case 'boom': this._tone(90, t, 0.9, { type: 'sine', vol: 0.5 * vol, slideTo: 30 }); this._noise(t, 1.2, 0.35 * vol, 500, 'lowpass'); break;
      case 'whoosh': this._noise(t, 1.0, 0.08 * vol, 1800, 'bandpass', 2); break;
      case 'thunder': this._noise(t, 0.12, 0.5 * vol, 4000, 'highpass'); this._noise(t + 0.05, 2.2, 0.35 * vol, 300, 'lowpass'); break;
      case 'crack': this._noise(t, 0.15, 0.12 * vol, 2500, 'bandpass', 1.5); this._tone(200, t, 0.12, { type: 'square', vol: 0.03 * vol, slideTo: 80 }); break;
      case 'splash': this._noise(t, 0.5, 0.12, 1200, 'bandpass', 0.7); break;
      case 'hurt': this._tone(330, t, 0.12, { type: 'square', vol: 0.05, slideTo: 200 }); break;
      case 'death': this._tone(440, t, 0.2, { type: 'square', vol: 0.08, slideTo: 260 }); this._tone(260, t + 0.18, 0.4, { type: 'square', vol: 0.08, slideTo: 90 }); break;
      case 'survive': [69, 74, 78, 81, 86].forEach((n, k) => this._tone(NOTE(n), t + k * 0.09, 0.5, { type: 'triangle', vol: 0.12 })); break;
      case 'coin': this._tone(NOTE(88), t, 0.08, { type: 'square', vol: 0.05 }); this._tone(NOTE(93), t + 0.08, 0.3, { type: 'square', vol: 0.05 }); break;
      case 'buy': [84, 88, 91, 96].forEach((n, k) => this._tone(NOTE(n), t + k * 0.05, 0.3, { type: 'sine', vol: 0.12 })); break;
      case 'deny': this._tone(180, t, 0.2, { type: 'square', vol: 0.06 }); break;
      case 'eat': for (let k = 0; k < 3; k++) this._noise(t + k * 0.13, 0.07, 0.15, 3000, 'bandpass', 3); this._tone(NOTE(79), t + 0.45, 0.25, { type: 'sine', vol: 0.08, slideTo: NOTE(86) }); break;
      case 'balloon': this._tone(500, t, 0.25, { type: 'sine', vol: 0.08, slideTo: 1100 }); break;
      case 'teleport': this._tone(300, t, 0.5, { type: 'sine', vol: 0.08, slideTo: 1500 }); this._noise(t, 0.5, 0.05, 3000, 'bandpass', 2); break;
      case 'tick': this._tone(1200, t, 0.05, { type: 'sine', vol: 0.05 }); break;
    }
  }
}
