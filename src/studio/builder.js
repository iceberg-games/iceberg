// Offline Studio builder: spawn real part groups from templates/keywords.
// Pure planning (no editor, no network). applyBuild() talks to the editor API
// so a whole build is one undoable action.
import { translate } from './nlscript.js';

const nid = (p = 'i') => p + '_' + Math.random().toString(36).slice(2, 10);

/** Plain instance JSON (no three.js), matching makeInstance() defaults. */
export function inst(type, over = {}) {
  const base = { id: nid(), type, name: 'Part', pos: [0, 0.5, 0], rot: [0, 0, 0], size: [1, 1, 1], color: '#bfe9ff', material: 'plastic', transparency: 0, collide: true, anchored: true, kill: false, scripts: [] };
  const per = {
    part: { shape: 'box', size: [4, 1, 2], color: '#a3a2a5', name: 'Part' },
    coin: { size: [1, 1, 1], color: '#ffd34d', collide: false, pos: [0, 1.2, 0], value: 5, name: 'Coin' },
    checkpoint: { size: [4, 0.4, 4], color: '#2f9e6a', pos: [0, 0.2, 0], order: 1, name: 'Checkpoint' },
    group: { size: [1, 1, 1], name: 'Model', collide: false },
    spawn: { size: [4, 0.4, 4], color: '#3f9de0', pos: [0, 0.2, 0], name: 'SpawnLocation' },
  }[type] || {};
  return JSON.parse(JSON.stringify({ ...base, ...per, ...over, id: over.id || base.id }));
}

const script = (text) => {
  const r = translate(text);
  return { id: nid('s'), name: 'Script', text, program: r.program, enabled: true };
};

const DEFAULTS = {
  house: { width: 12, length: 12, height: 6 },
  building: { width: 14, length: 12, height: 4, stories: 3 },
  tower: { width: 4, length: 4, height: 10 },
  bridge: { width: 4, length: 20, height: 0.6 },
  coins: { count: 5, spacing: 3 },
  checkpoint: {},
  wall: { width: 1, length: 12, height: 6 },
  platform: { width: 8, length: 8, height: 1 },
  stairs: { width: 4, steps: 6, rise: 1, run: 2 },
  shop: { width: 8, length: 6, height: 4 },
  fence: { width: 16, length: 16, height: 3 },
  ladder: { width: 2, length: 0.4, height: 12 },
  tree: { width: 2, height: 8 },
  lamp: { height: 10 },
  car: { width: 3, length: 7, height: 1.4 },
  obby: { count: 10, spacing: 8, width: 4 },
  maze: { width: 7, height: 5, count: 7 },
  arena: { width: 30, length: 30, height: 6 },
  town: {},
  fountain: {},
};

function dims(intent) {
  const d = { ...(DEFAULTS[intent.template] || {}) };
  const s = intent.scale && intent.scale !== 1 ? intent.scale : 1;
  if (intent.width != null) d.width = intent.width;
  if (intent.length != null) d.length = intent.length;
  if (intent.height != null) d.height = intent.height;
  if (intent.count != null) d.count = intent.count;
  if (intent.template === 'stairs' && intent.height != null) d.steps = Math.max(2, Math.round(intent.height));
  if (intent.stories != null) d.stories = intent.stories;
  if (intent.material) d.material = intent.material;
  if (intent.city) d.city = true;
  if (s !== 1) {
    for (const k of ['width', 'length', 'height', 'spacing', 'rise', 'run']) if (d[k]) d[k] = Math.max(0.5, +(d[k] * s).toFixed(2));
  }
  return d;
}

const part = (over) => inst('part', over);

function offsetAll(list, origin) {
  const [ox, oy, oz] = origin || [0, 0, 0];
  for (const inst of list) inst.pos = [+(inst.pos[0] + ox).toFixed(3), +(inst.pos[1] + oy).toFixed(3), +(inst.pos[2] + oz).toFixed(3)];
  return list;
}

function paint(list, color, skipTypes = new Set(['coin', 'checkpoint', 'spawn']), material = null) {
  for (const inst of list) {
    if (skipTypes.has(inst.type)) continue;
    if (color) inst.color = color;
    if (material) inst.material = material;
  }
  return list;
}

