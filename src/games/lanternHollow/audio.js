// Lantern Hollow audio: Iceberg Sound Designer pack (canonical sfx_/bgm_/amb_ names, brief §12).
// Files are synced from /workspace/iceberg-audio/lantern-hollow/ into ./sfx by scripts/lantern-hollow-audio.mjs
// (per-file suggested gains -> ./gains.js) and bundled via import.meta.glob, like Crystal Spire.
// Tolerant of missing files: any cue without a buffer is silent, and BGM/ambience start as soon as their file exists.
// Buses: music, amb, ui, world, combat (+2 dB hit sub-bus per Sound Designer note: raise the bus, not the files).
import { SFX_GAINS, LOOPS } from './gains.js';
const URLS = (() => { try { return import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }); } catch { return {}; } })();
export const AREA_BGM = { village: 'bgm_village', caves: 'bgm_caves', mine: 'bgm_mine', throne: 'bgm_throne' };
export const AREA_AMB = { village: ['amb_village_night', 'amb_hearth_fire'], caves: ['amb_caves_drips'], mine: ['amb_mine_water'], throne: ['amb_throne_wind'] };
// bgm_boss_queen_intense is a sample-locked layer over bgm_boss_queen (gain 0 → 1 in later phases, setIntensity)
const LAYERS = { bgm_boss_queen: 'bgm_boss_queen_intense' };
export { LOOPS };
export const STINGERS = ['sfx_victory_fanfare', 'sfx_area_enter', 'sfx_guttered'];
const DUCK = 0.5;   // ~ -6 dB on the music bus while a stinger plays
const BUS_GAIN = { music: 0.5, amb: 0.45, ui: 0.85, world: 0.9, combat: 1.0, hits: 1.26 };
const XF = 2.0;   // manifest: crossfade 1.5-2 s between areas / boss
// Bass-heavy slams ride the combat bus (Sound Designer batch 3); everything else by prefix.
const busFor = (n) => /^sfx_(boss_slam|golem_slam)$/.test(n) ? 'combat' : /^sfx_ui_|^sfx_quest_|^sfx_purchase|^sfx_upgrade_|^sfx_npc_/.test(n) ? 'ui' : /^sfx_hit_/.test(n) ? 'hits'
  : /^sfx_(swing|dash|enemy|player|flare|revive|heal|lantern)/.test(n) ? 'combat' : 'world';
/** Enemy/boss cue map (caves wired in Phase 2; mine + throne mapped for Phase 3). lead = seconds the sound must start
 *  before its impact (boss_phase builds 1.7 s; golem_charge 1.3 s > its 0.9 s telegraph → sped up to fit). */
export const ENEMY_SFX = {
  slime: { attack: 'sfx_slime_hop', death: 'sfx_enemy_poof' }, slimeBig: { attack: 'sfx_slime_hop', death: 'sfx_slime_split', rate: 0.8 }, slimelet: { attack: 'sfx_slime_hop', rate: 1.3 },
  spore: { attack: 'sfx_spore_burst', atImpact: true }, creeper: { attack: 'sfx_root_erupt', atImpact: true, emerge: 'sfx_root_erupt' }, moth: { attack: 'sfx_moth_flutter' },
  // Phase 3
  golem: { attack: 'sfx_golem_charge', fit: 0.9, slam: 'sfx_golem_slam' }, bat: { attack: 'sfx_bat_screech' }, kobold: { attack: 'sfx_pickaxe_throw' }, wraith: { attack: 'sfx_wraith_wail', voices: 2 },
  sentinel: { attack: 'sfx_spear_lunge' }, wisp: { attack: 'sfx_shard_bolt' }, knight: { block: 'sfx_shield_block', break: 'sfx_shield_break' }, shade: { attack: 'sfx_shade_teleport' },
  foreman: { drill: 'sfx_drill', flood: 'sfx_flood_wave', horn: 'sfx_minecart_horn' }, queen: { icicle: 'sfx_icicle_fall', brazier: 'sfx_brazier_light' },
  boss: { roar: 'sfx_boss_roar', slam: 'sfx_boss_slam', phase: 'sfx_boss_phase', phaseLead: 1.7, defeat: 'sfx_boss_defeat' },
};
export const LADDER = [0, 2, 4, 5, 7, 9, 11, 12];   // D-major ladder for sfx_ember_pickup (root A5)

