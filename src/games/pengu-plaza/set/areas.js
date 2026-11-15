// Pengu Plaza BIG — new-area anchors (GM2, branch game/pengu-plaza-big). PURE DATA, no imports.
// The original plaza anchors stay in ./layout.js (Iceberg Set Builder); everything outside the plaza lives here
// so Set Builder can resync it into blockworld-sets later. Units = world metres, y = up, plaza centre = (0, 0).
// If you move a coordinate here, the game follows (world.js / targets read everything from this file).
export const WORLD_R = 128;                 // walk bounds (circle)
export const PLAZA_EXITS = [                 // where paths leave the plaza ring (angle in radians, atan2(z, x))
  { to: 'ridge', a: Math.PI / 2, label: 'Aurora Ridge', icon: '🌌' },
  { to: 'harbor', a: 0, label: 'Frozen Harbor', icon: '⚓' },
  { to: 'grotto', a: Math.PI, label: 'Ice Cave Grotto', icon: '💎' },
  { to: 'woods', a: -Math.PI / 2, label: 'Snowy Pine Woods', icon: '🌲' },
  { to: 'village', a: Math.PI / 4, label: 'Igloo Village', icon: '🔥' },
  { to: 'garden', a: -3 * Math.PI / 4, label: 'Sculpture Garden', icon: '🗿' },
];
// Area discs (zone detection + ambience). `amb` = ambience cue, fog/hemi = area look.
export const AREAS_BIG = [
  { id: 'ridge', name: 'Aurora Ridge', icon: '🌌', x: 0, z: 88, r: 24, amb: 'amb_ridge', fog: '#2a3f78', hemi: 1.0 },
  { id: 'harbor', name: 'Frozen Harbor', icon: '⚓', x: 84, z: 0, r: 26, amb: 'amb_harbor', fog: '#3a5a8a', hemi: 0.95 },
  { id: 'grotto', name: 'Ice Cave Grotto', icon: '💎', x: -82, z: 0, r: 18, amb: 'amb_grotto', fog: '#160f38', hemi: 0.35, indoor: true },
  { id: 'woods', name: 'Snowy Pine Woods', icon: '🌲', x: 0, z: -86, r: 28, amb: 'amb_woods', fog: '#2a4a66', hemi: 0.95 },
  { id: 'village', name: 'Igloo Village', icon: '🔥', x: 60, z: 60, r: 22, amb: 'amb_village', fog: '#4a3a66', hemi: 1.0 },
  { id: 'garden', name: 'Sculpture Garden', icon: '🗿', x: -60, z: -60, r: 22, amb: 'amb_woods', fog: '#2f5a80', hemi: 1.05 },
];
// Paths (packed-snow strips, polyline of [x, z], width w)
export const PATHS = [
  { id: 'to-ridge', w: 5, pts: [[0, 34], [0, 64]] },
  { id: 'to-harbor', w: 5, pts: [[34, 0], [62, 0], [88, 0]] },
  { id: 'to-grotto', w: 5, pts: [[-34, 0], [-64, 0]] },
  { id: 'to-woods', w: 5, pts: [[0, -34], [0, -46], [0, -70]] },
  { id: 'to-village', w: 4.5, pts: [[27, 21], [44, 42], [54, 54]] },
  { id: 'to-garden', w: 4.5, pts: [[-24, -26], [-40, -42], [-50, -50]] },
];

