// Lantern Hollow enemies: definitions, attack shapes, and the HOST-AUTHORITATIVE simulation (brief §4.3, §9.2).
// The host runs one AreaSim per occupied area and publishes compact snapshots (state key `en.<area>`, ~5 Hz) plus
// the boss (`boss.<area>`, bosses.js) and dungeon progress (`dun.<area>`). Non-hosts render interpolated snapshots.
// Attacks are scheduled by server timestamp (atkAt, mp.now() ms) so every client resolves its own damage at the same moment.
// Each enemy has 1–2 attacks (atks[]); e.k = the attack in progress. Telegraph wind-ups: ≥0.6 s tier 1, ≥0.45 s tier 3.
import { makeBoss } from './bosses.js';
export { bossShapes, BOSSES } from './bosses.js';

export const TYPES = ['slime', 'slimeBig', 'slimelet', 'spore', 'creeper', 'moth', 'golem', 'bat', 'kobold', 'wraith', 'sentinel', 'wisp', 'knight', 'shade'];
export const ST = { idle: 0, chase: 1, windup: 2, strike: 3, recover: 4, burrowed: 5, emerge: 6, exposed: 7 };
const A = (o) => ({ travel: 0, cd: 2, dmg: 1, ...o });
export const DEF = {
  // ---- Glowroot Caves (tier 1) ----
  slime:    { name: 'Glimmer Slime', hp: 30, speed: 2.8, r: 0.7, aggro: 11, embers: [3, 5], mat: ['glowcap', 0.25], kind: 'slime', atks: [A({ shape: 'hop', windup: 0.7, travel: 0.35, cd: 1.4, sr: 1.5, range: 4.2 })] },
  slimeBig: { name: 'Big Glimmer Slime', hp: 55, speed: 2.2, r: 1.0, aggro: 11, embers: [5, 8], mat: ['glowcap', 0.4], kind: 'slime', split: 'slimelet', atks: [A({ shape: 'hop', windup: 0.85, travel: 0.4, cd: 1.8, dmg: 2, sr: 2.2, range: 4.6 })] },
  slimelet: { name: 'Slimelet', hp: 14, speed: 3.4, r: 0.45, aggro: 12, embers: [1, 2], mat: ['glowcap', 0.05], kind: 'slime', atks: [A({ shape: 'hop', windup: 0.55, travel: 0.3, cd: 1.2, sr: 1.1, range: 3.4 })] },
  spore:    { name: 'Spore Puff', hp: 40, speed: 0, r: 0.9, aggro: 7, embers: [4, 6], mat: ['glowcap', 0.3], kind: 'spore', atks: [A({ shape: 'self', windup: 1.0, cd: 2.6, sr: 3.6, range: 4.0, slow: 2 })] },
  creeper:  { name: 'Root Creeper', hp: 55, speed: 3.8, r: 0.8, aggro: 12, embers: [6, 9], mat: ['glowcap', 0.35], kind: 'creeper', burrow: true, exposed: 2.2, atks: [A({ shape: 'line', windup: 0.8, cd: 0, dmg: 2, len: 8, w: 1.5, range: 3.2 })] },
  moth:     { name: 'Gloom Moth', hp: 35, speed: 4.2, r: 0.6, aggro: 14, embers: [5, 8], mat: ['glowcap', 0.15], kind: 'moth', shadow: true, mote: true, orbit: true, fly: 1.7, atks: [A({ shape: 'swoop', windup: 0.6, travel: 0.4, cd: 2.2, len: 9, w: 1.6, range: 6.5 })] },
  // ---- Sunken Mine (tier 2) ----
  golem:    { name: 'Rust Golem', hp: 120, speed: 1.6, r: 1.1, aggro: 12, embers: [10, 15], mat: ['rustcog', 0.55], kind: 'golem', heavy: true,
    atks: [A({ shape: 'charge', windup: 0.9, travel: 0.5, cd: 2.8, dmg: 2, len: 9, w: 2.2, range: 8, minR: 3.4 }), A({ shape: 'self', windup: 0.8, cd: 2.2, dmg: 3, sr: 3.2, range: 3.2 })] },
  bat:      { name: 'Lamp-Eater Bat', hp: 30, speed: 5.4, r: 0.5, aggro: 14, embers: [4, 7], mat: ['rustcog', 0.25], kind: 'bat', fly: 2.0, flees: true, atks: [A({ shape: 'swoop', windup: 0.5, travel: 0.3, cd: 2.4, len: 7, w: 1.3, range: 6, steal: 15 })] },
  kobold:   { name: 'Frost Kobold Miner', hp: 50, speed: 2.6, r: 0.6, aggro: 13, embers: [6, 9], mat: ['rustcog', 0.4], kind: 'kobold', keep: 6, atks: [A({ shape: 'lob', windup: 0.8, cd: 2.4, dmg: 2, sr: 1.8, range: 10 })] },
  wraith:   { name: 'Gloom Wraith', hp: 70, speed: 3.0, r: 0.7, aggro: 13, embers: [9, 13], mat: ['rustcog', 0.3], kind: 'wraith', shadow: true, mote: true, phase: true, fly: 0.6, atks: [A({ shape: 'self', windup: 0.7, cd: 2.8, dmg: 2, sr: 3.0, range: 2.6, root: 1.5 })] },
  // ---- Aurora Throne (tier 3) ----
  sentinel: { name: 'Aurora Sentinel', hp: 110, speed: 3.0, r: 0.75, aggro: 13, embers: [10, 14], mat: ['shard', 0.3], kind: 'sentinel', combo: 3, atks: [A({ shape: 'charge', windup: 0.5, travel: 0.2, cd: 0.45, dmg: 2, len: 5, w: 1.0, range: 4.6 })] },
  wisp:     { name: 'Shard Wisp', hp: 45, speed: 1.8, r: 0.5, aggro: 15, embers: [7, 10], mat: ['shard', 0.35], kind: 'wisp', keep: 8, fly: 1.6, atks: [A({ shape: 'bolt', windup: 0.6, cd: 2.2, dmg: 2, len: 16, w: 0.8, range: 13 })] },
  knight:   { name: 'Frost Knight', hp: 180, speed: 2.0, r: 0.9, aggro: 12, embers: [14, 20], mat: ['shard', 0.5], kind: 'knight', shield: true, heavy: true, atks: [A({ shape: 'cone', windup: 0.7, cd: 2.4, dmg: 3, sr: 4.2, arc: 2.2, range: 3.4 })] },
  shade:    { name: 'Gloom Shade', hp: 80, speed: 3.6, r: 0.7, aggro: 18, embers: [10, 14], mat: ['shard', 0.3], kind: 'shade', shadow: true, mote: true, atks: [A({ shape: 'blink', windup: 0.6, cd: 3.2, dmg: 2, sr: 2.0, range: 18 })] },
};
export const atkOf = (e) => DEF[e.type].atks[e.k || 0] || DEF[e.type].atks[0];
export const MAX_HIT = 60;            // host clamps any single reported hit
/** Gloom+ (post-game): telegraph wind-ups run at 80 % (host stamps `fast` on the attack so every client draws the same timing). */
export const GLOOM_WINDUP = 0.8;
export const SCALE = (n) => 1 + 0.6 * (Math.min(5, Math.max(1, n)) - 1);

