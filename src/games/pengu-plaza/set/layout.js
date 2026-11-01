// Pengu Plaza bones (set id `pengu-plaza`): pure data, MIRRORS GM2's game config
// (/workspace/bw-pengu-plaza/src/games/pengu-plaza/config.js — GM2 owns the playable game + its own plaza).
// Values copied, not imported, so this filming set never couples to GM2's module. Keep in sync by hand.
export const PLAZA_R = 34;
export const RINK = { x: 0, z: -16, rx: 11, rz: 7 };
export const COCOA = { x: 14, z: 6 };
export const BELL = { x: 0, z: 2 };
export const SPAWN = { x: 0, z: 22, facing: Math.PI };
export const SEATS = [
  { x: -9, z: 8, rot: Math.PI / 2 }, { x: -9, z: 11, rot: Math.PI / 2 },
  { x: 9, z: 12, rot: -Math.PI / 2 }, { x: -14, z: -4, rot: Math.PI / 2 },
  { x: 18, z: -6, rot: -Math.PI / 2 }, { x: -3, z: 6.2, rot: Math.PI }, { x: 3, z: 6.2, rot: Math.PI },
];
export const PHOTO_SPOTS = [
  { id: 'fountain', name: 'Frost Fountain', x: 0, z: 11, look: [0, 3, 2] },
  { id: 'arch', name: 'Aurora Arch', x: 0, z: 30, look: [0, 5, 33] },
  { id: 'iceberg', name: 'Giant Ice Pengu', x: -22, z: -18, look: [-25, 6, -22] },
  { id: 'rink', name: 'Rinkside', x: 12, z: -22, look: [0, 1, -16] },
  { id: 'lantern', name: 'Lantern Lane', x: 22, z: 16, look: [26, 3, 20] },
];
// set-only extras (filming): prop positions implied by photo spot look targets + penguin NPC stand points (GM2 NPC_COUNT = 9)
export const PROPS = { fountain: { x: 0, z: 6 }, arch: { x: 0, z: 33 }, icePengu: { x: -25, z: -22 }, lanternLane: { x: 26, z: 20 } };
export const NPC_POINTS = [[-6, -14], [5, -18], [0, -11], [14, 4.8], [-9, 9.5], [6, 16], [-16, 2], [18, -2], [-4, 24]]
  .map(([x, z], i) => ({ id: `pengu-${i}`, x, z, facing: Math.atan2(-x, 6 - z), pose: ['skate', 'skate', 'skate', 'cocoa', 'sit', 'wave', 'idle', 'idle', 'dance'][i] }));
export const AREAS = [
  { id: 'plaza', name: 'Pengu Plaza', shape: 'circle', x: 0, z: 0, r: PLAZA_R },
  { id: 'rink', name: 'Ice Rink', shape: 'ellipse', x: RINK.x, z: RINK.z, rx: RINK.rx, rz: RINK.rz },
  { id: 'cocoa', name: 'Cocoa Stand', shape: 'circle', x: COCOA.x, z: COCOA.z, r: 4 },
];
export const ANCHORS = { spawn: SPAWN, cocoa: COCOA, bell: BELL, rinkCenter: { x: RINK.x, z: RINK.z }, ...Object.fromEntries(PHOTO_SPOTS.map(p => [`photo_${p.id}`, p])) };
export const TRAILS = [{ id: 'loop', pts: [[0, 22], [14, 10], [12, -22], [-22, -18], [-14, 4], [0, 22]] }];
export const BOUNDS = { minX: -PLAZA_R, maxX: PLAZA_R, minZ: -PLAZA_R, maxZ: PLAZA_R };
export const groundHeight = (x, z) => { const r = Math.hypot(x, z); return r > PLAZA_R ? Math.min(4, (r - PLAZA_R) * 0.25) : 0; };
