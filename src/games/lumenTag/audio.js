// Lumen Tag audio. Sound Designer 2 pack loads from ./sfx/<cue>.ogg (+ optional ./sfx/cues.json gains/loops);
// every cue has a procedural Web Audio fallback below. Routes through ctx.music.ctx/.master so site mute works.
const URLS = (() => { try { return import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }); } catch { return {}; } })();
const CUEJ = (() => { try { return Object.values(import.meta.glob('./sfx/cues.json', { eager: true, import: 'default' }))[0] || {}; } catch { return {}; } })();
export const CUES = ['beam_fire', 'beam_fire_prism', 'beam_hit', 'beam_block', 'tag_out', 'respawn', 'power_spawn', 'power_prism', 'power_surge', 'power_shield',
  'shield_block', 'lead_take', 'combo_tag', 'countdown_tick', 'round_start', 'final_seconds', 'win_fanfare', 'defeat', 'ui_click', 'amb_crystal_cavern'];
const url = (n) => URLS[`./sfx/${n}.ogg`];
const siteMuted = () => window.icebergUi?.isMuted?.() ?? !!window.iceberg?.music?.muted;
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
export class LumenAudio {
  constructor(music) { this.music = music; this.amb = null; this.bufs = {}; this._noise = null; this._load(); }
  get ctx() { return this.music?.ctx; }
  get out() { return this.music?.master; }
  _load() { const c = this.ctx; if (!c) return;
    for (const n of CUES) { const u = url(n); if (u) fetch(u).then(r => r.arrayBuffer()).then(a => c.decodeAudioData(a)).then(b => { this.bufs[n] = b; }).catch(() => {}); } }
  play(n, vol = 1, rate = 1) {
    const c = this.ctx, b = this.bufs[n]; if (!c || !b || !this.out) return false; if (siteMuted()) return true;
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; const g = c.createGain(); g.gain.value = (CUEJ[n]?.gain ?? 1) * vol;
    s.connect(g).connect(this.out); s.start(); return true;
  }
  noiseBuf() { if (this._noise) return this._noise; const c = this.ctx, b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (this._noise = b); }
  tone(f, t, dur, { type = 'sine', vol = 0.06, slideTo = null } = {}) {
    const c = this.ctx; if (!c || !this.out) return; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t, dur, { vol = 0.1, type = 'bandpass', f = 1200, fTo = null, q = 1 } = {}) {
    const c = this.ctx; if (!c || !this.out) return; const s = c.createBufferSource(); s.buffer = this.noiseBuf(); s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  start() {
    const c = this.ctx; if (this.amb || !c || !this.out) return;
    const bus = c.createGain(); bus.gain.value = 0; bus.gain.setTargetAtTime(this.bufs.amb_crystal_cavern ? (CUEJ.amb_crystal_cavern?.gain ?? 0.6) : 0.03, c.currentTime, 1.5); bus.connect(this.out);
    if (this.bufs.amb_crystal_cavern) { const s = c.createBufferSource(); s.buffer = this.bufs.amb_crystal_cavern; s.loop = true; s.connect(bus); s.start(); this.amb = { nodes: [s], bus }; return; }
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(bus);
    const oscs = [38, 45, 50, 57, 64].map((n, i) => { const o = c.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'sine'; o.frequency.value = NOTE(n); o.detune.value = (i - 2) * 6; o.connect(lp); o.start(); return o; });
    this.amb = { nodes: oscs, bus };
    this._chime = setInterval(() => { if (siteMuted() || !this.amb) return; const t = c.currentTime; const n = [76, 79, 83, 86, 88, 91][(Math.random() * 6) | 0]; this.tone(NOTE(n), t, 1.6, { vol: 0.012 }); this.tone(NOTE(n + 12), t + 0.02, 1.2, { vol: 0.006 }); }, 1700);
  }
  stop() { clearInterval(this._chime); if (!this.amb) return; const a = this.amb; a.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); setTimeout(() => a.nodes.forEach(o => { try { o.stop(); } catch {} }), 800); this.amb = null; }
  // name = cue id; arg = intensity / variant (0..1)
  sfx(name, arg = 0) {
    const c = this.ctx; if (!c || siteMuted()) return; const t = c.currentTime;
    if (this.play(name, name === 'beam_fire' ? 0.5 + arg * 0.5 : 1, name === 'beam_fire' ? 0.94 + Math.random() * 0.12 : 1)) return;
    switch (name) {
      case 'beam_fire': this.tone(NOTE(96), t, 0.14, { type: 'sawtooth', vol: 0.02 + arg * 0.035, slideTo: NOTE(72) }); this.tone(NOTE(84), t, 0.1, { type: 'square', vol: 0.015 + arg * 0.02, slideTo: NOTE(60) }); break;
      case 'beam_fire_prism': [0, 4, 7].forEach((k, i) => this.tone(NOTE(91 + k), t + i * 0.012, 0.16, { type: 'sawtooth', vol: 0.03, slideTo: NOTE(70 + k) })); break;
      case 'beam_hit': [84, 88, 91, 96].forEach((n, i) => this.tone(NOTE(n), t + i * 0.035, 0.22, { type: 'triangle', vol: 0.06 })); this.noise(t, 0.1, { vol: 0.08, f: 5000, q: 2 }); break;
      case 'beam_block': this.tone(NOTE(100), t, 0.3, { vol: 0.02 }); this.tone(NOTE(95), t + 0.01, 0.4, { vol: 0.015 }); break;
      case 'tag_out': this.tone(NOTE(64), t, 0.5, { type: 'sawtooth', vol: 0.06, slideTo: NOTE(40) }); this.noise(t, 0.3, { vol: 0.12, type: 'lowpass', f: 2000, fTo: 200 }); break;
      case 'respawn': this.tone(NOTE(60), t, 0.5, { type: 'triangle', vol: 0.04, slideTo: NOTE(84) }); break;
      case 'power_spawn': [79, 86].forEach((n, i) => this.tone(NOTE(n), t + i * 0.1, 0.5, { vol: 0.025 })); break;
      case 'power_prism': case 'power_surge': case 'power_shield': { const b = { power_prism: 72, power_surge: 76, power_shield: 67 }[name]; [0, 4, 7, 12, 16].forEach((k, i) => this.tone(NOTE(b + k), t + i * 0.05, 0.35, { type: 'triangle', vol: 0.05 })); break; }
      case 'shield_block': this.tone(NOTE(72), t, 0.4, { type: 'square', vol: 0.04, slideTo: NOTE(96) }); this.noise(t, 0.2, { vol: 0.06, f: 3000, q: 3 }); break;
      case 'lead_take': [72, 79, 84].forEach((n, i) => this.tone(NOTE(n), t + i * 0.07, 0.3, { type: 'square', vol: 0.035 })); break;
      case 'combo_tag': [88, 91, 95, 100].forEach((n, i) => this.tone(NOTE(n), t + 0.12 + i * 0.04, 0.2, { vol: 0.04 })); break;
      case 'countdown_tick': this.tone(NOTE(69), t, 0.15, { type: 'square', vol: 0.04 }); break;
      case 'round_start': this.tone(NOTE(81), t, 0.4, { type: 'square', vol: 0.05 }); this.tone(NOTE(88), t, 0.4, { type: 'triangle', vol: 0.04 }); break;
      case 'final_seconds': this.tone(NOTE(76), t, 0.1, { type: 'square', vol: 0.03 }); break;
      case 'win_fanfare': [67, 71, 74, 79, 83, 86, 91].forEach((n, i) => this.tone(NOTE(n), t + i * 0.08, 0.9, { type: 'triangle', vol: 0.07 })); break;
      case 'defeat': [67, 63, 60, 55].forEach((n, i) => this.tone(NOTE(n), t + i * 0.14, 0.6, { type: 'triangle', vol: 0.06 })); break;
      case 'ui_click': this.tone(NOTE(84), t, 0.08, { vol: 0.04 }); break;
    }
  }
}
