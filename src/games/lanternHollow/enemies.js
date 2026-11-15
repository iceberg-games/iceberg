// Lantern Hollow enemies: definitions, attack shapes, and the HOST-AUTHORITATIVE simulation (brief §4.3, §9.2).
// The host runs one AreaSim per occupied area and publishes compact snapshots (state key `en.<area>`, ~5 Hz) plus
// the boss (`boss.<area>`) and dungeon progress (`dun.<area>`). Non-hosts render interpolated snapshots.
// Attacks are scheduled by server timestamp (atkAt, mp.now() ms) so every client resolves its own damage at the same moment.
export const TYPES = ['slime', 'slimeBig', 'slimelet', 'spore', 'creeper', 'moth'];
export const ST = { idle: 0, chase: 1, windup: 2, strike: 3, recover: 4, burrowed: 5, emerge: 6, exposed: 7 };
export const DEF = {
  slime:    { name: 'Glimmer Slime', hp: 30, speed: 2.8, r: 0.7, aggro: 11, range: 4.2, windup: 0.7, travel: 0.35, cd: 1.4, dmg: 1, shape: 'hop', sr: 1.5, embers: [3, 5], glowcap: 0.25, kind: 'slime' },
  slimeBig: { name: 'Big Glimmer Slime', hp: 55, speed: 2.2, r: 1.0, aggro: 11, range: 4.6, windup: 0.85, travel: 0.4, cd: 1.8, dmg: 2, shape: 'hop', sr: 2.2, embers: [5, 8], glowcap: 0.4, kind: 'slime', split: 'slimelet' },
  slimelet: { name: 'Slimelet', hp: 14, speed: 3.4, r: 0.45, aggro: 12, range: 3.4, windup: 0.55, travel: 0.3, cd: 1.2, dmg: 1, shape: 'hop', sr: 1.1, embers: [1, 2], glowcap: 0.05, kind: 'slime' },
  spore:    { name: 'Spore Puff', hp: 40, speed: 0, r: 0.9, aggro: 7, range: 4.0, windup: 1.0, travel: 0, cd: 2.6, dmg: 1, shape: 'self', sr: 3.6, embers: [4, 6], glowcap: 0.3, kind: 'spore', slow: 2 },
  creeper:  { name: 'Root Creeper', hp: 55, speed: 3.8, r: 0.8, aggro: 12, range: 3.2, windup: 0.8, travel: 0, cd: 0, dmg: 2, shape: 'line', len: 8, w: 1.5, embers: [6, 9], glowcap: 0.35, kind: 'creeper', exposed: 2.2 },
  moth:     { name: 'Gloom Moth', hp: 35, speed: 4.2, r: 0.6, aggro: 14, range: 6.5, windup: 0.6, travel: 0.4, cd: 2.2, dmg: 1, shape: 'swoop', len: 9, w: 1.6, embers: [5, 8], glowcap: 0.15, kind: 'moth', shadow: true, mote: true },
};
export const BOSS = { mossmaw: { name: 'Mother Mossmaw', hp: 900, r: 3.2, embers: 120 } };
export const MAX_HIT = 60;            // host clamps any single reported hit
export const SCALE = (n) => 1 + 0.6 * (Math.min(5, Math.max(1, n)) - 1);

export function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const strHash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

