// Lantern Hollow audio: Iceberg Sound Designer pack (canonical sfx_/bgm_/amb_ names, brief §12) copied from
// /workspace/iceberg-audio/lantern-hollow/ into ./sfx and played through the shared AudioContext + master gain
// (music.ctx / music.master), same pattern as Crystal Spire. Missing files are simply silent (the pack lands later).
const URLS = (() => { try { return import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }); } catch { return {}; } })();
export const AREA_BGM = { village: 'bgm_village', caves: 'bgm_caves', mine: 'bgm_mine', throne: 'bgm_throne' };
export const AREA_AMB = { village: 'amb_village_night', caves: 'amb_caves_drips', mine: 'amb_mine_water', throne: 'amb_throne_wind' };
export const GAIN = { bgm: 0.45, amb: 0.4, sfx: 0.7 };
const XF = 2.5;

export class HollowAudio {
  constructor(music) { this.music = music; this.buffers = {}; this.loading = false; this.stopped = false; this.want = { bgm: null, amb: null }; this.cur = { bgm: null, amb: null }; this.cool = {}; }
  get ctx() { return this.music?.ctx || null; }
  get out() { return this.music?.master || null; }
  get ready() { return !!(this.ctx && this.out && this.ctx.state === 'running'); }
  get loaded() { return Object.keys(this.buffers); }
  _load() {
    if (this.loading || !this.ctx) return; this.loading = true;
    for (const [path, url] of Object.entries(URLS)) {
      const name = path.split('/').pop().replace('.ogg', '');
      fetch(url).then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b)).then(buf => { this.buffers[name] = buf; }).catch(() => {});
    }
  }
  /** Call every frame: lazily loads, then (re)starts the wanted loops once buffers exist. */
  tick() {
    if (!this.ctx || this.stopped) return; this._load(); if (!this.ready) return;
    for (const ch of ['bgm', 'amb']) { const w = this.want[ch]; if (w && this.cur[ch]?.name !== w && this.buffers[w]) this._swap(ch, w); }
  }
  /** Crossfade to an area's music + ambience. */
  setArea(id) { this.want.bgm = AREA_BGM[id] || null; this.want.amb = AREA_AMB[id] || null; this.tick(); }
  setMusic(name) { this.want.bgm = name; this.tick(); }
  _swap(ch, name) {
    const ctx = this.ctx, t = ctx.currentTime, old = this.cur[ch];
    if (old) { old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t); old.g.gain.linearRampToValueAtTime(0.0001, t + XF); try { old.s.stop(t + XF + 0.1); } catch { /* */ } }
    const s = ctx.createBufferSource(); s.buffer = this.buffers[name]; s.loop = true;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(GAIN[ch], t + XF);
    s.connect(g).connect(this.out); s.start(t + 0.02); this.cur[ch] = { s, g, name };
  }
  play(name, { rate = 1, gain = 1, minGap = 0.05 } = {}) {
    if (!this.ready) return null; const buf = this.buffers[name]; if (!buf) return null;
    const ctx = this.ctx, now = ctx.currentTime; if (this.cool[name] && now - this.cool[name] < minGap) return null; this.cool[name] = now;
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = GAIN.sfx * gain; s.connect(g).connect(this.out); s.start(now); return { s, g };
  }
  /** Random variant: playVar('sfx_step_snow', 3) -> sfx_step_snow_1..3 */
  playVar(base, n, opts) { return this.play(`${base}_${1 + Math.floor(Math.random() * n)}`, { rate: 0.95 + Math.random() * 0.1, ...opts }); }
  stop() {
    this.stopped = true; const t = this.ctx?.currentTime || 0;
    for (const ch of ['bgm', 'amb']) { const c = this.cur[ch]; if (!c) continue; c.g.gain.setTargetAtTime(0, t, 0.25); setTimeout(() => { try { c.s.stop(); c.g.disconnect(); } catch { /* */ } }, 1200); }
    this.cur = { bgm: null, amb: null };
  }
}
