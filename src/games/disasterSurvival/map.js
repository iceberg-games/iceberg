// Natural Disaster Survival map: an icy island town, pure data (no THREE), so it can be
// unit-tested and shared with a future multiplayer server. Buildings are made of
// destructible blocks; the terraced hill and the lobby are permanent.
export const ISLAND_R = 72;
export const CELL = 2, LAYER = 1.6;           // block size: 2 x 1.6 x 2
export const LOBBY = { x: 0, y: 50, z: -118, r: 11 };
export const HILL = { x: 46, z: -30, levels: 10, step: 0.75, half: 15, shrink: 1.35 };

// x, z = centre; cw x cd cells; floors (2 layers each); wall/roof colours; stairs side ('+x', '-x', '+z', '-z')
export const BUILDINGS = [
  { name: 'Red House', x: -24, z: 28, cw: 5, cd: 4, floors: 1, c: 0xc8473d, roof: 0x5a3a32 },
  { name: 'Igloo Mart', x: -6, z: 34, cw: 5, cd: 4, floors: 1, c: 0xe8c440, roof: 0x8a5a2a },
  { name: 'Frost Flats', x: -32, z: -20, cw: 4, cd: 4, floors: 3, c: 0x8aa7c4, roof: 0x3d4a5a, stairs: '+x' },
  { name: 'Lighthouse', x: -44, z: -46, cw: 3, cd: 3, floors: 4, c: 0xf2f2f2, stripe: 0xd23c3c, roof: 0xd23c3c, stairs: '-z' },
  { name: 'Green House', x: 32, z: 10, cw: 4, cd: 5, floors: 1, c: 0x4ea85a, roof: 0x2e5a34 },
  { name: 'Log Cabin', x: -40, z: 32, cw: 3, cd: 3, floors: 1, c: 0x8a5a34, roof: 0x4a2e1a },
  { name: 'Radio Shack', x: 2, z: -38, cw: 4, cd: 3, floors: 1, c: 0x9a6ac8, roof: 0x4a3360 },
];

/** All destructible blocks: {x,y,z,w,h,d,c,b} (centre + size; b = building index). */
export function buildBlocks() {
  const out = [];
  BUILDINGS.forEach((B, bi) => {
    const W = B.cw * CELL, D = B.cd * CELL, x0 = B.x - W / 2, z0 = B.z - D / 2;
    const layers = B.floors * 2;
    const push = (x, y, z, w, h, d, c) => out.push({ x, y, z, w, h, d, c, b: bi });
    for (let ly = 0; ly < layers; ly++) {
      const y = ly * LAYER + LAYER / 2;
      const col = B.stripe && ly % 2 === 1 ? B.stripe : B.c;
      for (let i = 0; i < B.cw; i++) for (let k = 0; k < B.cd; k++) {
        const edgeX = i === 0 || i === B.cw - 1, edgeZ = k === 0 || k === B.cd - 1;
        if (!edgeX && !edgeZ) continue;
        // door: front (+z) middle cell, bottom two layers
        if (k === B.cd - 1 && i === Math.floor(B.cw / 2) && ly < 2) continue;
        // windows: upper layer of each floor, middle cells of long walls (not corners)
        if (ly % 2 === 1 && !(edgeX && edgeZ) && ((edgeZ && i % 2 === 1) || (edgeX && k % 2 === 1)) && !(k === B.cd - 1 && i === Math.floor(B.cw / 2))) continue;
        push(x0 + i * CELL + CELL / 2, y, z0 + k * CELL + CELL / 2, CELL, LAYER, CELL, (i + k + ly) % 2 ? col : shade(col, 0.92));
      }
    }
    // roof slab (cells, slightly overhanging look via darker colour)
    const ry = layers * LAYER + 0.25;
    for (let i = 0; i < B.cw; i++) for (let k = 0; k < B.cd; k++) push(x0 + i * CELL + CELL / 2, ry, z0 + k * CELL + CELL / 2, CELL, 0.5, CELL, (i + k) % 2 ? B.roof : shade(B.roof, 1.12));
    // exterior stairs up to the roof: 0.75 high steps
    if (B.stairs) {
      const top = ry + 0.25, n = Math.ceil(top / 0.75);
      for (let s = 0; s < n; s++) {
        const h = Math.min(top, (s + 1) * 0.75), y = h / 2;
        let x, z, w, d;
        const ext = (B.stairs.endsWith('x') ? D : W) / 2, along = (ext - 0.5) - (n - 1 - s); // top step ends beside the roof
        if (B.stairs === '+x') { x = x0 + W + 1; z = B.z + along; w = 2; d = 1; }
        else if (B.stairs === '-x') { x = x0 - 1; z = B.z + along; w = 2; d = 1; }
        else if (B.stairs === '+z') { z = z0 + D + 1; x = B.x + along; w = 1; d = 2; }
        else { z = z0 - 1; x = B.x + along; w = 1; d = 2; }
        // stairs climb toward the corner, so make them longer than the wall if needed
        push(x, y, z, w, h, d, 0x9aa4ad);
      }
    }
  });
  return out;
}
function shade(hex, f) {
  const r = Math.min(255, ((hex >> 16) & 255) * f) | 0, g = Math.min(255, ((hex >> 8) & 255) * f) | 0, b = Math.min(255, (hex & 255) * f) | 0;
  return (r << 16) | (g << 8) | b;
}

