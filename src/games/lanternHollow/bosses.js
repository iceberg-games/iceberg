// Lantern Hollow bosses (brief §4.3): host-side state machines + the telegraph shapes every client draws/resolves.
// State is published as `boss.<area>`; attacks are timestamped (atkAt, mp.now() ms). Specials (opt.sac index) come from
// a client's FLARE: Mossmaw spore sacs, the Foreman's back vents, the Queen's braziers.
const SCALE = (n) => 1 + 0.6 * (Math.min(5, Math.max(1, n)) - 1);
export const BOSSES = {
  mossmaw: { name: 'Mother Mossmaw', hp: 900, r: 3.0, music: 'bgm_boss', reward: { embers: 120, sigil: 1 }, bb: 'boss_mossmaw', icon: '🌸', unlocks: 'mine', phases: [0.5] },
  foreman: { name: 'The Drowned Foreman', hp: 1600, r: 1.9, music: 'bgm_boss', reward: { embers: 200, sigil: 1, rustcog: 10 }, bb: 'boss_foreman', icon: '⚙️', phases: [0.5] },
  queen: { name: 'The Hollow Queen', hp: 2800, r: 1.3, music: 'bgm_boss_queen', reward: { embers: 300, sigil: 1, shard: 10 }, bb: 'boss_queen', icon: '👑', phases: [0.66, 0.3] },
};
const P10 = (v) => Math.round(v * 10), U10 = (v) => v / 10;
const clampArena = (D, x, z, pad = 2.5) => { const dx = x - D.x, dz = z - D.z, l = Math.hypot(dx, dz), m = D.r - pad; return l > m ? [D.x + dx / l * m, D.z + dz / l * m] : [x, z]; };
const lerpAng = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

class BossBase {
  constructor(sim, id) { this.sim = sim; this.id = id; this.def = BOSSES[id]; this.D = sim.L.den; }
  get b() { return this.sim.boss; }
  arena(targets) { return targets.filter(t => Math.hypot(t.x - this.D.x, t.z - this.D.z) < this.D.r + 1); }
  fresh(now, n) { const hp = Math.round(this.def.hp * SCALE(n) * this.sim.hpMul); const [x, z] = this.D.boss;
    return { id: this.id, hp, max: hp, ph: 1, phAt: 0, atk: 0, atkAt: 0, atkEnd: 0, dir: 0, pts: [], x, z, stunUntil: 0, nextAt: now + 2200, adds: 0, dead: 0, empty: 0 }; }
  adopt(s, now) { return { ...s, atk: 0, atkAt: 0, atkEnd: 0, pts: [], nextAt: now + 2000, adds: 0, empty: 0 }; }
  step(dt, now, targets) {
    const sim = this.sim, inA = this.arena(targets), alive = inA.filter(t => !t.down);
    if (!this.b) { if (!alive.length || sim.dun.gate) return; sim.boss = this.fresh(now, targets.length); this.init?.(now); sim.bossDirty = true; }
    const b = this.b;
    if (!alive.length) { b.empty += dt; if (b.empty > 4) { sim.boss = null; sim.list = sim.list.filter(e => !e.boss); sim.bossDirty = sim.dirty = true; } return; }   // party wipe / left: boss resets to full
    b.empty = 0;
    if (b.atk && now > b.atkEnd) { b.atk = 0; b.pts = []; sim.bossDirty = true; }
    this.tick?.(dt, now, alive);
    if (now < b.stunUntil || now < b.nextAt || b.atk) return;
    this.think(now, alive); sim.bossDirty = true;
  }
  mul(now) { return 1; }
  hit(dmg, opt = {}) {
    const b = this.b, now = this.sim.ctx.now(); if (!b || b.dead) return { ok: false };
    if (opt.sac != null) return this.special(opt.sac | 0, opt, now) || { ok: false };
    dmg = Math.max(0, Math.min(60, Number(dmg) || 0)); const mul = this.mul(now);
    b.hp -= dmg * mul; this.sim.bossDirty = true;
    const th = this.def.phases[b.ph - 1];
    if (th != null && b.hp <= b.max * th) { b.ph++; b.atk = 0; b.pts = []; b.phAt = now + 1700; b.nextAt = now + 3600; this.onPhase?.(b.ph, now); this.sim.ctx.send('phase', { a: this.sim.area, b: this.id, ph: b.ph, at: b.phAt }); }   // sfx_boss_phase builds 1.7 s: dark/changes land on phAt
    if (b.hp <= 0) { b.hp = 0; b.dead = 1; b.atk = 0; this.sim.dun.bossDead = 1; const D = this.D; this.sim.list = this.sim.list.filter(e => !e.boss && Math.hypot(e.x - D.x, e.z - D.z) > D.r + 2);   // adds + stragglers in the arena poof with the boss this.sim.dirty = true; this.sim.dirtyDun();
      this.sim.ctx.send('bossDown', { a: this.sim.area, b: this.id, s: (this.sim.rng() * 2 ** 31) | 0, by: opt.from || null }); }
    return { ok: true, mul };
  }
  addsAlive() { return this.sim.list.filter(e => e.boss).length; }
  summon(types, ring = 5) { const b = this.b; for (const t of types) { const a = this.sim.rng() * 6.28, [x, z] = clampArena(this.D, b.x + Math.cos(a) * ring, b.z + Math.sin(a) * ring); const e = this.sim.spawn(t, x, z, { boss: 1, aggro: 30 }); e.st = 1; } b.adds += types.length; }
  pack() { const b = this.b; return { id: b.id, hp: Math.round(b.hp), max: b.max, ph: b.ph, phAt: b.phAt || 0, atk: b.atk, atkAt: b.atkAt, dir: Math.round(b.dir * 100) / 100, pts: b.pts, x: Math.round(b.x * 10) / 10, z: Math.round(b.z * 10) / 10, stunUntil: b.stunUntil, dead: b.dead, ...this.extra?.() }; }
}

