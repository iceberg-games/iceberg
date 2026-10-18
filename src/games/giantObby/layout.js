// Giant Rainbow Obby: engine-agnostic course layout.
// Pure functions only (no Three.js, no DOM), so the layout is deterministic and
// testable: the same SEED always produces the same 1000 stages.
//
// Coordinates: the course runs along +Z, centred on X = 0. Stage i starts with
// its checkpoint pad at z = stageZ(i); the pad top is at height stageY(i).
// Part format (all centres / sizes in world units):
//   { k, x, y, z, w, h, d, c, m?, spin?, fade? }
//   k: 'solid' (walkable), 'kill' (neon lava brick), 'truss' (climbable),
//      'fade' (blinking tile), 'pad' (checkpoint pad), 'glow' (decor, no collision),
//      'cloud' (decor)
//   m:    { axis: 'x'|'y'|'z', amp, speed, phase }  -> moves sinusoidally
//   spin: { speed, phase }                           -> rotates around Y (kill bar)
//   fade: { period, on, phase }                       -> visible for `on` fraction

export const SEED = 2016;
export const STAGE_COUNT = 1000;          // stages 0..999 lead to the winner pad 1000
export const PAD_W = 8, PAD_D = 6, PAD_H = 1.2;
export const REST_EVERY = 25, MILESTONE_EVERY = 100;
export const MIN_Y = 6, MAX_Y = 34;

export const SECTIONS = [
  { name: 'Rainbow Road',    sky: ['#5fb6ff', '#d9f1ff'], colors: [0xff4d4d, 0xff9f1c, 0xffe14d, 0x4dd964, 0x3fa9ff, 0x9b5cff] },
  { name: 'Lime Lagoon',     sky: ['#3fc3e8', '#e3fff4'], colors: [0x7ee81f, 0x2fd47a, 0x1fc8c8, 0xc8f04d, 0x00b37e] },
  { name: 'Sunset Sherbet',  sky: ['#ff8a5c', '#ffe3b8'], colors: [0xff6b6b, 0xff9671, 0xffc75f, 0xf9f871, 0xff5e9c] },
  { name: 'Ocean Pop',       sky: ['#2f8fe0', '#c9ecff'], colors: [0x00c2ff, 0x0077ff, 0x4de1ff, 0x00e0b0, 0xffffff] },
  { name: 'Grape Soda',      sky: ['#7a5cff', '#e6dbff'], colors: [0x9b5cff, 0xc77dff, 0x6a4cff, 0xff7de9, 0x4dd0ff] },
  { name: 'Bubblegum Sky',   sky: ['#ff8fd0', '#fff0fa'], colors: [0xff5fb8, 0xff9ad5, 0x7fd8ff, 0xfff27f, 0xb38cff] },
  { name: 'Tropical Punch',  sky: ['#18b8a8', '#fff6c9'], colors: [0xff3d6e, 0xffb000, 0x00d68f, 0x00a6ff, 0xff7a00] },
  { name: 'Mint Galaxy',     sky: ['#1d3f8a', '#8fe8d8'], colors: [0x5cffc8, 0x5ca8ff, 0xd65cff, 0xfff15c, 0xffffff] },
  { name: 'Neon Night',      sky: ['#0d1033', '#4a2a7a'], colors: [0xff2bd6, 0x2bfff1, 0xfff22b, 0x7b2bff, 0x2bff6a] },
  { name: 'Golden Rainbow',  sky: ['#ffb84d', '#fff7d6'], colors: [0xffd34d, 0xff4d4d, 0x4dd964, 0x3fa9ff, 0x9b5cff, 0xffffff] },
];
export const sectionOf = (stage) => Math.min(SECTIONS.length - 1, Math.floor(stage / MILESTONE_EVERY));
export const isMilestone = (i) => i > 0 && i % MILESTONE_EVERY === 0;
export const isRest = (i) => i > 0 && i % REST_EVERY === 0 && !isMilestone(i);
/** 0 at the start, 1 at stage 1000, with a small dip right after every milestone. */
export function difficulty(i) {
  const base = Math.min(1, i / STAGE_COUNT);
  const inSection = (i % MILESTONE_EVERY) / MILESTONE_EVERY; // ramps inside each section
  return Math.min(1, Math.max(0, base * 0.8 + inSection * 0.25 - 0.05));
}