/** Permanent hill terraces as boxes {minX..maxZ}. */
export function hillBoxes() {
  const out = [];
  for (let i = 0; i < HILL.levels; i++) {
    const hs = HILL.half - i * HILL.shrink;
    out.push({ minX: HILL.x - hs, maxX: HILL.x + hs, minZ: HILL.z - hs, maxZ: HILL.z + hs, minY: i * HILL.step, maxY: (i + 1) * HILL.step });
  }
  return out;
}
/** Ground height (hill terraces) at x,z; buildings ignored. Used by NPC survivors. */
export function groundHeight(x, z) {
  const dd = Math.max(Math.abs(x - HILL.x), Math.abs(z - HILL.z));
  let h = 0;
  for (let i = 0; i < HILL.levels; i++) if (dd <= HILL.half - i * HILL.shrink) h = (i + 1) * HILL.step;
  return h;
}
export const HILL_TOP = { x: HILL.x, z: HILL.z, y: HILL.levels * HILL.step };

/** Decorative pine trees [x, z, scale] (circle colliders). */
export const TREES = [[-52, 0, 1.2], [-48, -40, 1], [-56, 20, 1.1], [30, 40, 1.2], [44, 30, 0.9], [-24, 46, 1], [22, -44, 1.1], [56, 10, 1], [-14, -56, 1.2], [6, 50, 0.9], [-60, -14, 1], [36, -56, 1], [60, -48, 0.8], [-30, 54, 1.1]];

/** Player/NPC spawn points spread around town. */
export function spawnPoints() {
  const pts = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = 24 + (i % 3) * 7; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  // a few right in front of the holdout's entrance steps
  pts.push([-4, 17], [4, 17], [0, 19]);
  return pts.filter(([x, z]) => !inBunker(x, z) && BUILDINGS.every(B => Math.abs(B.x - x) > B.cw + 1.5 || Math.abs(B.z - z) > B.cd + 1.5));
}

// ---------------------------------------------------------------- THE ICE HOLDOUT (main map)
// A big above-ground bunker on orange/green anchor legs. Plain grey metal panels (destructible),
// permanent frame/floors/stairs, two levels + roof deck + east catwalk.
export const BUNKER = { x: 0, z: 0, hx: 18, hz: 12, floor0: 2.8, floor1: 7.2, roof: 11.6 };
export const BUNKER_GROUP = 100; // b index for bunker blocks
const GREY = 0xa9b0b7, GREY2 = 0x9da4ab, TRIM = 0x6a727a, ORANGE = 0xf0781e, GREEN = 0x38b04a, DARK = 0x3a4048;