// ---------- Mother Mossmaw (caves): Root Slam rings, Vine Sweep cone, slimes; P2 dark + spore sacs ----------
class Mossmaw extends BossBase {
  init() { Object.assign(this.b, { sacs: [1, 1, 1, 1], sacT: [0, 0, 0, 0] }); }
  adopt(s, now) { return { sacT: [0, 0, 0, 0], ...super.adopt(s, now) }; }
  tick(dt, now) { const b = this.b; for (let i = 0; i < 4; i++) if (!b.sacs[i] && b.sacT[i] && now >= b.sacT[i]) { b.sacs[i] = 1; b.sacT[i] = 0; this.sim.bossDirty = true; } }
  mul(now) { const b = this.b; return b.ph === 2 ? (now < b.stunUntil ? 1.6 : 0.3) : 1; }
  think(now, alive) {
    const b = this.b, n = this.sim.nearest(b, alive, 99), opts = b.ph === 1 ? [1, 2, 2, 3] : [1, 2, 4, 4, 3];
    let pick = opts[Math.floor(this.sim.rng() * opts.length)]; if (pick === 3 && this.addsAlive() >= (b.ph === 1 ? 4 : 6)) pick = 2;
    if (pick === 3) { this.summon(Array(b.ph === 1 ? 2 : 3).fill('slime')); b.atk = 3; b.atkAt = now + 300; }
    else { b.atk = pick; b.atkAt = now + (pick === 2 ? 900 : 1000); b.dir = Math.atan2(n.t.x - b.x, n.t.z - b.z); b.pts = alive.slice(0, 4).map(t => [P10(t.x), P10(t.z)]); }
    b.atkEnd = b.atkAt + 1200; b.nextAt = b.atkAt + (b.ph === 1 ? 1700 : 1300) + (pick === 1 ? 900 : 0);
  }
  special(i, opt, now) { const b = this.b; if (b.ph !== 2 || now < b.phAt || !b.sacs[i]) return null;
    b.sacs[i] = 0; b.sacT[i] = now + 18000; b.stunUntil = now + 5000; b.atk = 0; b.nextAt = now + 5200; this.sim.bossDirty = true; this.sim.ctx.send('sac', { a: this.sim.area, i }); return { ok: true, stun: true }; }
  extra() { return { sacs: this.b.sacs }; }
}