function house(d, color) {
  const w = d.width, l = d.length, h = d.height, t = 1;
  const yFloor = 0.5, yWall = yFloor + 0.5 + h / 2;
  const doorW = Math.min(3, Math.max(2, w * 0.25));
  const side = (w - doorW) / 2;
  const list = [
    part({ name: 'HouseFloor', pos: [0, yFloor, 0], size: [w, 1, l], color: color || '#8a5a34', material: 'wood' }),
    part({ name: 'HouseWallBack', pos: [0, yWall, -l / 2 + t / 2], size: [w, h, t], color: color || '#c9d1d9' }),
    part({ name: 'HouseWallLeft', pos: [-w / 2 + t / 2, yWall, 0], size: [t, h, l - 2 * t], color: color || '#c9d1d9' }),
    part({ name: 'HouseWallRight', pos: [w / 2 - t / 2, yWall, 0], size: [t, h, l - 2 * t], color: color || '#c9d1d9' }),
  ];
  const leftX = -w / 2 + t + side / 2;
  const rightX = w / 2 - t - side / 2;
  if (side > 0.6) {
    list.push(part({ name: 'HouseWallFrontL', pos: [leftX, yWall, l / 2 - t / 2], size: [side, h, t], color: color || '#c9d1d9' }));
    list.push(part({ name: 'HouseWallFrontR', pos: [rightX, yWall, l / 2 - t / 2], size: [side, h, t], color: color || '#c9d1d9' }));
  }
  const lintelH = Math.max(1, h * 0.25);
  list.push(part({ name: 'HouseDoorLintel', pos: [0, yFloor + 0.5 + h - lintelH / 2, l / 2 - t / 2], size: [doorW, lintelH, t], color: color || '#c9d1d9' }));
  list.push(part({ name: 'HouseRoof', shape: 'wedge', pos: [0, yFloor + 0.5 + h + 1, 0], size: [w + 1, 2, l + 1], color: color || '#7a1f2b', material: 'wood' }));
  const doorH = Math.max(3, h * 0.7), doorY = yFloor + 0.5 + doorH / 2;
  list.push(part({ name: 'HouseDoor', pos: [0, doorY, l / 2 - t / 2 - 0.15], size: [Math.max(1.6, doorW * 0.7), doorH, 0.3], color: '#8a5a34', material: 'wood' }));
  const winW = Math.min(2, w * 0.2), winH = Math.min(2, h * 0.35), winY = yFloor + 0.5 + h * 0.55;
  list.push(part({ name: 'HouseWindowL', pos: [-w / 2 + t / 2 + 0.05, winY, -l * 0.2], size: [0.2, winH, winW], color: '#9fd3f5', material: 'glass' }));
  list.push(part({ name: 'HouseWindowR', pos: [w / 2 - t / 2 - 0.05, winY, -l * 0.2], size: [0.2, winH, winW], color: '#9fd3f5', material: 'glass' }));
  list.push(part({ name: 'HouseWindowF', pos: [-w * 0.28, winY, l / 2 - t / 2 + 0.05], size: [winW, winH, 0.2], color: '#9fd3f5', material: 'glass' }));
  return list;
}

function tower(d, color) {
  const w = d.width, l = d.length, h = d.height;
  const floors = Math.max(1, Math.round(h / 2));
  const segH = h / floors;
  const list = [];
  for (let i = 0; i < floors; i++) {
    const shrink = i === floors - 1 ? 0.7 : 1;
    list.push(part({
      name: i === floors - 1 ? 'TowerCap' : `TowerLevel${i + 1}`,
      pos: [0, segH / 2 + i * segH, 0],
      size: [w * shrink, segH, l * shrink],
      color: color || (i % 2 ? '#a3a2a5' : '#8a96a3'),
    }));
  }
  return list;
}

function bridge(d, color) {
  const w = d.width, l = d.length, th = Math.max(0.4, d.height || 0.6);
  const y = th / 2;
  const railH = 1.2;
  const c = color || '#8a96a3';
  return [
    part({ name: 'BridgeDeck', pos: [0, y, 0], size: [w, th, l], color: c, material: 'wood' }),
    part({ name: 'BridgeRailL', pos: [-w / 2 + 0.15, y + th / 2 + railH / 2, 0], size: [0.3, railH, l], color: c }),
    part({ name: 'BridgeRailR', pos: [w / 2 - 0.15, y + th / 2 + railH / 2, 0], size: [0.3, railH, l], color: c }),
  ];
}

