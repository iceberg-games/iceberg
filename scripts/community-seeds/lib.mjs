// Tiny builder for Studio project JSON (the same shape src/studio/instances.js#makeInstance,
// src/studio/store.js and publish_custom_game use). Pure JS, no THREE / DOM needed, so the
// seed generator runs in plain node. Scripts are written as compiled behaviour programs
// (the JSON the plain-words translator produces; see src/studio/nlscript.js header).
import { translate, validateProgram } from '../../src/studio/nlscript.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const BASE = { type: 'part', name: 'Part', pos: [0, 0.5, 0], rot: [0, 0, 0], size: [1, 1, 1], color: '#bfe9ff', material: 'plastic', transparency: 0, collide: true, anchored: true, kill: false, scripts: [] };
const PER = {
  part: { shape: 'box', size: [4, 1, 2], color: '#a3a2a5', name: 'Part' },
  rig: { rigKind: 'r6', size: [1, 1, 1], pos: [0, 0, 0], name: 'R6 Rig' },
  spawn: { size: [4, 0.4, 4], color: '#3f9de0', pos: [0, 0.2, 0], name: 'SpawnLocation' },
  checkpoint: { size: [4, 0.4, 4], color: '#2f9e6a', pos: [0, 0.2, 0], order: 1, name: 'Checkpoint' },
  coin: { size: [1, 1, 1], color: '#ffd34d', collide: false, pos: [0, 1.2, 0], value: 5 },
  gear: { size: [2, 1, 2], color: '#5b6b7a', pos: [0, 0.5, 0], gearId: 'speedCoil', name: 'GearGiver' },
  group: { size: [1, 1, 1], name: 'Model', collide: false },
};

// ---------- program builders (plain JSON; validated by validateProgram at build time) ----------
export const A = {
  say: (text) => ({ do: 'message', text }),
  add: (name, amount) => ({ do: 'addVar', name, amount }),
  set: (name, value) => ({ do: 'setVar', name, value }),
  show: (target) => ({ do: 'show', target }),
  hide: (target, seconds) => (target ? { do: 'hide', target, seconds: seconds ?? null } : { do: 'hide', seconds: seconds ?? null, target: null }),
  sound: (sound) => ({ do: 'sound', sound }),
  fx: (kind, target, seconds = 1.5) => ({ do: 'particles', kind, seconds, target: target ?? null }),
  color: (color, target, seconds = 0.3) => ({ do: 'color', color, seconds, target: target ?? null }),
  wait: (seconds) => ({ do: 'wait', seconds }),
  win: (text) => ({ do: 'win', text }),
  bucks: (amount) => ({ do: 'bucks', amount }),
  door: (target, seconds) => ({ do: 'door', style: 'slide', target, seconds: seconds ?? null }),
  teleport: (toPart) => ({ do: 'teleport', toPart }),
  bounce: (power) => ({ do: 'bounce', power }),
  damage: (amount) => ({ do: 'damage', amount }),
  heal: (amount) => ({ do: 'heal', amount }),
  timer: (start) => ({ do: 'timer', start, reset: start }),
  board: (show) => ({ do: 'leaderboard', show }),
  glow: (color, target) => ({ do: 'glow', color, target: target ?? null }),
  light: (on, color, target) => ({ do: 'light', on, color, target: target ?? null }),
  spin: (axis, speed, target, seconds) => ({ do: 'spin', axis, speed, seconds: seconds ?? null, target: target ?? null }),
  collide: (target, value) => ({ do: 'collide', target, value }),
  transparency: (target, value, seconds = 0.3) => ({ do: 'transparency', target, value, seconds }),
  moveBy: (target, offset, seconds) => ({ do: 'moveBy', target, offset, seconds }),
};
const rule = (type, extra, actions, o = {}) => ({ trigger: { type, ...extra }, once: !!o.once, actions, ...(o.else ? { else: o.else } : {}), ...(o.if ? { if: o.if } : {}) });
export const R = {
  start: (actions, o) => rule('start', {}, actions, o),
  enter: (actions, o) => rule('enter', o?.part ? { part: o.part } : {}, actions, o),
  leave: (actions, o) => rule('leave', {}, actions, o),
  touch: (actions, o) => rule('touch', {}, actions, o),
  press: (actions, o) => rule('press', {}, actions, o),
  click: (actions, o) => rule('click', {}, actions, o),
  every: (seconds, actions, o) => rule('every', { seconds }, actions, o),
  reach: (v, op, value, actions, o) => rule('reach', { var: v, op, value }, actions, o),
};
export const IF = (v, op, value) => ({ var: v, op, value });
export const program = (rules = [], continuous = []) => ({ continuous, rules });
export const CONT = {
  spin: (axis, speed) => ({ type: 'spin', axis, speed }),
  move: (axis, distance, period) => ({ type: 'move', axis, distance, period }),
  path: (points, period, pause = 0.5) => ({ type: 'path', points, period, pause }),
  wander: (radius, speed = 2, pause = 2) => ({ type: 'wander', speed, radius, pause }),
  chase: (range, speed = 6) => ({ type: 'chase', speed, range }),
};

let sc = 0;
/** One script entry as Studio stores it. `text` is optional plain words: it is only kept when the
 *  offline translator turns it into EXACTLY this program (so the runtime's re-translate is lossless). */
export function script(name, prog, text) {
  const out = { id: `s_${(sc++).toString(36)}`, name: String(name).slice(0, 30), program: prog, enabled: true };
  if (text) { const t = translate(text, { names: [] }); if (JSON.stringify(t.program) === JSON.stringify(prog) && !t.unknown.length) out.text = text; }
  return out;
}

