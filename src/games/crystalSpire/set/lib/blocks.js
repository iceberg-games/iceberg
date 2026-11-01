// Instanced block batching: collect thousands of boxes (or any shared geometry)
// per material and emit one InstancedMesh each. Per-instance colors may exceed 1
// (HDR) so glow materials (MeshBasicMaterial, toneMapped:false) feed the bloom pass.
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

export class Batch {
  constructor() { this.groups = new Map(); }
  _g(mat, geo) {
    const key = mat.uuid + ':' + geo.uuid;
    if (!this.groups.has(key)) this.groups.set(key, { mat, geo, items: [] });
    return this.groups.get(key).items;
  }
  /** Centered box. rot = [rx, ry, rz] (radians, XYZ order). color = hex/Color/[r,g,b] (HDR ok). */
  box(mat, x, y, z, sx, sy, sz, color = 0xffffff, rot = null) { return this.add(mat, UNIT_BOX, x, y, z, sx, sy, sz, color, rot); }
  add(mat, geo, x, y, z, sx = 1, sy = 1, sz = 1, color = 0xffffff, rot = null) {
    const items = this._g(mat, geo);
    items.push({ x, y, z, sx, sy, sz, color, rot });
    return items.length - 1;
  }
  build(parent, { cast = true, receive = true } = {}) {
    const meshes = [];
    for (const { mat, geo, items } of this.groups.values()) {
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach((b, i) => {
        _p.set(b.x, b.y, b.z); _s.set(b.sx, b.sy, b.sz);
        if (b.rot) _q.setFromEuler(_e.set(b.rot[0], b.rot[1], b.rot[2], b.rot[3] || 'XYZ')); else _q.identity();
        im.setMatrixAt(i, _m.compose(_p, _q, _s));
        if (Array.isArray(b.color)) _c.setRGB(b.color[0], b.color[1], b.color[2]); else _c.set(b.color);
        im.setColorAt(i, _c);
      });
      im.castShadow = cast && !mat.userData.noShadow; im.receiveShadow = receive;
      im.computeBoundingSphere();
      parent.add(im); meshes.push(im);
    }
    return meshes;
  }
}

/** Glow material for lights/windows: unlit, HDR, bloom picks it up. `level` scales all instances (day/night). */
export function glowMaterial(opts = {}) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: opts.fog ?? true, ...opts });
  delete m.level;
  m.userData.noShadow = true;
  return m;
}

/** Inject a world-space pattern into a standard material (works with instancing). pattern = GLSL returning a multiplier for diffuse. */
export function worldPattern(mat, glsl) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wp_ = vec4(transformed, 1.0);
        vec3 wn_ = objectNormal;
        #ifdef USE_INSTANCING
          wp_ = instanceMatrix * wp_; wn_ = mat3(instanceMatrix) * wn_;
        #endif
        vWP = (modelMatrix * wp_).xyz; vWN = normalize(mat3(modelMatrix) * wn_);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWP; varying vec3 vWN;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
        float patternMul(){ ${glsl} }`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= patternMul();');
  };
  mat.customProgramCacheKey = () => glsl;
  return mat;
}

export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export { UNIT_BOX };