/** Telegraph shapes for a rendered enemy record (or null). t0/t1 in the same ms clock as atkAt. */
export function enemyShapes(e) {
  const d = DEF[e.type]; if (!d || !e.atkAt || (e.st !== ST.windup && e.st !== ST.strike)) return [];
  const t1 = e.atkAt, t0 = t1 - (d.windup + d.travel) * 1000;
  if (d.shape === 'hop') return [{ key: `e${e.id}:${t1}`, s: { kind: 'circle', x: e.ax, z: e.az, r: d.sr }, t0, t1, dmg: d.dmg }];
  if (d.shape === 'self') return [{ key: `e${e.id}:${t1}`, s: { kind: 'circle', x: e.ax, z: e.az, r: d.sr }, t0, t1, dmg: d.dmg, slow: d.slow }];
  const dir = e.dir ?? e.facing;
  return [{ key: `e${e.id}:${t1}`, s: { kind: 'line', x: e.ax, z: e.az, dir, len: d.len, w: d.w }, t0, t1, dmg: d.dmg }];
}
/** Boss telegraphs from the boss state. */
export function bossShapes(b, center) {
  if (!b || !b.atkAt || b.dead) return [];
  const out = [], [cx, cz] = center;
  if (b.atk === 1) for (let i = 0; i < 3; i++) { const t1 = b.atkAt + i * 450; out.push({ key: `b1:${b.atkAt}:${i}`, s: { kind: 'ring', x: cx, z: cz, r0: 3.4 + i * 3, r: 6.4 + i * 3 }, t0: b.atkAt - 1000, t1, dmg: 1 }); }
  if (b.atk === 2) out.push({ key: `b2:${b.atkAt}`, s: { kind: 'cone', x: cx, z: cz, r: 10, arc: Math.PI, dir: b.dir }, t0: b.atkAt - 900, t1: b.atkAt, dmg: 2 });
  if (b.atk === 4) (b.pts || []).forEach(([x, z], i) => out.push({ key: `b4:${b.atkAt}:${i}`, s: { kind: 'circle', x: x / 10, z: z / 10, r: 2.3 }, t0: b.atkAt - 1000, t1: b.atkAt, dmg: 1 }));
  return out;
}

// ---------- snapshot packing (≈34 B / enemy) ----------
export function packEnemies(list, base) {
  return { b: base, e: list.map(e => [e.id, TYPES.indexOf(e.type), Math.round(e.x * 10), Math.round(e.z * 10), Math.max(1, Math.round(e.hp / e.maxHp * 100)), e.st | (e.lit ? 16 : 0),
    e.atkAt ? Math.round(e.atkAt - base) : 0, Math.round((e.dir ?? e.facing) * 100), Math.round(e.ax * 10), Math.round(e.az * 10), e.w ?? -1]) };
}
export function unpackEnemies(s) {
  if (!s || !Array.isArray(s.e)) return [];
  return s.e.map(([id, t, x, z, hp, st, at, f, ax, az]) => ({ id, type: TYPES[t] || 'slime', x: x / 10, z: z / 10, hpPct: hp, st: st & 15, lit: !!(st & 16), atkAt: at ? s.b + at : 0, facing: f / 100, dir: f / 100, ax: ax / 10, az: az / 10 }));
}

/**
 * Host simulation for one area. ctx: { canWalk(x,z), litAt(x,z,targets), now(), send(name,payload), area }.
 * targets each tick: [{ id, x, z, r, down }].
 */
