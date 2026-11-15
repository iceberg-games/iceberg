// Frostlings audio: loads ./sfx/<cue>.ogg when present (Sound Designer 2 pack, designs/frostlings-cues.md),
// else procedural synth. Gains/loops from ./sfx/cues.json. Routes through ctx.music.ctx/.master (platform mute).
import GAINS from './sfx/cues.json';
const URLS = (() => { try { return import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }); } catch { return {}; } })();
const urlFor = (n) => Object.entries(URLS).find(([k]) => k.startsWith(`./sfx/${n}.`))?.[1];
const siteMuted = () => window.icebergUi?.isMuted?.() ?? !!window.iceberg?.music?.muted;
export const CUES = ['bgm_village', 'bgm_battle_wild', 'bgm_battle_tamer', 'amb_meadow', 'amb_caverns', 'amb_coast', 'amb_peak',
  'sfx_move_snow', 'sfx_move_crystal', 'sfx_move_tide', 'sfx_move_ember', 'sfx_move_gale', 'sfx_move_aurora', 'sfx_move_plain',
  'sfx_hit', 'sfx_hit_super', 'sfx_faint', 'sfx_status_chill', 'sfx_status_sleep', 'sfx_status_burn', 'sfx_heal',
  'sfx_encounter', 'sfx_tamer_intro', 'sfx_victory', 'sfx_defeat', 'sfx_snare_throw', 'sfx_snare_shake', 'sfx_catch_success', 'sfx_catch_fail', 'sfx_care',
  'sfx_level_up', 'sfx_evolve', 'sfx_frostdex_new', 'sfx_quest_complete', 'ui_click'];
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const BGM = {
  bgm_village:      { bpm: 96,  bass: [48, 48, 53, 53, 55, 55, 52, 52], lead: [72, 76, 79, 76, 77, 74, 72, 0, 74, 77, 81, 79, 76, 72, 74, 0], vol: 0.04, lw: 'triangle' },
  bgm_battle_wild:  { bpm: 144, bass: [45, 45, 52, 45, 50, 50, 52, 52], lead: [69, 72, 76, 72, 74, 77, 76, 72, 69, 0, 72, 74, 76, 79, 76, 74], vol: 0.045, lw: 'square' },
  bgm_battle_tamer: { bpm: 152, bass: [40, 40, 43, 43, 45, 45, 47, 47], lead: [64, 67, 71, 74, 72, 71, 67, 0, 64, 67, 72, 76, 74, 72, 71, 67], vol: 0.05, lw: 'sawtooth' },
};
const AMB = {   // procedural ambience beds: noise filter + LFO + sprinkle tones
  amb_meadow:  { f: 700,  q: 0.6, vol: 0.05, lfo: 0.12, chirp: [84, 88, 91], every: 3.5 },
  amb_caverns: { f: 260,  q: 1.2, vol: 0.06, lfo: 0.05, chirp: [91, 95, 98, 103], every: 2.2, drip: true },
  amb_coast:   { f: 900,  q: 0.5, vol: 0.08, lfo: 0.16, chirp: [], every: 99, wave: true },
  amb_peak:    { f: 1400, q: 0.8, vol: 0.05, lfo: 0.08, chirp: [79, 83, 86, 91], every: 2.8, pad: true },
};
export class FrostAudio {
  constructor(music) { this.music = music; this.bufs = {}; this.loops = {}; this.bgm = null; this.ambName = null; this._noise = null; this._load(); }
  get ctx() { return this.music?.ctx; }
  get out() { return this.music?.master; }
  _load() {
    const c = this.ctx; if (!c) return;
    for (const n of CUES) { const u = urlFor(n); if (!u) continue;
      fetch(u).then(r => r.arrayBuffer()).then(a => c.decodeAudioData(a)).then(b => { this.bufs[n] = b; if (this.bgm === n) { const x = n; this.bgm = null; this._stop('bgm'); this.music_(x); } if (this.ambName === n) { const x = n; this.ambName = null; this._stop('amb'); this.amb(x); } }).catch(() => {}); }
  }
  play(n, vol = 1, rate = 1) {
    const c = this.ctx, b = this.bufs[n]; if (!c || !b || !this.out) return false;
    if (siteMuted()) return true;
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; const g = c.createGain(); g.gain.value = (GAINS[n]?.gain ?? 1) * vol;
    s.connect(g).connect(this.out); s.start(); return true;
  }
  noiseBuf() { if (this._noise) return this._noise; const c = this.ctx, b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (this._noise = b); }
  tone(f, t, dur, { type = 'sine', vol = 0.06, slideTo = null, dest = null, attack = 0.006 } = {}) {
    const c = this.ctx; if (!c || !this.out) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t, dur, { vol = 0.1, type = 'bandpass', f = 1200, fTo = null, q = 1, dest = null } = {}) {
    const c = this.ctx; if (!c || !this.out) return;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf(); s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(dest || this.out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  _bufLoop(slot, name, gain) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.bufs[name]; s.loop = true; const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(gain, c.currentTime, 0.6);
    s.connect(g).connect(this.out); s.start(); this.loops[slot] = { s, g };
  }
  _stop(slot) {
    const c = this.ctx, l = this.loops[slot]; if (!l || !c) return; delete this.loops[slot];
    if (l.g) l.g.gain.setTargetAtTime(0, c.currentTime, 0.35);
    if (l.id) clearInterval(l.id);
    setTimeout(() => { try { l.s?.stop(); } catch { /* */ } try { l.bus?.disconnect(); } catch { /* */ } (l.stops || []).forEach(x => { try { x.stop(); } catch { /* */ } }); }, 1500);
  }
  // ---- music ----
  music_(name) {
    if (this.bgm === name) return;
    this._stop('bgm'); this.bgm = name; const c = this.ctx; if (!c || !this.out || !name) return;
    if (this.bufs[name]) return this._bufLoop('bgm', name, GAINS[name]?.gain ?? 0.45);
    const P = BGM[name]; if (!P) return;
    const bus = c.createGain(); bus.gain.value = 0; bus.gain.setTargetAtTime(1, c.currentTime, 0.5); bus.connect(this.out);
    const step = 60 / P.bpm / 2; let i = 0, next = c.currentTime + 0.1;
    const id = setInterval(() => {
      if (siteMuted()) { next = c.currentTime + 0.1; return; }
      while (next < c.currentTime + 0.25) {
        if (i % 2 === 0) this.tone(NOTE(P.bass[(i / 2 | 0) % P.bass.length]), next, step * 1.8, { type: 'triangle', vol: P.vol * 1.3, dest: bus });
        const l = P.lead[i % P.lead.length]; if (l) this.tone(NOTE(l), next, step * 0.9, { type: P.lw, vol: P.vol * (P.lw === 'triangle' ? 0.9 : 0.4), dest: bus });
        if (name !== 'bgm_village' && i % 4 === 2) this.noise(next, 0.04, { vol: P.vol * 0.8, type: 'highpass', f: 7000, dest: bus });
        if (name !== 'bgm_village' && i % 8 === 0) this.tone(NOTE(36), next, 0.12, { type: 'sine', vol: P.vol * 2.2, slideTo: NOTE(28), dest: bus });
        if (name === 'bgm_village' && i % 16 === 0) this.tone(NOTE(84 + (i / 16 % 2) * 4), next, 1.2, { type: 'sine', vol: P.vol * 0.5, dest: bus });
        i++; next += step;
      }
    }, 60);
    this.loops.bgm = { g: bus, bus, id };
  }
  amb(name) {
    if (this.ambName === name) return;
    this._stop('amb'); this.ambName = name; const c = this.ctx; if (!c || !this.out || !name) return;
    if (this.bufs[name]) return this._bufLoop('amb', name, GAINS[name]?.gain ?? 0.4);
    const A = AMB[name]; if (!A) return;
    const bus = c.createGain(); bus.gain.value = 0; bus.gain.setTargetAtTime(1, c.currentTime, 1); bus.connect(this.out);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf(); s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = A.f; fl.Q.value = A.q;
    const g = c.createGain(); g.gain.value = A.vol;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = A.lfo; lg.gain.value = A.vol * 0.7; lfo.connect(lg).connect(g.gain);
    const lfo2 = c.createOscillator(), lg2 = c.createGain(); lfo2.frequency.value = A.lfo * 0.7; lg2.gain.value = A.f * 0.4; lfo2.connect(lg2).connect(fl.frequency);
    s.connect(fl).connect(g).connect(bus); s.start(); lfo.start(); lfo2.start();
    const stops = [s, lfo, lfo2];
    if (A.pad) { [57, 64, 69].forEach((n, k) => { const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = NOTE(n); o.detune.value = k * 4; og.gain.value = 0.012; o.connect(og).connect(bus); o.start(); stops.push(o); }); }
    let acc = 0;
    const id = setInterval(() => {
      if (siteMuted()) return; const t = c.currentTime; acc += 0.25;
      if (A.chirp.length && acc >= A.every * (0.6 + Math.random() * 0.8)) { acc = 0; const n = A.chirp[(Math.random() * A.chirp.length) | 0]; this.tone(NOTE(n), t, A.drip ? 0.35 : 0.5, { vol: 0.018, dest: bus, slideTo: A.drip ? NOTE(n - 7) : null }); if (!A.drip) this.tone(NOTE(n + 7), t + 0.09, 0.4, { vol: 0.012, dest: bus }); }
      if (A.wave && Math.random() < 0.06) this.noise(t, 3.2, { vol: 0.07, type: 'lowpass', f: 1600, fTo: 300, dest: bus });
    }, 250);
    this.loops.amb = { g: bus, bus, id, stops };
  }
  stop() { this._stop('bgm'); this._stop('amb'); this.bgm = null; this.ambName = null; }
  // ---- one-shots (procedural fallback for every cue) ----
  sfx(name, arg = 0) {
    const c = this.ctx; if (!c) return; const t = c.currentTime;
    const rate = name.startsWith('sfx_move') || name === 'sfx_hit' ? 0.94 + Math.random() * 0.12 : 1;
    if (this.play(name, 1, rate)) return;
    if (siteMuted()) return;
    const arp = (ns, gap, dur, o = {}) => ns.forEach((n, i) => this.tone(NOTE(n), t + i * gap, dur, { type: 'triangle', vol: 0.07, ...o }));
    switch (name) {
      case 'sfx_move_snow': this.noise(t, 0.5, { vol: 0.14, f: 2500, fTo: 6000, q: 0.8 }); arp([88, 91, 96], 0.06, 0.3, { type: 'sine', vol: 0.04 }); break;
      case 'sfx_move_crystal': arp([84, 91, 96, 103], 0.04, 0.45, { type: 'sine', vol: 0.05 }); this.tone(NOTE(76), t, 0.5, { type: 'square', vol: 0.02, slideTo: NOTE(100) }); break;
      case 'sfx_move_tide': for (let i = 0; i < 4; i++) this.tone(NOTE(62 + i * 5), t + i * 0.06, 0.12, { vol: 0.06, slideTo: NOTE(74 + i * 5) }); this.noise(t + 0.15, 0.5, { vol: 0.1, type: 'lowpass', f: 1400, fTo: 300 }); break;
      case 'sfx_move_ember': this.noise(t, 0.55, { vol: 0.18, type: 'lowpass', f: 900, fTo: 200 }); for (let i = 0; i < 6; i++) this.noise(t + Math.random() * 0.5, 0.03, { vol: 0.08, type: 'highpass', f: 4000 }); this.tone(NOTE(45), t, 0.3, { type: 'sawtooth', vol: 0.04, slideTo: NOTE(57) }); break;
      case 'sfx_move_gale': this.noise(t, 0.7, { vol: 0.16, f: 400, fTo: 2400, q: 3 }); break;
      case 'sfx_move_aurora': [72, 76, 79, 84].forEach(n => this.tone(NOTE(n), t, 0.9, { type: 'sine', vol: 0.03, attack: 0.15 })); arp([96, 100, 103, 108], 0.08, 0.3, { type: 'sine', vol: 0.025 }); break;
      case 'sfx_move_plain': this.tone(NOTE(60), t, 0.18, { type: 'square', vol: 0.05, slideTo: NOTE(72) }); this.noise(t, 0.08, { vol: 0.1, type: 'lowpass', f: 900 }); break;
      case 'sfx_hit': this.noise(t, 0.16, { vol: 0.2, type: 'lowpass', f: 1200 }); this.tone(NOTE(43), t, 0.18, { vol: 0.1, slideTo: NOTE(33) }); break;
      case 'sfx_hit_super': this.noise(t, 0.25, { vol: 0.26, type: 'lowpass', f: 1800 }); this.tone(NOTE(40), t, 0.25, { type: 'square', vol: 0.07, slideTo: NOTE(28) }); arp([84, 88, 91], 0.05, 0.25, { vol: 0.05 }); break;
      case 'sfx_faint': this.tone(NOTE(76), t, 0.8, { type: 'triangle', vol: 0.07, slideTo: NOTE(52) }); this.noise(t + 0.5, 0.4, { vol: 0.1, type: 'lowpass', f: 1500, fTo: 200 }); break;
      case 'sfx_status_chill': for (let i = 0; i < 5; i++) this.noise(t + i * 0.05, 0.05, { vol: 0.1, type: 'highpass', f: 5000 + i * 600 }); this.tone(NOTE(96), t, 0.4, { vol: 0.03 }); break;
      case 'sfx_status_sleep': arp([79, 76, 72, 67], 0.15, 0.3, { type: 'sine', vol: 0.05 }); break;
      case 'sfx_status_burn': this.noise(t, 0.5, { vol: 0.12, type: 'highpass', f: 3000, fTo: 1200 }); break;
      case 'sfx_heal': arp([72, 76, 79, 84, 88], 0.06, 0.4, { type: 'sine', vol: 0.05 }); break;
      case 'sfx_encounter': this.noise(t, 0.35, { vol: 0.12, f: 600, fTo: 4000, q: 1.5 }); arp([79, 86], 0.12, 0.25, { type: 'square', vol: 0.05 }); break;
      case 'sfx_tamer_intro': this.tone(NOTE(36), t, 0.6, { vol: 0.16, slideTo: NOTE(30) }); this.noise(t, 0.5, { vol: 0.14, type: 'lowpass', f: 600 }); arp([60, 64, 67, 72], 0.1, 0.5, { type: 'sawtooth', vol: 0.035 }); break;
      case 'sfx_victory': arp([72, 76, 79, 84, 79, 84, 88], 0.1, 0.5, { vol: 0.07 }); break;
      case 'sfx_defeat': arp([72, 69, 65, 60], 0.22, 0.6, { vol: 0.06 }); break;
      case 'sfx_snare_throw': this.noise(t, 0.4, { vol: 0.1, f: 800, fTo: 3000, q: 2 }); this.tone(NOTE(84), t, 0.4, { vol: 0.02, slideTo: NOTE(96) }); break;
      case 'sfx_snare_shake': this.tone(NOTE(55 + arg * 3), t, 0.08, { type: 'square', vol: 0.05 }); this.tone(NOTE(62 + arg * 3), t + 0.09, 0.08, { type: 'square', vol: 0.04 }); this.noise(t, 0.06, { vol: 0.06, type: 'lowpass', f: 1200 }); break;
      case 'sfx_catch_success': this.tone(NOTE(48), t, 0.1, { type: 'square', vol: 0.08 }); arp([79, 83, 86, 91, 95], 0.07, 0.6, { vol: 0.06 }); this.noise(t + 0.2, 0.8, { vol: 0.05, type: 'highpass', f: 6000 }); break;
      case 'sfx_catch_fail': this.noise(t, 0.3, { vol: 0.18, type: 'highpass', f: 2500, fTo: 800 }); this.tone(NOTE(70), t, 0.3, { type: 'triangle', vol: 0.05, slideTo: NOTE(58) }); break;
      case 'sfx_care': for (let i = 0; i < 3; i++) this.noise(t + i * 0.09, 0.05, { vol: 0.08, type: 'lowpass', f: 900 }); this.tone(NOTE(84), t + 0.3, 0.12, { vol: 0.05, slideTo: NOTE(91) }); this.tone(NOTE(88), t + 0.42, 0.15, { vol: 0.05, slideTo: NOTE(96) }); break;
      case 'sfx_level_up': arp([72, 76, 79, 84, 88, 91], 0.05, 0.35, { type: 'square', vol: 0.035 }); this.noise(t + 0.2, 0.6, { vol: 0.04, type: 'highpass', f: 7000 }); break;
      case 'sfx_evolve': { this.tone(NOTE(48), t, 3, { type: 'sawtooth', vol: 0.03, slideTo: NOTE(84), attack: 1.5 }); this.noise(t, 3, { vol: 0.07, f: 300, fTo: 8000, q: 2 }); const b = t + 3; [72, 76, 79, 84, 88].forEach(n => this.tone(NOTE(n), b, 1.4, { type: 'triangle', vol: 0.05 })); break; }
      case 'sfx_frostdex_new': this.noise(t, 0.15, { vol: 0.08, f: 3000, q: 0.7 }); arp([84, 88, 91, 96], 0.07, 0.4, { type: 'sine', vol: 0.05 }); break;
      case 'sfx_quest_complete': arp([67, 72, 76, 79, 84], 0.09, 0.7, { vol: 0.07 }); break;
      case 'ui_click': this.tone(NOTE(96), t, 0.07, { type: 'sine', vol: 0.03 }); break;
    }
  }
}
