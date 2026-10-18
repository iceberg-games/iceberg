// Generic collision world shared by all games:
//   - axis-aligned boxes (walls, floors, stairs, furniture)
//   - a voxel grid (player-built blocks) via any object with has(x,y,z)
//   - vertical circles (trees, ice spires)
//   - an optional flat floor at floorY and horizontal bounds
export class Collision {
  constructor({ floorY = 0, bounds = null } = {}) {
    this.boxes = [];
    this.circles = [];
    this.voxels = null;
    this.convexes = []; // rotated/sloped parts: {verts, normals, edges, aabb}
    this.floorY = floorY;
    this.bounds = bounds; // {type:'circle', r} | {type:'box', minX,maxX,minZ,maxZ}
  }
  addBox(minX, minY, minZ, maxX, maxY, maxZ) { const b = { minX, minY, minZ, maxX, maxY, maxZ }; this.boxes.push(b); return b; }
  addBox3(box3) { return this.addBox(box3.min.x, box3.min.y, box3.min.z, box3.max.x, box3.max.y, box3.max.z); }
  removeBox(b) { const i = this.boxes.indexOf(b); if (i >= 0) this.boxes.splice(i, 1); }
  addConvex(c) { this.convexes.push(c); return c; }
  removeConvex(c) { const i = this.convexes.indexOf(c); if (i >= 0) this.convexes.splice(i, 1); }
  addCircle(x, z, r, top = Infinity) { this.circles.push({ x, z, r, top }); }

  overlaps(minX, minY, minZ, maxX, maxY, maxZ) {
    const e = 1e-4;
    for (const b of this.boxes) {
      if (maxX > b.minX + e && minX < b.maxX - e && maxY > b.minY + e && minY < b.maxY - e && maxZ > b.minZ + e && minZ < b.maxZ - e) return true;
    }
    if (this.voxels) {
      for (let x = Math.floor(minX + e); x <= Math.floor(maxX - e); x++)
        for (let y = Math.floor(minY + e); y <= Math.floor(maxY - e); y++)
          for (let z = Math.floor(minZ + e); z <= Math.floor(maxZ - e); z++)
            if (this.voxels.has(x, y, z)) return true;
    }
    for (const c of this.convexes) if (aabbVsConvex(minX, minY, minZ, maxX, maxY, maxZ, c)) return true;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, hw = (maxX - minX) / 2;
    for (const c of this.circles) {
      if (minY < c.top && (cx - c.x) ** 2 + (cz - c.z) ** 2 < (c.r + hw) ** 2) return true;
    }
    return false;
  }

  clampBounds(pos) {
    const b = this.bounds; if (!b) return;
    if (b.type === 'circle') {
      const d = Math.hypot(pos.x, pos.z);
      if (d > b.r) { pos.x *= b.r / d; pos.z *= b.r / d; }
    } else {
      pos.x = Math.min(b.maxX, Math.max(b.minX, pos.x));
      pos.z = Math.min(b.maxZ, Math.max(b.minZ, pos.z));
    }
  }
}

// ---------- convex shapes (separating axis theorem) ----------
const WORLD_AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Build a convex collider from world-space vertices, face normals and edge directions. */
export function makeConvex(verts, normals, edges) {
  const aabb = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  for (const v of verts) {
    aabb.minX = Math.min(aabb.minX, v[0]); aabb.maxX = Math.max(aabb.maxX, v[0]);
    aabb.minY = Math.min(aabb.minY, v[1]); aabb.maxY = Math.max(aabb.maxY, v[1]);
    aabb.minZ = Math.min(aabb.minZ, v[2]); aabb.maxZ = Math.max(aabb.maxZ, v[2]);
  }
  const axes = [...normals];
  for (const w of WORLD_AXES) for (const e of edges) { const c = cross(w, e); const l = Math.hypot(...c); if (l > 1e-4) axes.push([c[0] / l, c[1] / l, c[2] / l]); }
  return { verts, axes, aabb };
}

export function aabbVsConvex(minX, minY, minZ, maxX, maxY, maxZ, c, e = 1e-4) {
  const b = c.aabb;
  if (maxX <= b.minX + e || minX >= b.maxX - e || maxY <= b.minY + e || minY >= b.maxY - e || maxZ <= b.minZ + e || minZ >= b.maxZ - e) return false;
  if (c.support) return gjkAabb(minX + e, minY + e, minZ + e, maxX - e, maxY - e, maxZ - e, c);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  const hx = (maxX - minX) / 2, hy = (maxY - minY) / 2, hz = (maxZ - minZ) / 2;
  for (const a of c.axes) {
    const pc = cx * a[0] + cy * a[1] + cz * a[2];
    const r = hx * Math.abs(a[0]) + hy * Math.abs(a[1]) + hz * Math.abs(a[2]);
    let lo = Infinity, hi = -Infinity;
    for (const v of c.verts) { const d = v[0] * a[0] + v[1] * a[1] + v[2] * a[2]; if (d < lo) lo = d; if (d > hi) hi = d; }
    if (pc + r <= lo + e || pc - r >= hi - e) return false;
  }
  return true;
}

