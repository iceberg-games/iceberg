// Winterhaven audio: the Sound Designer's in-game loop (Web Audio, loop = true, sample-exact .ogg first)
// plus small procedural chimes, all through the platform's shared music output (ctx.music.master), so the
// site mute/volume applies. UI clicks use the shared Frost Glass set (src/audio/uiSounds.js playUi).
import { playUi as sharedPlayUi, isMuted as siteMuted } from '../../audio/uiSounds.js';
import { AUDIO_DIR, MUSIC, AMBIENCE, SFX_GAIN } from './config.js';
// Sound Designer 2's Winterhaven SFX (Ogg, original synthesis). One-shots are imported so Vite inlines them into the
// single-file build: they work on file:// too. The 20-24 s ambience loops are separate files (site/public/audio/winterhaven/).
const SFX_URLS = (() => { try { return import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }); } catch { return {}; } })();
const SFX = Object.fromEntries(Object.entries(SFX_URLS).map(([k, v]) => [k.replace(/^.*\/|\.ogg$/g, ''), v]));

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
export class WinterAudio {
  constructor(music) { this.music = music; this.track = { state: 'idle', src: null, gain: null, buffer: null, file: null, error: null }; this.stopped = false; this.played = 0; this.bank = {}; this.amb = {}; this.ambWant = null; this.lastTalk = -1; this.samples = 0; }
  /** Decode one SFX (lazy). Returns the AudioBuffer or null. */
  _sfx(name) {
    const ctx = this.ctx, url = SFX[name]; if (!ctx || !url) return null;
    const r = this.bank[name]; if (r) return r.buf;
    const rec = this.bank[name] = { buf: null };
    fetch(url).then(res => res.arrayBuffer()).then(d => new Promise((ok, bad) => { const p = ctx.decodeAudioData(d, ok, bad); p?.catch?.(bad); })).then(b => { rec.buf = b; }).catch(() => { rec.failed = true; });
    return null;
  }
  preloadSfx() { for (const k of Object.keys(SFX)) this._sfx(k); }
  /** Play a Winterhaven SFX by manifest name. Returns false (caller may fall back) if not loaded or muted. */
  play(name, { vol = 1, rate = 1, at = 0 } = {}) {
    const ctx = this.ctx; if (!ctx || this.muted || !this.out) return false;
    const buf = this._sfx(name); if (!buf) return false;
    const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = buf; src.playbackRate.value = rate;
    g.gain.value = vol * (SFX_GAIN[name] ?? 1); src.connect(g).connect(this.out); src.start(ctx.currentTime + at); this.samples++; return true;
  }
  /** NPC "voice": a few random npc_talk blips (never the same twice in a row) with ±5% pitch jitter. */
  chatter(n = 3, pitch = 1) {
    for (let i = 0; i < n; i++) { let k = Math.floor(Math.random() * 3); if (k >= this.lastTalk) k++; this.lastTalk = k; this.play(`npc_talk_${k + 1}`, { rate: pitch * (0.95 + Math.random() * 0.1), at: 0.12 + i * 0.16 }); }
  }
  /** Ambience bed for the current area ('village' | 'market' | 'hearth' | null), crossfaded. Call every frame. */
  ambience(want) {
    const ctx = this.ctx; if (!ctx || this.stopped || typeof location === 'undefined' || location.protocol === 'file:') return;
    for (const [key, cfg] of Object.entries(AMBIENCE)) {
      let a = this.amb[key]; const on = key === want && !this.muted;
      if (on && !a) {
        a = this.amb[key] = { state: 'loading' };
        const bases = /\/play\//.test(location.pathname) ? ['../', './'] : ['./', '../'];
        (async () => { for (const b of bases) { try { const r = await fetch(new URL(b + AUDIO_DIR + cfg.file, location.href)); if (!r.ok) continue; const d = await r.arrayBuffer(); a.buf = await new Promise((ok, bad) => { const p = ctx.decodeAudioData(d, ok, bad); p?.catch?.(bad); }); a.state = 'ready'; return; } catch { /* next */ } } a.state = 'failed'; })();
      }
      if (!a || a.state !== 'ready') continue;
      if (on && !a.src && !this.stopped) { const s = ctx.createBufferSource(); s.buffer = a.buf; s.loop = true; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.linearRampToValueAtTime(cfg.gain, ctx.currentTime + 2); s.connect(g).connect(this.out); s.start(); a.src = s; a.g = g; }
      else if (!on && a.src) { const { src, g } = a; a.src = null; g.gain.setTargetAtTime(0, ctx.currentTime, 0.6); setTimeout(() => { try { src.stop(); } catch { /* */ } g.disconnect(); }, 3500); }
    }
  }
  get ctx() { return this.music?.ctx || null; }
  get out() { return this.music?.master || null; }
  get muted() { const m = this.music?.muted; return m != null ? !!m : (typeof window !== 'undefined' && !!window.iceberg?.music?.muted) || siteMuted(); }
  async _load() {
    const tr = this.track; if (tr.state !== 'idle' || !this.ctx) return; tr.state = 'loading';
    try {
      if (typeof location === 'undefined' || location.protocol === 'file:') throw new Error('file:// (no separate assets)');
      const canOgg = typeof Audio !== 'undefined' && new Audio().canPlayType('audio/ogg; codecs="vorbis"');
      const list = canOgg ? MUSIC.files : [...MUSIC.files].reverse();
      const bases = /\/play\//.test(location.pathname) ? ['../', './'] : ['./', '../'];
      for (const f of list) for (const b of bases) {
        try {
          const res = await fetch(new URL(b + AUDIO_DIR + f, location.href)); if (!res.ok) continue;
          const data = await res.arrayBuffer();
          tr.buffer = await new Promise((ok, bad) => { const p = this.ctx.decodeAudioData(data, ok, bad); p?.catch?.(bad); });
          tr.file = f; tr.state = 'ready'; return;
        } catch (e) { tr.error = String(e?.message || e); }
      }
      throw new Error(tr.error || 'not found');
    } catch (e) { tr.state = 'failed'; tr.error = String(e?.message || e); }
  }
  /** Call every frame: lazily loads and (re)starts the loop once the shared AudioContext exists. */
  update() {
    const ctx = this.ctx, tr = this.track; if (!ctx || this.stopped) return;
    if (!this._pre) { this._pre = true; this.preloadSfx(); }
    if (tr.state === 'idle') { this._load(); return; }
    if (tr.state !== 'ready' || tr.src || this.muted || ctx.state !== 'running') return;
    const src = ctx.createBufferSource(); src.buffer = tr.buffer; src.loop = true;
    // skip MP3 decoder padding so the 40 s loop stays seamless on the fallback too
    const d = tr.buffer.getChannelData(0); let i0 = 0; const lim = Math.min(d.length, tr.buffer.sampleRate * 0.06); while (i0 < lim && Math.abs(d[i0]) < 1e-4) i0++;
    const ls = i0 / tr.buffer.sampleRate; src.loopStart = ls; src.loopEnd = Math.min(tr.buffer.duration, ls + MUSIC.loopSeconds);
    const g = ctx.createGain(); const t = ctx.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(MUSIC.gain, t + MUSIC.fadeIn);
    src.connect(g).connect(this.out); src.start(t, ls); tr.src = src; tr.gain = g;
  }
  get playing() { return !!this.track.src; }
  /** Music level (duck under the minigame countdown / win). */
  duck(level, sec = 1.2) { const g = this.track.gain, ctx = this.ctx; if (!g || !ctx) return; const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(level * MUSIC.gain, t, 0.08); g.gain.setTargetAtTime(MUSIC.gain, t + sec, 0.5); }
  ui(name) {
    if (this.muted) return;
    const map = { popup_open: 'plus_open', popup_close: 'plus_close', notification: 'quest_marker', click: `plus_click_${1 + Math.floor(Math.random() * 3)}`, error: 'plus_locked', play: 'plus_badge' };
    if (map[name] && this.play(map[name])) return;
    try { sharedPlayUi(name); } catch { /* not initialised (tests) */ }
  }
  _tone(freq, t, dur, { type = 'sine', vol = 0.06, slideTo = null } = {}) {
    const ctx = this.ctx; if (!ctx || this.muted || !this.out) return; this.played++;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  sfx(name) {
    const ctx = this.ctx; if (!ctx || this.muted) return; const t = ctx.currentTime;
    const SAMPLE = { collect: 'quest_objective', gate: 'quest_objective', count: 'quest_marker', go: 'quest_accept', win: 'quest_complete', fail: 'quest_fail', accept: 'quest_accept', greet: 'npc_greet', bye: 'npc_bye', think: 'npc_think', agree: 'npc_agree', disagree: 'npc_disagree' };
    if (SAMPLE[name] && this.play(SAMPLE[name], name === 'gate' ? { rate: 1.12 } : {})) { if (name === 'win') this.duck(0.3, 2); return; }
    switch (name) { // B minor / D major bells to sit with the Winterhaven motif
      case 'collect': [78, 81, 83, 86].forEach((n, i) => this._tone(NOTE(n), t + i * 0.08, 0.5, { type: 'triangle', vol: 0.07 })); break;
      case 'gate': this._tone(NOTE(86), t, 0.35, { vol: 0.08 }); this._tone(NOTE(90), t + 0.06, 0.4, { vol: 0.06 }); break;
      case 'count': this._tone(NOTE(81), t, 0.18, { type: 'triangle', vol: 0.08 }); break;
      case 'go': this._tone(NOTE(86), t, 0.5, { type: 'triangle', vol: 0.1 }); break;
      case 'win': [74, 78, 81, 86, 90].forEach((n, i) => this._tone(NOTE(n), t + i * 0.1, 0.8, { type: 'triangle', vol: 0.09 })); this.duck(0.3, 1.6); break;
      case 'fail': this._tone(NOTE(66), t, 0.5, { type: 'triangle', vol: 0.07, slideTo: NOTE(59) }); break;
    }
  }
  stop() {
    this.stopped = true; for (const a of Object.values(this.amb)) if (a.src) { try { a.src.stop(); } catch { /* */ } a.g.disconnect(); a.src = null; } const tr = this.track, ctx = this.ctx; if (!tr.src || !ctx) return;
    const { src, gain } = tr; tr.src = null; tr.gain = null; gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    setTimeout(() => { try { src.stop(); } catch { /* */ } gain.disconnect(); }, 1500);
  }
}
