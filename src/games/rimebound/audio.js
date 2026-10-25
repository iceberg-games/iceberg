// Rimebound audio: Web Audio oneshots + looping beds from ./sfx/*.ogg
const SFX_URLS = (() => { try { return import.meta.glob('./sfx/*.ogg', { eager: true, query: '?url', import: 'default' }); } catch { return {}; } })();
const SFX = Object.fromEntries(Object.entries(SFX_URLS).map(([k, v]) => [k.replace(/^.*\/|\.ogg$/g, ''), v]));
const ALIAS = { sfx_emote_wave: 'emote_wave', sfx_emote_shiver: 'emote_freeze_pose', mus_emote_campfire_jig: 'emote_dance_loop', mus_emote_icebox: 'emote_dance_loop', mus_emote_concierge: 'emote_encore_bow' };
const resolve = (n) => (SFX[n] ? n : SFX[ALIAS[n]] ? ALIAS[n] : SFX['sfx_' + n] ? 'sfx_' + n : null);

export class RimeAudio {
  constructor(music) {
    this.music = music; this._last = ''; this.buf = {}; this.beds = {}; this.want = new Set(); this.dead = false;
    try { this.ctx = music?.ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
    if (this.ctx) { this.out = this.ctx.createGain(); this.out.connect(music?.master || this.ctx.destination); }
  }
  get muted() { return !!this.music?.muted; }
  async load(name) {
    if (this.buf[name] || !this.ctx) return this.buf[name];
    const url = SFX[name]; if (!url) return null;
    this.buf[name] = (async () => { const r = await fetch(url); return this.ctx.decodeAudioData(await r.arrayBuffer()); })().catch(() => null);
    return this.buf[name];
  }
  async play(cue, { vol = 0.8, loop = false, rate = 1 } = {}) {
    this._last = cue || ''; const n = resolve(cue); if (!n || !this.ctx || this.muted || this.dead) return null;
    if (this.ctx.state === 'suspended') this.ctx.resume?.().catch(() => {});
    const b = await this.load(n); if (!b || this.dead) return null;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = loop; s.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = vol; s.connect(g).connect(this.out); s.start();
    return { s, g };
  }
  setBed(name, vol = 0.5) { if (resolve(name)) this.want.add(resolve(name) + '|' + vol); this.update(); }
  clearBed(name) {
    for (const k of [...this.want]) if (!name || k.startsWith(resolve(name) + '|')) { this.want.delete(k); const n = k.split('|')[0]; try { this.beds[n]?.s.stop(); } catch {} delete this.beds[n]; }
  }
  setBeds(list) { // list of [name, vol]
    const keep = new Set(list.map(([n]) => resolve(n)).filter(Boolean));
    for (const k of [...this.want]) if (!keep.has(k.split('|')[0])) this.clearBed(k.split('|')[0]);
    for (const [n, v] of list) if (resolve(n) && ![...this.want].some(k => k.startsWith(resolve(n) + '|'))) this.want.add(resolve(n) + '|' + v);
    this.update();
  }
  update() {
    if (!this.ctx || this.dead) return;
    for (const k of this.want) {
      const [n, v] = k.split('|');
      if (this.muted) { if (this.beds[n]?.s) { try { this.beds[n].s.stop(); } catch {} delete this.beds[n]; } continue; }
      if (this.beds[n] || this.ctx.state !== 'running') continue;
      this.beds[n] = { pending: true };
      this.play(n, { vol: +v, loop: true }).then(h => { if (!h) { delete this.beds[n]; return; } if (!this.want.has(k)) { try { h.s.stop(); } catch {} delete this.beds[n]; } else this.beds[n] = h; });
    }
    if (this.ctx.state === 'suspended') this.ctx.resume?.().catch(() => {});
  }
  last() { return this._last; }
  dispose() { this.clearBed(); this.dead = true; try { this.out?.disconnect(); } catch {} if (!this.music?.ctx) this.ctx?.close?.().catch(() => {}); }
}
