// Snow/ice heightfield terrain for Studio games.
// doc.terrain = { size, res, heights: number[(res+1)^2] } — plain JSON so it
// saves, undoes and exports with the rest of the doc. Centered on the origin.
// Brushes: raise / lower / smooth / flatten (editor.js wraps each stroke in one undo step).
import * as THREE from 'three';

export const TERRAIN_BRUSHES = {
  raise:   { icon: '⛰️', label: 'Raise' },
  lower:   { icon: '🕳️', label: 'Lower' },
  smooth:  { icon: '🌀', label: 'Smooth' },
  flatten: { icon: '▭', label: 'Flatten' },
};
export const MAX_H = 60, MIN_H = -20;

export function newTerrain(size = 128, res = 64) {
  return { size, res, heights: new Array((res + 1) * (res + 1)).fill(0) };
}
const idx = (t, i, j) => j * (t.res + 1) + i;

/** bilinear height at world x/z, or null outside the terrain */
export function heightAt(t, x, z) {
  if (!t) return null;
  const half = t.size / 2, cell = t.size / t.res;
  const fx = (x + half) / cell, fz = (z + half) / cell;
  if (fx < 0 || fz < 0 || fx > t.res || fz > t.res) return null;
  const i = Math.min(t.res - 1, Math.floor(fx)), j = Math.min(t.res - 1, Math.floor(fz)), u = fx - i, v = fz - j;
  const h = t.heights;
  const a = h[idx(t, i, j)], b = h[idx(t, i + 1, j)], c = h[idx(t, i, j + 1)], d = h[idx(t, i + 1, j + 1)];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/**
 * Apply one brush dab at world (x, z). opts: { mode, radius, strength, target }.
 * Returns true if anything changed.
 */
export function applyBrush(t, x, z, { mode = 'raise', radius = 8, strength = 0.5, target = null } = {}) {
  const half = t.size / 2, cell = t.size / t.res, h = t.heights;
  const ci = (x + half) / cell, cj = (z + half) / cell, rc = radius / cell;
  const i0 = Math.max(0, Math.floor(ci - rc)), i1 = Math.min(t.res, Math.ceil(ci + rc));
  const j0 = Math.max(0, Math.floor(cj - rc)), j1 = Math.min(t.res, Math.ceil(cj + rc));
  if (i0 > i1 || j0 > j1) return false;
  const src = mode === 'smooth' ? h.slice() : h;
  const flatY = target ?? heightAt(t, x, z) ?? 0;
  let changed = false;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const d = Math.hypot(i - ci, j - cj) / rc; if (d > 1) continue;
    const fall = 0.5 + 0.5 * Math.cos(d * Math.PI); // soft round falloff
    const k = idx(t, i, j), old = h[k];
    let nv = old;
    if (mode === 'raise') nv = old + strength * fall;
    else if (mode === 'lower') nv = old - strength * fall;
    else if (mode === 'flatten') nv = old + (flatY - old) * Math.min(1, strength * fall);
    else if (mode === 'smooth') {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii > t.res || jj > t.res) continue; s += src[idx(t, ii, jj)]; n++; }
      nv = old + (s / n - old) * Math.min(1, strength * fall * 1.5);
    }
    nv = Math.round(Math.max(MIN_H, Math.min(MAX_H, nv)) * 100) / 100;
    if (nv !== old) { h[k] = nv; changed = true; }
  }
  return changed;
}

const SNOW = new THREE.Color('#f4f9ff'), PACKED = new THREE.Color('#cfe3f2'), ICE = new THREE.Color('#8fd0f5'), DEEP = new THREE.Color('#4f8fb8');
/** Build the terrain mesh (snow on flats, ice on slopes and in hollows). */
export function buildTerrainMesh(t) {
  const geo = new THREE.PlaneGeometry(t.size, t.size, t.res, t.res);
  geo.rotateX(-Math.PI / 2);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, flatShading: false }));
  mesh.receiveShadow = true; mesh.castShadow = true; mesh.userData.ground = true; mesh.userData.terrain = true;
  updateTerrainMesh(mesh, t);
  return mesh;
}
export function updateTerrainMesh(mesh, t) {
  const pos = mesh.geometry.attributes.position, col = mesh.geometry.attributes.color;
  // PlaneGeometry rotated -90° X: vertex order is row-major from -z to +z, -x to +x
  for (let j = 0; j <= t.res; j++) for (let i = 0; i <= t.res; i++) pos.setY(j * (t.res + 1) + i, t.heights[idx(t, i, j)] + 0.02);
  pos.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox();
  const n = mesh.geometry.attributes.normal, c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const y = pos.getY(k), slope = 1 - n.getY(k);
    if (y < -1.5) c.copy(DEEP).lerp(ICE, Math.min(1, (y + 6) / 4.5));
    else if (slope > 0.35) c.copy(ICE);
    else if (slope > 0.15) c.copy(PACKED).lerp(ICE, (slope - 0.15) / 0.2);
    else c.copy(SNOW).lerp(PACKED, slope / 0.15);
    col.setXYZ(k, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}
export const hasTerrain = (doc) => !!doc?.terrain?.heights?.some(v => v !== 0);
