// Studio instance model. A game is a list of instances (parts, models, rigs,
// spawn, checkpoints, coins, gear givers). Each instance is plain JSON so a
// game can be saved, undone/redone, exported and later synced to a server.
import * as THREE from 'three';
import { makeConvex } from '../engine/collision.js';
import { GEARS } from './gears.js';
import { createR6Rig, rigFromModel } from './animation.js';

export const MATERIALS = {
  plastic: { name: 'Plastic', roughness: 0.55 },
  snow:    { name: 'Snow', roughness: 1 },
  ice:     { name: 'Ice', roughness: 0.05, metalness: 0.1, opacity: 0.7 },
  wood:    { name: 'Wood', roughness: 0.85 },
  metal:   { name: 'Metal', roughness: 0.25, metalness: 0.9 },
  neon:    { name: 'Neon', roughness: 0.4, emissive: 1.2 },
  glass:   { name: 'Glass', roughness: 0.05, opacity: 0.35 },
  lava:    { name: 'Lava', roughness: 0.6, emissive: 1.0, lava: true },
};
export const SHAPES = ['box', 'sphere', 'cylinder', 'wedge'];
export const TYPE_INFO = {
  part: { icon: '🧱', label: 'Part' }, model: { icon: '📦', label: 'Model' }, rig: { icon: '🧍', label: 'Rig' },
  spawn: { icon: '📍', label: 'SpawnLocation' }, checkpoint: { icon: '🚩', label: 'Checkpoint' },
  coin: { icon: '🪙', label: 'Coin' }, gear: { icon: '⚙️', label: 'GearGiver' },
};

let counter = 0;
export const newId = (p = 'i') => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Default JSON for a new instance of a type (overrides merged on top). */
export function makeInstance(type, over = {}) {
  const base = { id: newId(), type, name: TYPE_INFO[type]?.label || 'Part', pos: [0, 0.5, 0], rot: [0, 0, 0], size: [1, 1, 1], color: '#bfe9ff', material: 'plastic', transparency: 0, collide: true, anchored: true, kill: false, scripts: [] };
  const per = {
    part: { shape: 'box', size: [4, 1, 2], color: '#a3a2a5', name: 'Part' },
    model: { modelId: null, size: [1, 1, 1], color: '#ffffff' },
    rig: { rigKind: 'r6', size: [1, 1, 1], pos: [0, 0, 0], name: 'R6 Rig' },
    spawn: { size: [4, 0.4, 4], color: '#3f9de0', pos: [0, 0.2, 0], name: 'SpawnLocation' },
    checkpoint: { size: [4, 0.4, 4], color: '#2f9e6a', pos: [0, 0.2, 0], order: 1, name: 'Checkpoint' },
    coin: { size: [1, 1, 1], color: '#ffd34d', collide: false, pos: [0, 1.2, 0], value: 5 },
    gear: { size: [2, 1, 2], color: '#5b6b7a', pos: [0, 0.5, 0], gearId: 'speedCoil', name: 'GearGiver' },
  }[type] || {};
  return JSON.parse(JSON.stringify({ ...base, ...per, ...over, id: over.id || base.id }));
}

// ---------- unit shapes (geometry + convex collider data) ----------
function wedgeGeometry() {
  // Roblox-style wedge: tall at the back (-Z), slopes down to the front (+Z)
  const v = [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5], [-.5, .5, -.5], [.5, .5, -.5]];
  const tris = [[0, 2, 1], [0, 3, 2], [0, 1, 5], [0, 5, 4], [3, 4, 5], [3, 5, 2], [0, 4, 3], [1, 2, 5]];
  const pos = []; for (const t of tris) for (const i of t) pos.push(...v[i]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals(); return g;
}
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(0.5, 28, 18),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 28), wedge: wedgeGeometry(),
};
const prism = (n) => { const v = []; for (const y of [-.5, .5]) for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; v.push([Math.cos(a) * .5, y, Math.sin(a) * .5]); } return v; };
const BOX_V = [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5], [-.5, .5, -.5], [.5, .5, -.5], [.5, .5, .5], [-.5, .5, .5]];
const ico = new THREE.IcosahedronGeometry(0.5, 0).attributes.position;
const ICO_V = []; for (let i = 0; i < ico.count; i++) ICO_V.push([ico.getX(i), ico.getY(i), ico.getZ(i)]);
export const HULLS = {
  box: { verts: BOX_V, normals: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], edges: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
  wedge: { verts: [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5], [-.5, .5, -.5], [.5, .5, -.5]], normals: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 1]], edges: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, -1]] },
  cylinder: (() => { const v = prism(8); const n = [[0, 1, 0]]; const e = [[0, 1, 0]]; for (let i = 0; i < 8; i++) { const a = ((i + 0.5) / 8) * Math.PI * 2; n.push([Math.cos(a), 0, Math.sin(a)]); e.push([-Math.sin(a), 0, Math.cos(a)]); } return { verts: v, normals: n, edges: e }; })(),
  sphere: (() => { const n = [], e = []; const idx = new THREE.IcosahedronGeometry(0.5, 0).attributes.position; for (let i = 0; i < idx.count; i += 3) { const a = new THREE.Vector3().fromBufferAttribute(idx, i), b = new THREE.Vector3().fromBufferAttribute(idx, i + 1), c = new THREE.Vector3().fromBufferAttribute(idx, i + 2); n.push(b.clone().sub(a).cross(c.clone().sub(a)).normalize().toArray()); e.push(b.clone().sub(a).normalize().toArray(), c.clone().sub(b).normalize().toArray(), a.clone().sub(c).normalize().toArray()); } return { verts: ICO_V, normals: n, edges: e }; })(),
};