// ---------- The Drowned Foreman (mine): Drill Charge lane, Flood Wave half-arena (jump on carts), Lamp Swing arcs; P2 dark, FLARE his back vents ----------
class Foreman extends BossBase {
  tick(dt, now, alive) {
    const b = this.b, n = this.sim.nearest(b, alive, 99);
    if (b.atk === 1 && now >= b.atkAt - 800 && now <= b.atkAt) { const k = 1 - (b.atkAt - now) / 800; b.x = b.sx + Math.sin(b.dir) * b.len * k; b.z = b.sz + Math.cos(b.dir) * b.len * k; this.sim.bossDirty = true; }
    else if (!b.atk && n && now >= b.stunUntil) { { let d = Math.atan2(n.t.x - b.x, n.t.z - b.z) - b.dir; d = Math.atan2(Math.sin(d), Math.cos(d)); b.dir += Math.sign(d) * Math.min(Math.abs(d), dt * 0.8); } }   // turns slowly (0.8 rad/s): dash behind him and FLARE
  }
  mul(now) { const b = this.b; return b.ph === 2 && now >= b.phAt ? (now < b.stunUntil ? 1.8 : 0.45) : (now < b.stunUntil ? 1.4 : 1); }
  think(now, alive) {
    const b = this.b, D = this.D, rng = this.sim.rng, n = this.sim.nearest(b, alive, 99);
    const opts = b.ph === 1 ? [1, 1, 2, 3] : [1, 2, 3, 4, 2]; let pick = opts[Math.floor(rng() * opts.length)]; if (pick === 4 && this.addsAlive() >= 6) pick = 3;
    if (pick === 1) { const dir = Math.atan2(n.t.x - b.x, n.t.z - b.z); let len = 4; while (len < 24 && Math.hypot(b.x + Math.sin(dir) * (len + 1) - D.x, b.z + Math.cos(dir) * (len + 1) - D.z) < D.r - 2.5) len++;
      Object.assign(b, { atk: 1, dir, sx: b.x, sz: b.z, len, atkAt: now + 1900 }); b.pts = [[P10(b.x), P10(b.z), P10(len)]]; }
    else if (pick === 2) { let sx = 0, sz = 0; for (const t of alive) { sx += t.x - D.x; sz += t.z - D.z; } const dir = Math.atan2(sx || rng() - 0.5, sz || rng() - 0.5);
      Object.assign(b, { atk: 2, atkAt: now + 1600 }); b.pts = [[Math.round(dir * 100)]]; }
    else if (pick === 3) { b.atk = 3; b.atkAt = now + 1000; b.pts = (D.lamps || []).map(([lx, lz]) => { const t = this.sim.nearest({ x: lx, z: lz }, alive, 99)?.t || n.t; return [Math.round(Math.atan2(t.x - lx, t.z - lz) * 100)]; }); }
    else { this.summon(['bat', 'bat', 'kobold'], 6); b.atk = 4; b.atkAt = now + 400; }
    b.atkEnd = b.atkAt + 600; b.nextAt = b.atkAt + (b.ph === 1 ? 1500 : 1100);
    if (pick === 1) { const [cx, cz] = clampArena(D, b.sx + Math.sin(b.dir) * b.len, b.sz + Math.cos(b.dir) * b.len); b.ex = cx; b.ez = cz; }
  }
  special(i, opt, now) {   // FLARE at his back vents (phase 2): stagger
    const b = this.b; if (b.ph !== 2 || now < b.phAt || now < b.stunUntil || opt.x == null) return null;
    const dx = opt.x - b.x, dz = opt.z - b.z; if (Math.hypot(dx, dz) > 6.5) return null;
    let ang = Math.atan2(dx, dz) - b.dir; ang = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))); if (ang < 1.75) return null;
    b.stunUntil = now + 4500; b.atk = 0; b.pts = []; b.nextAt = now + 4800; this.sim.bossDirty = true; this.sim.ctx.send('stagger', { a: this.sim.area }); return { ok: true, stun: true };
  }
}

