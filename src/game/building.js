// Voxel building system (1x1x1 grid blocks). Reused by Frost Fields and the
// game creator. Exposes has(x,y,z) so it can plug into Collision as voxels.
import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_BY_ID } from '../data/blocks.js';

const GEO = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();
export function blockMaterial(id) {
  if (!matCache.has(id)) {
    const b = BLOCK_BY_ID[id] || BLOCK_TYPES[0];
    matCache.set(id, new THREE.MeshStandardMaterial({
      color: b.color, roughness: b.roughness ?? 0.6, transparent: !!b.transparent, opacity: b.opacity ?? 1,
      emissive: b.emissive || '#000000', metalness: b.transparent ? 0.1 : 0,
    }));
  }
  return matCache.get(id);
}

export class Building {
  constructor(scene, { blocks = [], onChange = () => {}, canPlace = () => true, groundMeshes = [] } = {}) {
    this.scene = scene; this.onChange = onChange; this.canPlace = canPlace;
    this.groundMeshes = groundMeshes;
    this.map = new Map(); this.meshes = [];
    this.group = new THREE.Group(); scene.add(this.group);
    this.selected = BLOCK_TYPES[0].id;
    this.active = false;
    for (const [x, y, z, t] of blocks) this._add(x, y, z, t);
    // ghost preview
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.03, 1.03, 1.03)), new THREE.LineBasicMaterial({ color: '#1e6fb8' }));
    this.ghost.add(this.ghostEdges);
    this.ghost.visible = false; scene.add(this.ghost);
  }
  key(x, y, z) { return `${x},${y},${z}`; }
  has(x, y, z) { return this.map.has(this.key(x, y, z)); }
  get count() { return this.map.size; }

  _add(x, y, z, type) {
    const m = new THREE.Mesh(GEO, blockMaterial(type));
    m.position.set(x + 0.5, y + 0.5, z + 0.5);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.cell = [x, y, z]; m.userData.type = type;
    this.group.add(m); this.meshes.push(m);
    this.map.set(this.key(x, y, z), m);
  }
  place(x, y, z, type = this.selected) {
    if (this.has(x, y, z) || !this.canPlace(x, y, z)) return false;
    this._add(x, y, z, type); this.onChange('place', [x, y, z, type]);
    return true;
  }
  remove(x, y, z) {
    const k = this.key(x, y, z), m = this.map.get(k);
    if (!m) return false;
    this.group.remove(m); this.map.delete(k);
    this.meshes.splice(this.meshes.indexOf(m), 1);
    this.onChange('remove', [x, y, z]);
    return true;
  }
  clear() { for (const m of [...this.meshes]) { const [x, y, z] = m.userData.cell; this.remove(x, y, z); } }
  serialize() { return this.meshes.map(m => [...m.userData.cell, m.userData.type]); }

  /** Raycast: returns {point, normal, placeCell, removeCell} or null */
  pick(ray) {
    const hit = ray.intersectObjects([...this.meshes, ...this.groundMeshes], false)[0];
    if (!hit) return null;
    const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).round() : new THREE.Vector3(0, 1, 0);
    if (hit.object.userData.cell) {
      const [x, y, z] = hit.object.userData.cell;
      return { point: hit.point, normal: n, placeCell: [x + n.x, y + n.y, z + n.z], removeCell: [x, y, z], object: hit.object };
    }
    const p = hit.point.clone().addScaledVector(n, 0.01);
    return { point: hit.point, normal: n, placeCell: [Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)], removeCell: null, object: hit.object };
  }

  setActive(on) { this.active = on; this.ghost.visible = false; }

  hover(ray, removing = false) {
    if (!this.active) { this.ghost.visible = false; return; }
    const h = this.pick(ray);
    if (!h) { this.ghost.visible = false; return; }
    const c = removing && h.removeCell ? h.removeCell : h.placeCell;
    this.ghost.position.set(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5);
    this.ghost.material.color.set(removing ? '#ff5a5a' : (BLOCK_BY_ID[this.selected]?.color || '#fff'));
    this.ghost.visible = true;
  }

  /** Handle a click in build mode. Returns 'placed' | 'removed' | null */
  click({ ray, button, shift }) {
    if (!this.active) return null;
    const h = this.pick(ray); if (!h) return null;
    if (button === 2 || shift) {
      if (h.removeCell && this.remove(...h.removeCell)) return 'removed';
      return null;
    }
    if (button === 0 && this.place(...h.placeCell)) return 'placed';
    return null;
  }

  dispose() { this.scene.remove(this.group); this.scene.remove(this.ghost); }
}