export function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const strHash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

/** Telegraph shapes for a rendered enemy record. t0/t1 in the same ms clock as atkAt. */
export function enemyShapes(e) {
  const d = DEF[e.type]; if (!d || !e.atkAt || (e.st !== ST.windup && e.st !== ST.strike)) return [];
  const a = atkOf(e), t1 = e.atkAt, t0 = t1 - (a.windup * (e.fast ? GLOOM_WINDUP : 1) + a.travel) * 1000, key = `e${e.id}:${t1}`, base = { t0, t1, dmg: a.dmg, slow: a.slow, root: a.root, steal: a.steal, src: e.id };
  if (a.shape === 'hop' || a.shape === 'self' || a.shape === 'lob' || a.shape === 'blink') return [{ key, s: { kind: 'circle', x: e.ax, z: e.az, r: a.sr }, ...base }];
  if (a.shape === 'cone') return [{ key, s: { kind: 'cone', x: e.ax, z: e.az, r: a.sr, arc: a.arc, dir: e.dir }, ...base }];
  const out = [{ key, s: { kind: 'line', x: e.ax, z: e.az, dir: e.dir, len: e.bl || a.len, w: a.w }, ...base }];
  if (e.bx != null && e.bl) out.push({ key: key + 'b', s: { kind: 'line', x: e.bx, z: e.bz, dir: e.bd, len: Math.max(1, a.len - e.bl), w: a.w }, ...base });
  return out;
}