// ---------- curved shapes (GJK on support functions) ----------
// Exact intersection for any convex shape given by a support function, used
// for rotated / stretched spheres and cylinders. A shape is
// { support(d:[x,y,z]) -> [x,y,z], aabb } and plugs into the same
// convexes list as polyhedra (aabbVsConvex dispatches on `support`).
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const neg = (a) => [-a[0], -a[1], -a[2]];
const triple = (a, b, c) => cross(cross(a, b), c);

/** Build a support-function shape and its world AABB. */
export function makeSupportShape(support) {
  const ax = (i, s) => { const d = [0, 0, 0]; d[i] = s; return support(d)[i]; };
  const aabb = { minX: ax(0, -1), maxX: ax(0, 1), minY: ax(1, -1), maxY: ax(1, 1), minZ: ax(2, -1), maxZ: ax(2, 1) };
  return { support, aabb, curved: true };
}

/** Boolean GJK: does the box [min,max] overlap the support shape? */
export function gjkAabb(minX, minY, minZ, maxX, maxY, maxZ, shape) {
  const boxSup = (d) => [d[0] >= 0 ? maxX : minX, d[1] >= 0 ? maxY : minY, d[2] >= 0 ? maxZ : minZ];
  const S = (d) => sub(shape.support(d), boxSup(neg(d)));
  let d = sub([(shape.aabb.minX + shape.aabb.maxX) / 2, (shape.aabb.minY + shape.aabb.maxY) / 2, (shape.aabb.minZ + shape.aabb.maxZ) / 2], [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]);
  if (Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) < 1e-9) d = [1, 0, 0];
  let simplex = [S(d)]; d = neg(simplex[0]);
  for (let it = 0; it < 48; it++) {
    if (dot(d, d) < 1e-14) return true; // origin on the simplex
    const a = S(d);
    if (dot(a, d) < 1e-6) return false; // can't pass the origin → separated
    simplex.push(a);
    const r = doSimplex(simplex); simplex = r.s; d = r.d;
    if (r.hit) return true;
  }
  return false;
}
function doSimplex(s) {
  const a = s[s.length - 1], ao = neg(a);
  if (s.length === 2) {
    const b = s[0], ab = sub(b, a);
    if (dot(ab, ao) > 0) { let d = triple(ab, ao, ab); if (dot(d, d) < 1e-14) d = anyPerp(ab); return { s: [b, a], d }; }
    return { s: [a], d: ao };
  }
  if (s.length === 3) {
    const [c, b] = s, ab = sub(b, a), ac = sub(c, a), abc = cross(ab, ac);
    if (dot(cross(abc, ac), ao) > 0) {
      if (dot(ac, ao) > 0) return { s: [c, a], d: triple(ac, ao, ac) };
      return doSimplex([b, a]);
    }
    if (dot(cross(ab, abc), ao) > 0) return doSimplex([b, a]);
    if (dot(abc, ao) > 0) return { s: [c, b, a], d: abc };
    return { s: [b, c, a], d: neg(abc) };
  }
  // tetrahedron
  const [d0, c, b] = s, ab = sub(b, a), ac = sub(c, a), ad = sub(d0, a);
  const abc = cross(ab, ac), acd = cross(ac, ad), adb = cross(ad, ab);
  if (dot(abc, ao) > 0) return doSimplex([c, b, a]);
  if (dot(acd, ao) > 0) return doSimplex([d0, c, a]);
  if (dot(adb, ao) > 0) return doSimplex([b, d0, a]);
  return { s, d: [0, 0, 0], hit: true };
}
const anyPerp = (v) => { const c = cross(v, Math.abs(v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]); return c; };

/**
 * Affine image of a unit shape: m = 3x4 world matrix as a THREE.Matrix4
 * `elements` array (column-major). kind: 'sphere' (radius 0.5) or
 * 'cylinder' (radius 0.5, height 1 along local Y). Exact for any rotation and
 * non-uniform size.
 */
export function makeAffineShape(kind, e) {
  const M = (v) => [e[0] * v[0] + e[4] * v[1] + e[8] * v[2], e[1] * v[0] + e[5] * v[1] + e[9] * v[2], e[2] * v[0] + e[6] * v[1] + e[10] * v[2]];
  const MT = (d) => [e[0] * d[0] + e[1] * d[1] + e[2] * d[2], e[4] * d[0] + e[5] * d[1] + e[6] * d[2], e[8] * d[0] + e[9] * d[1] + e[10] * d[2]];
  const c = [e[12], e[13], e[14]];
  const unit = kind === 'cylinder'
    ? (l) => { const r = Math.hypot(l[0], l[2]); return [r > 1e-9 ? 0.5 * l[0] / r : 0, l[1] >= 0 ? 0.5 : -0.5, r > 1e-9 ? 0.5 * l[2] / r : 0]; }
    : (l) => { const n = Math.hypot(l[0], l[1], l[2]) || 1; return [0.5 * l[0] / n, 0.5 * l[1] / n, 0.5 * l[2] / n]; };
  const shape = makeSupportShape((d) => { const p = M(unit(MT(d))); return [c[0] + p[0], c[1] + p[1], c[2] + p[2]]; });
  shape.kind = kind;
  return shape;
}