function coins(d) {
  const n = d.count || 5, gap = d.spacing || 3;
  const list = [];
  const start = -((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) list.push(inst('coin', { name: n === 1 ? 'Coin' : `Coin${i + 1}`, pos: [start + i * gap, 1.2, 0] }));
  return list;
}

function checkpoints(d) {
  const n = d.count || 1, gap = d.spacing || 8;
  const list = [];
  const start = -((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) list.push(inst('checkpoint', { name: n === 1 ? 'Checkpoint' : `Checkpoint${i + 1}`, pos: [start + i * gap, 0.2, 0], order: i + 1 }));
  return list;
}

function wall(d, color) {
  return [part({ name: 'Wall', pos: [0, d.height / 2, 0], size: [d.length, d.height, d.width], color: color || '#a3a2a5' })];
}

function platform(d, color) {
  return [part({ name: 'Platform', pos: [0, d.height / 2, 0], size: [d.width, d.height, d.length], color: color || '#a3a2a5' })];
}

function stairs(d, color) {
  const list = [];
  const c = color || '#8a96a3';
  for (let i = 0; i < d.steps; i++) {
    list.push(part({
      name: `Stair${i + 1}`,
      pos: [0, d.rise / 2 + i * d.rise, i * d.run],
      size: [d.width, d.rise, d.run],
      color: c,
    }));
  }
  return list;
}


function building(d, color) {
  const stories = Math.max(1, Math.round(d.stories || 3));
  const w = d.width, l = d.length, storyH = d.height || 4;
  const t = 1, list = [];
  const wallC = color || '#c9d1d9', floorC = color || '#8a96a3';
  for (let s = 0; s < stories; s++) {
    const y0 = s * storyH;
    list.push(part({ name: `BuildingFloor${s + 1}`, pos: [0, y0 + 0.25, 0], size: [w, 0.5, l], color: floorC, material: 'wood' }));
    const yWall = y0 + 0.5 + (storyH - 0.5) / 2, h = storyH - 0.5;
    list.push(part({ name: `BuildingWallB${s + 1}`, pos: [0, yWall, -l / 2 + t / 2], size: [w, h, t], color: wallC }));
    list.push(part({ name: `BuildingWallL${s + 1}`, pos: [-w / 2 + t / 2, yWall, 0], size: [t, h, l - 2 * t], color: wallC }));
    list.push(part({ name: `BuildingWallR${s + 1}`, pos: [w / 2 - t / 2, yWall, 0], size: [t, h, l - 2 * t], color: wallC }));
    const doorW = s === 0 ? 2.4 : 0;
    const side = (w - (doorW || 2.2)) / 2;
    list.push(part({ name: `BuildingWallFL${s + 1}`, pos: [-w / 2 + t + side / 2, yWall, l / 2 - t / 2], size: [side, h, t], color: wallC }));
    list.push(part({ name: `BuildingWallFR${s + 1}`, pos: [w / 2 - t - side / 2, yWall, l / 2 - t / 2], size: [side, h, t], color: wallC }));
    if (s === 0) list.push(part({ name: 'BuildingDoor', pos: [0, 0.5 + 2, l / 2 - t / 2 - 0.15], size: [1.8, 4, 0.3], color: '#8a5a34', material: 'wood' }));
    const winY = y0 + storyH * 0.55;
    list.push(part({ name: `BuildingWindowL${s + 1}`, pos: [-w / 2 + t / 2 + 0.05, winY, 0], size: [0.2, 1.6, 2], color: '#9fd3f5', material: 'glass' }));
    list.push(part({ name: `BuildingWindowR${s + 1}`, pos: [w / 2 - t / 2 - 0.05, winY, 0], size: [0.2, 1.6, 2], color: '#9fd3f5', material: 'glass' }));
  }
  list.push(part({ name: 'BuildingRoof', shape: 'wedge', pos: [0, stories * storyH + 1, 0], size: [w + 1, 2, l + 1], color: color || '#7a1f2b', material: 'wood' }));
  return list;
}

function shop(d, color) {
  const w = d.width, l = d.length, h = d.height;
  const c = color || '#c98a2a';
  return [
    part({ name: 'ShopFloor', pos: [0, 0.25, 0], size: [w, 0.5, l], color: '#8a5a34', material: 'wood' }),
    part({ name: 'ShopCounter', pos: [0, 1.2, l / 2 - 0.6], size: [w - 1, 1.4, 1.2], color: c, material: 'wood' }),
    part({ name: 'ShopBack', pos: [0, h / 2 + 0.25, -l / 2 + 0.4], size: [w, h, 0.8], color: c, material: 'wood' }),
    part({ name: 'ShopCanopy', pos: [0, h + 0.4, 0.4], size: [w + 1.5, 0.4, l + 1], color: color || '#e2474b' }),
    part({ name: 'ShopPostL', shape: 'cylinder', pos: [-w / 2 + 0.4, h / 2, l / 2 - 0.3], size: [0.4, h, 0.4], color: '#8a5a34', material: 'wood' }),
    part({ name: 'ShopPostR', shape: 'cylinder', pos: [w / 2 - 0.4, h / 2, l / 2 - 0.3], size: [0.4, h, 0.4], color: '#8a5a34', material: 'wood' }),
  ];
}

function fence(d, color, around) {
  const b = aabbOf(around) || { min: [-(d.width || 16) / 2, 0, -(d.length || 16) / 2], max: [(d.width || 16) / 2, 0, (d.length || 16) / 2] };
  const pad = 1.2, h = d.height || 3, t = 0.35, c = color || '#8a5a34';
  const x0 = b.min[0] - pad, x1 = b.max[0] + pad, z0 = b.min[2] - pad, z1 = b.max[2] + pad;
  const midY = h / 2;
  const list = [
    part({ name: 'FenceNorth', pos: [(x0 + x1) / 2, midY, z1], size: [x1 - x0, h, t], color: c, material: 'wood' }),
    part({ name: 'FenceSouth', pos: [(x0 + x1) / 2, midY, z0], size: [x1 - x0, h, t], color: c, material: 'wood' }),
    part({ name: 'FenceWest', pos: [x0, midY, (z0 + z1) / 2], size: [t, h, z1 - z0 - 2 * t], color: c, material: 'wood' }),
    part({ name: 'FenceEast', pos: [x1, midY, (z0 + z1) / 2], size: [t, h, z1 - z0 - 2 * t], color: c, material: 'wood' }),
  ];
  for (const [name, x, z] of [['FencePostNW', x0, z1], ['FencePostNE', x1, z1], ['FencePostSW', x0, z0], ['FencePostSE', x1, z0]]) {
    list.push(part({ name, shape: 'cylinder', pos: [x, midY, z], size: [0.5, h + 0.4, 0.5], color: c, material: 'wood' }));
  }
  return list;
}

function ladder(d, color) {
  const h = d.height || 12, w = d.width || 2;
  const list = [part({ name: 'LadderRailL', pos: [-w / 2, h / 2, 0], size: [0.2, h, 0.2], color: color || '#8a96a3', material: 'metal' }),
    part({ name: 'LadderRailR', pos: [w / 2, h / 2, 0], size: [0.2, h, 0.2], color: color || '#8a96a3', material: 'metal' })];
  const rungs = Math.max(4, Math.round(h / 1.2));
  for (let i = 0; i < rungs; i++) {
    const y = 0.6 + i * (h - 0.8) / (rungs - 1);
    list.push(part({ name: `LadderRung${i + 1}`, pos: [0, y, 0], size: [w, 0.15, 0.3], color: color || '#8a96a3', material: 'metal' }));
  }
  return list;
}

function tree(d, color) {
  const h = d.height || 8, trunkR = Math.max(0.6, (d.width || 2) * 0.5);
  const trunkH = h * 0.45;
  const leafC = color || '#2f9e6a';
  return [
    part({ name: 'TreeTrunk', shape: 'cylinder', pos: [0, trunkH / 2, 0], size: [trunkR, trunkH, trunkR], color: '#8a5a34', material: 'wood' }),
    part({ name: 'TreeLeaves', shape: 'sphere', pos: [0, trunkH + h * 0.28, 0], size: [h * 0.7, h * 0.6, h * 0.7], color: leafC }),
    part({ name: 'TreeLeaves2', shape: 'sphere', pos: [h * 0.15, trunkH + h * 0.15, h * 0.1], size: [h * 0.45, h * 0.4, h * 0.45], color: leafC }),
  ];
}

function lamp(d, color) {
  const h = d.height || 10;
  return [
    part({ name: 'LampBase', shape: 'cylinder', pos: [0, 0.3, 0], size: [1.6, 0.6, 1.6], color: '#5b6b7a', material: 'metal' }),
    part({ name: 'LampPole', shape: 'cylinder', pos: [0, h / 2, 0], size: [0.4, h, 0.4], color: color || '#5b6b7a', material: 'metal' }),
    part({ name: 'LampLight', shape: 'sphere', pos: [0, h + 0.6, 0], size: [1.6, 1.6, 1.6], color: '#fff6b0', material: 'neon' }),
  ];
}

function car(d, color) {
  const w = d.width || 3, l = d.length || 7, h = d.height || 1.4, c = color || '#e2474b';
  const wheel = (name, x, z) => part({ name, shape: 'cylinder', pos: [x, 0.55, z], rot: [0, 0, Math.PI / 2], size: [1.1, 0.5, 1.1], color: '#22262e', material: 'metal' });
  return [
    part({ name: 'CarBody', pos: [0, 1.0, 0], size: [w, h, l], color: c }),
    part({ name: 'CarCabin', pos: [0, 1.0 + h * 0.7, -l * 0.08], size: [w * 0.85, h * 0.7, l * 0.45], color: '#9fd3f5', material: 'glass' }),
    wheel('CarWheelFL', -w / 2, l * 0.3), wheel('CarWheelFR', w / 2, l * 0.3),
    wheel('CarWheelBL', -w / 2, -l * 0.3), wheel('CarWheelBR', w / 2, -l * 0.3),
  ];
}

function obby(d) {
  const n = Math.max(3, Math.min(20, d.count || 10));
  const gap = d.spacing || 8, w = d.width || 4;
  const colors = ['#e2474b', '#ff8c2a', '#f5c542', '#2f9e6a', '#3f8fd0', '#8b6cf0'];
  const list = [part({ name: 'ObbyStart', pos: [0, 6, 0], size: [6, 1, 6], color: '#2f9e6a' })];
  for (let i = 0; i < n; i++) {
    const x = ((i % 2) * 2 - 1) * 2.5;
    const y = 6 + i * 0.6;
    const z = 8 + i * gap;
    list.push(part({ name: `ObbyJump${i + 1}`, pos: [x, y, z], size: [w, 1, w], color: colors[i % colors.length] }));
  }
  const last = list[list.length - 1];
  list.push(inst('checkpoint', { name: 'ObbyFinish', pos: [0, last.pos[1], last.pos[2] + gap], order: 1 }));
  list.push(part({ name: 'ObbyGoal', pos: [0, last.pos[1], last.pos[2] + gap], size: [6, 1, 6], color: '#f2c230', material: 'neon', scripts: [script('When touched, you win and play a win sound')] }));
  return list;
}

function maze(d, color) {
  // Odd grid of cells; 1 = wall. Deterministic DFS so the same size always matches.
  const cells = Math.max(3, Math.min(9, Math.round(d.width || d.count || 7)));
  const n = cells % 2 ? cells : cells + 1;
  const grid = Array.from({ length: n }, () => Array(n).fill(1));
  const stack = [[1, 1]];
  grid[1][1] = 0;
  const dirs = [[0, 2], [2, 0], [0, -2], [-2, 0]];
  const hash = (x, y, i) => (x * 17 + y * 31 + i * 13 + n * 7) % 4;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const order = [0, 1, 2, 3].sort((a, b) => hash(cx, cy, a) - hash(cx, cy, b));
    let carved = false;
    for (const k of order) {
      const [dx, dy] = dirs[k], nx = cx + dx, ny = cy + dy;
      if (nx <= 0 || ny <= 0 || nx >= n - 1 || ny >= n - 1 || grid[ny][nx] === 0) continue;
      grid[cy + dy / 2][cx + dx / 2] = 0;
      grid[ny][nx] = 0;
      stack.push([nx, ny]);
      carved = true;
      break;
    }
    if (!carved) stack.pop();
  }
  grid[1][0] = 0; grid[n - 2][n - 1] = 0;
  const cell = 4, t = 1.2, h = d.height || 5, c = color || '#8a96a3';
  const list = [part({ name: 'MazeFloor', pos: [0, 0.25, 0], size: [n * cell, 0.5, n * cell], color: '#6b737c' })];
  let k = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (grid[y][x]) {
    k++;
    list.push(part({ name: `MazeWall${k}`, pos: [(x - (n - 1) / 2) * cell, h / 2 + 0.5, (y - (n - 1) / 2) * cell], size: [cell, h, cell], color: c }));
  }
  return list;
}

function arena(d, color) {
  const w = d.width || 30, l = d.length || 30, h = d.height || 6, t = 1.2, c = color || '#a3a2a5';
  return [
    part({ name: 'ArenaFloor', pos: [0, 0.4, 0], size: [w, 0.8, l], color: c }),
    part({ name: 'ArenaWallN', pos: [0, h / 2 + 0.4, l / 2 - t / 2], size: [w, h, t], color: c }),
    part({ name: 'ArenaWallS', pos: [0, h / 2 + 0.4, -l / 2 + t / 2], size: [w, h, t], color: c }),
    part({ name: 'ArenaWallW', pos: [-w / 2 + t / 2, h / 2 + 0.4, 0], size: [t, h, l - 2 * t], color: c }),
    part({ name: 'ArenaWallE', pos: [w / 2 - t / 2, h / 2 + 0.4, 0], size: [t, h, l - 2 * t], color: c }),
  ];
}

function fountain(d, color) {
  const c = color || '#5cc3f0';
  return [
    part({ name: 'FountainBasin', shape: 'cylinder', pos: [0, 0.4, 0], size: [10, 0.8, 10], color: '#aab4be', material: 'metal' }),
    part({ name: 'FountainWater', shape: 'cylinder', pos: [0, 0.85, 0], size: [8.4, 0.5, 8.4], color: c, material: 'glass' }),
    part({ name: 'FountainPillar', shape: 'cylinder', pos: [0, 2.2, 0], size: [1.2, 3, 1.2], color: '#aab4be', material: 'metal' }),
    part({ name: 'FountainBowl', shape: 'cylinder', pos: [0, 3.8, 0], size: [3.8, 0.5, 3.8], color: '#aab4be', material: 'metal' }),
    part({ name: 'FountainSpray', shape: 'sphere', pos: [0, 4.8, 0], size: [1.6, 1.8, 1.6], color: c, material: 'glass' }),
  ];
}

/** A small town: main road + two cross roads, a shop, houses (taller buildings for a city), trees, lamp posts and a fountain. */
function town(d, color) {
  const out = [];
  const add = (prefix, list, at) => {
    for (const p of list) p.name = `${prefix}_${p.name}`;
    offsetAll(list, at);
    out.push(...list);
  };
  const houseD = { width: 12, length: 12, height: 6 };
  const row = d.city ? building : house;
  const rowD = d.city ? { width: 14, length: 12, height: 4, stories: 3 } : houseD;
  const cols = ['#d9534f', '#e0a33a', '#4f9bd9', '#6bbf6b'];
  const roadC = '#4a4f57';
  add('Road', [part({ name: 'Main', pos: [0, 0.1, 0], size: [76, 0.2, 8], color: roadC, material: 'plastic', collide: true })], [0, 0, 0]);
  add('Road', [part({ name: 'CrossWest', pos: [0, 0.12, 0], size: [6, 0.2, 76], color: roadC })], [-34, 0, 0]);
  add('Road', [part({ name: 'CrossEast', pos: [0, 0.12, 0], size: [6, 0.2, 76], color: roadC })], [34, 0, 0]);
  add('Shop', shop({ width: 8, length: 6, height: 4 }, null), [0, 0, -14]);
  add('Fountain', fountain(d), [0, 0, 14]);
  add('House1', row(rowD, color || cols[0]), [-14, 0, -14]);
  add('House2', row(rowD, color || cols[1]), [14, 0, -14]);
  add('House3', row(rowD, color || cols[2]), [-14, 0, 14]);
  add('House4', row(rowD, color || cols[3]), [14, 0, 14]);
  [[-25, -26], [25, -26], [-25, 26], [25, 26]].forEach(([x, z], i) => add(`Tree${i + 1}`, tree({ height: 7, width: 2 }), [x, 0, z]));
  [[-24, 5.5], [-8, -5.5], [8, 5.5], [24, -5.5]].forEach(([x, z], i) => add(`Lamp${i + 1}`, lamp({ height: 9 }), [x, 0, z]));
  return out;
}

const MAKERS = { town, fountain, house, building, tower, bridge, coins, checkpoint: checkpoints, wall, platform, stairs, shop, fence, ladder, tree, lamp, car, obby, maze, arena };

const LABELS = {
  house: 'house', building: 'building', tower: 'tower', bridge: 'bridge', coins: 'coins',
  checkpoint: 'checkpoint', wall: 'wall', platform: 'platform', stairs: 'stairs',
  shop: 'shop stand', fence: 'fence', ladder: 'ladder', tree: 'tree', lamp: 'lamp post',
  car: 'car', obby: 'obby', maze: 'maze', arena: 'arena', town: 'town', fountain: 'fountain',
};


/** Axis-aligned bounds of placed instances (groups skipped). */
export function aabbOf(instances) {
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let any = false;
  for (const i of instances || []) {
    if (!i || i.type === 'group' || !i.pos || !i.size) continue;
    any = true;
    const [x, y, z] = i.pos, [sx, sy, sz] = i.size;
    min = [Math.min(min[0], x - sx / 2), Math.min(min[1], y - sy / 2), Math.min(min[2], z - sz / 2)];
    max = [Math.max(max[0], x + sx / 2), Math.max(max[1], y + sy / 2), Math.max(max[2], z + sz / 2)];
  }
  return any ? { min, max } : null;
}

export function aabbsOverlap(a, b, pad = 0.5) {
  if (!a || !b) return false;
  return a.min[0] < b.max[0] + pad && a.max[0] > b.min[0] - pad
    && a.min[1] < b.max[1] + pad && a.max[1] > b.min[1] - pad
    && a.min[2] < b.max[2] + pad && a.max[2] > b.min[2] - pad;
}

function shiftAabb(b, d) {
  return { min: b.min.map((v, i) => v + d[i]), max: b.max.map((v, i) => v + d[i]) };
}

/** Origin that centers the local build on a world XZ point, sitting on y=0. */
export function originAtPoint(local, point) {
  const L = aabbOf(local);
  if (!L || !point) return [0, 0, 0];
  const cx = (L.min[0] + L.max[0]) / 2, cz = (L.min[2] + L.max[2]) / 2;
  return [+(point[0] - cx).toFixed(3), 0, +(point[2] - cz).toFixed(3)];
}

/** Origin that parks the local build just beside a neighbor group (+X). */
export function originBeside(local, neighbor, gap = 1.5) {
  const L = aabbOf(local), N = aabbOf(neighbor);
  if (!L || !N) return [0, 0, 0];
  const cz = (N.min[2] + N.max[2]) / 2 - (L.min[2] + L.max[2]) / 2;
  return [+(N.max[0] + gap - L.min[0]).toFixed(3), 0, +cz.toFixed(3)];
}

/**
 * Slide a preferred origin on the XZ plane until the local build no longer
 * overlaps existing parts. Never returns an overlapping origin when a free
 * ring slot exists (up to 12 rings).
 */
export function nextFreeOrigin(local, existing, preferred = [0, 0, 0], pad = 1) {
  const L = aabbOf(local);
  if (!L) return preferred;
  const others = aabbOf((existing || []).filter((i) => i && i.type !== 'group' && i.type !== 'spawn'));
  const stepX = Math.max(4, (L.max[0] - L.min[0]) + pad * 2);
  const stepZ = Math.max(4, (L.max[2] - L.min[2]) + pad * 2);
  const pref = [preferred[0] || 0, preferred[1] || 0, preferred[2] || 0];
  const tryAt = (o) => !others || !aabbsOverlap(shiftAabb(L, o), others, pad);
  if (tryAt(pref)) return pref;
  for (let ring = 1; ring <= 12; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dz = -ring; dz <= ring; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const o = [pref[0] + dx * stepX, pref[1], pref[2] + dz * stepZ];
        if (tryAt(o)) return o;
      }
    }
  }
  return [pref[0] + stepX * 13, pref[1], pref[2]];
}

