// Sandboxed interpreter for plain-words script programs (see nlscript.js).
// Only whitelisted actions run; user text never becomes executable code.
//
//   Motion: per-part movement state shared by every script on that part
//           (continuous spin / bob / path + one-off tweens like elevators).
//   ScriptRunner: one per script; fires rules on events and steps through
//           action lists (waits, countdowns, loops, random choices).
import * as THREE from 'three';

const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

export class Motion {
  /** resolvePoint(p) → THREE.Vector3 world position for 'self' | [x,y,z] | part name */
  constructor(entry, resolvePoint) {
    this.entry = entry; this.resolve = resolvePoint;
    this.origin = entry.root.position.clone();
    this.baseRot = entry.root.rotation.clone();
    this.conts = []; this.spins = []; this.offset = new THREE.Vector3(); this.tween = null;
    this.time = 0; this.paused = false; this.active = false;
  }
  addContinuous(c) { this.conts.push(c); this.active = true; }
  spin(axis, speed, seconds) { this.spins.push({ axis, speed, left: seconds || Infinity }); this.active = true; this.paused = false; }
  stop() { this.paused = true; this.tween = null; this.spins = []; }
  resume() { this.paused = false; this.active = true; }
  /** tween the offset from the origin to `to` (Vector3) over `seconds` */
  tweenTo(to, seconds) { this.tween = { from: this.offset.clone(), to: to.clone(), t: 0, dur: Math.max(0.05, seconds || 1) }; this.active = true; this.paused = false; }
  moveBy(off, seconds) { const base = this.tween ? this.tween.to : this.offset; this.tweenTo(base.clone().add(new THREE.Vector3(...off)), seconds); }
  moveTo(worldPos, seconds) { this.tweenTo(worldPos.clone().sub(this.origin), seconds); }
  goBack(seconds) { this.tweenTo(new THREE.Vector3(), seconds); }
  get busy() { return !!this.tween; }

  /** advance; returns true if the part moved or turned this frame */
  update(dt) {
    if (!this.active || this.paused) return false;
    this.time += dt;
    const root = this.entry.root; let moved = false;
    const pos = this.origin.clone();
    for (const c of this.conts) {
      if (c.type === 'spin') { root.rotation[c.axis] += THREE.MathUtils.degToRad(c.speed) * dt; moved = true; }
      else if (c.type === 'move') { const f = (1 - Math.cos((this.time / c.period) * Math.PI)) / 2; pos.setComponent('xyz'.indexOf(c.axis), pos.getComponent('xyz'.indexOf(c.axis)) + c.distance * f); moved = true; }
      else if (c.type === 'path') {
        const pts = c.points.map(p => this.resolve(p)).filter(Boolean); if (pts.length < 2) continue;
        // ping-pong along the points, pausing at each stop
        const leg = c.period + c.pause, legs = pts.length - 1, cycle = leg * legs * 2;
        let t = this.time % cycle; let i = Math.floor(t / leg); const forward = i < legs; if (!forward) i = 2 * legs - 1 - i;
        const local = Math.min(1, (t % leg) / c.period); const k = forward ? ease(local) : 1 - ease(local);
        pos.copy(pts[i]).lerp(pts[i + 1], k);
        moved = true;
      }
    }
    for (const s of this.spins) { root.rotation[s.axis] += THREE.MathUtils.degToRad(s.speed) * dt; s.left -= dt; moved = true; }
    this.spins = this.spins.filter(s => s.left > 0);
    if (this.tween) {
      const tw = this.tween; tw.t += dt; const k = ease(Math.min(1, tw.t / tw.dur));
      this.offset.copy(tw.from).lerp(tw.to, k); if (tw.t >= tw.dur) this.tween = null; moved = true;
    }
    if (moved || this.offset.lengthSq() > 0) { root.position.copy(pos).add(this.offset); moved = true; }
    if (!this.conts.length && !this.spins.length && !this.tween) this.active = false; // stays where it ended
    return moved;
  }
}

export class ScriptRunner {
  /** api: runtime helpers (act, check, ... see runtime.js) */
  constructor(inst, entry, program, api) {
    this.inst = inst; this.entry = entry; this.program = program; this.api = api;
    this.runs = []; this.time = 0; this.timers = []; this.firedOnce = new Set(); this.cooldown = new Map(); this.reachState = new Map();
    (program.continuous || []).forEach(c => entry.motion?.addContinuous(c));
  }
  get dynamic() { return !!this.entry.motion?.active; }
  start() {
    (this.program.rules || []).forEach((r, i) => {
      if (r.trigger.type === 'start') this.runRule(i);
      if (r.trigger.type === 'every') this.timers.push({ i, every: r.trigger.seconds, next: r.trigger.seconds });
    });
  }
  /** legacy: a touch on this script's own part */
  touch() { this.fire('touch', this.entry); }
  /** event from the runtime; `src` is the entry the event happened on */
  fire(type, src) {
    (this.program.rules || []).forEach((r, i) => {
      if (r.trigger.type !== type) return;
      if (r.trigger.part ? (src?.inst.name || '').toLowerCase() !== r.trigger.part.toLowerCase() : src && src !== this.entry) return;
      if (type === 'touch') { const until = this.cooldown.get(i) || 0; if (this.time < until) return; this.cooldown.set(i, this.time + 0.6); }
      this.runRule(i);
    });
  }
  /** called every frame by the runtime with a var getter, for "when the score reaches 50" */
  checkReach(getVar) {
    (this.program.rules || []).forEach((r, i) => {
      if (r.trigger.type !== 'reach') return;
      const now = compare(getVar(r.trigger.var), r.trigger.op, r.trigger.value), was = this.reachState.get(i) || false;
      this.reachState.set(i, now); if (now && !was) this.runRule(i);
    });
  }
  runRule(i) {
    const r = this.program.rules[i]; if (!r) return;
    if (r.once && this.firedOnce.has(i)) return; this.firedOnce.add(i);
    const ok = !r.if || this.api.check(r.if);
    const list = ok ? r.actions : (r.else || []);
    if (!list.length) return;
    if (r.loop && this.runs.some(x => x.rule === i)) return; // already looping
    this.runs.push({ actions: list, i: 0, waitUntil: 0, rule: i, loop: !!r.loop && ok });
  }
  update(dt) {
    this.time += dt;
    for (const t of this.timers) { t.next -= dt; if (t.next <= 0) { t.next += t.every; this.runRule(t.i); } }
    for (const r of this.runs) {
      let guard = 0;
      while (r.i < r.actions.length && this.time >= r.waitUntil && guard++ < 100) {
        let a = r.actions[r.i++];
        if (a.do === 'random') a = a.options[Math.floor(Math.random() * a.options.length)];
        if (a.do === 'wait') { r.waitUntil = this.time + a.seconds; break; }
        let wait = 0;
        try { wait = this.api.act(a, this) || 0; } catch (e) { console.warn('script action failed', a, e); }
        if (wait > 0) { r.waitUntil = this.time + wait; break; }
      }
      if (r.loop && r.i >= r.actions.length) { r.i = 0; if (!r.actions.some(a => a.do === 'wait')) r.waitUntil = this.time + 0.5; }
    }
    this.runs = this.runs.filter(r => r.loop || r.i < r.actions.length);
    return false;
  }
}

export function compare(v, op, x) {
  v = +v || 0;
  switch (op) { case '>': return v > x; case '<': return v < x; case '<=': return v <= x; case '==': return v === x; case '!=': return v !== x; default: return v >= x; }
}