// ---------- snapshot packing (≈40 B / enemy) ----------
export function packEnemies(list, base) {
  return { b: base, e: list.map(e => { const r = [e.id, TYPES.indexOf(e.type), Math.round(e.x * 10), Math.round(e.z * 10), Math.max(1, Math.round(e.hp / e.maxHp * 100)), e.st | (e.lit ? 16 : 0) | (e.broken ? 32 : 0) | (e.fast ? 64 : 0),
    e.atkAt ? Math.round(e.atkAt - base) : 0, Math.round((e.dir ?? e.facing) * 100), Math.round(e.ax * 10), Math.round(e.az * 10), e.k || 0, Math.round(e.facing * 100)];
    if (e.bl) r.push(Math.round(e.bx * 10), Math.round(e.bz * 10), Math.round(e.bd * 100), Math.round(e.bl * 10)); return r; }) };
}
export function unpackEnemies(s) {
  if (!s || !Array.isArray(s.e)) return [];
  return s.e.map(([id, t, x, z, hp, st, at, f, ax, az, k, fc, bx, bz, bd, bl]) => ({ id, type: TYPES[t] || 'slime', x: x / 10, z: z / 10, hpPct: hp, st: st & 15, lit: !!(st & 16), broken: !!(st & 32), fast: !!(st & 64), atkAt: at ? s.b + at : 0,
    dir: f / 100, facing: fc != null ? fc / 100 : f / 100, ax: ax / 10, az: az / 10, k: k || 0, ...(bl ? { bx: bx / 10, bz: bz / 10, bd: bd / 100, bl: bl / 10 } : {}) }));
}

/**
 * Host simulation for one area. ctx: { canWalk(x,z,e), inBounds(x,z), litAt(x,z), now(), send(name,payload), onDun(dun) }.
 * layout: { posts[], chambers{}, garden?, gateRule: 'waves'|'levers'|'posts', levers?, den{ boss, bossId, r, x, z }, mirrors? }.
 * targets each tick: [{ id, x, z, r, down, gp }].
 */
