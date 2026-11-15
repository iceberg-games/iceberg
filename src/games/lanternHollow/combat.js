// Player combat (brief §4.1/4.2/4.4): 3-hit combo with soft auto-aim, dash with i-frames + charges, lantern glow
// meter + FLARE (hold), half-heart HP with i-frames, tonics, downed state. All input comes through engine.input
// (keyboard and the game's touch buttons write the same key codes), so desktop and mobile share one path.
import * as THREE from 'three';
import { makeSlash } from './fx.js';

const HW = 0.42, H = 2.6;
const SWING = [{ t: 0.3, reach: 2.5, arc: 2.1, mul: 1 }, { t: 0.3, reach: 2.5, arc: 2.1, mul: 1.1 }, { t: 0.42, reach: 3.1, arc: Math.PI * 2, mul: 1.6 }];

export class PlayerCombat {
  /** o: { engine, avatar, audio, particles, stats(), mobile, onHits(hits, info), onDown(), onHurt(n) } */
  constructor(o) {
    Object.assign(this, o);
    this.player = o.engine.player; this.input = o.engine.input;
    const s = o.stats();
    this.hp = s.hearts * 2; this.glow = s.glow; this.iframes = 0; this.swing = null; this.combo = 0; this.comboT = 0;
    this.dash = { t: 0, cd: 0, charges: s.charges, dir: new THREE.Vector3() }; this.flaring = false; this.down = null; this.slowT = 0; this.lowWarned = false; this.burnT = 0; this.healFx = 0;
    // sword in the right hand
    const sw = this.sword = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: '#dfe6ff', metalness: 0.85, roughness: 0.22, emissive: '#ffb347', emissiveIntensity: 0 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.25, 0.03), steel); blade.position.y = -0.82; sw.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.064, 0.18, 4), steel); tip.position.y = -1.53; tip.rotation.z = Math.PI; tip.rotation.y = Math.PI / 4; sw.add(tip);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.1), new THREE.MeshStandardMaterial({ color: '#c79a4a', metalness: 0.8, roughness: 0.3 })); guard.position.y = -0.18; sw.add(guard);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 8), new THREE.MeshStandardMaterial({ color: '#4a3222' })); grip.position.y = -0.02; sw.add(grip);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: '#ff9a3c', toneMapped: false })); gem.position.y = -0.18; gem.position.z = 0.06; sw.add(gem);
    this.steel = steel;
    const armR = o.avatar.bones?.armR, armLen = o.avatar.bodySlots?.limbs?.arm?.[1] || 1;
    if (armR) { sw.position.set(0, -armLen + 0.05, 0.12); sw.rotation.x = Math.PI / 2; armR.add(sw); }
    this.slash = makeSlash(); o.scene.add(this.slash);
  }
  get maxHp() { return this.stats().hearts * 2; }
  get radius() { const s = this.stats(); const base = this.glow <= 0 ? 2.5 : s.radius; return this.flaring ? base * 1.8 : base; }
  get dashing() { return this.dash.t > 0; }
  reset(full = true) { const s = this.stats(); if (full) { this.hp = s.hearts * 2; this.glow = s.glow; } this.down = null; this.player.mods.speed = 1; this.iframes = 1.2; this.swing = null; this.dash.charges = s.charges; }
  /** targets: [{ id, kind, x, z, r, hittable }] — returns nearest for auto-aim. */
  aim(targets, range = 4.5) {
    const p = this.player.pos, f = this.player.facing; let best = null, bd = Infinity;
    for (const t of targets) { if (!t.hittable) continue; const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz) - (t.r || 0.5); if (d > range) continue;
      let a = Math.atan2(dx, dz) - f; a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); if (!this.mobile && a > 1.0 && d > 1.2) continue; const score = d + a * 1.2; if (score < bd) { bd = score; best = t; } }
    if (best) { this.player.facing = Math.atan2(best.x - p.x, best.z - p.z); this.avatar.root.rotation.y = this.player.facing; }
    return best;
  }
  attack(targets) {
    if (this.down || this.swing || this.dashing) return false;
    this.combo = this.comboT > 0 ? (this.combo + 1) % 3 : 0; this.comboT = 0.75;
    this.aim(targets); const S = SWING[this.combo];
    this.swing = { i: this.combo, t: 0, dur: S.t, hit: false };
    this.audio.play(`sfx_swing_${this.combo + 1}`, { rate: 0.96 + Math.random() * 0.08 });
    return true;
  }
  _resolveSwing(targets) {
    const S = SWING[this.swing.i], p = this.player.pos, f = this.player.facing, dmg = this.stats().damage * S.mul, hits = [];
    for (const t of targets) { if (!t.hittable) continue; const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
      if (d - (t.r || 0.5) > S.reach) continue; let a = Math.atan2(dx, dz) - f; a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      if (a > S.arc / 2 && d > (t.r || 0.5) + 0.6) continue; hits.push({ t, dmg: Math.round(dmg * (0.92 + Math.random() * 0.16)), crit: S.mul > 1.5 }); }
    if (hits.length) this.onHits(hits, { x: p.x, z: p.z, combo: this.swing.i });
  }
  startDash() {
    if (this.down || this.dash.charges <= 0 || this.dashing) return;
    const p = this.player, k = (c) => this.input.down(c);
    const f = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0), s = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    const an = this.input.analog; let mf = f, ms = s; if (an && (Math.abs(an.x) > 0.1 || Math.abs(an.y) > 0.1)) { mf = an.y; ms = an.x; }
    const fx = -Math.sin(p.camYaw), fz = -Math.cos(p.camYaw), rx = Math.cos(p.camYaw), rz = -Math.sin(p.camYaw);
    let dx = fx * mf + rx * ms, dz = fz * mf + rz * ms; if (Math.hypot(dx, dz) < 0.1) { dx = Math.sin(p.facing); dz = Math.cos(p.facing); }
    const l = Math.hypot(dx, dz); this.dash.dir.set(dx / l, 0, dz / l); p.facing = Math.atan2(dx, dz); this.avatar.root.rotation.y = p.facing;
    this.dash.t = 0.18; this.dash.charges--; if (this.dash.cd <= 0) this.dash.cd = this.stats().cooldown; this.iframes = Math.max(this.iframes, 0.3);
    this.audio.play('sfx_dash', { rate: 0.95 + Math.random() * 0.1 }); this.swing = null;
  }
  takeDamage(n, o = {}) { const slow = o.slow || 0;
    if (this.down || this.iframes > 0 || this.dashing || n <= 0) return 0;
    this.hp = Math.max(0, this.hp - n); this.iframes = 0.65; if (slow) this.slowT = slow; if (o.root) this.rootT = o.root;
    this.audio.play('sfx_player_hurt', { rate: 0.95 + Math.random() * 0.1 }); this.onHurt?.(n);
    if (this.hp <= 0) { if (this.onSecondWind?.()) { this.hp = 4; this.iframes = 1.5; this.healFx = 0.8; } else this.goDown(); } return n;
  }
  goDown() { if (this.down) return; this.down = { t: 0 }; this.flaring = false; this.swing = null; this.player.mods.speed = 0.22; this.audio.play('sfx_player_down'); this.audio.loopOff('flare'); this.onDown?.(); }
  heal(n) { const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + n); if (this.hp > before) { this.audio.play('sfx_heal'); this.healFx = 0.6; } return this.hp - before; }
  update(dt, t, { pressed, held, targets, collision, regenMul = 1 }) {
    const s = this.stats(), p = this.player;
    this.iframes = Math.max(0, this.iframes - dt); this.comboT -= dt; this.healFx = Math.max(0, this.healFx - dt);
    if (this.dash.cd > 0) { this.dash.cd -= dt; if (this.dash.cd <= 0) { this.dash.charges = Math.min(s.charges, this.dash.charges + 1); if (this.dash.charges < s.charges) this.dash.cd = s.cooldown; } }
    if (this.down) { this.down.t += dt; this.glow = Math.max(0, this.glow - dt * 4); this.steel.emissiveIntensity = 0; return; }
    // dash movement (manual, collision-checked so it never tunnels through walls)
    if (this.dashing) { const step = 6 / 0.18 * Math.min(dt, this.dash.t); this.dash.t -= dt;
      for (let i = 0; i < 4; i++) { const nx = p.pos.x + this.dash.dir.x * step / 4, nz = p.pos.z + this.dash.dir.z * step / 4;
        if (collision.overlaps(nx - HW, p.pos.y + 0.05, nz - HW, nx + HW, p.pos.y + H, nz + HW)) break; p.pos.x = nx; p.pos.z = nz; }
      collision.clampBounds(p.pos); this.avatar.root.position.copy(p.pos);
      if (Math.random() < 0.8) this.particles.burst(p.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), ['#ffd27a', '#ffffff', '#ff9a3c'], 3, 1, { up: 0.6, size: 0.1, life: 0.35, grav: 0 }); }
    this.slowT = Math.max(0, this.slowT - dt); this.rootT = Math.max(0, (this.rootT || 0) - dt); p.mods.speed = (this.rootT > 0 ? 0.05 : this.slowT > 0 ? 0.6 : (this.flaring ? 0.85 : 1)) * (s.speed || 1);
    // inputs
    if (pressed('KeyK')) this.attack(targets);
    if (pressed('ShiftLeft') || pressed('ShiftRight')) this.startDash();
    if (pressed('KeyR')) this.onTonic?.();
    // flare
    const wantFlare = held('KeyQ') && this.glow > 0.5;
    if (wantFlare && !this.flaring) { this.audio.play('sfx_flare_start'); this.audio.loopOn('flare', 'sfx_flare_loop'); }
    if (!wantFlare && this.flaring) this.audio.loopOff('flare');
    this.flaring = wantFlare;
    const still = Math.hypot(p.vel.x, p.vel.z) < 0.5;
    if (this.flaring) { if (!(s.steady && still)) this.glow = Math.max(0, this.glow - 25 * (s.flareCost || 1) * dt); } else this.glow = Math.min(s.glow, this.glow + 3 * regenMul * dt);
    if (this.glow < s.glow * 0.2 && !this.lowWarned) { this.lowWarned = true; this.audio.play('sfx_lantern_low'); }
    if (this.glow > s.glow * 0.35) this.lowWarned = false;
    // swing timeline
    if (this.swing) { const sw = this.swing; sw.t += dt; const k = sw.t / sw.dur;
      if (!sw.hit && k >= 0.35) { sw.hit = true; this._resolveSwing(targets); }
      const armR = this.avatar.bones?.armR; if (armR) { if (sw.i === 2) { armR.rotation.set(-1.5, 0, -0.2); this.avatar.root.rotation.y = p.facing + k * Math.PI * 2; } else { const dirn = sw.i === 0 ? 1 : -1; armR.rotation.set(-1.6 + Math.sin(k * Math.PI) * 0.3, dirn * (1.2 - k * 2.4) * 0.6, -0.5 * dirn); } }
      this.slash.visible = true; this.slash.position.set(p.pos.x, p.pos.y + 1.15, p.pos.z);
      this.slash.rotation.z = p.facing - Math.PI / 2 + (sw.i === 2 ? -k * Math.PI * 2 : (sw.i === 0 ? 1 : -1) * (0.6 - k * 1.2));
      this.slash.scale.setScalar(sw.i === 2 ? 1.15 : 1); this.slash.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.6;
      if (k >= 1) { this.swing = null; this.slash.visible = false; if (this.avatar.root) this.avatar.root.rotation.y = p.facing; } }
    else this.slash.visible = false;
    this.steel.emissiveIntensity = 0.15 + s.damage / 28 * 0.4 + (this.swing ? 0.5 : 0);
    // i-frame blink
    this.avatar.root.visible = !(this.iframes > 0 && !this.dashing && Math.floor(t * 20) % 2 === 0 && this.iframes < 0.6);
  }
  dispose() { this.sword.removeFromParent(); this.slash.removeFromParent(); this.audio.loopOff('flare'); this.player.mods.speed = 1; this.avatar.root.visible = true; }
}
