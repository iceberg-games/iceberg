// Sandboxed interpreter for plain-words script programs (see nlscript.js).
// Only whitelisted actions run; user text never becomes executable code.
import * as THREE from 'three';

export class ScriptRunner {
  /** api: runtime helpers (respawn, setVisible, setColor, ... see runtime.js) */
  constructor(inst, entry, program, api) {
    this.inst = inst; this.entry = entry; this.program = program; this.api = api;
    this.runs = []; this.time = 0; this.timers = []; this.firedOnce = new Set(); this.touchCooldown = 0;
    this.origin = entry.root.position.clone();
    this.baseRot = entry.root.rotation.clone();
    this.dynamic = (program.continuous || []).length > 0;
  }
  start() {
    (this.program.rules || []).forEach((r, i) => {
      if (r.trigger.type === 'start') this._run(r.actions);
      if (r.trigger.type === 'every') this.timers.push({ i, every: r.trigger.seconds, next: r.trigger.seconds });
    });
  }
  touch() {
    if (this.touchCooldown > 0) return;
    this.touchCooldown = 0.6;
    (this.program.rules || []).forEach((r, i) => {
      if (r.trigger.type !== 'touch') return;
      if (r.once && this.firedOnce.has(i)) return;
      this.firedOnce.add(i); this._run(r.actions);
    });
  }
  _run(actions) { this.runs.push({ actions, i: 0, waitUntil: 0 }); }

  update(dt) {
    this.time += dt; this.touchCooldown -= dt;
    const root = this.entry.root;
    let moved = false;
    for (const c of this.program.continuous || []) {
      if (c.type === 'spin') { root.rotation[c.axis] += THREE.MathUtils.degToRad(c.speed) * dt; moved = true; }
      if (c.type === 'move') {
        const f = (1 - Math.cos((this.time / c.period) * Math.PI)) / 2;
        root.position[c.axis] = this.origin[c.axis] + c.distance * f; moved = true;
      }
    }
    for (const t of this.timers) { t.next -= dt; if (t.next <= 0) { t.next += t.every; this._run(this.program.rules[t.i].actions); } }
    for (const r of this.runs) {
      while (r.i < r.actions.length && this.time >= r.waitUntil) {
        const a = r.actions[r.i++];
        if (a.do === 'wait') { r.waitUntil = this.time + a.seconds; break; }
        try { this.api.act(a, this); } catch (e) { console.warn('script action failed', a, e); }
      }
    }
    this.runs = this.runs.filter(r => r.i < r.actions.length);
    return moved;
  }
}