// ---------- The Hollow Queen (throne): Blade Dance, Icicle Rain; P2 Shades/Knights + Mirror Clones; P3 Long Night + braziers ----------
class Queen extends BossBase {
  init() { Object.assign(this.b, { braz: [0, 0, 0, 0], aur: 0, night: 0 }); }
  onPhase(ph, now) { const b = this.b; if (ph === 3) { b.night = 1; b.braz = [0, 0, 0, 0]; } }
  tick(dt, now, alive) {
    const b = this.b;
    if ((b.atk === 1 || b.atk === 4) && b.pts.length) { for (let i = 0; i < b.pts.length; i++) { const [x, z, d, l] = b.pts[i], t1 = b.atkAt + i * 700; if (now >= t1 - 220 && now <= t1) { const k = 1 - (t1 - now) / 220; b.x = U10(x) + Math.sin(d / 100) * U10(l) * k; b.z = U10(z) + Math.cos(d / 100) * U10(l) * k; this.sim.bossDirty = true; } } }
    if (b.night && b.aur && now > b.aur) { b.aur = 0; b.braz = [0, 0, 0, 0]; this.sim.bossDirty = true; this.sim.ctx.send('night', { a: this.sim.area }); }   // the window closes: Long Night again
    if (b.night) for (let i = 0; i < 4; i++) if (b.braz[i] && now > b.braz[i] && !b.aur) { b.braz[i] = 0; this.sim.bossDirty = true; }
    this.alive = alive.length;
  }
  mul(now) { const b = this.b; if (b.night) return now < b.aur ? 2 : 0; return 1; }
  think(now, alive) {
    const b = this.b, D = this.D, rng = this.sim.rng;
    const opts = b.ph === 1 ? [1, 2, 1] : b.ph === 2 ? [1, 2, 3, 4, 4] : [2, 1, 2, 4]; let pick = opts[Math.floor(rng() * opts.length)]; if (pick === 3 && this.addsAlive() >= 5) pick = 4;
    if (pick === 1 || pick === 4) { let x = b.x, z = b.z; b.pts = [];
      for (let i = 0; i < 3; i++) { const t = alive[(i + Math.floor(rng() * alive.length)) % alive.length], dir = Math.atan2(t.x - x, t.z - z); let len = Math.hypot(t.x - x, t.z - z) + 3;
        let [ex, ez] = clampArena(D, x + Math.sin(dir) * len, z + Math.cos(dir) * len); len = Math.max(3, Math.hypot(ex - x, ez - z)); b.pts.push([P10(x), P10(z), Math.round(dir * 100), P10(len)]); x = ex; z = ez; }
      b.atk = pick; b.atkAt = now + 650; b.atkEnd = b.atkAt + 2 * 700 + 300; }
    else if (pick === 2) { b.pts = []; const n = b.ph === 3 ? 14 : 10;
      for (let i = 0; i < n; i++) { const t = alive[i % alive.length], a = rng() * 6.28, r = rng() * 5; const [x, z] = clampArena(D, t.x + Math.cos(a) * r, t.z + Math.sin(a) * r, 1); b.pts.push([P10(x), P10(z)]); }
      b.atk = 2; b.atkAt = now + 1000; b.atkEnd = b.atkAt + n * 110 + 200; }
    else { this.summon(['shade', 'shade', 'knight'], 6); b.atk = 3; b.atkAt = now + 400; b.atkEnd = b.atkAt + 300; }
    b.nextAt = b.atkEnd + (b.night && now < b.aur ? 1800 : b.ph === 1 ? 1300 : 1000);
  }
  special(i, opt, now) {   // FLARE lights a brazier during the Long Night (14 s solo, 6 s each in co-op)
    const b = this.b; if (!b.night || now < b.phAt || b.aur || i < 0 || i > 3) return null; if (b.braz[i] > now) return null;
    b.braz[i] = now + (this.alive > 1 ? 6000 : 14000); this.sim.bossDirty = true; this.sim.ctx.send('brazier', { a: this.sim.area, i });
    if (b.braz.every(t => t > now)) { b.aur = now + 10000; b.braz = b.braz.map(() => b.aur); b.atk = 0; b.pts = []; b.nextAt = now + 2500; this.sim.ctx.send('aurora', { a: this.sim.area }); }
    return { ok: true };
  }
  extra() { return { braz: this.b.braz, aur: this.b.aur, night: this.b.night }; }
}