/** Preferred origin: beside the selection if any, else a look/front point, then the next free slot. */
export function resolveBuildOrigin(local, { existing = [], selection = [], lookPoint = null, origin = null } = {}) {
  const sel = (selection || []).filter((i) => i && i.type !== 'group');
  let preferred;
  if (sel.length) preferred = originBeside(local, sel);
  else if (lookPoint) preferred = originAtPoint(local, lookPoint);
  else preferred = origin || [0, 0, 0];
  return nextFreeOrigin(local, existing, preferred);
}

/**
 * Plan a build (no editor mutation).
 * @param {object} intent classifyIntent() build result
 * @param {{ origin?: number[] }} [ctx]
 */
export function planBuild(intent, ctx = {}) {
  const template = intent.template;
  const maker = MAKERS[template];
  if (!maker) return { ok: false, reason: 'unknown-template', instances: [] };
  const d = dims(intent);
  let instances = maker.length >= 3 ? maker(d, intent.color, ctx.around) : maker(d, intent.color);
  if ((intent.color || intent.material) && template !== 'coins' && template !== 'checkpoint' && template !== 'town') paint(instances, intent.color, undefined, intent.material);
  const origin = (ctx.existing || ctx.selection || ctx.lookPoint)
    ? resolveBuildOrigin(instances, ctx)
    : (ctx.origin || [0, 0, 0]);
  offsetAll(instances, origin);
  const label = LABELS[template] || template;
  const bits = [];
  if (template === 'coins') bits.push(`${d.count} coin${d.count === 1 ? '' : 's'}${intent.line || d.count > 1 ? ' in a line' : ''}`);
  else if (template === 'tower') bits.push(`a tower ${d.height} high`);
  else if (template === 'town') bits.push(intent.city ? 'a little city' : 'a little town');
  else if (template === 'house') bits.push(intent.scale < 1 ? 'a small house' : intent.scale > 1 ? 'a large house' : 'a house');
  else if (template === 'building') bits.push(`a ${d.stories || 3} story building`);
  else if (template === 'obby') bits.push(`a ${d.count} jump obby`);
  else if (template === 'bridge') bits.push(`a bridge ${d.length} long`);
  else if (template === 'checkpoint') bits.push(d.count > 1 ? `${d.count} checkpoints` : 'a checkpoint');
  else if (template === 'fence' && ctx.around) bits.push('a fence around the selection');
  else bits.push(`a ${label}`);
  if (intent.colorName) bits.push(`in ${intent.colorName}`);
  if (intent.material) bits.push(`of ${intent.material}`);
  return {
    ok: true,
    template,
    dims: d,
    groupName: template === 'coins' ? 'Coins' : template[0].toUpperCase() + template.slice(1),
    summary: bits.join(' '),
    instances,
    origin,
  };
}