/** World-space convex collider for a unit hull transformed by `matrix`. */
export function convexFromHull(hull, matrix) {
  const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(matrix);
  const verts = hull.verts.map(p => v.set(...p).applyMatrix4(matrix).toArray());
  const normals = hull.normals.map(n => v.set(...n).applyMatrix3(nm).normalize().toArray());
  const edges = hull.edges.map(e => v.set(...e).transformDirection(matrix).toArray());
  return makeConvex(verts, normals, edges);
}

const matCache = new Map();
export function partMaterial(inst) {
  const m = MATERIALS[inst.material] || MATERIALS.plastic;
  const opacity = Math.min(m.opacity ?? 1, 1 - (inst.transparency || 0));
  const mat = new THREE.MeshStandardMaterial({
    color: inst.color, roughness: m.roughness, metalness: m.metalness || 0,
    transparent: opacity < 1, opacity, depthWrite: opacity > 0.5,
    emissive: m.emissive ? inst.color : '#000000', emissiveIntensity: m.emissive || 0,
  });
  if (m.lava) mat.userData.lava = true;
  return mat;
}

function coinMesh() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 24), new THREE.MeshStandardMaterial({ color: '#ffd34d', metalness: 0.8, roughness: 0.25, emissive: '#5a3c00', emissiveIntensity: 0.6 }));
  disc.rotation.x = Math.PI / 2; g.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 24), new THREE.MeshStandardMaterial({ color: '#9fe3ff', emissive: '#2a8fd0', emissiveIntensity: 0.6 }));
  g.add(rim); return g;
}
function flag(color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 8), new THREE.MeshStandardMaterial({ color: '#ddd', metalness: 0.6 }));
  pole.position.y = 1.5; g.add(pole);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }));
  f.position.set(0.5, 2.65, 0); g.add(f); return g;
}

/**
 * Build the Three.js object for an instance.
 * Returns { root, body, hull, hullMatrixFrom } where body is scaled to inst.size.
 */
export function buildObject(inst, { models, editing }) {
  const root = new THREE.Group();
  root.position.set(...inst.pos);
  root.rotation.set(...inst.rot.map(THREE.MathUtils.degToRad));
  let body, hull = HULLS.box, hullOffset = null, extra = {};
  switch (inst.type) {
    case 'part': {
      body = new THREE.Mesh(GEO[inst.shape] || GEO.box, partMaterial(inst));
      body.scale.set(...inst.size);
      hull = HULLS[inst.shape] || HULLS.box;
      break;
    }
    case 'spawn': case 'checkpoint': {
      body = new THREE.Mesh(GEO.box, partMaterial(inst)); body.scale.set(...inst.size);
      const deco = inst.type === 'checkpoint' ? flag('#ffd34d') : new THREE.Mesh(new THREE.CircleGeometry(Math.min(inst.size[0], inst.size[2]) * 0.35, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      if (inst.type === 'spawn') deco.rotation.x = -Math.PI / 2;
      deco.position.y = inst.size[1] / 2 + 0.01; root.add(deco);
      break;
    }
    case 'coin': {
      body = new THREE.Group(); body.add(coinMesh()); body.scale.set(...inst.size); hull = HULLS.sphere; break;
    }
    case 'gear': {
      body = new THREE.Mesh(GEO.cylinder, partMaterial(inst)); body.scale.set(...inst.size); hull = HULLS.cylinder;
      const g = GEARS[inst.gearId];
      if (g) { const icon = g.handModel(); icon.position.y = inst.size[1] / 2 + 1.2; icon.scale.setScalar(1.6); icon.userData.spin = true; root.add(icon); extra.icon = icon; }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.max(inst.size[0], inst.size[2]) * 0.45, 0.06, 8, 32), new THREE.MeshBasicMaterial({ color: g?.color || '#fff' }));
      ring.rotation.x = Math.PI / 2; ring.position.y = inst.size[1] / 2 + 0.03; root.add(ring);
      break;
    }
    case 'model': {
      body = new THREE.Group();
      const obj = models?.instance(inst.modelId);
      if (obj) { body.add(obj); extra.model = obj; const b = new THREE.Box3().setFromObject(obj); hullOffset = b; if (obj.userData.isRig || obj.userData.clips?.length) extra.rig = rigFromModel(obj) || null; }
      else { const ph = new THREE.Mesh(GEO.box, new THREE.MeshStandardMaterial({ color: '#ff66cc', wireframe: true })); ph.position.y = 0.5; body.add(ph); hullOffset = new THREE.Box3(new THREE.Vector3(-.5, 0, -.5), new THREE.Vector3(.5, 1, .5)); }
      body.scale.set(...inst.size);
      break;
    }
    case 'rig': {
      body = new THREE.Group();
      const rig = createR6Rig();
      body.add(rig.root); extra.rig = rig;
      body.scale.set(...inst.size);
      hullOffset = new THREE.Box3(new THREE.Vector3(-1, 0, -0.25), new THREE.Vector3(1, 2.62, 0.25));
      break;
    }
    default: body = new THREE.Mesh(GEO.box, partMaterial(inst));
  }
  root.add(body);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.instId = inst.id; } });
  root.userData.instId = inst.id;
  return { root, body, hull, hullOffset, ...extra };
}

/** Compute the world convex collider for a built object. */
export function computeCollider(entry) {
  entry.root.updateMatrixWorld(true);
  const m = entry.body.matrixWorld.clone();
  if (entry.hullOffset) {
    const b = entry.hullOffset, c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    m.multiply(new THREE.Matrix4().compose(c, new THREE.Quaternion(), s.max(new THREE.Vector3(0.05, 0.05, 0.05))));
  }
  return convexFromHull(entry.hull, m);
}
