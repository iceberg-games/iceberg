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
  tower: { width: 4, length: 4, height: 10 },
  bridge: { width: 4, length: 20, height: 0.6 },
  coins: { count: 5, spacing: 3 },
  checkpoint: {},
  wall: { width: 1, length: 12, height: 6 },
  platform: { width: 8, length: 8, height: 1 },
  stairs: { width: 4, steps: 6, rise: 1, run: 2 },
};

function dims(intent) {
  const d = { ...(DEFAULTS[intent.template] || {}) };
  const s = intent.scale && intent.scale !== 1 ? intent.scale : 1;
  if (intent.width != null) d.width = intent.width;
  if (intent.length != null) d.length = intent.length;
  if (intent.height != null) d.height = intent.height;
  if (intent.count != null) d.count = intent.count;
  if (intent.template === 'stairs' && intent.height != null) d.steps = Math.max(2, Math.round(intent.height));
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

function paint(list, color, skipTypes = new Set(['coin', 'checkpoint', 'spawn'])) {
  if (!color) return list;
  for (const inst of list) if (!skipTypes.has(inst.type)) inst.color = color;
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

const MAKERS = { house, tower, bridge, coins, checkpoint: checkpoints, wall, platform, stairs };

const LABELS = {
  house: 'house', tower: 'tower', bridge: 'bridge', coins: 'coins',
  checkpoint: 'checkpoint', wall: 'wall', platform: 'platform', stairs: 'stairs',
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
  let instances = maker(d, intent.color);
  if (intent.color && template !== 'coins' && template !== 'checkpoint') paint(instances, intent.color);
  const origin = (ctx.existing || ctx.selection || ctx.lookPoint)
    ? resolveBuildOrigin(instances, ctx)
    : (ctx.origin || [0, 0, 0]);
  offsetAll(instances, origin);
  const label = LABELS[template] || template;
  const bits = [];
  if (template === 'coins') bits.push(`${d.count} coin${d.count === 1 ? '' : 's'}${intent.line || d.count > 1 ? ' in a line' : ''}`);
  else if (template === 'tower') bits.push(`a tower ${d.height} high`);
  else if (template === 'house') bits.push(intent.scale < 1 ? 'a small house' : intent.scale > 1 ? 'a large house' : 'a house');
  else if (template === 'bridge') bits.push(`a bridge ${d.length} long`);
  else if (template === 'checkpoint') bits.push(d.count > 1 ? `${d.count} checkpoints` : 'a checkpoint');
  else bits.push(`a ${label}`);
  if (intent.colorName) bits.push(`in ${intent.colorName}`);
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

export { DEFAULTS, script };