export class AreaSim {
  constructor(area, ctx, layout) {
    this.area = area; this.ctx = ctx; this.L = layout; this.list = []; this.nextId = 1; this.activated = new Set(); this.rng = mulberry32((Date.now() ^ strHash(area)) & 0xffffff);
    this.dun = this.freshDun(1); this.boss = null; this.bossCtl = makeBoss(layout.den.bossId, this); this.waveAt = 0; this.dirty = true; this.bossDirty = true; this.hpMul = 1;
  }
  freshDun(rid) { return { rid, posts: this.L.posts.map(() => 0), wave: 0, waveOn: false, gate: 1, bossDead: 0, levers: (this.L.levers || []).map(() => 0) }; }
  spawn(type, x, z, extra = {}) {
    const d = DEF[type], hp = Math.round(d.hp * (this.scale || 1) * this.hpMul);
    const e = { id: this.nextId++, type, x, z, hx: x, hz: z, hp, maxHp: hp, st: d.burrow ? ST.burrowed : ST.idle, t: 0, cd: 1 + this.rng(), atkAt: 0, ax: x, az: z, sx: x, sz: z, facing: this.rng() * 6.28, dir: 0, lit: false, k: 0, combo: 0, ...extra };
    this.list.push(e); this.dirty = true; return e;
  }
  reset() { this.list = []; this.activated.clear(); this.boss = null; this.dun = this.freshDun(this.dun.rid + 1); this.dirty = this.bossDirty = true; this.ctx.onDun?.(this.dun); }
  /** Rebuild from the last snapshot after host migration. */
  adopt(snap, dun, boss) {
    if (dun) this.dun = { ...this.dun, ...dun };
    for (const r of unpackEnemies(snap)) { const d = DEF[r.type]; const hp = Math.max(1, Math.round(d.hp * (r.hpPct / 100))); this.list.push({ ...r, hp, maxHp: d.hp, hx: r.x, hz: r.z, t: 0, cd: 1, sx: r.x, sz: r.z, st: r.st === ST.burrowed ? ST.burrowed : ST.chase, atkAt: 0, combo: 0 }); this.nextId = Math.max(this.nextId, r.id + 1); }
    for (const k of Object.keys(this.L.chambers || {})) this.activated.add(k);
    if (boss && !boss.dead) this.boss = this.bossCtl.adopt(boss, this.ctx.now());
  }
  /** Gate rule (brief): caves = 3 garden waves, mine = 3 gallery levers, throne = 3 aurora pillars. */
  checkGate() {
    const r = this.L.gateRule, d = this.dun; if (!d.gate) return;
    const open = r === 'levers' ? d.levers.every(Boolean) : r === 'posts' ? d.posts.every(Boolean) : r === 'waves' ? d.wave >= (this.L.garden?.waves.length || 0) : true;
    if (open) { d.gate = 0; this.dirtyDun(); }
  }
  step(dt, targets) {
    const now = this.ctx.now(), alive = targets.filter(t => !t.down), L = this.L;
    this.scale = SCALE(targets.length); this.hpMul = targets.some(t => t.gp) ? 1.6 : 1;
    for (const [k, c] of Object.entries(L.chambers || {})) if (!this.activated.has(k) && targets.some(t => Math.hypot(t.x - c.x, t.z - c.z) < c.r + 4)) {
      this.activated.add(k); for (const [type, x, z] of c.spawns) this.spawn(type, x, z, { ch: k }); }
    const g = L.garden;
    if (g && this.dun.wave < g.waves.length) {
      if (!this.dun.waveOn && alive.some(t => Math.hypot(t.x - g.x, t.z - g.z) < g.r - 1)) { this.dun.waveOn = true; this.waveAt = now + 1200; this.dirtyDun(); }
      if (this.dun.waveOn && this.waveAt && now >= this.waveAt) { this.waveAt = 0; for (const [type, x, z] of g.waves[this.dun.wave]) this.spawn(type, x, z, { w: this.dun.wave, aggro: 30 }); this.dirtyDun(); }
      if (this.dun.waveOn && !this.waveAt && !this.list.some(e => e.w === this.dun.wave)) {
        this.dun.wave++; if (this.dun.wave >= g.waves.length) this.dun.waveOn = false; else this.waveAt = now + 2500; this.dirtyDun(); this.checkGate(); }
    }
    for (const e of this.list) this.stepEnemy(e, dt, now, alive);
    for (let i = 0; i < this.list.length; i++) for (let j = i + 1; j < this.list.length; j++) {
      const a = this.list[i], b = this.list[j]; if (a.st === ST.burrowed || b.st === ST.burrowed || DEF[a.type].fly || DEF[b.type].fly) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = DEF[a.type].r + DEF[b.type].r; if (d > 0.001 && d < min) { const p = (min - d) / 2 / d; if (DEF[a.type].speed) this.tryMove(a, -dx * p, -dz * p); if (DEF[b.type].speed) this.tryMove(b, dx * p, dz * p); } }
    if (L.den && !this.dun.bossDead) this.bossCtl.step(dt, now, targets);
  }
  dirtyDun() { this.ctx.onDun?.(this.dun); }
  walk(e, x, z) { return DEF[e.type].phase ? this.ctx.inBounds(x, z) : this.ctx.canWalk(x, z, e); }
  tryMove(e, dx, dz) { const nx = e.x + dx, nz = e.z + dz; if (this.walk(e, nx, nz)) { e.x = nx; e.z = nz; return true; } if (this.walk(e, nx, e.z)) { e.x = nx; return true; } if (this.walk(e, e.x, nz)) { e.z = nz; return true; } return false; }
  nearest(e, alive, range, far = false) { let best = null, bd = far ? -1 : range; for (const t of alive) { const d = Math.hypot(t.x - e.x, t.z - e.z); if (far ? (d < range && d > bd) : d < bd) { bd = d; best = t; } } return best ? { t: best, d: bd } : null; }
  stepEnemy(e, dt, now, alive) {
    const d = DEF[e.type], wasLit = e.lit, wasBroken = e.broken;
    if (d.shadow) { e.lit = this.ctx.litAt(e.x, e.z); if (e.lit !== wasLit) this.dirty = true; }
    if (d.shield) { e.broken = (e.brokenUntil || 0) > now; if (e.broken !== wasBroken) this.dirty = true; }
    e.cd -= dt; e.t += dt;
    const near = this.nearest(e, alive, (e.aggro || d.aggro) * (e.st === ST.idle ? 1 : 1.6));
    const face = (x, z) => { e.facing = Math.atan2(x - e.x, z - e.z); };
    const spd = d.speed * (d.shadow && e.lit ? 0.7 : d.shadow ? 1.25 : 1);   // shadows: faster in the dark, slowed in light
    switch (e.st) {
      case ST.idle:
        if (near) { e.st = ST.chase; this.dirty = true; break; }
        if (d.speed && e.t > 2) { e.t = 0; e.wx = e.hx + (this.rng() - 0.5) * 4; e.wz = e.hz + (this.rng() - 0.5) * 4; }
        if (d.speed && e.wx != null) { const dx = e.wx - e.x, dz = e.wz - e.z, l = Math.hypot(dx, dz); if (l > 0.3) { this.tryMove(e, dx / l * spd * 0.35 * dt, dz / l * spd * 0.35 * dt); face(e.wx, e.wz); } }
        break;
      case ST.chase: {
        if (!near) { e.st = ST.idle; e.hx = e.x; e.hz = e.z; this.dirty = true; break; }
        const { t, d: dist } = near; face(t.x, t.z);
        const atk = this.pickAttack(e, dist), a = d.atks[atk];
        if (e.flee && now < e.flee) { const dx = e.x - t.x, dz = e.z - t.z, l = Math.hypot(dx, dz) || 1; if (l < 9) this.tryMove(e, dx / l * spd * dt, dz / l * spd * dt); break; }
        if (d.orbit || d.flees) { const ang = Math.atan2(e.x - t.x, e.z - t.z) + dt * 0.9, want = a.range - 1, ox = t.x + Math.sin(ang) * want, oz = t.z + Math.cos(ang) * want, dx = ox - e.x, dz = oz - e.z, l = Math.hypot(dx, dz) || 1;
          this.tryMove(e, dx / l * Math.min(l, spd * dt), dz / l * Math.min(l, spd * dt)); }
        else if (d.keep) { const dx = t.x - e.x, dz = t.z - e.z, k = dist > d.keep + 1.5 ? 1 : dist < d.keep - 1.5 ? -1 : 0; if (k) this.tryMove(e, dx / dist * spd * dt * k, dz / dist * spd * dt * k); }
        else if (d.speed && dist > a.range * 0.75) { const dx = t.x - e.x, dz = t.z - e.z; this.tryMove(e, dx / dist * spd * dt, dz / dist * spd * dt); }
        if (a.shape === 'blink') { const far = this.nearest(e, alive, (e.aggro || d.aggro) * 1.6, true); if (far && e.cd <= 0) this.beginAttack(e, far.t, now, atk); }
        else if (dist <= a.range && (!a.minR || dist >= a.minR) && e.cd <= 0) this.beginAttack(e, t, now, atk);
        break; }
      case ST.windup: { const a = atkOf(e); if (now >= e.atkAt - a.travel * 1000) { e.st = ST.strike; e.sx = e.x; e.sz = e.z; this.dirty = true; } break; }
      case ST.strike: {
        const a = atkOf(e), k = a.travel ? Math.min(1, 1 - (e.atkAt - now) / (a.travel * 1000)) : 1;
        if (a.shape === 'hop') { e.x = e.sx + (e.ax - e.sx) * k; e.z = e.sz + (e.az - e.sz) * k; }
        if (a.shape === 'swoop' || a.shape === 'charge') { const L = e.bl || a.len, nx = e.ax + Math.sin(e.dir) * L * k, nz = e.az + Math.cos(e.dir) * L * k; if (d.fly || this.walk(e, nx, nz)) { if (this.ctx.inBounds(nx, nz)) { e.x = nx; e.z = nz; } } }
        if (now >= e.atkAt) {
          if (a.shape === 'blink') { e.x = e.ax; e.z = e.az; }
          e.st = d.exposed ? ST.exposed : ST.recover; e.t = 0; this.dirty = true;
          e.combo = (e.combo || 0) + 1; const comboDone = !d.combo || e.combo >= d.combo; if (comboDone) e.combo = 0;
          e.cd = (comboDone && d.combo ? 2.6 : a.cd) * (0.8 + this.rng() * 0.4);
          if (d.flees) e.flee = now + 4000;
        }
        break; }
      case ST.recover: if (e.t > (d.combo && e.combo ? 0.15 : 0.5)) { e.st = ST.chase; this.dirty = true; } break;
      case ST.burrowed: {
        if (!near) break; const { t, d: dist } = near, a = d.atks[0];
        if (dist > a.range) { const dx = t.x - e.x, dz = t.z - e.z; this.tryMove(e, dx / dist * spd * dt, dz / dist * spd * dt); }
        else if (e.cd <= 0) { e.st = ST.emerge; e.t = 0; face(t.x, t.z); this.dirty = true; }
        break; }
      case ST.emerge: if (e.t > 0.4 && near) this.beginAttack(e, near.t, now, 0); else if (e.t > 1.5) { e.st = ST.burrowed; this.dirty = true; } break;
      case ST.exposed: if (e.t > d.exposed) { e.st = ST.burrowed; e.cd = 1.2; this.dirty = true; } break;
    }
  }
  pickAttack(e, dist) { const atks = DEF[e.type].atks; if (atks.length === 1) return 0; for (let i = atks.length - 1; i >= 0; i--) if (dist <= atks[i].range && (!atks[i].minR || dist >= atks[i].minR)) return i; return 0; }
  beginAttack(e, t, now, k = 0) {
    const d = DEF[e.type], a = d.atks[k]; e.k = k; e.st = ST.windup; e.fast = this.hpMul > 1; e.atkAt = now + (a.windup * (e.fast ? GLOOM_WINDUP : 1) + a.travel) * 1000; e.t = 0; this.dirty = true; e.bx = e.bz = e.bd = undefined; e.bl = 0;
    const dx = t.x - e.x, dz = t.z - e.z, l = Math.hypot(dx, dz) || 1;
    if (a.shape === 'hop') { const reach = Math.min(l, a.range); e.ax = e.x + dx / l * reach; e.az = e.z + dz / l * reach; if (!this.ctx.canWalk(e.ax, e.az, e)) { e.ax = e.x; e.az = e.z; } }
    else if (a.shape === 'self') { e.ax = e.x; e.az = e.z; }
    else if (a.shape === 'lob') { e.ax = t.x; e.az = t.z; }
    else if (a.shape === 'blink') { const bx = t.x + dx / l * 1.6, bz = t.z + dz / l * 1.6; const ok = this.ctx.inBounds(bx, bz) && this.ctx.canWalk(bx, bz, e); e.ax = ok ? bx : t.x; e.az = ok ? bz : t.z; }
    else if (a.shape === 'cone') { e.ax = e.x; e.az = e.z; e.dir = Math.atan2(dx, dz); e.facing = e.dir; }
    else { e.ax = e.x; e.az = e.z; e.dir = Math.atan2(dx, dz); e.facing = e.dir;
      if (a.shape === 'bolt' && this.L.mirrors) this.bounce(e, a); }
  }
  /** Shard Wisp bolts reflect off Hall of Mirrors panels (brief §3.4). */
  bounce(e, a) {
    const fx = Math.sin(e.dir), fz = Math.cos(e.dir); let best = null;
    for (const m of this.L.mirrors) { const den = fx * m.nx + fz * m.nz; if (Math.abs(den) < 0.05) continue;
      const tHit = ((m.x - e.ax) * m.nx + (m.z - e.az) * m.nz) / den; if (tHit < 1 || tHit > a.len - 1) continue;
      const hx = e.ax + fx * tHit, hz = e.az + fz * tHit, tx = -m.nz, tz = m.nx; if (Math.abs((hx - m.x) * tx + (hz - m.z) * tz) > m.hw) continue;
      if (!best || tHit < best.t) best = { t: tHit, hx, hz, m }; }
    if (!best) return; const { m } = best, dot = fx * m.nx + fz * m.nz, rx = fx - 2 * dot * m.nx, rz = fz - 2 * dot * m.nz;
    e.bl = best.t; e.bx = best.hx; e.bz = best.hz; e.bd = Math.atan2(rx, rz);
  }
  /** Host applies a reported hit. opt: { flare, kx, kz, k, from }. */
  applyHit(id, dmg, opt = {}) {
    const e = this.list.find(x => x.id === id); if (!e) return { ok: false };
    const d = DEF[e.type], now = this.ctx.now();
    if (e.st === ST.burrowed) return { ok: false, reason: 'burrowed' };
    if (d.shadow && !e.lit && !opt.flare) return { ok: false, reason: 'dark' };
    if (d.shield) {   // Frost Knight: a FLARE shatters the ice shield for 5 s; until then frontal hits are blocked
      if (opt.flare && !(e.brokenUntil > now)) { e.brokenUntil = now + 5000; this.ctx.send('shield', { a: this.area, id, x: e.x, z: e.z, broke: 1 }); this.dirty = true; }
      if (!(e.brokenUntil > now) && opt.kx != null) { let ang = Math.atan2(opt.kx - e.x, opt.kz - e.z) - e.facing; ang = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));
        if (ang < 1.25) { if (!(e.blockT > now)) { e.blockT = now + 400; this.ctx.send('shield', { a: this.area, id, x: e.x, z: e.z, broke: 0 }); } return { ok: false, reason: 'blocked' }; } }
    }
    dmg = Math.max(0, Math.min(MAX_HIT, Number(dmg) || 0));
    e.hp -= dmg; this.dirty = true; e.flee = 0;
    if (opt.kx != null && d.speed && !d.heavy) { const dx = e.x - opt.kx, dz = e.z - opt.kz, l = Math.hypot(dx, dz) || 1; this.tryMove(e, dx / l * (opt.k || 0.5), dz / l * (opt.k || 0.5)); }
    if (e.st === ST.idle) e.st = ST.chase;
    if (e.hp <= 0) { this.kill(e, opt.from); return { ok: true, killed: true }; }
    return { ok: true, hpPct: e.hp / e.maxHp };
  }
  kill(e, by) {
    this.list.splice(this.list.indexOf(e), 1); this.dirty = true;
    this.ctx.send('slain', { a: this.area, id: e.id, t: e.type, x: Math.round(e.x * 10) / 10, z: Math.round(e.z * 10) / 10, s: (this.rng() * 2 ** 31) | 0, by: by || null, adds: e.boss ? 1 : 0 });
    const d = DEF[e.type]; if (d.split) for (let i = 0; i < 2; i++) { const a = this.rng() * 6.28; const n = this.spawn(d.split, e.x + Math.cos(a) * 0.8, e.z + Math.sin(a) * 0.8, { w: e.w, aggro: 30, boss: e.boss }); n.st = ST.chase; n.cd = 0.8; }
  }
  hitBoss(dmg, opt = {}) { return this.bossCtl.hit(dmg, opt); }
  packBoss() { return this.boss ? this.bossCtl.pack() : null; }
}
