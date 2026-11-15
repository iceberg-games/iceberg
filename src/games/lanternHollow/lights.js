// Light pool: the world registers many "virtual" point lights (hearths, lamp posts, crystals, mushrooms);
// each frame only the N nearest to the camera target get one of a FIXED set of real PointLights.
// A constant light count means no shader recompiles and a bounded per-fragment cost (mobile: 6, desktop: 10).
import * as THREE from 'three';

export class LightPool {
  constructor(scene, count = 10) {
    this.virtual = []; this.real = [];
    for (let i = 0; i < count; i++) { const l = new THREE.PointLight('#ffffff', 0, 10, 1.7); l.castShadow = false; scene.add(l); this.real.push(l); }
  }
  /** Register a light; returns the record (mutate intensity / color / on freely). */
  add(x, y, z, color, intensity, distance, { flicker = 0, area = null, on = true } = {}) {
    const v = { pos: new THREE.Vector3(x, y, z), color: new THREE.Color(color), intensity, distance, flicker, area, on, phase: Math.random() * 10, mul: 1 };
    this.virtual.push(v); return v;
  }
  remove(v) { const i = this.virtual.indexOf(v); if (i >= 0) this.virtual.splice(i, 1); }
  update(t, center, area) {
    const list = this.virtual.filter(v => v.on && v.mul > 0.01 && (!area || !v.area || v.area === area))
      .map(v => ({ v, d: v.pos.distanceToSquared(center) - v.distance * v.distance * 0.25 })).sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.real.length; i++) {
      const l = this.real[i], e = list[i];
      if (!e) { l.intensity = 0; continue; }
      const v = e.v; l.position.copy(v.pos); l.color.copy(v.color); l.distance = v.distance;
      l.intensity = v.intensity * v.mul * (v.flicker ? 1 + Math.sin(t * 11 + v.phase) * v.flicker * 0.6 + Math.sin(t * 23.7 + v.phase) * v.flicker * 0.4 : 1);
    }
  }
  dispose() { for (const l of this.real) l.removeFromParent(); }
}