// ---------- seeded RNG ----------
export function hash32(a, b = 0) {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b + 0x7f4a7c15), 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}
export function rng(seed) {
  let s = seed >>> 0;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  next.range = (a, b) => a + (b - a) * next();
  next.int = (a, b) => Math.floor(a + (b - a + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.sign = () => (next() < 0.5 ? -1 : 1);
  return next;
}

// ---------- stage types ----------
// Each type: { minD, weight(d), length(r,d), rise(r,d,y) , build(r, d, ctx) }
// build returns parts in course-local coordinates: u = distance after the pad
// (0..length), base height y0 (pad top) and target y1.
const lerp = (a, b, t) => a + (b - a) * t;

export const STAGE_TYPES = {
  jumps: {
    weight: () => 3,
    plan(r, d) { const n = r.int(3, 5), gap = lerp(2.2, 4.6, d); return { n, gap, size: lerp(3.2, 1.7, d), rise: 0, length: n * (gap + lerp(3.2, 1.7, d)) + gap }; },
    build(r, p, y0, col) {
      const parts = []; let u = p.gap;
      for (let j = 0; j < p.n; j++) {
        const s = p.size * r.range(0.9, 1.1);
        parts.push({ k: 'solid', x: r.range(-2.5, 2.5), y: y0 + r.range(-0.6, 0.8) - 0.5, z: u + s / 2, w: s, h: 1, d: s, c: col(j) });
        u += s + p.gap;
      }
      return parts;
    },
  },
  zigzag: {
    weight: (d) => 2,
    plan(r, d) { const n = r.int(4, 6), gap = lerp(1.6, 3.2, d), size = lerp(2.8, 1.6, d); return { n, gap, size, rise: 0, length: n * (gap + size) + gap }; },
    build(r, p, y0, col) {
      const parts = []; let u = p.gap, side = r.sign();
      for (let j = 0; j < p.n; j++) {
        parts.push({ k: 'solid', x: side * r.range(2.4, 4.2), y: y0 - 0.5, z: u + p.size / 2, w: p.size, h: 1, d: p.size, c: col(j) });
        side = -side; u += p.size + p.gap;
      }
      return parts;
    },
  },
  tightrope: {
    weight: (d) => 1.5,
    plan(r, d) { const len = r.range(12, 22); return { len, width: lerp(1.6, 0.8, d), breaks: d > 0.35 ? r.int(1, 2) : 0, rise: 0, length: len + 2 }; },
    build(r, p, y0, col) {
      const parts = []; const segs = p.breaks + 1, gap = 2.6, segLen = (p.len - p.breaks * gap) / segs;
      let u = 1, x = r.range(-1.5, 1.5);
      for (let j = 0; j < segs; j++) {
        parts.push({ k: 'solid', x, y: y0 - 0.3, z: u + segLen / 2, w: p.width, h: 0.6, d: segLen, c: col(j) });
        u += segLen + gap; x = Math.max(-3, Math.min(3, x + r.range(-1.5, 1.5)));
      }
      return parts;
    },
  },
  moving: {
    minD: 0.05, weight: () => 2.2,
    plan(r, d) { const n = r.int(2, 4); return { n, amp: lerp(2.5, 5, d), speed: lerp(0.8, 1.9, d), size: lerp(3.4, 2.2, d), vertical: d > 0.3 && r() < 0.35, rise: 0, length: n * 5.4 + 2 }; },
    build(r, p, y0, col) {
      const parts = []; let u = 2.6;
      for (let j = 0; j < p.n; j++) {
        const m = p.vertical ? { axis: 'y', amp: 1.6, speed: p.speed, phase: j * 1.7 } : { axis: 'x', amp: p.amp, speed: p.speed, phase: j * 2.1 + r() };
        parts.push({ k: 'solid', x: 0, y: y0 - 0.4, z: u + p.size / 2, w: p.size, h: 0.8, d: p.size, c: col(j), m });
        u += 5.4;
      }
      return parts;
    },
  },
  lavaBars: {
    weight: () => 2.2,
    plan(r, d) { const n = r.int(3, 6); return { n, moving: d > 0.25, rise: 0, length: n * 4.2 + 3 }; },
    build(r, p, y0, col) {
      const parts = [{ k: 'solid', x: 0, y: y0 - 0.5, z: p.length / 2, w: 4.4, h: 1, d: p.length, c: col(0) }];
      for (let j = 0; j < p.n; j++) {
        const z = 3 + j * 4.2;
        const bar = { k: 'kill', x: 0, y: y0 + 0.3, z, w: 4.6, h: 0.6, d: 0.6, c: 0xff3b1f };
        if (p.moving && j % 2 === 1) bar.m = { axis: 'y', amp: 1.4, speed: 2 + r(), phase: r() * 6, offset: 1.4 };
        parts.push(bar);
      }
      return parts;
    },
  },
  spinner: {
    minD: 0.08, weight: () => 1.6,
    plan(r, d) { return { speed: lerp(1.1, 2.8, d) * r.sign(), arms: d > 0.55 ? 2 : 1, rise: 0, length: 13 }; },
    build(r, p, y0, col) {
      const parts = [{ k: 'solid', x: 0, y: y0 - 0.5, z: 6.5, w: 10, h: 1, d: 10, c: col(0) },
        { k: 'solid', x: 0, y: y0 + 0.6, z: 6.5, w: 1.2, h: 1.2, d: 1.2, c: 0x333333 }];
      for (let a = 0; a < p.arms; a++) parts.push({ k: 'kill', x: 0, y: y0 + 0.55, z: 6.5, w: 9.4, h: 0.5, d: 0.5, c: 0xff3b1f, spin: { speed: p.speed, phase: a * Math.PI / 2 } });
      return parts;
    },
  },
  truss: {
    weight: (d, y) => (y < MAX_Y - 8 ? 1.4 : 0),
    plan(r, d) { return { height: r.int(5, 8), rise: 0, length: 8 }; },
    build(r, p, y0, col) {
      return [
        { k: 'solid', x: 0, y: y0 - 0.5, z: 1.25, w: 4, h: 1, d: 2.5, c: col(0) },
        { k: 'truss', x: 0, y: y0 - 1 + (p.height + 1) / 2, z: 3.5, w: 2, h: p.height + 1, d: 2, c: 0x9aa4b0 },
        { k: 'solid', x: 0, y: y0 + p.height - 0.5, z: 6, w: 4, h: 1, d: 4, c: col(1) },
      ];
    },
  },
  stairs: {
    weight: (d, y) => (y < MAX_Y - 10 ? 1.6 : 0),
    plan(r, d) { const n = r.int(4, 6), step = lerp(0.9, 1.5, d); return { n, step, gap: lerp(1.6, 3.0, d), size: lerp(3, 1.8, d), rise: 0, length: n * (lerp(1.6, 3.0, d) + lerp(3, 1.8, d)) + 2 }; },
    build(r, p, y0, col) {
      const parts = []; let u = p.gap, x = 0;
      for (let j = 0; j < p.n; j++) {
        parts.push({ k: 'solid', x, y: y0 + (j + 1) * p.step - 0.5, z: u + p.size / 2, w: p.size, h: 1, d: p.size, c: col(j) });
        u += p.size + p.gap; x = Math.max(-3, Math.min(3, x + r.range(-2, 2)));
      }
      return parts;
    },
  },
  descend: {
    weight: (d, y) => (y > MIN_Y + 12 ? 2.2 : 0),
    plan(r, d) { const n = r.int(3, 5); return { n, step: r.range(1.4, 2.2), gap: lerp(1.8, 3.4, d), size: lerp(3, 2, d), rise: 0, length: n * (lerp(1.8, 3.4, d) + lerp(3, 2, d)) + 2 }; },
    build(r, p, y0, col) {
      const parts = []; let u = p.gap;
      for (let j = 0; j < p.n; j++) {
        parts.push({ k: 'solid', x: r.range(-2, 2), y: y0 - (j + 1) * p.step - 0.5, z: u + p.size / 2, w: p.size, h: 1, d: p.size, c: col(j) });
        u += p.size + p.gap;
      }
      return parts;
    },
  },
  fadeTiles: {
    minD: 0.12, weight: () => 1.4,
    plan(r, d) { const n = r.int(4, 6); return { n, period: lerp(3.2, 2.2, d), on: lerp(0.7, 0.55, d), rise: 0, length: n * 3.6 + 1.6 }; },
    build(r, p, y0, col) {
      const parts = []; let u = 1.6;
      for (let j = 0; j < p.n; j++) {
        parts.push({ k: 'fade', x: r.range(-1.5, 1.5), y: y0 - 0.3, z: u + 1.3, w: 2.6, h: 0.6, d: 2.6, c: col(j), fade: { period: p.period, on: p.on, phase: j * 0.18 } });
        u += 3.6;
      }
      return parts;
    },
  },
  killChecker: {
    minD: 0.15, weight: () => 1.3,
    plan(r, d) { const rows = r.int(4, 7); return { rows, rise: 0, length: rows * 2 + 2 }; },
    build(r, p, y0, col) {
      const parts = []; const t = 2; let safe = 1;
      for (let row = 0; row < p.rows; row++) {
        safe = Math.max(0, Math.min(2, safe + r.int(-1, 1)));
        for (let c = 0; c < 3; c++) {
          const x = (c - 1) * t, z = 1 + row * t + t / 2;
          const kill = c !== safe && r() < 0.8;
          parts.push(kill ? { k: 'kill', x, y: y0 - 0.5, z, w: t, h: 1, d: t, c: 0xff3b1f } : { k: 'solid', x, y: y0 - 0.5, z, w: t, h: 1, d: t, c: col(row + c) });
        }
      }
      return parts;
    },
  },
};

// ---------- course plan ----------
let _cache = null;
/** Plans the whole course once: type, length, start position and height of every stage. */
export function planCourse(seed = SEED) {
  if (_cache && _cache.seed === seed) return _cache;
  const stages = []; let z = 0, y = MIN_Y + 2;
  for (let i = 0; i <= STAGE_COUNT; i++) {
    const r = rng(hash32(seed, i));
    const d = difficulty(i);
    let type, p;
    if (i === STAGE_COUNT) { type = 'finish'; p = { length: 0 }; }
    else if (isMilestone(i) || isRest(i) || i === 0) { type = isMilestone(i) ? 'milestone' : (i === 0 ? 'start' : 'rest'); p = { length: isMilestone(i) ? 12 : 8 }; }
    else {
      const opts = Object.entries(STAGE_TYPES).filter(([, t]) => (t.minD || 0) <= d + 1e-9).map(([k, t]) => [k, t.weight(d, y)]).filter(([, w]) => w > 0);
      const total = opts.reduce((s, [, w]) => s + w, 0); let pick = r() * total; type = opts[0][0];
      for (const [k, w] of opts) { if ((pick -= w) <= 0) { type = k; break; } }
      // avoid three of the same type in a row
      if (stages.length > 1 && stages[i - 1].type === type && stages[i - 2].type === type) type = type === 'jumps' ? 'zigzag' : 'jumps';
      p = STAGE_TYPES[type].plan(r, d);
    }
    let y1 = y;
    if (type === 'truss') y1 = y + p.height;
    if (type === 'stairs') y1 = y + p.n * p.step;
    if (type === 'descend') y1 = y - p.n * p.step;
    y1 = Math.max(MIN_Y, Math.min(MAX_Y, y1));
    stages.push({ i, type, p, z, y, y1, seed: hash32(seed, i), d, length: PAD_D + p.length });
    z += PAD_D + p.length; y = y1;
  }
  _cache = { seed, stages, totalLength: z };
  return _cache;
}

export const stageInfo = (i, seed = SEED) => planCourse(seed).stages[Math.max(0, Math.min(STAGE_COUNT, i))];
/** Where the player stands on checkpoint i. */
export function checkpointPos(i, seed = SEED) { const s = stageInfo(i, seed); return { x: 0, y: s.y, z: s.z + PAD_D / 2 }; }

/** Index of the stage whose span contains z (binary search). */
export function stageAtZ(z, seed = SEED) {
  const st = planCourse(seed).stages; let lo = 0, hi = st.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (st[m].z <= z) lo = m; else hi = m - 1; }
  return lo;
}

/** All parts of stage i in world coordinates. Deterministic. */
export function buildStage(i, seed = SEED) {
  const s = stageInfo(i, seed);
  const sec = SECTIONS[sectionOf(i)];
  const colorOffset = i % sec.colors.length;
  const col = (j) => sec.colors[(colorOffset + j) % sec.colors.length];
  const parts = [];
  const gold = 0xffd34d;
  // checkpoint pad
  const padW = s.type === 'milestone' || s.type === 'finish' ? 16 : PAD_W;
  const padD = s.type === 'finish' ? 16 : PAD_D;
  parts.push({ k: 'pad', x: 0, y: s.y - PAD_H / 2, z: s.z + padD / 2, w: padW, h: PAD_H, d: padD, c: (s.type === 'milestone' || s.type === 'finish') ? gold : 0xf4f7fb, stage: i });
  parts.push({ k: 'glow', x: 0, y: s.y + 0.03, z: s.z + padD / 2, w: 3.2, h: 0.06, d: 3.2, c: (s.type === 'milestone' || s.type === 'finish') ? 0xffffff : col(0) });
  const z0 = s.z + PAD_D;
  if (s.type === 'rest' || s.type === 'start' || s.type === 'milestone') {
    const w = s.type === 'milestone' ? 10 : 6;
    parts.push({ k: 'solid', x: 0, y: s.y - 0.5, z: z0 + s.p.length / 2, w, h: 1, d: s.p.length, c: s.type === 'milestone' ? gold : col(1) });
    // rainbow arch over the bridge
    const arch = SECTIONS[0].colors;
    for (let a = 0; a < arch.length; a++) {
      const R = 6.5 - a * 0.45;
      for (let q = 0; q <= 10; q++) {
        const ang = Math.PI * q / 10;
        parts.push({ k: 'glow', x: Math.cos(ang) * R, y: s.y + Math.sin(ang) * R, z: z0 + s.p.length / 2, w: 0.5, h: 0.5, d: 0.45, c: arch[a], soft: true });
      }
    }
  } else if (s.type !== 'finish') {
    const r = rng(s.seed ^ 0x51ed27);
    for (const q of STAGE_TYPES[s.type].build(r, s.p, s.y, col)) {
      q.z += z0; if (q.m && q.m.offset) q.y += q.m.offset; parts.push(q);
    }
    if (s.type === 'descend' || s.type === 'stairs') {
      // the next pad might be at a different height; nothing else needed.
    }
  }
  // a few blocky clouds around the stage (decor)
  const cr = rng(s.seed ^ 0xc10d);
  for (let c = 0; c < 2; c++) {
    const side = cr.sign();
    parts.push({ k: 'cloud', x: side * cr.range(22, 60), y: s.y + cr.range(-4, 14), z: s.z + cr.range(0, s.length), w: cr.range(6, 14), h: cr.range(2, 3.5), d: cr.range(4, 9), c: 0xffffff });
  }
  return parts;
}

/** Fingerprint of a stage range (used by tests to check determinism). */
export function fingerprint(from, to, seed = SEED) {
  let h = 0;
  for (let i = from; i <= to; i++) for (const q of buildStage(i, seed)) h = hash32(h, Math.round((q.x * 7 + q.y * 13 + q.z * 17 + q.w * 3) * 100) ^ q.k.length);
  return h >>> 0;
}

// ---------- moving-part kinematics (shared by renderer + collision) ----------
export function partOffset(q, t) {
  if (!q.m) return 0;
  return Math.sin(t * q.m.speed + q.m.phase) * q.m.amp;
}
export function fadeVisible(q, t) {
  const f = q.fade; const x = ((t / f.period + f.phase) % 1 + 1) % 1; return x < f.on;
}