/**
 * Insert a planned build as one undoable editor action.
 * Requires ed.checkpoint, ed.doc, and ed.insertMany (or the fallback below).
 */
export function applyBuild(ed, plan) {
  if (!plan?.ok || !plan.instances?.length) return { ok: false, ids: [] };
  if (typeof ed.insertMany === 'function') {
    const out = ed.insertMany(plan.instances, { groupName: plan.instances.length > 1 ? plan.groupName : null });
    if (out?.ok) ed.lastBuild = { ids: out.ids, groupId: out.groupId, template: plan.template, summary: plan.summary };
    return out;
  }
  // Fallback used by unit tests / minimal editors
  ed.checkpoint?.();
  const ids = [];
  for (const inst of plan.instances) {
    ed.doc.instances.push(inst);
    ids.push(inst.id);
  }
  if (plan.instances.length > 1 && typeof ed.group === 'function') ed.group(ids, plan.groupName);
  else if (typeof ed.selectMany === 'function') ed.selectMany(ids);
  else if (typeof ed.select === 'function') ed.select(ids[ids.length - 1]);
  return { ok: true, ids, groupId: null, count: ids.length };
}


function lastBuildParts(ed) {
  const lb = ed?.lastBuild;
  if (!lb) return [];
  const ids = new Set(lb.ids || []);
  if (lb.groupId) ids.add(lb.groupId);
  return (ed.doc?.instances || []).filter((i) => ids.has(i.id) || (i.parent && ids.has(i.parent)));
}

