// Crystal Spire audio: Iceberg Sound Designer pack (canonical sfx_/bgm_/amb_ names, see
// /workspace/iceberg-audio/crystal-spire/manifest.json) copied into ./sfx and played through the
// shared AudioContext + master gain. base/ascent BGM + wind bed are looping AudioBufferSourceNodes.
const URLS = (() => { try { return import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }); } catch { return {}; } })();
export const GAIN = {
  bgm_crystal_base: 0.5, bgm_crystal_ascent: 0.5, amb_wind_height: 0.45,
  sfx_crystal_step_1: 0.5, sfx_crystal_step_2: 0.5, sfx_crystal_step_3: 0.5,
  sfx_jump: 0.6, sfx_land: 0.65, sfx_ledge_grab: 0.7, sfx_checkpoint: 0.8, sfx_shard_collect: 0.7,
  sfx_slip: 0.6, sfx_fall: 0.7, sfx_summit: 0.9, sfx_death_shatter: 0.8, sfx_wind_gust: 0.65,
};
const XF = 3, SEMI = (n) => Math.pow(2, n / 12);

export class SpireAudio {
  constructor(music) { this.music = music; this.buffers = {}; this.loading = false; this.bgm = null; this.want = 'base'; this.cool = {}; this.lastStep = -1; this.ladder = { n: 0, t: -9 }; this.fall = null; this.windLevel = 0; }
  get ctx() { return this.music?.ctx || null; }
  get out() { return this.music?.master || null; }
  get ready() { return !!(this.ctx && this.out && this.ctx.state === 'running'); }
  get playing() { return !!this.bgm; }
  _load() {
    if (this.loading || !this.ctx) return; this.loading = true;
    for (const [path, url] of Object.entries(URLS)) {
      const name = path.split('/').pop().replace('.ogg', '');
      fetch(url).then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b)).then(buf => { this.buffers[name] = buf; }).catch(() => {});
    }
  }
  tick() {
    if (!this.ctx) return; this._load();
    if (this.bgm || this.stopped || !this.ready) return;
    const a = this.buffers.bgm_crystal_base, b = this.buffers.bgm_crystal_ascent, w = this.buffers.amb_wind_height; if (!a || !b || !w) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.05;
    this.bus = ctx.createGain(); this.bus.connect(this.out);          // music bus (ducked)
    this.duck = ctx.createGain(); this.duck.connect(this.bus);
    const mk = (buf, name, on, dest) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.linearRampToValueAtTime(on ? GAIN[name] : 0.0001, t + 1.5);
      s.connect(g).connect(dest); s.start(t); return { s, g, name }; };
    this.bgm = { base: mk(a, 'bgm_crystal_base', this.want === 'base', this.duck), ascent: mk(b, 'bgm_crystal_ascent', this.want === 'ascent', this.duck) };
    this.wind = mk(w, 'amb_wind_height', false, this.out); this.setWind(this.windLevel, true);
  }
  /** 'base' | 'ascent' — ~3 s equal-power crossfade. */
  setMusic(which) {
    if (which === this.want) return; this.want = which; if (!this.bgm) return;
    const t = this.ctx.currentTime, N = 16;
    for (const k of ['base', 'ascent']) { const { g, name } = this.bgm[k], v0 = Math.max(0.0001, g.gain.value), on = k === which;
      const curve = new Float32Array(N); for (let i = 0; i < N; i++) { const x = i / (N - 1); curve[i] = Math.max(0.0001, on ? Math.max(v0, GAIN[name] * Math.sin(x * Math.PI / 2)) : v0 * Math.cos(x * Math.PI / 2)); }
      g.gain.cancelScheduledValues(t); g.gain.setValueCurveAtTime(curve, t, XF); }
  }
  /** wind bed 0..1 (0 below mid-height). */
  setWind(level, force) {
    level = Math.max(0, Math.min(1, level)); if (!force && Math.abs(level - this.windLevel) < 0.02) return; this.windLevel = level;
    if (!this.wind) return; const t = this.ctx.currentTime; this.wind.g.gain.cancelScheduledValues(t); this.wind.g.gain.setTargetAtTime(Math.max(0.0001, GAIN.amb_wind_height * level), t, 0.6);
  }
  duckMusic(db, hold) {
    if (!this.duck) return; const t = this.ctx.currentTime, g = this.duck.gain, v = Math.pow(10, db / 20);
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + 0.12); g.setValueAtTime(v, t + hold); g.linearRampToValueAtTime(1, t + hold + 0.8);
  }
  play(name, { delay = 0, rate = 1, gain = 1, minGap = 0.05 } = {}) {
    if (!this.ready) return null; const buf = this.buffers[name]; if (!buf) return null;
    const ctx = this.ctx, now = ctx.currentTime;
    if (this.cool[name] && now - this.cool[name] < minGap) return null; this.cool[name] = now;
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = (GAIN[name] ?? 0.7) * gain;
    s.connect(g).connect(this.out); s.start(now + delay); return { s, g };
  }
  step() { let i; do i = Math.floor(Math.random() * 3); while (i === this.lastStep); this.lastStep = i; this.play(`sfx_crystal_step_${i + 1}`, { rate: 0.96 + Math.random() * 0.08, minGap: 0.12 }); }
  shard() { const now = this.ctx?.currentTime ?? 0; const L = [0, 2, 4, 7]; this.ladder.n = now - this.ladder.t < 1 ? Math.min(3, this.ladder.n + 1) : 0; this.ladder.t = now; this.play('sfx_shard_collect', { rate: SEMI(L[this.ladder.n]), minGap: 0.02 }); return this.ladder.n; }
  startFall() { if (this.fall) return; this.fall = this.play('sfx_fall'); }
  stopFall(fast) { const f = this.fall; this.fall = null; if (!f) return; const t = this.ctx.currentTime; f.g.gain.cancelScheduledValues(t); f.g.gain.setValueAtTime(f.g.gain.value, t); f.g.gain.linearRampToValueAtTime(0.0001, t + (fast ? 0.05 : 0.25)); try { f.s.stop(t + 0.3); } catch { /* */ } }
  checkpoint() { this.play('sfx_checkpoint'); this.duckMusic(-3, 1); }
  summit() { this.play('sfx_summit'); this.duckMusic(-6, 3); }
  death() { this.stopFall(true); this.play('sfx_death_shatter'); }
  stop() {
    this.stopped = true; this.stopFall(true); if (!this.bgm) return;
    const t = this.ctx.currentTime, bgm = this.bgm, bus = this.bus, wind = this.wind; this.bgm = null;
    bus.gain.setTargetAtTime(0, t, 0.25); wind.g.gain.setTargetAtTime(0, t, 0.25);
    setTimeout(() => { for (const n of [bgm.base, bgm.ascent, wind]) { try { n.s.stop(); } catch { /* */ } } try { bus.disconnect(); wind.g.disconnect(); } catch { /* */ } }, 1500);
  }
}
