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
