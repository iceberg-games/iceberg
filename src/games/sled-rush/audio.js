// Sled Rush audio. Uses the Sound Designer pack (./sfx/*.ogg, original, see CREDITS) through the
// platform's shared AudioContext/master gain (ctx.music.ctx/.master), so HUD mute/volume apply.
// Any cue that fails to load falls back to a tiny procedural synth. Plus a live snow-hiss bed
// whose volume/brightness follow sled speed.
const URLS = (() => { try { return import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }); } catch { return {}; } })();
const GAIN = { sled_whoosh: 0.55, sled_turn: 0.6, jump_launch: 0.7, land_soft: 0.8, boost_pad: 0.7, gate_pass: 0.7, near_miss: 0.6, crash_soft: 0.8, finish_fanfare: 0.8, ui_start: 0.7, ui_click_soft_1: 0.6, ui_confirm: 0.7, menu_open: 0.6 };
const JITTER = new Set(['sled_whoosh', 'sled_turn', 'land_soft']);
const MUSIC_GAIN = 0.55;

export class SledAudio {
  constructor(music) { this.music = music; this.bufs = {}; this.loading = false; this.hiss = null; this.loop = null; }
  get ctx() { return this.music?.ctx || null; }
  get out() { return this.music?.master || null; }
  _load() {
    if (this.loading || !this.ctx) return; this.loading = true;
    for (const [path, url] of Object.entries(URLS)) {
      const name = path.split('/').pop().replace('.ogg', '');
      fetch(url).then(r => r.arrayBuffer()).then(d => new Promise((ok, bad) => { const p = this.ctx.decodeAudioData(d, ok, bad); p?.catch?.(bad); }))
        .then(b => { this.bufs[name] = b; if (name === 'sled_rush_loop' && this.wantMusic) this.startMusic(); }).catch(() => {});
    }
  }
  startMusic() {
    this.wantMusic = true; this._load(); const ctx = this.ctx, b = this.bufs.sled_rush_loop;
    if (!ctx || !this.out || !b || this.loop) return;
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; const g = ctx.createGain(); g.gain.value = MUSIC_GAIN;
    s.connect(g).connect(this.out); s.start(); this.loop = { s, g };
  }
  duck(amount = 0.5, secs = 2.5) {
    if (!this.loop) return; const g = this.loop.g.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setTargetAtTime(MUSIC_GAIN * amount, t, 0.08); g.setTargetAtTime(MUSIC_GAIN, t + secs, 0.4);
  }
  play(name, vol = 1) {
    const ctx = this.ctx; if (!ctx || !this.out || ctx.state !== 'running') return; this._load();
    const b = this.bufs[name];
    if (!b) return this._synth(name);
    const s = ctx.createBufferSource(); s.buffer = b; if (JITTER.has(name)) s.playbackRate.value = 0.95 + Math.random() * 0.1;
    const g = ctx.createGain(); g.gain.value = (GAIN[name] ?? 0.7) * vol; s.connect(g).connect(this.out); s.start();
    if (name === 'finish_fanfare') this.duck();
  }
  _synth(name) { // fallback blips so the game never goes silent
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    const f = { gate_pass: [880, 1320], boost_pad: [300, 900], jump_launch: [400, 700], land_soft: [200, 120], crash_soft: [160, 60], finish_fanfare: [523, 1046], ui_start: [660, 990], near_miss: [1200, 1600] }[name] || [500, 500];
    o.type = 'triangle'; o.frequency.setValueAtTime(f[0], t); o.frequency.exponentialRampToValueAtTime(f[1], t + 0.25);
    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.4);
  }
  setSpeed(k, airborne) { // k 0..1
    const ctx = this.ctx; if (!ctx || !this.out) return;
    if (!this.hiss) {
      const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); let last = 0;
      for (let i = 0; i < d.length; i++) { last = last * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = last; }
      const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(this.out); s.start(); this.hiss = { s, f, g };
    }
    const t = ctx.currentTime;
    this.hiss.g.gain.setTargetAtTime(airborne ? 0.01 : 0.03 + k * 0.16, t, 0.08);
    this.hiss.f.frequency.setTargetAtTime(500 + k * 2600, t, 0.1);
  }
  stop() {
    this.wantMusic = false;
    try { this.loop?.s.stop(); } catch {} this.loop = null;
    try { this.hiss?.s.stop(); } catch {} this.hiss = null;
  }
}
