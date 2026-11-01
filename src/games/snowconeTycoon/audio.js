// Snowcone Tycoon audio: the Iceberg Sound Designer pack (original, see
// /workspace/iceberg-audio/snowcone-tycoon/manifest.json) copied into ./sfx and
// played through the platform's shared AudioContext + master gain, so the HUD
// mute/volume apply. Both BGM loops (same key/length) run in sync on looping
// AudioBufferSourceNodes; "lobby" <-> "busy" is a ~1.5 s gain crossfade.
const URLS = (() => { try { return import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }); } catch { return {}; } })();
// suggested_gain from the manifest
export const GAIN = {
  bgm_snowcone_busy: 0.5, bgm_snowcone_lobby: 0.5, sfx_cash_register: 0.75, sfx_customer_happy: 0.6, sfx_ice_crunch: 0.6,
  sfx_level_up: 0.85, sfx_order_ding: 0.7, sfx_place_machine: 0.8, sfx_reject: 0.6, sfx_serve: 0.8, sfx_syrup_pour: 0.6, sfx_upgrade: 0.8,
};
const JITTER = new Set(['sfx_serve', 'sfx_ice_crunch', 'sfx_place_machine']);
const FADE = 1.5;

export class SnowconeAudio {
  constructor(music) { this.music = music; this.buffers = {}; this.loading = false; this.bgm = null; this.want = 'lobby'; this.cool = {}; }
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
  /** Safe to call every frame: loads, then starts the synced BGM pair once unlocked. */
  tick() {
    if (!this.ctx) return; this._load();
    if (this.bgm || this.stopped || !this.ready) return;
    const a = this.buffers.bgm_snowcone_lobby, b = this.buffers.bgm_snowcone_busy; if (!a || !b) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.05;
    this.bus = ctx.createGain(); this.bus.gain.value = 1; this.bus.connect(this.out);
    const mk = (buf, name, on) => {
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(on ? GAIN[name] : 0.0001, t + 1.2);
      s.connect(g).connect(this.bus); s.start(t); return { s, g, name };
    };
    this.bgm = { lobby: mk(a, 'bgm_snowcone_lobby', this.want === 'lobby'), busy: mk(b, 'bgm_snowcone_busy', this.want === 'busy') };
  }
  /** 'lobby' | 'busy' — crossfades, keeping the loops sample-synced. */
  setMusic(which) {
    if (which === this.want) return; this.want = which;
    if (!this.bgm) return;
    const t = this.ctx.currentTime;
    for (const k of ['lobby', 'busy']) {
      const { g, name } = this.bgm[k]; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
      g.gain.linearRampToValueAtTime(k === which ? GAIN[name] : 0.0001, t + FADE);
    }
  }
  /** Play a one-shot by manifest name. opts: { delay, rate, gain, minGap } */
  play(name, { delay = 0, rate = null, gain = 1, minGap = 0.05 } = {}) {
    if (!this.ready) return null; const buf = this.buffers[name]; if (!buf) return null;
    const ctx = this.ctx, now = ctx.currentTime;
    if (this.cool[name] && now - this.cool[name] < minGap) return null; this.cool[name] = now;
    const s = ctx.createBufferSource(); s.buffer = buf;
    s.playbackRate.value = rate ?? (JITTER.has(name) ? 0.95 + Math.random() * 0.1 : 1);
    const g = ctx.createGain(); g.gain.value = GAIN[name] * gain;
    s.connect(g).connect(this.out); s.start(now + delay); return s;
  }
  /** Sale: happy chirp, then register +0.1 s. */
  sale() { this.play('sfx_customer_happy'); this.play('sfx_cash_register', { delay: 0.1 }); }
  stop() {
    this.stopped = true; if (!this.bgm) return;
    const ctx = this.ctx, t = ctx.currentTime, bgm = this.bgm, bus = this.bus; this.bgm = null;
    bus.gain.setTargetAtTime(0, t, 0.25);
    setTimeout(() => { for (const k of ['lobby', 'busy']) { try { bgm[k].s.stop(); } catch { /* */ } } try { bus.disconnect(); } catch { /* */ } }, 1500);
  }
}