// ---- Aurora Ridge: plateau + stairs + sled lift ----
export const RIDGE = {
  plateau: { minX: -18, maxX: 18, minZ: 78, maxZ: 102, top: 7 },
  stairs: { x: 0, w: 6, z0: 64, steps: 14, rise: 0.5, depth: 1 },     // step i: z0+i..z0+i+1, top (i+1)*rise
  lift: { base: { x: 21.5, z: 62 }, top: { x: 21.5, z: 90, y: 8 }, exit: { x: 15, z: 88 }, ride: 5 },
  telescope: { x: 0, z: 99 },   // looks north (+z) at the aurora
  cairn: { x: -11, z: 92 },
  flag: { x: 13, z: 97 },
  snowAngel: { x: -6, z: 84 },
  aurora: { x: 0, y: 70, z: 230 },  // sky target (night only)
};
// ---- Frozen Harbor ----
export const HARBOR = {
  shoreX: 88,                                   // water for x > shoreX (except the pier)
  pier: { x0: 88, x1: 106, hw: 2.5 },
  lighthouse: { x: 82, z: -21 },
  market: { x: 72, z: 12 },
  boats: [{ x: 96, z: 9.5, rot: 0.2 }, { x: 98, z: -9, rot: -0.3 }, { x: 112, z: 16, rot: 1.1 }],
  boatsSpot: { x: 90, z: 4.5, look: [97, 1, 2] },
  seal: { x: 101, z: 13 }, sealPup: { x: 110, z: -13 }, puffinRock: { x: 93, z: 22 },
  fisher: { x: 104.5, z: 1.4 },
  whale: { x: 126, z: 4 },                      // breach point (shared-clock timer)
  wander: [[70, -6], [78, 6], [66, 4]],
};
// ---- Ice Cave Grotto (dome, entrance faces +x) ----
export const GROTTO = {
  x: -82, z: 0, r: 18, gap: 0.28, doorH: 6,     // cave mouth: half-angle (rad) around +x, height
  heart: { x: -86, z: 0 },
  pool: { x: -80, z: 9 }, poolSpot: { x: -74, z: 4, look: [-80, 0.5, 9] },
  falls: { x: -97.5, z: -5 }, fallsSpot: { x: -88, z: -7, look: [-97, 4, -5] },
  carving: { x: -84, z: -15.6 },
  gem: { x: -95, z: 8.6 },                      // hidden behind the crystal cluster in the NW niche
  spelunker: { x: -75, z: -7 },
  moths: { x: -88, z: 7, y: 3 },
};
// ---- Snowy Pine Woods (south, over the creek bridge) ----
export const WOODS = {
  creek: { z: -48, hw: 2.2, x0: -110, x1: 110 }, bridge: { x: 0, hw: 2.6, len: 7 },
  clearing: { x: 0, z: -84, r: 9 },
  oldPine: { x: -15, z: -97 },
  owlPerches: [[12, -77, 3.6], [-11, -70, 3.2], [7, -101, 4.2]],
  foxHome: { x: 2, z: -86, r: 11 },
  hares: { x: -7, z: -76 },
  reindeer: { x: 17, z: -93 },
  yeti: { x: -24, z: -110 },                    // night only, far edge
  goldenCone: { x: 22, z: -107 },
  wander: [[-4, -64], [6, -80]],
};
// ---- Igloo Village (NE, end of Lantern Lane) ----
export const VILLAGE = {
  igloos: [[50, 68, 2.4], [46, 58, 1.9], [52, 47, 1.3], [64, 44, 0.7], [72, 52, 0.1], [70, 68, -0.8], [60, 73, -1.6]],
  bonfire: { x: 59, z: 59 },
  streetSpot: { x: 47, z: 50, look: [60, 2, 62] },
  choir: { x: 53, z: 65 },
  snowman: { x: 66, z: 56 },
  market: { x: 66, z: 66 },
  sledHill: { x: 76, z: 74, r: 7, h: 4 },
  wander: [[56, 52], [62, 64]],
};
// ---- Sculpture Garden (SW) + snow maze ----
export const GARDEN = {
  maze: { x: -58, z: -62, cell: 2.4, h: 1.7 },
  // 7x7 maze, '#' wall, '.' open, 'H' heart, 'E' entrance (north side, facing the plaza path)
  mazeMap: [
    '###E###',
    '#.....#',
    '#.###.#',
    '#.#H#.#',
    '#.#.#.#',
    '#...#.#',
    '#######',
  ],
  dragon: { x: -73, z: -48 }, whale: { x: -44, z: -72 }, castle: { x: -75, z: -72 },
  sculptor: { x: -69, z: -44 },
  wander: [[-48, -52], [-62, -46]],
};
// Spot rings (stand here + Snap auto-aims). Original 5 plaza spots stay in layout.js PHOTO_SPOTS.
export const SPOTS_BIG = [
  { id: 'summit', name: 'Summit Lookout', area: 'ridge', x: 0, z: 96, y: 7, look: [0, 30, 200] },
  { id: 'boats', name: 'Moored Boats', area: 'harbor', ...HARBOR.boatsSpot },
  { id: 'glow_pool', name: 'Glow Pool', area: 'grotto', ...GROTTO.poolSpot },
  { id: 'icicle_falls', name: 'Frozen Falls', area: 'grotto', ...GROTTO.fallsSpot },
  { id: 'igloo_row', name: 'Igloo Street', area: 'village', ...VILLAGE.streetSpot },
];
// Event schedule on the shared server clock (mp.now(), seconds). Everyone in an instance sees the same events.
export const EVENTS = {
  night: { period: 480, start: 300, len: 150 },      // aurora + yeti + lighthouse beam
  whale: { period: 75, len: 5.5, offset: 20 },
  shootingStar: { period: 53, len: 1.8, offset: 9 },
  danceCrowd: { period: 210, len: 45, offset: 60, x: -6, z: -2, r: 3.2 },
  snowman: { period: 120, done: 90 },                // builds for 90 s, finished for 30 s
};
