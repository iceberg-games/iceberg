// Adapted copy for the playable game (src/games/snowconeTycoon): counter moved to z -4.3 so the
// player lane behind it is walkable, back bar split around the ice hopper, syrups re-spaced.
// Snowcone Plaza (set id `snowcone-plaza`, for GM1 game `snowcone-tycoon`): pure data (no THREE/DOM).
// Sunny frost boardwalk plaza with striped snowcone stand. GM hooks: SERVE_WINDOW, CUSTOMER_SLOTS (4), ICE_HOPPER,
// SYRUPS/FLAVORS, TOPPING_BAR, PLACE_SPOTS, UPGRADE_PADS, NEON_SIGN, QUEUE, SEATS, PLAYER_ZONE.
// Axes: +z = toward street/camera (south). Shop faces +z. Units ≈ meters.
export const BOUNDS = { minX: -30, maxX: 30, minZ: -26, maxZ: 30 };
export const SHOP = { x: 0, z: -10, w: 16, d: 9, h: 4.2, loftY: 4.4, roofY: 8.6 };   // main stand building
export const COUNTERS = [
  { id: 'main-counter', x: 0, z: -4.3, w: 10, d: 1.2, h: 1.1 },
  { id: 'kiosk-left', x: -16, z: 6, w: 3.2, d: 1.2, h: 1.1 },
  { id: 'kiosk-right', x: 16, z: 6, w: 3.2, d: 1.2, h: 1.1 },
];
export const CASH_REGISTER = { id: 'register', x: 3.6, y: 1.1, z: -4.3, facing: 0 };
export const STANDS = [
  { id: 'main-stand', name: 'Sugarfrost Stand', x: 0, z: -10, tier: 3 },
  { id: 'kiosk-left', name: 'Berry Kiosk', x: -16, z: 6, tier: 1 },
  { id: 'kiosk-right', name: 'Mint Kiosk', x: 16, z: 6, tier: 1 },
];
// flavors match the GM1 brief (day 1 = first 3). pattern = colorblind-safe shape hint for UI.
export const FLAVORS = [
  { id: 'blue-glacier', name: 'Blue Glacier', color: '#3fa7ff', pattern: 'stripe' },
  { id: 'cherry-freeze', name: 'Cherry Freeze', color: '#ff3d5e', pattern: 'dots' },
  { id: 'lime-frost', name: 'Lime Frost', color: '#7dff6b', pattern: 'swirl' },
  { id: 'grape-rime', name: 'Grape Rime', color: '#a45cff', pattern: 'zigzag' },
  { id: 'orange-slush', name: 'Orange Slush', color: '#ff9a2e', pattern: 'checker' },
  { id: 'vanilla-snow', name: 'Vanilla Snow', color: '#fff3d6', pattern: 'plain' },
];
export const SYRUPS = FLAVORS.map((f, i) => ({ ...f, x: [-4.2, -3.0, -1.8, 1.8, 3.0, 4.2][i], y: 1.1, z: -6.5, day: i < 3 ? 1 : i < 5 ? 2 : 3 }));
export const ICE_HOPPER = { id: 'ice-hopper', x: 0, y: 0, z: -7.9, useY: 1.4, note: 'chrome hopper w/ spinning blades (hold USE)' };
export const TOPPING_BAR = { id: 'topping-bar', x: -6.4, y: 0, z: -5.6, toppings: ['sprinkles', 'cherry', 'mini-marshmallow', 'candy-flake'], day: 2 };
export const SERVE_WINDOW = { id: 'serve-window', x: 0, y: 1.1, z: -4.3, w: 8, playerZ: -5.4, customerZ: -2.7 };
// 4 customer slots at the window (brief: queue up to 4). Facing -z (toward stand).
export const CUSTOMER_SLOTS = [-3, -1, 1, 3].map((x, i) => ({ id: `slot-${i}`, x, y: 0, z: -2.7, facing: Math.PI }));
export const PLAYER_ZONE = { minX: -4.5, maxX: 4.5, minZ: -7.2, maxZ: -4.9, y: 0.13, note: 'lane between counter and split back bar; hopper through the centre gap' };
export const NEON_SIGN = { x: 0, y: 11.4, z: -12, levels: 3 };
export const MACHINES = [   // starting shavers; middle one = ICE_HOPPER (chrome)
  { id: 'shaver-1', kind: 'shaver', x: -3.6, z: -7.9, level: 1 },
  { id: 'ice-hopper', kind: 'hopper', x: 0, z: -7.9, level: 2 },
  { id: 'shaver-3', kind: 'shaver', x: 3.6, z: -7.9, level: 3 },
];
// Machine floor: empty buy/place pads (GM: spawn machine on purchase)
export const PLACE_SPOTS = [0, 1, 2].flatMap(row => [-1, 1].map((s, si) => ({ id: `pad-${row}${si}`, x: s * 12.5, z: -14 + row * 3.4, kind: 'machine', price: 50 * (row + 1) * (si + 1) })));
export const UPGRADE_PADS = [
  { id: 'up-shaver', name: 'Faster Shavers', x: -10.5, z: 0.5, color: '#4ff0d0', price: 120 },
  { id: 'up-syrup', name: 'Rainbow Syrups', x: -7.5, z: 0.5, color: '#ff8fd0', price: 250 },
  { id: 'up-loft', name: 'Open the Loft', x: 7.5, z: 0.5, color: '#ffd36b', price: 500 },
  { id: 'up-patio', name: 'Bigger Patio', x: 10.5, z: 0.5, color: '#9b8cff', price: 800 },
];
// overflow line behind the 4 slots (snakes onto the boardwalk). facing toward stand (-z)
export const QUEUE = Array.from({ length: 8 }, (_, i) => ({ id: `q${i}`, x: i < 4 ? -1.2 : 1.2, z: -0.6 + (i % 4) * 1.2 + (i < 4 ? 0 : 0.6), facing: Math.PI }));
export const BOARDWALK = { minX: -26, maxX: 26, minZ: 3, maxZ: 10, plank: 0.5 };
export const RAILINGS = [ { from: [-26, 28], to: [26, 28] }, { from: [-28, -16], to: [-28, 26] }, { from: [28, -16], to: [28, 26] }, { from: [-26, 10.2], to: [-6, 10.2] }, { from: [6, 10.2], to: [26, 10.2] } ];
export const GLACIERS = [[-60, -70, 34, 30], [-20, -85, 48, 38], [30, -78, 40, 34], [70, -60, 30, 26], [-85, -20, 26, 22], [88, -15, 24, 20]].map(([x, z, h, r]) => ({ x, z, h, r }));
export const SEATS = [];   // patio tables
for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { const x = [-15, -10, 10, 15][c], z = 15 + r * 5; SEATS.push({ id: `table-${r}${c}`, x, z, chairs: 4, umbrella: ['#ff8fd0', '#4ff0d0', '#ffd36b', '#9b8cff'][(r + c) % 4] }); }
export const LOFT_SEATS = [-5, -2, 2, 5].map((x, i) => ({ id: `loft-${i}`, x, y: SHOP.loftY, z: -6.5 }));
export const ROOF_SEATS = [-4, 0, 4].map((x, i) => ({ id: `roof-${i}`, x, y: SHOP.roofY, z: -10 }));
export const STAIRS = { x: 9.4, z0: -4, z1: -13, y0: 0, y1: SHOP.loftY, w: 1.6 };   // outside stair up to loft
export const BARRELS = [[-9, -4.5], [-10.2, -3.4], [12.5, -2.8], [-21, 4], [21, 4], [-6, 9]].map(([x, z], i) => ({ id: `toppings-${i}`, x, z, topping: ['sprinkles', 'gummies', 'mochi', 'boba', 'cookie', 'pop rocks'][i] }));
export const LANTERNS = [[-8, 4], [8, 4], [-14, 11], [14, 11], [-20, 18], [20, 18], [-6, 22], [6, 22], [0, 12]];
export const FOUNTAIN = { x: 0, z: 13, r: 2.6 };
export const AREAS = [
  { id: 'boardwalk', name: 'Frost Boardwalk', shape: 'rect', minX: -26, maxX: 26, minZ: 3, maxZ: 10 },
  { id: 'lobby', name: 'Lobby Plaza', shape: 'rect', minX: -10, maxX: 10, minZ: 10, maxZ: 28 },
  { id: 'counter', name: 'Counter / Serve Window', shape: 'rect', minX: -6, maxX: 6, minZ: -5.2, maxZ: 3 },
  { id: 'kitchen', name: 'Shaver Kitchen', shape: 'rect', minX: -8, maxX: 8, minZ: -14.5, maxZ: -5.5 },
  { id: 'machine-floor', name: 'Machine Floor', shape: 'rect', minX: -16, maxX: 16, minZ: -18, maxZ: -6, note: 'side wings w/ PLACE_SPOTS' },
  { id: 'patio', name: 'Patio Seating', shape: 'rect', minX: -20, maxX: 20, minZ: 12, maxZ: 26 },
  { id: 'loft', name: 'Upstairs Loft', shape: 'rect', minX: -8, maxX: 8, minZ: -8, maxZ: -5, y: SHOP.loftY },
  { id: 'rooftop', name: 'Rooftop Sign Deck', shape: 'rect', minX: -7, maxX: 7, minZ: -14, maxZ: -6, y: SHOP.roofY },
];
export const ANCHORS = {
  spawn: { x: 0, y: 0, z: 26, facing: Math.PI },
  register: { x: CASH_REGISTER.x, y: 0, z: -3.4 },
  serveWindow: { x: 0, y: 0, z: -3.0 }, playerStation: { x: 0, y: 0, z: -6.2 }, iceHopper: { x: 0, y: 0, z: -6.8 }, boardwalk: { x: 0, y: 0, z: 6.5 },
  queueHead: { x: QUEUE[0].x, y: 0, z: QUEUE[0].z },
  fountain: { x: FOUNTAIN.x, y: 0, z: FOUNTAIN.z },
  stairBase: { x: STAIRS.x, y: 0, z: STAIRS.z0 },
  loft: { x: 0, y: SHOP.loftY, z: -6.5 },
  rooftop: { x: 0, y: SHOP.roofY, z: -10 },
  sign: { x: 0, y: SHOP.roofY + 3, z: -12 },
};
export const TRAILS = [
  { id: 'main-walk', pts: [[0, 26], [0, 17], [0, 9], [0, 2]] },
  { id: 'patio-loop', pts: [[-16, 13], [-16, 23], [16, 23], [16, 13], [-16, 13]] },
  { id: 'to-kiosks', pts: [[-16, 8], [0, 8], [16, 8]] },
  { id: 'to-loft', pts: [[0, 2], [9.2, -3], [9.2, -13], [0, -7]] },
];
export const SPAWN = ANCHORS.spawn;
export function floorHeight(x, z) {   // walkable surface incl. stairs
  if (Math.abs(x - STAIRS.x) < STAIRS.w / 2 && z < STAIRS.z0 && z > STAIRS.z1) return STAIRS.y1 * (STAIRS.z0 - z) / (STAIRS.z0 - STAIRS.z1);
  return groundHeight(x, z);
}
export function groundHeight(x, z) {
  const r = Math.hypot(x, z - 4);
  return r > 30 ? Math.min(3, (r - 30) * 0.2) : 0;
}
export const areaAt = (x, z) => AREAS.slice().sort((a, b) => (a.maxX - a.minX) * (a.maxZ - a.minZ) - (b.maxX - b.minX) * (b.maxZ - b.minZ)).find(a => !a.y && x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ)?.id ?? null;

export const BACK_BARS = [{ x0: -4.9, x1: -1.1, z: -6.5, d: 0.9 }, { x0: 1.1, x1: 4.9, z: -6.5, d: 0.9 }];
export const TRASH = { x: 6.4, z: -5.6 };