export function makeBoss(id, sim) { return id === 'foreman' ? new Foreman(sim, id) : id === 'queen' ? new Queen(sim, id) : new Mossmaw(sim, 'mossmaw'); }

/** Telegraph shapes from a published boss state. D = layout.den. */
export function bossShapes(b, D) {
  if (!b || !b.atkAt || b.dead || !b.atk) return [];
  const out = [], cx = b.x ?? D.boss[0], cz = b.z ?? D.boss[1];
  if (b.id === 'foreman') {
    if (b.atk === 1 && b.pts[0]) { const [x, z, l] = b.pts[0]; out.push({ key: `f1:${b.atkAt}`, s: { kind: 'line', x: U10(x), z: U10(z), dir: b.dir, len: U10(l) + 2, w: 3.4 }, t0: b.atkAt - 1900, t1: b.atkAt, dmg: 3, sfx: 'drill' }); }
    if (b.atk === 2 && b.pts[0]) out.push({ key: `f2:${b.atkAt}`, s: { kind: 'line', x: D.x, z: D.z, dir: b.pts[0][0] / 100, len: D.r + 2, w: D.r * 2 + 4, safeY: 0.9 }, t0: b.atkAt - 1600, t1: b.atkAt, dmg: 3, sfx: 'flood' });
    if (b.atk === 3) (D.lamps || []).forEach(([lx, lz], i) => b.pts[i] && out.push({ key: `f3:${b.atkAt}:${i}`, s: { kind: 'cone', x: lx, z: lz, r: 9, arc: 1.2, dir: b.pts[i][0] / 100 }, t0: b.atkAt - 1000, t1: b.atkAt, dmg: 2, sfx: 'lamp' }));
    return out;
  }
  if (b.id === 'queen') {
    const dash = (pts, tag, mirror) => pts.forEach(([x, z, d, l], i) => { let X = U10(x), Z = U10(z), dir = d / 100; if (mirror) { X = 2 * D.x - X; Z = 2 * D.z - Z; dir += Math.PI; }
      const t1 = b.atkAt + i * 700; out.push({ key: `q${tag}:${b.atkAt}:${i}`, s: { kind: 'line', x: X, z: Z, dir, len: U10(l), w: 1.8 }, t0: t1 - 650, t1, dmg: 2, sfx: 'dash' }); });
    if (b.atk === 1) dash(b.pts, 'd', false);
    if (b.atk === 4) { dash(b.pts, 'd', false); dash(b.pts, 'm', true); }
    if (b.atk === 2) b.pts.forEach(([x, z], i) => { const t1 = b.atkAt + i * 110; out.push({ key: `q2:${b.atkAt}:${i}`, s: { kind: 'circle', x: U10(x), z: U10(z), r: 1.5 }, t0: t1 - 1000, t1, dmg: 2, sfx: 'icicle' }); });
    return out;
  }
  if (b.atk === 1) for (let i = 0; i < 3; i++) { const t1 = b.atkAt + i * 450; out.push({ key: `b1:${b.atkAt}:${i}`, s: { kind: 'ring', x: cx, z: cz, r0: 3.4 + i * 3, r: 6.4 + i * 3 }, t0: b.atkAt - 1000, t1, dmg: 1, sfx: i ? null : 'slam' }); }
  if (b.atk === 2) out.push({ key: `b2:${b.atkAt}`, s: { kind: 'cone', x: cx, z: cz, r: 10, arc: Math.PI, dir: b.dir }, t0: b.atkAt - 900, t1: b.atkAt, dmg: 2, sfx: 'sweep' });
  if (b.atk === 4) (b.pts || []).forEach(([x, z], i) => out.push({ key: `b4:${b.atkAt}:${i}`, s: { kind: 'circle', x: U10(x), z: U10(z), r: 2.3 }, t0: b.atkAt - 1000, t1: b.atkAt, dmg: 1, sfx: i ? null : 'spore' }));
  return out;
}