export function createDoc({ id, name, description, sky = 'day', ground = 'baseplate', music = 'winter', snow = false, mobile = true, author = 'gooberr478' }) {
  const instances = []; const byName = new Map(); let seq = 0, parent = null;
  const d = {
    instances,
    add(type, over = {}) {
      const inst = clone({ ...BASE, type, id: `i_${id.slice(2, 10)}_${(seq++).toString(36)}`, ...(PER[type] || {}), ...over });
      if (parent && !over.parent) inst.parent = parent;
      if (!over.id) delete over.id;
      instances.push(inst); if (type !== 'group') { const k = inst.name.toLowerCase(); byName.set(k, (byName.get(k) || 0) + 1); }
      return inst;
    },
    /** center position + full size, like the Studio gizmo uses */
    box(name, pos, size, color, o = {}) { return d.add('part', { name, shape: 'box', pos, size, color, ...o }); },
    cyl(name, pos, size, color, o = {}) { return d.add('part', { name, shape: 'cylinder', pos, size, color, ...o }); },
    ball(name, pos, size, color, o = {}) { return d.add('part', { name, shape: 'sphere', pos, size: Array.isArray(size) ? size : [size, size, size], color, ...o }); },
    wedge(name, pos, size, color, o = {}) { return d.add('part', { name, shape: 'wedge', pos, size, color, ...o }); },
    /** axis-aligned slab from corner coords: x0,x1,z0,z1 and top y with thickness */
    slab(name, x0, x1, z0, z1, top, thick, color, o = {}) { return d.box(name, [(x0 + x1) / 2, top - thick / 2, (z0 + z1) / 2], [Math.abs(x1 - x0), thick, Math.abs(z1 - z0)], color, o); },
    /** box standing on the ground-level y0 (pos.y computed from bottom) */
    stand(name, x, y0, z, w, h, dd, color, o = {}) { return d.box(name, [x, y0 + h / 2, z], [w, h, dd], color, o); },
    /** invisible, non-solid trigger volume */
    zone(name, pos, size, scripts) { return d.add('part', { name, shape: 'box', pos, size, color: '#ffffff', transparency: 1, collide: false, scripts }); },
    coin(pos, value = 1, name = 'Coin') { return d.add('coin', { pos, value, name }); },
    group(name, fn) { const g = d.add('group', { name }); const prev = parent; parent = g.id; const start = instances.length; fn(g); parent = prev; const kids = instances.slice(start).filter(i => i.parent === g.id && i.type !== 'group'); if (kids.length) { const c = [0, 1, 2].map(a => kids.reduce((s, k) => s + k.pos[a], 0) / kids.length); g.pos = c.map(v => Math.round(v * 100) / 100); } return g; },
    byName: (n) => instances.find(i => i.type !== 'group' && i.name.toLowerCase() === String(n).toLowerCase()) || instances.find(i => i.name.toLowerCase() === String(n).toLowerCase()),
    count: (n) => byName.get(String(n).toLowerCase()) || 0,
    build({ thumbnail, flipZ = false } = {}) {
      // validate every script program + every referenced part name
      const problems = []; const has = (n) => d.count(n) > 0;
      for (const i of instances) for (const s of i.scripts || []) {
        const v = validateProgram(s.program);
        if (JSON.stringify(v.rules.length) !== JSON.stringify((s.program.rules || []).length)) problems.push(`${i.name}/${s.name}: validateProgram dropped a rule`);
        const refs = new Set();
        const walk = (a) => { if (!a) return; if (a.target) refs.add(a.target); if (a.toPart) refs.add(a.toPart); if (typeof a.to === 'string' && !['spawn', 'checkpoint', 'self'].includes(a.to)) refs.add(a.to); (a.options || []).forEach(walk); };
        for (const r of s.program.rules || []) { (r.actions || []).forEach(walk); (r.else || []).forEach(walk); if (r.trigger.part) refs.add(r.trigger.part); }
        for (const n of refs) { if (!has(n)) problems.push(`${i.name}/${s.name}: missing part "${n}"`); }
      }
      const dupTargets = new Set(); for (const i of instances) for (const s of i.scripts || []) for (const r of s.program.rules || []) for (const a of [...(r.actions || []), ...(r.else || [])]) if (a.target && d.count(a.target) > 1) dupTargets.add(a.target);
      if (dupTargets.size) problems.push(`targets with duplicate names: ${[...dupTargets].join(', ')}`);
      if (flipZ) for (const i of instances) { i.pos[2] = -i.pos[2] || 0; i.pos = i.pos.map(v => (v === 0 ? 0 : v)); for (const s of i.scripts || []) { for (const c of s.program.continuous || []) { if (c.type === 'move' && c.axis === 'z') c.distance = -c.distance; if (c.type === 'path') c.points = c.points.map(p => (Array.isArray(p) ? [p[0], p[1], -p[2]] : p)); } for (const r of s.program.rules || []) for (const a of [...(r.actions || []), ...(r.else || [])]) { if (Array.isArray(a.offset)) a.offset = [a.offset[0], a.offset[1], -a.offset[2]]; if (Array.isArray(a.to)) a.to = [a.to[0], a.to[1], -a.to[2]]; } } }
      const now = 1763700000000; // fixed so the seed JSON is reproducible
      const doc = { id, version: 2, name, description, music, snow, mobile, starterGears: [], animations: [], sky, ground, template: 'blank', author, createdAt: now, updatedAt: now, instances };
      if (thumbnail) doc.thumbnail = thumbnail;
      return { doc, problems };
    },
  };
  return d;
}