/** Recolor / rescale / remove the last chat build as one undo step. */
export function applyTweak(ed, tweak) {
  const parts = lastBuildParts(ed);
  if (tweak?.kind === 'undoLast' || tweak?.undo) {
    if (!parts.length) return { ok: false, reason: 'no-last-build' };
    const ids = [...new Set([ed.lastBuild.groupId, ...(ed.lastBuild.ids || [])])].filter(Boolean);
    if (typeof ed.remove === 'function') ed.remove(ids);
    else {
      ed.checkpoint?.();
      const gone = new Set(parts.map((p) => p.id));
      ed.doc.instances = ed.doc.instances.filter((i) => !gone.has(i.id));
    }
    ed.lastBuild = null;
    return { ok: true, action: 'undo' };
  }
  if (!parts.length) return { ok: false, reason: 'no-last-build' };
  const solids = parts.filter((i) => i.type !== 'group');
  ed.checkpoint?.();
  if (tweak.scale && tweak.scale !== 1) {
    const b = aabbOf(solids);
    if (b) {
      const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
      const s = tweak.scale;
      for (const inst of solids) {
        inst.pos = inst.pos.map((v, i) => +(c[i] + (v - c[i]) * s).toFixed(3));
        inst.size = inst.size.map((v) => +Math.max(0.1, v * s).toFixed(3));
        ed.world?.rebuild?.(inst);
      }
    }
  }
  if (tweak.color || tweak.material) {
    paint(solids, tweak.color, new Set(), tweak.material);
    for (const inst of solids) ed.world?.rebuild?.(inst);
  }
  ed.updateGroupCenters?.();
  return { ok: true, action: 'tweak', count: solids.length, scale: tweak.scale, color: tweak.color, material: tweak.material };
}

export { DEFAULTS, script, lastBuildParts };
