// Knockout Floes procedural audio (fallback). Sound Designer 2 owns final cues
// (throw/hit/crack/sink/splash/ko/win/lose/ambience): replace sfx() bodies or load files here.
// Routes through ctx.music.ctx / .master so the platform mute works.
import CUES from './sfx/cues.json';
// Sound Designer 2 pack (./sfx/*.ogg, gains/loops from manifest -> cues.json). Procedural fallback below.
const URLS = (() => { try { return import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }); } catch { return {}; } })();
const url = (n) => URLS[`./sfx/${n}.ogg`];
const siteMuted = () => window.icebergUi?.isMuted?.() ?? !!window.iceberg?.music?.muted;
// game event -> pack cue
const MAP = { throw: 'throw_whoosh', hit: 'snowball_hit_player', splat: 'snowball_hit_ice', water: 'snowball_hit_water', crack: 'floe_crack', sink: 'floe_sink',
  splash: 'water_splash', ko: 'ko_banner', tick: null, go: 'round_start', jump: null, land: 'land_soft', emote: 'ui_click', win: 'last_standing', lose: 'defeat',
  combo: 'combo_knock', ooh: 'crowd_ooh', slide: 'slide_whoosh', warn: 'border_warn', rematch: 'rematch_click', step: null };
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
export class FloesAudio {
  constructor(music) { this.music = music; this.amb = null; this._noise = null; this.bufs = {}; this.loops = {}; this._load(); }
  _load() {
    const c = this.ctx; if (!c) return;
    for (const n of Object.keys(CUES)) { const u = url(n); if (!u) continue;
      fetch(u).then(r => r.arrayBuffer()).then(a => c.decodeAudioData(a)).then(b => { this.bufs[n] = b; if (this.amb && CUES[n].loop && n.startsWith('amb_')) this.loop(n, true); }).catch(() => {}); }
  }
  play(n, vol = 1, rate = 1) {
    const c = this.ctx, b = this.bufs[n]; if (!c || !b || !this.out) return false;
    if (siteMuted()) return true;
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; const g = c.createGain(); g.gain.value = (CUES[n]?.gain ?? 1) * vol;
    s.connect(g).connect(this.out); s.start(); return true;
  }
  loop(n, on) {
    const c = this.ctx; if (!c) return;
    if (!on) { const l = this.loops[n]; if (l) { l.g.gain.setTargetAtTime(0, c.currentTime, 0.3); setTimeout(() => { try { l.s.stop(); } catch {} }, 1200); delete this.loops[n]; } return; }
    if (this.loops[n] || !this.bufs[n] || !this.out) return;
    const s = c.createBufferSource(); s.buffer = this.bufs[n]; s.loop = true; const g = c.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(CUES[n]?.gain ?? 1, c.currentTime, 0.8); s.connect(g).connect(this.out); s.start(); this.loops[n] = { s, g };
  }
  get ctx() { return this.music?.ctx; }
  get out() { return this.music?.master; }
  noiseBuf() {
    if (this._noise) return this._noise;
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (this._noise = b);
  }
  tone(f, t, dur, { type = 'sine', vol = 0.06, slideTo = null } = {}) {
    const c = this.ctx; if (!c || !this.out) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t, dur, { vol = 0.1, type = 'bandpass', f = 1200, fTo = null, q = 1 } = {}) {
    const c = this.ctx; if (!c || !this.out) return;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf(); s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  start() {
    const c = this.ctx; if (this.amb || !c || !this.out) return;
    if (this.bufs.amb_arctic_night) { this.amb = { nodes: [], bus: c.createGain(), pack: true }; this.loop('amb_arctic_night', true); this.loop('amb_water_lapping', true); return; }
    const bus = c.createGain(); bus.gain.value = 0; bus.gain.setTargetAtTime(0.035, c.currentTime, 2); bus.connect(this.out);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.connect(bus);
    const oscs = [43, 50, 55, 62].map((n, i) => { const o = c.createOscillator(); o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = (i - 1.5) * 7; o.connect(lp); o.start(); return o; });
    const s = c.createBufferSource(); s.buffer = this.noiseBuf(); s.loop = true;   // wind/water wash
    const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380; const wg = c.createGain(); wg.gain.value = 0.5;
    s.connect(wf).connect(wg).connect(bus); s.start();
    this.amb = { nodes: [...oscs, s], bus };
  }
  stop() {
    Object.keys(this.loops).forEach(n => this.loop(n, false));
    if (!this.amb) return; const a = this.amb; a.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    setTimeout(() => a.nodes.forEach(o => { try { o.stop(); } catch {} }), 800); this.amb = null;
  }
  sfx(name, arg = 0) {
    const c = this.ctx; if (!c) return; const t = c.currentTime;
    if (MAP[name] && this.play(MAP[name], name === 'throw' ? 0.8 + arg * 0.4 : 1, name === 'hit' ? 1.05 - arg * 0.15 : 1)) return;
    if (name === 'tick' && arg && this.play('round_start')) return;
    if (name === 'tick' && !arg && this.play('countdown_tick')) return;
    if (name === 'step') { this.play(`foot_ice_${1 + ((Math.random() * 4) | 0)}`, 0.6); return; }
    switch (name) {
      case 'throw': this.noise(t, 0.16, { vol: 0.07 + arg * 0.06, f: 900, fTo: 2600, q: 2 }); break;
      case 'hit': // arg = charge 0..1
        this.tone(NOTE(50), t, 0.22, { type: 'square', vol: 0.09, slideTo: NOTE(38) });
        this.noise(t, 0.12, { vol: 0.2, type: 'lowpass', f: 1800 });
        this.tone(NOTE(76 + arg * 7), t + 0.01, 0.18, { type: 'triangle', vol: 0.07, slideTo: NOTE(88) }); break;
      case 'water': this.noise(t, 0.2, { vol: 0.08, type: 'lowpass', f: 900 }); break;
      case 'splat': this.noise(t, 0.1, { vol: 0.08, type: 'lowpass', f: 1400 }); break;
      case 'crack': for (let i = 0; i < 5; i++) this.noise(t + i * 0.05 + Math.random() * 0.03, 0.05, { vol: 0.16, f: 2500 + Math.random() * 2000, q: 4 }); break;
      case 'sink': this.tone(NOTE(40), t, 1.3, { type: 'sawtooth', vol: 0.05, slideTo: NOTE(28) }); this.noise(t, 1.2, { vol: 0.08, type: 'lowpass', f: 800, fTo: 150 }); break;
      case 'splash': this.noise(t, 0.6, { vol: 0.22, type: 'lowpass', f: 3000, fTo: 200 }); this.tone(NOTE(62), t, 0.3, { vol: 0.05, slideTo: NOTE(45) }); break;
      case 'ko': [72, 76, 79].forEach((n, i) => this.tone(NOTE(n), t + i * 0.06, 0.3, { type: 'square', vol: 0.05 })); break;
      case 'tick': this.tone(NOTE(arg ? 81 : 69), t, 0.18, { type: 'square', vol: 0.04 }); break;
      case 'jump': this.tone(NOTE(67), t, 0.12, { type: 'triangle', vol: 0.04, slideTo: NOTE(79) }); break;
      case 'emote': this.tone(NOTE(84), t, 0.1, { vol: 0.04 }); this.tone(NOTE(88), t + 0.07, 0.12, { vol: 0.04 }); break;
      case 'win': [67, 71, 74, 79, 83, 86].forEach((n, i) => this.tone(NOTE(n), t + i * 0.08, 0.8, { type: 'triangle', vol: 0.08 })); break;
      case 'lose': [67, 63, 60, 55].forEach((n, i) => this.tone(NOTE(n), t + i * 0.14, 0.6, { type: 'triangle', vol: 0.06 })); break;
    }
  }
}
// heartbeat for the final duel (pack loop)
FloesAudio.prototype.heartbeat = function (on) { this.loop('heartbeat_final2', on); };