export class AreaSim {
  constructor(area, ctx, layout) {
    this.area = area; this.ctx = ctx; this.L = layout; this.list = []; this.nextId = 1; this.activated = new Set(); this.rng = mulberry32(Date.now() & 0xffffff);
    this.dun = { rid: 1, posts: layout.posts.map(() => 0), wave: 0, waveOn: false, gate: 1, bossDead: 0 };
    this.boss = null; this.waveAt = 0; this.emptySince = null; this.dirty = true; this.bossDirty = true;
  }
  spawn(type, x, z, extra = {}) {
    const d = DEF[type], hp = Math.round(d.hp * (this.scale || 1));
    const e = { id: this.nextId++, type, x, z, hx: x, hz: z, hp, maxHp: hp, st: type === 'creeper' ? ST.burrowed : ST.idle, t: 0, cd: 1 + this.rng(), atkAt: 0, ax: x, az: z, sx: x, sz: z, facing: this.rng() * 6.28, dir: 0, lit: false, ...extra };
    this.list.push(e); this.dirty = true; return e;
  }
  reset() {
    this.list = []; this.activated.clear(); this.boss = null;
    this.dun = { rid: this.dun.rid + 1, posts: this.L.posts.map(() => 0), wave: 0, waveOn: false, gate: 1, bossDead: 0 }; this.dirty = this.bossDirty = true; this.ctx.onDun?.(this.dun);
  }
  /** Rebuild from the last snapshot after host migration. */
  adopt(snap, dun, boss) {
    if (dun) this.dun = { ...this.dun, ...dun };
    for (const r of unpackEnemies(snap)) { const d = DEF[r.type]; const hp = Math.round(d.hp * (r.hpPct / 100)); this.list.push({ ...r, hp, maxHp: d.hp, hx: r.x, hz: r.z, t: 0, cd: 1, sx: r.x, sz: r.z, st: r.st === ST.burrowed ? ST.burrowed : ST.chase, atkAt: 0 }); this.nextId = Math.max(this.nextId, r.id + 1); }
    for (const k of Object.keys(this.L.chambers || {})) this.activated.add(k);
    if (boss && !boss.dead) this.boss = { ...boss, atk: 0, atkAt: 0, nextAt: this.ctx.now() + 2000 };
  }
  get bossCenter() { return this.L.den.boss; }
  step(dt, targets) {
    const now = this.ctx.now(), alive = targets.filter(t => !t.down), L = this.L;
    this.scale = SCALE(targets.length);
    // chamber activation
    for (const [k, c] of Object.entries(L.chambers || {})) if (!this.activated.has(k) && targets.some(t => Math.hypot(t.x - c.x, t.z - c.z) < c.r + 4)) {
      this.activated.add(k); for (const [type, x, z] of c.spawns) this.spawn(type, x, z, { ch: k }); }
    // garden waves
    const g = L.garden;
    if (g && this.dun.wave < g.waves.length) {
      if (!this.dun.waveOn && alive.some(t => Math.hypot(t.x - g.x, t.z - g.z) < g.r - 1)) { this.dun.waveOn = true; this.waveAt = now + 1200; this.dirtyDun(); }
      if (this.dun.waveOn && this.waveAt && now >= this.waveAt) { this.waveAt = 0; for (const [type, x, z] of g.waves[this.dun.wave]) this.spawn(type, x, z, { w: this.dun.wave, aggro: 30 }); this.dirtyDun(); }
      if (this.dun.waveOn && !this.waveAt && !this.list.some(e => e.w === this.dun.wave)) {
        this.dun.wave++; if (this.dun.wave >= g.waves.length) { this.dun.waveOn = false; this.dun.gate = 0; } else this.waveAt = now + 2500; this.dirtyDun(); }
    }
    // enemies
    for (const e of this.list) this.stepEnemy(e, dt, now, alive);
    // separation
    for (let i = 0; i < this.list.length; i++) for (let j = i + 1; j < this.list.length; j++) {
      const a = this.list[i], b = this.list[j]; if (a.st === ST.burrowed || b.st === ST.burrowed) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = DEF[a.type].r + DEF[b.type].r; if (d > 0.001 && d < min) { const p = (min - d) / 2 / d; if (DEF[a.type].speed) this.tryMove(a, -dx * p, -dz * p); if (DEF[b.type].speed) this.tryMove(b, dx * p, dz * p); } }
    if (L.den) this.stepBoss(dt, now, targets, alive);
  }
  dirtyDun() { this.ctx.onDun?.(this.dun); }
  tryMove(e, dx, dz) { const nx = e.x + dx, nz = e.z + dz; if (this.ctx.canWalk(nx, nz, e)) { e.x = nx; e.z = nz; return true; } if (this.ctx.canWalk(nx, e.z, e)) { e.x = nx; return true; } if (this.ctx.canWalk(e.x, nz, e)) { e.z = nz; return true; } return false; }
  nearest(e, alive, range) { let best = null, bd = range; for (const t of alive) { const d = Math.hypot(t.x - e.x, t.z - e.z); if (d < bd) { bd = d; best = t; } } return best ? { t: best, d: bd } : null; }
  stepEnemy(e, dt, now, alive) {
    const d = DEF[e.type], wasLit = e.lit;
    if (d.shadow) { e.lit = this.ctx.litAt(e.x, e.z); if (e.lit !== wasLit) this.dirty = true; }
    e.cd -= dt; e.t += dt;
    const near = this.nearest(e, alive, (e.aggro || d.aggro) * (e.st === ST.idle ? 1 : 1.6));
    const face = (x, z) => { e.facing = Math.atan2(x - e.x, z - e.z); };
    switch (e.st) {
      case ST.idle:
        if (near) { e.st = ST.chase; this.dirty = true; break; }
        if (d.speed && e.t > 2) { e.t = 0; e.wx = e.hx + (this.rng() - 0.5) * 4; e.wz = e.hz + (this.rng() - 0.5) * 4; }
        if (d.speed && e.wx != null) { const dx = e.wx - e.x, dz = e.wz - e.z, l = Math.hypot(dx, dz); if (l > 0.3) { this.tryMove(e, dx / l * d.speed * 0.35 * dt, dz / l * d.speed * 0.35 * dt); face(e.wx, e.wz); } }
        break;
      case ST.chase: {
        if (!near) { e.st = ST.idle; e.hx = e.x; e.hz = e.z; this.dirty = true; break; }
        const { t, d: dist } = near; face(t.x, t.z);
        if (d.shadow) { // moths orbit at range, outside the light where possible
          const a = Math.atan2(e.x - t.x, e.z - t.z) + dt * 0.9, want = d.range - 1, ox = t.x + Math.sin(a) * want, oz = t.z + Math.cos(a) * want, dx = ox - e.x, dz = oz - e.z, l = Math.hypot(dx, dz) || 1;
          this.tryMove(e, dx / l * Math.min(l, d.speed * dt), dz / l * Math.min(l, d.speed * dt));
        } else if (d.speed && dist > d.range * 0.75) { const dx = t.x - e.x, dz = t.z - e.z; this.tryMove(e, dx / dist * d.speed * dt, dz / dist * d.speed * dt); }
        if (dist <= d.range && e.cd <= 0) this.beginAttack(e, t, now);
        break; }
      case ST.windup: if (now >= e.atkAt - d.travel * 1000) { e.st = ST.strike; e.sx = e.x; e.sz = e.z; this.dirty = true; } break;
      case ST.strike: {
        const k = d.travel ? Math.min(1, 1 - (e.atkAt - now) / (d.travel * 1000)) : 1;
        if (d.shape === 'hop') { e.x = e.sx + (e.ax - e.sx) * k; e.z = e.sz + (e.az - e.sz) * k; }
        if (d.shape === 'swoop') { const ex = e.ax + Math.sin(e.dir) * d.len, ez = e.az + Math.cos(e.dir) * d.len; const nx = e.ax + (ex - e.ax) * k, nz = e.az + (ez - e.az) * k; if (this.ctx.canWalk(nx, nz, e)) { e.x = nx; e.z = nz; } }
        if (now >= e.atkAt) { e.st = d.exposed ? ST.exposed : ST.recover; e.t = 0; e.cd = d.cd * (0.8 + this.rng() * 0.4); this.dirty = true; }
        break; }
      case ST.recover: if (e.t > 0.5) { e.st = ST.chase; this.dirty = true; } break;
      case ST.burrowed: {
        if (!near) break; const { t, d: dist } = near;
        if (dist > d.range) { const dx = t.x - e.x, dz = t.z - e.z; this.tryMove(e, dx / dist * d.speed * dt, dz / dist * d.speed * dt); }
        else if (e.cd <= 0) { e.st = ST.emerge; e.t = 0; face(t.x, t.z); this.dirty = true; }
        break; }
      case ST.emerge: if (e.t > 0.4 && near) this.beginAttack(e, near.t, now); else if (e.t > 1.5) { e.st = ST.burrowed; this.dirty = true; } break;
      case ST.exposed: if (e.t > d.exposed) { e.st = ST.burrowed; e.cd = 1.2; this.dirty = true; } break;
    }
  }
  beginAttack(e, t, now) {
    const d = DEF[e.type]; e.st = ST.windup; e.atkAt = now + (d.windup + d.travel) * 1000; e.t = 0; this.dirty = true;
    if (d.shape === 'hop') { const dx = t.x - e.x, dz = t.z - e.z, l = Math.hypot(dx, dz) || 1, reach = Math.min(l, d.range); e.ax = e.x + dx / l * reach; e.az = e.z + dz / l * reach; if (!this.ctx.canWalk(e.ax, e.az, e)) { e.ax = e.x; e.az = e.z; } }
    else if (d.shape === 'self') { e.ax = e.x; e.az = e.z; }
    else { e.ax = e.x; e.az = e.z; e.dir = Math.atan2(t.x - e.x, t.z - e.z); e.facing = e.dir; }
  }
  /** Host applies a reported hit. Returns { ok, killed, hpPct }. */
  applyHit(id, dmg, opt = {}) {
    const e = this.list.find(x => x.id === id); if (!e) return { ok: false };
    const d = DEF[e.type];
    if (e.st === ST.burrowed) return { ok: false, reason: 'burrowed' };
    if (d.shadow && !e.lit && !opt.flare) return { ok: false, reason: 'dark' };
    dmg = Math.max(0, Math.min(MAX_HIT, Number(dmg) || 0));
    e.hp -= dmg; this.dirty = true;
    if (opt.kx != null && d.speed) { const dx = e.x - opt.kx, dz = e.z - opt.kz, l = Math.hypot(dx, dz) || 1; this.tryMove(e, dx / l * (opt.k || 0.5), dz / l * (opt.k || 0.5)); }
    if (e.st === ST.idle) e.st = ST.chase;
    if (e.hp <= 0) { this.kill(e, opt.from); return { ok: true, killed: true }; }
    return { ok: true, hpPct: e.hp / e.maxHp };
  }
  kill(e, by) {
    this.list.splice(this.list.indexOf(e), 1); this.dirty = true;
    this.ctx.send('slain', { a: this.area, id: e.id, t: e.type, x: Math.round(e.x * 10) / 10, z: Math.round(e.z * 10) / 10, s: (this.rng() * 2 ** 31) | 0, by: by || null });
    const d = DEF[e.type]; if (d.split) for (let i = 0; i < 2; i++) { const a = this.rng() * 6.28; const n = this.spawn(d.split, e.x + Math.cos(a) * 0.8, e.z + Math.sin(a) * 0.8, { w: e.w, aggro: 30 }); n.st = ST.chase; n.cd = 0.8; }
  }
  // ---------- boss: Mother Mossmaw ----------
  stepBoss(dt, now, targets, alive) {
    const D = this.L.den, [bx, bz] = D.boss;
    const inDen = targets.filter(t => Math.hypot(t.x - D.x, t.z - D.z) < D.r + 1), aliveIn = inDen.filter(t => !t.down);
    if (this.dun.bossDead) return;
    if (!this.boss) { if (!aliveIn.length || this.dun.gate) return;
      const hp = Math.round(BOSS.mossmaw.hp * SCALE(targets.length)); this.boss = { hp, max: hp, ph: 1, atk: 0, atkAt: 0, dir: 0, pts: [], sacs: [1, 1, 1, 1], sacT: [0, 0, 0, 0], stunUntil: 0, nextAt: now + 2200, adds: 0, dead: 0, empty: 0 }; this.bossDirty = true; }
    const b = this.boss;
    if (!aliveIn.length) { b.empty += dt; if (b.empty > 4) { this.boss = null; this.list = this.list.filter(e => !e.boss); this.bossDirty = this.dirty = true; } return; }
    b.empty = 0;
    if (b.atk && now > b.atkAt + 1200) { b.atk = 0; this.bossDirty = true; }
    for (let i = 0; i < 4; i++) if (!b.sacs[i] && b.sacT[i] && now >= b.sacT[i]) { b.sacs[i] = 1; b.sacT[i] = 0; this.bossDirty = true; }
    if (now < b.stunUntil || now < b.nextAt || b.atk) return;
    const n = this.nearest({ x: bx, z: bz }, aliveIn, 99);
    const opts = b.ph === 1 ? [1, 2, 2, 3] : [1, 2, 4, 4, 3];
    let pick = opts[Math.floor(this.rng() * opts.length)];
    if (pick === 3 && b.adds >= (b.ph === 1 ? 4 : 6)) pick = 2;
    if (pick === 3) { const k = b.ph === 1 ? 2 : 3; for (let i = 0; i < k; i++) { const a = this.rng() * 6.28; const e = this.spawn('slime', bx + Math.cos(a) * 5, bz + Math.sin(a) * 5, { boss: 1, aggro: 30 }); e.st = ST.chase; } b.adds += k; b.atk = 3; b.atkAt = now + 300; }
    else { b.atk = pick; b.atkAt = now + (pick === 1 ? 1000 : pick === 2 ? 900 : 1000); b.dir = Math.atan2(n.t.x - bx, n.t.z - bz); b.pts = aliveIn.slice(0, 4).map(t => [Math.round(t.x * 10), Math.round(t.z * 10)]); }
    b.nextAt = b.atkAt + (b.ph === 1 ? 1700 : 1300) + (pick === 1 ? 900 : 0);
    this.bossDirty = true;
  }
  /** Boss damage (sac bursts stun; phase 2 is armoured unless stunned). */
  hitBoss(dmg, { sac = null, from = null } = {}) {
    const b = this.boss, now = this.ctx.now(); if (!b || b.dead) return { ok: false };
    if (sac != null && b.ph === 2 && now >= (b.phAt || 0) && b.sacs[sac]) { b.sacs[sac] = 0; b.sacT[sac] = now + 18000; b.stunUntil = now + 5000; b.atk = 0; b.nextAt = now + 5200; this.bossDirty = true; this.ctx.send('sac', { a: this.area, i: sac }); return { ok: true, stun: true }; }
    if (sac != null) return { ok: false };
    dmg = Math.max(0, Math.min(MAX_HIT, Number(dmg) || 0));
    const mul = b.ph === 2 ? (now < b.stunUntil ? 1.6 : 0.3) : 1;   // phase 2 is armoured unless a sac burst stunned her
    b.hp -= dmg * mul; this.bossDirty = true;
    if (b.ph === 1 && b.hp <= b.max * 0.5) { b.ph = 2; b.atk = 0; b.phAt = now + 1700; b.nextAt = now + 3600; this.ctx.send('phase', { a: this.area, ph: 2, at: b.phAt }); }   // sfx_boss_phase builds 1.7 s before its boom: the dark lands on phAt
    if (b.hp <= 0) { b.hp = 0; b.dead = 1; b.atk = 0; this.dun.bossDead = 1; this.list = this.list.filter(e => !e.boss); this.dirty = true; this.dirtyDun();
      this.ctx.send('bossDown', { a: this.area, b: 'mossmaw', s: (this.rng() * 2 ** 31) | 0, by: from }); }
    return { ok: true, mul };
  }
  packBoss() { const b = this.boss; if (!b) return null; return { hp: Math.round(b.hp), max: b.max, ph: b.ph, phAt: b.phAt || 0, atk: b.atk, atkAt: b.atkAt, dir: Math.round(b.dir * 100) / 100, pts: b.pts, sacs: b.sacs, stunUntil: b.stunUntil, dead: b.dead }; }
}