export class HollowAudio {
  constructor(music) { this.music = music; this.buffers = {}; this.loading = false; this.stopped = false; this.want = { bgm: null, amb: [] }; this.cur = { bgm: null, amb: {} }; this.intensity = 0; this.duckN = 0; this.cool = {}; this.bus = null; this.ladder = { n: -1, t: -9 }; this.loops = {}; }
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
  _buses() {
    if (this.bus || !this.ctx || !this.out) return this.bus;
    this.bus = {}; for (const [k, v] of Object.entries(BUS_GAIN)) { const g = this.ctx.createGain(); g.gain.value = v; g.connect(this.out); this.bus[k] = g; }
    return this.bus;
  }
  tick() {
    if (!this.ctx || this.stopped) return; this._load(); if (!this.ready) return; this._buses();
    const w = this.want.bgm; if (w && this.cur.bgm?.name !== w && this.buffers[w] && (!LAYERS[w] || this.buffers[LAYERS[w]])) this._swapBgm(w);
    else if (!w && this.cur.bgm) this._swapBgm(null);
    for (const n of this.want.amb) if (!this.cur.amb[n] && this.buffers[n]) this.cur.amb[n] = this._loop(n, this.bus.amb, SFX_GAINS[n] ?? 1, XF);
    for (const n of Object.keys(this.cur.amb)) if (!this.want.amb.includes(n)) { this._fadeOut(this.cur.amb[n], XF); delete this.cur.amb[n]; }
  }
  setArea(id) { this.want.bgm = AREA_BGM[id] || null; this.want.amb = AREA_AMB[id] || []; this.tick(); }
  setMusic(name) { if (this.want.bgm === name) return; this.want.bgm = name; this.tick(); }
  /** 0..1: fades the Queen's intense layer (no-op for other themes). */
  setIntensity(k) { this.intensity = Math.max(0, Math.min(1, k)); const L = this.cur.bgm?.layer; if (L) { const t = this.ctx.currentTime; L.g.gain.cancelScheduledValues(t); L.g.gain.setTargetAtTime(this.intensity * (SFX_GAINS[L.name] ?? 1), t, 0.6); } }
  _loop(name, dest, gain, fade, when) {
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = this.buffers[name]; s.loop = true;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(Math.max(0.0001, gain), t + fade);
    s.connect(g).connect(dest); s.start(when ?? t + 0.02); return { s, g, name };
  }
  _fadeOut(v, fade) { if (!v) return; const t = this.ctx.currentTime; v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0.0001, t + fade); try { v.s.stop(t + fade + 0.1); } catch { /* */ } }
  _swapBgm(name) {   // crossfade on area + boss transitions
    const old = this.cur.bgm; if (old) { this._fadeOut(old, XF); this._fadeOut(old.layer, XF); }
    if (!name) { this.cur.bgm = null; return; }
    const when = this.ctx.currentTime + 0.05, v = this._loop(name, this.bus.music, SFX_GAINS[name] ?? 1, XF, when);
    const ln = LAYERS[name]; if (ln) v.layer = this._loop(ln, this.bus.music, this.intensity * (SFX_GAINS[ln] ?? 1), XF, when);   // same start time = sample-locked
    this.cur.bgm = v;
  }
  /** Stinger: plays at its manifest gain and ducks the music bus ~6 dB for its length. */
  stinger(name) {
    const h = this.play(name, { minGap: 0.5 }); if (!h) return null;
    const m = this.bus.music.gain, t = this.ctx.currentTime, d = h.s.buffer.duration; this.duckN++;
    m.cancelScheduledValues(t); m.setValueAtTime(m.value, t); m.linearRampToValueAtTime(BUS_GAIN.music * DUCK, t + 0.15);
    h.s.onended = () => { if (--this.duckN > 0 || this.stopped) return; const t2 = this.ctx.currentTime; m.cancelScheduledValues(t2); m.setValueAtTime(m.value, t2); m.linearRampToValueAtTime(BUS_GAIN.music, t2 + 0.8); };
    void d; return h;
  }
  /** One-shot. offset = start into the file (s), for late-started telegraphs. */
  play(name, { rate = 1, gain = 1, minGap = 0.04, offset = 0, loop = false } = {}) {
    if (!this.ready || !this._buses()) return null; const buf = this.buffers[name]; if (!buf) return null;
    const ctx = this.ctx, now = ctx.currentTime; if (!loop && this.cool[name] && now - this.cool[name] < minGap) return null; this.cool[name] = now;
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate; s.loop = loop;
    const g = ctx.createGain(); g.gain.value = (SFX_GAINS[name] ?? 0.8) * gain; s.connect(g).connect(this.bus[busFor(name)]); s.start(now, Math.min(offset, buf.duration - 0.05)); return { s, g };
  }
  /** Voice-capped play (e.g. wraith_wail 3.4 s): at most `max` overlapping instances of a cue. */
  playCapped(name, max, opts) { const v = (this.voices ||= {}); v[name] = (v[name] || []).filter(x => x.end > (this.ctx?.currentTime ?? 0)); if (v[name].length >= max) return null;
    const h = this.play(name, opts); if (h) v[name].push({ end: this.ctx.currentTime + h.s.buffer.duration / (opts?.rate || 1) }); return h; }
  /** Fit a long cue into a shorter window by speeding it up (max 1.5x), e.g. golem_charge 1.3 s into a 0.9 s telegraph. */
  playFit(name, windowS, opts = {}) { const d = this.buffers[name]?.duration || windowS; return this.play(name, { ...opts, rate: Math.min(1.5, Math.max(1, d / windowS)) }); }
  playVar(base, n, opts) { return this.play(`${base}_${1 + Math.floor(Math.random() * n)}`, { rate: 0.95 + Math.random() * 0.1, ...opts }); }
  /** Telegraph cue fitted to the wind-up window (file is 0.78 s): speed up to 1.6x, then start late. */
  telegraph(windowS, gain = 1) {
    const dur = this.buffers.sfx_enemy_telegraph?.duration || 0.78; let rate = Math.min(1.6, Math.max(1, dur / Math.max(0.2, windowS)));
    const offset = Math.max(0, dur - windowS * rate);
    return this.play('sfx_enemy_telegraph', { rate, offset, gain, minGap: 0.08 });
  }
  /** Ember pickup ladder: consecutive pickups climb 0,2,4,5,7,9,11,12 semitones. */
  ember() { const now = this.ctx?.currentTime ?? 0; this.ladder.n = now - this.ladder.t < 0.6 ? Math.min(LADDER.length - 1, this.ladder.n + 1) : 0; this.ladder.t = now;
    return this.play('sfx_ember_pickup', { rate: Math.pow(2, LADDER[this.ladder.n] / 12), minGap: 0.03 }); }
  step(surface) { if (surface === 'snow') { const i = 1 + Math.floor(Math.random() * 3); this.play(`sfx_step_snow_${i}`, { rate: 0.95 + Math.random() * 0.1, minGap: 0.12 }); } else this.playVar('sfx_step_stone', 3, { minGap: 0.12 }); }
  /** Named loop (e.g. flare) — degrades to the one-shot start cue until a loop file exists. */
  loopOn(key, name, gain = 1) { if (this.loops[key]) return; this.loops[key] = this.play(name, { loop: true, gain }) || 'none'; }
  loopOff(key) { const l = this.loops[key]; delete this.loops[key]; if (l && l !== 'none') { const t = this.ctx.currentTime; l.g.gain.setTargetAtTime(0, t, 0.04); try { l.s.stop(t + 0.2); } catch { /* */ } } }
  stop() {
    this.stopped = true; const t = this.ctx?.currentTime || 0;
    for (const k of Object.keys(this.loops)) this.loopOff(k);
    const all = [this.cur.bgm, this.cur.bgm?.layer, ...Object.values(this.cur.amb)].filter(Boolean);
    for (const c of all) { c.g.gain.setTargetAtTime(0, t, 0.25); setTimeout(() => { try { c.s.stop(); c.g.disconnect(); } catch { /* */ } }, 1200); }
    this.cur = { bgm: null, amb: {} };
    setTimeout(() => { if (this.bus) for (const g of Object.values(this.bus)) { try { g.disconnect(); } catch { /* */ } } }, 1500);
  }
}