/** { blocks, decor, openings, lights } — blocks: {x,y,z,w,h,d,c,b,perm,mat:'metal'}; decor: {x,y,z,w,h,d,c,kind,ry,rz} */
export function buildBunker() {
  const B = BUNKER, blocks = [], decor = [], openings = [], lights = [];
  const blk = (x, y, z, w, h, d, c, perm = false, part = 'panel') => blocks.push({ x, y, z, w, h, d, c, b: BUNKER_GROUP, perm, mat: 'metal', part });
  const box = (x0, y0, z0, x1, y1, z1, c, perm = true, part = 'frame') => blk((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, c, perm, part);
  const dec = (x, y, z, w, h, d, c, kind = 'metal', ry = 0, rz = 0) => decor.push({ x, y, z, w, h, d, c, kind, ry, rz });
  const { hx, hz, floor0: F0, floor1: F1, roof: RF } = B;
  // --- legs / anchors (green + orange) under the floor slab
  const LXS = [0, 1, 2, 3, 4, 5].map(i => -hx + 1 + i * (2 * hx - 2) / 5), LZS = [-hz + 1, 0, hz - 1];
  for (const lx of LXS) for (const lz of LZS) {
    box(lx - 0.45, 0, lz - 0.45, lx + 0.45, F0 - 0.4, lz + 0.45, ORANGE, true, 'leg');
    dec(lx, 0.08, lz, 1.9, 0.16, 1.9, GREEN);                                   // green anchor plate
    for (const [bx, bz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) dec(lx + bx, 0.25, lz + bz, 0.22, 0.2, 0.22, ORANGE); // chunky bolts
    dec(lx, 0.7, lz, 1.0, 0.2, 1.0, GREEN); dec(lx, 1.6, lz, 1.0, 0.2, 1.0, GREEN);   // green bolt bands
    for (const [bx, bz] of [[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5]]) dec(lx + bx, 0.7, lz + bz, 0.16, 0.16, 0.16, ORANGE);
  }
  // diagonal anchor struts (decor), alternating orange/green
  let k = 0;
  const span = LXS[1] - LXS[0];
  for (const lz of [-hz + 1, hz - 1]) for (const lx of LXS.slice(0, -1)) dec(lx + span / 2, (F0 - 0.4) / 2, lz, Math.hypot(span, F0 - 0.6) - 0.6, 0.24, 0.24, k++ % 2 ? GREEN : ORANGE, 'metal', 0, Math.atan2(F0 - 0.8, span) * (k % 2 ? 1 : -1));
  // --- floor slabs (permanent)
  box(-hx, F0 - 0.4, -hz, hx, F0, hz, TRIM, true, 'floor');
  const HOLE = { x0: 4, x1: 10.4, z0: -hz + 0.4, z1: -hz + 3.6 };
  box(-hx + 0.4, F1 - 0.4, -hz + 0.4, HOLE.x0, F1, hz - 0.4, GREY2, true, 'floor');
  box(HOLE.x0, F1 - 0.4, HOLE.z1, HOLE.x1, F1, hz - 0.4, GREY2, true, 'floor');
  box(HOLE.x1, F1 - 0.4, -hz + 0.4, hx - 0.4, F1, hz - 0.4, GREY2, true, 'floor');
  // --- frame columns (permanent) with green plates + orange bolts
  const cols = [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz], [0, -hz], [0, hz], [-hx, 0], [hx, 0]];
  for (const [cx, cz] of cols) {
    const x = Math.max(-hx + 0.3, Math.min(hx - 0.3, cx)), z = Math.max(-hz + 0.3, Math.min(hz - 0.3, cz));
    box(x - 0.35, F0, z - 0.35, x + 0.35, RF, z + 0.35, TRIM, true, 'frame');
    for (const y of [F0 + 0.3, F1 + 0.1]) { dec(x, y, z, 0.95, 0.35, 0.95, GREEN); dec(x + (cx > 0 ? 0.5 : -0.5), y, z, 0.12, 0.16, 0.16, ORANGE); dec(x, y, z + (cz > 0 ? 0.5 : -0.5), 0.16, 0.16, 0.12, ORANGE); }
  }
  // --- wall panels (destructible). doors/windows are gaps.
  const isDoor = (side, lv, i) => (side === '+z' && lv === 0 && (i === hx / 2 - 1 || i === hx / 2)) || (side === '-z' && lv === 0 && i === 3) || (side === '+x' && lv === 1 && (i === hz / 2 - 1 || i === hz / 2));
  for (const lv of [0, 1]) {
    const y0 = lv ? F1 : F0;
    for (const side of ['+z', '-z', '+x', '-x']) {
      const n = side.endsWith('z') ? hx : hz; // cells of 2
      for (let i = 0; i < n; i++) {
        const along = -(side.endsWith('z') ? hx : hz) + i * 2 + 1;
        for (let r = 0; r < 2; r++) {
          const y = y0 + 1 + r * 2 + (r === 1 && lv === 0 ? 0.2 : 0), h = r === 1 && lv === 0 ? 2.4 : 2;
          if (isDoor(side, lv, i)) { if (r === 0) openings.push(side.endsWith('z') ? { x: along, y: y0, z: side[0] === '+' ? hz : -hz } : { x: side[0] === '+' ? hx : -hx, y: y0, z: along }); continue; }
          if (r === 1 && i % 3 === 1 && i > 0 && i < n - 1) continue; // windows
          const c = (i + r + lv) % 2 ? GREY : GREY2;
          if (side.endsWith('z')) blk(along, y, (side[0] === '+' ? 1 : -1) * (hz - 0.2), 2, h, 0.4, c);
          else blk((side[0] === '+' ? 1 : -1) * (hx - 0.2), y, along, 0.4, h, 2, c);
        }
      }
    }
  }
  // door frames: warning stripes + lights
  for (const o of openings) {
    const alongX = Math.abs(o.z) === hz, w = o.z === hz ? 4 : 2;
    const ox = o.z === hz ? 0 : o.x, oz = o.z;
    if (alongX) { dec(ox, o.y + 4.1, oz + Math.sign(oz) * 0.25, w + 0.6, 0.35, 0.1, 0, 'stripe'); lights.push([ox, o.y + 4.6, oz + Math.sign(oz) * 0.5]); }
    else { dec(o.x + Math.sign(o.x) * 0.25, o.y + 4.1, o.z === 1 || o.z === -1 ? 0 : o.z, 0.1, 0.35, w + 2.6, 0, 'stripe', 0); lights.push([o.x + Math.sign(o.x) * 0.5, o.y + 4.6, 0]); }
  }
  // interior walls (destructible): L0 x=0 with doorway, L1 z=0 west half with doorway
  for (let i = 0; i < hz; i++) { if (i === 2 || i === 3) continue; for (let r = 0; r < 2; r++) blk(0, F0 + 1 + r * 2.2, -hz + i * 2 + 1, 0.3, r ? 2.4 : 2, 2, GREY2); }
  for (let i = 0; i < hx / 2; i++) { if (i === 3) continue; for (let r = 0; r < 2; r++) blk(-hx + i * 2 + 1, F1 + 1 + r * 2, 0, 2, 2, 0.3, GREY); }
  // interior stairs L0 -> L1 (permanent), along the back wall of the east room
  for (let sI = 0; sI < 6; sI++) { const top = F0 + (sI + 1) * (F1 - F0) / 6; box(HOLE.x0 + sI, F0, HOLE.z0, HOLE.x0 + sI + 1, Math.min(top, F1), HOLE.z0 + 2.6, sI % 2 ? GREY : GREY2, true, 'stairs'); }
  dec(HOLE.x0 + 3, F0 + 2.6, HOLE.z0 + 2.8, 6.4, 0.12, 0.12, 0xf2c230); // handrail
  // roof panels (destructible, 4x4) + parapet rail (permanent) with a gap where the stairs land
  for (let ix = 0; ix < hx / 2; ix++) for (let iz = 0; iz < hz / 2; iz++) blk(-hx + ix * 4 + 2, F1 + 4 + 0.2, -hz + iz * 4 + 2, 4, 0.4, 4, (ix + iz) % 2 ? GREY : GREY2, false, 'roof');
  const RT = F1 + 4.4; // roof top
  box(-hx, RT, hz - 0.25, hx, RT + 1, hz, TRIM, true, 'rail'); box(-hx, RT, -hz, hx, RT + 1, -hz + 0.25, TRIM, true, 'rail');
  box(hx - 0.25, RT, -hz, hx, RT + 1, hz, TRIM, true, 'rail'); box(-hx, RT, -hz + 3, -hx + 0.25, RT + 1, hz, TRIM, true, 'rail');
  for (const [x0, z0, x1, z1] of [[-hx, hz - 0.25, hx, hz], [-hx, -hz, hx, -hz + 0.25], [hx - 0.25, -hz, hx, hz], [-hx, -hz + 3, -hx + 0.25, hz]]) dec((x0 + x1) / 2, RT + 1.05, (z0 + z1) / 2, x1 - x0 + 0.1, 0.14, z1 - z0 + 0.1, 0xf4f8ff, 'snow');
  // frost along the wall tops and window sills
  dec(0, F1 - 0.35, hz + 0.05, hx * 2, 0.12, 0.2, 0xf4f8ff, 'snow'); dec(0, F1 - 0.35, -hz - 0.05, hx * 2, 0.12, 0.2, 0xf4f8ff, 'snow');
  // exterior stairs to the roof deck on the west side (permanent)
  const nS = Math.ceil(RT / 0.75);
  for (let sI = 0; sI < nS; sI++) { const top = Math.min(RT, (sI + 1) * 0.75), z = -hz + 1.5 + (nS - 1 - sI); box(-hx - 2.2, 0, z - 0.5, -hx - 0.2, top, z + 0.5, sI % 2 ? ORANGE : GREEN, true, 'stairs'); }
  // east catwalk at level 1 (destructible segments + rail), on orange legs with green plates
  for (let i = 0; i < hz; i++) {
    const z = -hz + i * 2 + 1;
    blk(hx + 1.5, F1 - 0.1, z, 3, 0.2, 2, i % 2 ? GREY : GREY2, false, 'catwalk');
    blk(hx + 2.9, F1 + 0.5, z, 0.15, 1.0, 2, 0xf2c230, false, 'catwalk');
  }
  for (const lz of [-hz + 1, 0, hz - 1]) { box(hx + 2.4, 0, lz - 0.3, hx + 3.0, F1 - 0.2, lz + 0.3, ORANGE, true, 'leg'); dec(hx + 2.7, 0.08, lz, 1.4, 0.16, 1.4, GREEN); dec(hx + 2.7, F1 - 0.6, lz, 0.9, 0.3, 0.9, GREEN); }
  // front + back entrance steps (permanent)
  for (let sI = 0; sI < 4; sI++) { box(-2.5, 0, hz + (3 - sI) * 0.8, 2.5, (sI + 1) * F0 / 4, hz + (4 - sI) * 0.8, sI % 2 ? GREY2 : GREY, true, 'stairs'); box(-hx + 5.6, 0, -hz - (4 - sI) * 0.8, -hx + 8.4, (sI + 1) * F0 / 4, -hz - (3 - sI) * 0.8, sI % 2 ? GREY2 : GREY, true, 'stairs'); }
  // fill the gap between the top step and the slab
  // (top steps reach F0 exactly; z ranges are adjacent to the slab edge)
  // interior ceiling lights
  for (const [x, z] of [[-hx / 2, -hz / 2], [-hx / 2, hz / 2], [hx / 2, hz / 3], [hx / 2 + 3, -hz / 6]]) { lights.push([x, F1 - 0.55, z]); lights.push([x, RT - 0.55 - 0.4, z]); }
  return { blocks, decor, openings, lights, roofTop: RT, hole: HOLE };
}
/** Is (x,z) inside the bunker footprint (used to keep spawns and NPCs out of the walls). */
export const inBunker = (x, z, m = 0) => Math.abs(x - BUNKER.x) < BUNKER.hx + 3.5 + m && Math.abs(z - BUNKER.z) < BUNKER.hz + 4.5 + m;
