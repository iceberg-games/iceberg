// FINAL showcase batch (Nov 15) — lane 1, owned by Iceberg Cosmetics.
//   fs_glacier_wings  (back)  — layered faceted ice-crystal wings, glowing veins, breathing flap, snowflake sparkles
//   fs_polar_cub_pal  (neck)  — chunky polar-bear cub riding the LEFT (armL-side, -X) shoulder: fur shells, knit scarf,
//                               ice-pick charm, breathing / blinking / ear twitch / look-around / little wave
// Lane 2 (Iceberg Cosmetics 2) builds fs_aurora_lantern_staff in finalShowcaseLane2.js — do NOT merge maps here.
//
// Contract (same as qolGm1Wearables.js): builders are authored in classic space and return { bone, object };
// avatar.js parents `object` under the per-bone anchor (torso -> 'back'/'neck' anchor), so items follow every
// body type (classic|tall|stout|pip|glacier|yeti) and the R15 rig seam. Because the torso anchor scales
// NON-uniformly (tw, th, td/0.5), each item keeps a `fit` holder that cancels that stretch every tick and applies
// one uniform size factor instead, so wings/cub never get squashed on Pip or smeared wide on Glacier.
// Animation runs from object.userData.tick(dt) (Avatar.animate -> attached[*].userData.tick). All time is
// accumulated from dt (deterministic, pauses with the game). Particles: one pooled THREE.Points per item, capped.
// object.userData.dispose() frees per-item GPU resources (shared textures are module-cached and kept).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- quality switch
// 'high' = MeshPhysicalMaterial (clearcoat + iridescence + sheen). 'low' = MeshStandardMaterial, fewer particles,
// no fur shells. Set before items are built (e.g. from a perf/device setting); default auto-picks low on touch devices.
let QUALITY = (typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '')) ? 'low' : 'high';
export function setFinalShowcaseQuality(q) { QUALITY = q === 'low' ? 'low' : 'high'; }
export const finalShowcaseQuality = () => QUALITY;
const HQ = () => QUALITY !== 'low';

// ---------------------------------------------------------------- shared helpers
const _c = (h) => new THREE.Color(h);
const tint = (hex, toward, t) => _c(hex).lerp(_c(toward), t);
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; }
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

/** Tiny procedural "icy sky" cube map so glossy/clearcoat materials have something to reflect in any scene. */
let _env = null;
function iceEnv() {
  if (_env) return _env;
  const face = (top, bottom, sun) => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, top); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    if (sun) { const r = x.createRadialGradient(40, 18, 0, 40, 18, 26); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = r; x.fillRect(0, 0, 64, 64); }
    return c;
  };
  const side = (s) => face('#e8f6ff', '#7fa8c8', s);
  _env = new THREE.CubeTexture([side(true), side(false), face('#ffffff', '#ffffff'), face('#5a7d99', '#5a7d99'), side(false), side(true)]);
  _env.colorSpace = THREE.SRGBColorSpace; _env.needsUpdate = true; return _env;
}

/** Soft six-armed snowflake sprite with a glow core (particles). */
let _flake = null;
function flakeTexture() {
  if (_flake) return _flake;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.18, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineCap = 'round'; x.translate(32, 32);
  for (let i = 0; i < 6; i++) {
    x.rotate(Math.PI / 3); x.lineWidth = 2.6; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -24); x.stroke();
    x.lineWidth = 1.8; for (const d of [-11, -17]) { x.beginPath(); x.moveTo(0, d); x.lineTo(5, d - 5); x.moveTo(0, d); x.lineTo(-5, d - 5); x.stroke(); }
  }
  _flake = new THREE.CanvasTexture(c); _flake.colorSpace = THREE.SRGBColorSpace; return _flake;
}

/**
 * Pooled sparkle particles (one draw call). Each particle: position, size (world units), alpha, rotation.
 * Size attenuates with distance using the real viewport height (read in onBeforeRender).
 */
function makeSparkles(max, color) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max), rot = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: flakeTexture() }, uColor: { value: _c(color) }, uScale: { value: 400 } },
    vertexShader: `attribute float aSize; attribute float aAlpha; attribute float aRot; uniform float uScale;
      varying float vA; varying float vR;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = aAlpha > 0.001 ? aSize * uScale / max(0.05, -mv.z) : 0.0; vA = aAlpha; vR = aRot; }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; varying float vA; varying float vR;
      void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); p = mat2(c,-s,s,c) * p + 0.5;
        vec4 t = texture2D(uMap, p); vec3 col = mix(uColor, vec3(1.0), 0.55 * t.r);
        gl_FragColor = vec4(col * t.a * vA, t.a * vA); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.castShadow = false; pts.renderOrder = 10;
  const _v = new THREE.Vector2();
  pts.onBeforeRender = (renderer, _s, cam) => { renderer.getDrawingBufferSize(_v); mat.uniforms.uScale.value = _v.y * (cam.projectionMatrix?.elements[5] || 1) * 0.5; };
  const P = Array.from({ length: max }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.05, r: 0, vr: 0, ph: 0 }));
  let next = 0;
  return {
    points: pts, mat,
    spawn(x, y, z, o = {}) {
      const p = P[next]; next = (next + 1) % max;
      Object.assign(p, { life: 0, max: o.life ?? 2, x, y, z, vx: o.vx ?? 0, vy: o.vy ?? -0.1, vz: o.vz ?? 0, s: o.size ?? 0.05, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2, ph: Math.random() * 6.28, glint: !!o.glint });
    },
    update(dt, t) {
      for (let i = 0; i < max; i++) {
        const p = P[i];
        if (p.life >= p.max) { alpha[i] = 0; continue; }
        p.life += dt; const k = p.life / p.max;
        p.x += (p.vx + Math.sin(t * 1.7 + p.ph) * 0.04) * dt; p.y += p.vy * dt; p.z += (p.vz + Math.cos(t * 1.3 + p.ph) * 0.03) * dt; p.r += p.vr * dt;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        const fade = Math.min(1, k * 6) * Math.max(0, 1 - k) ** 1.2;
        alpha[i] = p.glint ? Math.sin(Math.min(1, k) * Math.PI) ** 2 : fade * (0.75 + 0.25 * Math.sin(t * 9 + p.ph));
        size[i] = p.glint ? p.s * (0.4 + Math.sin(k * Math.PI) * 1.2) : p.s; rot[i] = p.glint ? p.r * 0.2 : p.r;
      }
      for (const a of ['position', 'aSize', 'aAlpha', 'aRot']) geo.attributes[a].needsUpdate = true;
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

/**
 * Cancel the torso anchor's non-uniform scale and apply one uniform factor k (clamped).
 * Returns the anchor scale so callers can also place things relative to the real body.
 */
function fitHolder(holder, kFn) {
  const a = holder.parent?.scale; if (!a) return null;
  const sx = a.x || 1, sy = a.y || 1, sz = a.z || 1, k = kFn(sx, sy, sz);
  holder.scale.set(k / sx, k / sy, k / sz);
  return { sx, sy, sz, k };
}

function disposeTree(root, keep = new Set()) {
  const seen = new Set();
  root.traverse(o => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    for (const m of [].concat(o.material || [])) { if (seen.has(m)) continue; seen.add(m);
      for (const k of ['map', 'emissiveMap', 'alphaMap', 'bumpMap']) { const t = m[k]; if (t && !keep.has(t) && !seen.has(t)) { seen.add(t); t.dispose(); } }
      m.dispose(); }
  });
}

// =====================================================================================================
// 1) GLACIER WINGS (fs_glacier_wings, back)
// =====================================================================================================

/** Vein texture: bright rachis down the middle + diagonal barbs, used as the emissive map (glow follows veins). */
let _veinTex = null;
function veinTexture() {
  if (_veinTex) return _veinTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 64, 256);
  const glow = (w, a) => { x.strokeStyle = `rgba(255,255,255,${a})`; x.lineWidth = w; };
  x.lineCap = 'round';
  for (const [w, a] of [[9, 0.18], [4, 0.5], [1.6, 1]]) { glow(w, a); x.beginPath(); x.moveTo(32, 256); x.lineTo(32, 6); x.stroke(); }
  for (let y = 236; y > 30; y -= 17) {
    const len = 10 + (y / 256) * 14;
    for (const s of [-1, 1]) for (const [w, a] of [[4, 0.18], [1.3, 0.75]]) { glow(w, a * (0.5 + y / 512)); x.beginPath(); x.moveTo(32, y); x.quadraticCurveTo(32 + s * len * 0.5, y - 6, 32 + s * len, y - 16); x.stroke(); }
  }
  // frosted rim along the outer edges (u=0 / u=1)
  const rim = x.createLinearGradient(0, 0, 64, 0); rim.addColorStop(0, 'rgba(255,255,255,0.35)'); rim.addColorStop(0.12, 'rgba(255,255,255,0)'); rim.addColorStop(0.88, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(255,255,255,0.35)');
  x.fillStyle = rim; x.fillRect(0, 0, 64, 256);
  _veinTex = new THREE.CanvasTexture(c); _veinTex.colorSpace = THREE.SRGBColorSpace; return _veinTex;
}

/**
 * Faceted crystal feather: diamond cross-section (edge, front ridge, edge, back ridge) swept along a gently
 * curved spine, pointed tip. Non-indexed so flatShading gives crisp cut-ice facets. uv: u across, v along.
 * Vertex color = frost gradient (deep tint at the quill -> pale frost at the tip); repainted on recolor.
 */
function featherGeometry(len, wid, thick, { bend = 0.08, asym = 0.25, segs = 7 } = {}) {
  const rings = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, y = t * len;
    const w = wid * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)), 0.75) * (1 - t * 0.15);
    const h = thick * (1 - t * 0.55), z = -bend * t * t, xo = wid * 0.25 * t * t;   // sweep back + slight trailing curl
    rings.push([[-w * (1 - asym) + xo, y, z], [xo, y, z + h], [w * (1 + asym) + xo, y, z], [xo, y, z - h * 0.8]].map((p, k) => ({ p, u: [0, 0.5, 1, 0.5][k], v: t })));
  }
  const tip = { p: [wid * 0.25, len * 1.08, -bend * 1.1], u: 0.5, v: 1 }, base = { p: [0, -len * 0.04, 0], u: 0.5, v: 0 };
  const P = [], U = [], T = [];
  const tri = (a, b, c) => { for (const q of [a, b, c]) { P.push(...q.p); U.push(q.u, q.v); T.push(q.v); } };
  for (let k = 0; k < 4; k++) tri(base, rings[0][(k + 1) % 4], rings[0][k]);
  for (let i = 0; i < segs; i++) for (let k = 0; k < 4; k++) {
    const a = rings[i][k], b = rings[i][(k + 1) % 4], c = rings[i + 1][(k + 1) % 4], d = rings[i + 1][k];
    tri(a, b, c); tri(a, c, d);
  }
  for (let k = 0; k < 4; k++) tri(rings[segs][k], rings[segs][(k + 1) % 4], tip);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(P.length), 3));
  g.userData.t = T; g.computeVertexNormals(); return g;
}
function paintGradient(geo, base, tip) {
  const col = geo.attributes.color, T = geo.userData.t, c = new THREE.Color();
  for (let i = 0; i < T.length; i++) { const k = Math.pow(T[i], 1.6); c.copy(base).lerp(tip, k); col.setXYZ(i, c.r, c.g, c.b); }
  col.needsUpdate = true;
}
/** Merge a list of (geometry, matrix) into one geometry (per tier per wing = one draw call). */
function mergeFeathers(parts) {
  let n = 0; for (const { geo } of parts) n += geo.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = new Float32Array(n * 3), T = [];
  const v = new THREE.Vector3(), nm = new THREE.Matrix3(); let o = 0;
  for (const { geo, m } of parts) {
    nm.getNormalMatrix(m);
    const p = geo.attributes.position, nn = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++, o++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); P.set([v.x, v.y, v.z], o * 3);
      v.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize(); N.set([v.x, v.y, v.z], o * 3);
      U.set([uv.getX(i), uv.getY(i)], o * 2); T.push(geo.userData.t[i]);
    }
    geo.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.userData.t = T; g.computeBoundingSphere(); return g;
}

function crystalMaterial(color, tierGlow) {
  const common = {
    color: '#ffffff', vertexColors: true, roughness: 0.14, metalness: 0.05, flatShading: true,
    transparent: true, opacity: 0.84, side: THREE.DoubleSide, depthWrite: false,
    emissive: _c(color), emissiveMap: veinTexture(), emissiveIntensity: tierGlow, envMap: iceEnv(), envMapIntensity: 1.25,
  };
  return HQ()
    ? new THREE.MeshPhysicalMaterial({ ...common, clearcoat: 1, clearcoatRoughness: 0.06, iridescence: 0.45, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 520], specularIntensity: 1 })
    : new THREE.MeshStandardMaterial(common);
}

function buildGlacierWings(color) {
  const g = new THREE.Group(); g.name = 'fs_glacier_wings';
  const fit = new THREE.Group(); g.add(fit);                       // cancels anchor stretch (see fitHolder)
  const root = new THREE.Group(); root.position.set(0, 0.2, 0); fit.add(root);
  const tierMats = [crystalMaterial(color, 1.7), crystalMaterial(color, 1.45), crystalMaterial(color, 1.25), crystalMaterial(color, 1.1)];
  tierMats.forEach((m, i) => { m.userData.base = m.emissiveIntensity; m.userData.tier = i; });
  const silver = new THREE.MeshStandardMaterial({ color: '#c3d6e6', metalness: 0.9, roughness: 0.28, envMap: iceEnv(), envMapIntensity: 1.1 });
  const gemM = HQ()
    ? new THREE.MeshPhysicalMaterial({ color: tint(color, '#ffffff', 0.35), emissive: _c(color), emissiveIntensity: 0.9, roughness: 0.05, clearcoat: 1, flatShading: true, envMap: iceEnv(), envMapIntensity: 1.5 })
    : new THREE.MeshStandardMaterial({ color: tint(color, '#ffffff', 0.35), emissive: _c(color), emissiveIntensity: 0.9, roughness: 0.08, flatShading: true, envMap: iceEnv() });
  const glowM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });

  // --- back brooch: hexagonal frost-silver bezel, faceted heart gem, six tiny snowflake prongs
  const brooch = new THREE.Group(); brooch.position.set(0, 0, -0.02); root.add(brooch);
  const bezel = mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.045, 6), silver); bezel.rotation.x = Math.PI / 2; brooch.add(bezel);
  const ring = mesh(new THREE.TorusGeometry(0.12, 0.014, 6, 6), silver, 0, 0, -0.024); ring.rotation.z = Math.PI / 6; brooch.add(ring);
  const heart = mesh(new THREE.OctahedronGeometry(0.075, 0), gemM, 0, 0, -0.05); heart.scale.set(1, 1.25, 0.6); brooch.add(heart);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const p = mesh(new THREE.ConeGeometry(0.014, 0.07, 4), silver, Math.sin(a) * 0.15, Math.cos(a) * 0.15, -0.012); p.rotation.z = -a; brooch.add(p); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: flakeTexture(), color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.32); halo.position.set(0, 0, -0.08); brooch.add(halo);

  // --- wings
  const wings = [];
  const arm = [[0.05, 0.0, 0], [0.38, 0.12, -0.05], [0.74, 0.38, -0.11], [0.98, 0.66, -0.16]];   // shoulder -> elbow -> wrist -> hand
  const armCurve = new THREE.CatmullRomCurve3(arm.map(p => new THREE.Vector3(...p)));
  const armGeo = new THREE.TubeGeometry(armCurve, 24, 0.022, 6, false);
  // tiers: [count, from(curve t), to(curve t), length, width, angleFrom, angleTo, z, glowTier]
  const TIERS = [
    { n: 9, t0: 0.55, t1: 1.0, len: [0.68, 1.08], wid: 0.09, a0: -1.1, a1: 0.5, z: 0.0 },    // primaries (long, fan from the hand)
    { n: 8, t0: 0.1, t1: 0.62, len: [0.58, 0.74], wid: 0.085, a0: -1.66, a1: -1.08, z: -0.035 },  // secondaries (hang from the forearm)
    { n: 8, t0: 0.12, t1: 0.95, len: [0.3, 0.4], wid: 0.072, a0: -1.45, a1: -0.25, z: -0.07 },  // coverts (short overlay)
    { n: 5, t0: 0.05, t1: 0.55, len: [0.15, 0.2], wid: 0.06, a0: -1.3, a1: -0.7, z: -0.1 },     // scapulars (tiny, along the shoulder)
  ];
  const tierGeos = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.08, 0.02, -0.02); root.add(pivot);
    const body = new THREE.Group(); body.scale.x = sx; pivot.add(body);     // left wing = mirrored right wing
    const tips = [];
    body.add(mesh(armGeo, silver));
    for (const [i, p] of arm.entries()) if (i) { const k = mesh(new THREE.OctahedronGeometry(0.03 + i * 0.006, 0), gemM, ...p); k.rotation.y = i; body.add(k); }
    const tiers = TIERS.map((T, ti) => {
      const grp = new THREE.Group(); body.add(grp);
      const parts = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < T.n; i++) {
        const f = i / (T.n - 1), at = armCurve.getPoint(T.t0 + (T.t1 - T.t0) * f);
        const ang = T.a0 + (T.a1 - T.a0) * f, L = T.len[0] + (T.len[1] - T.len[0]) * (ti === 0 ? Math.sin(f * Math.PI * 0.62) : f);
        const geo = featherGeometry(L, T.wid * (ti === 0 ? 1 - f * 0.25 : 1), 0.024, { bend: 0.05 + L * 0.06, asym: 0.3 });
        e.set(0, ti % 2 ? 0.08 : -0.06, ang - Math.PI / 2); q.setFromEuler(e);
        m.compose(new THREE.Vector3(at.x, at.y, at.z + T.z - i * 0.004), q, new THREE.Vector3(1, 1, 1));
        if (ti === 0) { const tip = new THREE.Vector3(0.02, L * 1.05, -0.06).applyMatrix4(m); tips.push(tip); }
        parts.push({ geo, m: m.clone() });
      }
      const merged = mergeFeathers(parts); merged.userData.tier = ti; tierGeos.push(merged);
      const fm = mesh(merged, tierMats[ti]); fm.renderOrder = 1 + ti; fm.castShadow = ti < 2; grp.add(fm);
      return grp;
    });
    // tip markers (for sparkle spawning) ride the primaries tier so they follow the flap
    const markers = tips.map(p => { const o = new THREE.Object3D(); o.position.copy(p); tiers[0].add(o); return o; });
    // a soft additive glow streak along the arm (reads as inner light from the front, too)
    const streak = mesh(new THREE.TubeGeometry(armCurve, 20, 0.04, 6, false), glowM); streak.castShadow = false; streak.renderOrder = 6; body.add(streak);
    wings.push({ pivot, sx, tiers, markers });
  }
  // per tier: primaries deepest, coverts/scapulars frostier, tips fade to rime white
  const paint = (c) => tierGeos.forEach(gg => { const i = gg.userData.tier; paintGradient(gg, tint(c, i < 2 ? '#0b2a45' : '#ffffff', i < 2 ? 0.16 - i * 0.06 : 0.12 + (i - 2) * 0.12), tint(c, '#ffffff', 0.45 + i * 0.08)); });
  paint(color);

  // --- sparkles: drift off the primary tips + the occasional star glint
  const maxSp = HQ() ? 40 : 18, sp = makeSparkles(maxSp, tint(color, '#ffffff', 0.25)); root.add(sp.points);
  let t = 0, emit = 0, glintIn = 1.2, seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const _w = new THREE.Vector3();
  g.userData.tick = (dt = 0) => {
    dt = Math.min(dt || 0, 0.1); t += dt;
    // uniform size from the torso; root sits on the real back surface (anchor z -0.25 == -td/2 on every body)
    const F = fitHolder(fit, (sx, sy) => THREE.MathUtils.clamp(Math.sqrt(sx * sy) * 1.08, 0.82, 1.38)) || { sy: 1, sz: 1, k: 1 };
    const rootY = (0.14 * F.sy) / F.k, breathe = Math.sin(t * 1.25 + 0.4) * 0.012;
    root.position.set(0, rootY + breathe, (-0.25 * F.sz - 0.03) / F.k);
    // breathe/flap: slow, layered; outer tiers lag the inner ones so the wing "ripples"
    const b = Math.sin(t * 1.25), b2 = Math.sin(t * 1.25 - 0.6);
    for (const w of wings) {
      w.pivot.rotation.y = w.sx * (0.42 + b * 0.14);
      w.pivot.rotation.z = w.sx * (0.06 + b2 * 0.05);
      w.tiers.forEach((tg, i) => { tg.rotation.z = Math.sin(t * 1.25 - 0.35 * (i + 1)) * 0.035 * (i === 0 ? 1.4 : 1); tg.rotation.y = Math.sin(t * 1.25 - 0.5 * i) * 0.04; });
    }
    // vein glow: a pulse that travels from the coverts out to the primaries
    tierMats.forEach((m, i) => { m.emissiveIntensity = m.userData.base * (0.78 + 0.32 * Math.max(0, Math.sin(t * 1.6 - (3 - i) * 0.55)) ** 2); });
    heart.rotation.y = t * 0.8; halo.material.opacity = 0.45 + Math.sin(t * 1.6) * 0.15; halo.material.rotation = t * 0.2;
    // particles (positions in `root` space)
    emit += dt * (HQ() ? 7 : 3.5);
    while (emit >= 1) { emit -= 1;
      const w = wings[rnd() < 0.5 ? 0 : 1], mk = w.markers[Math.floor(rnd() * w.markers.length)];
      mk.getWorldPosition(_w); root.worldToLocal(_w);
      sp.spawn(_w.x + (rnd() - 0.5) * 0.06, _w.y, _w.z, { life: 1.8 + rnd() * 1.4, vx: w.sx * (0.05 + rnd() * 0.08), vy: -0.12 - rnd() * 0.12, vz: -0.04 - rnd() * 0.05, size: 0.04 + rnd() * 0.035 });
    }
    glintIn -= dt;
    if (glintIn <= 0) { glintIn = 1.6 + rnd() * 2.2;
      const w = wings[rnd() < 0.5 ? 0 : 1], mk = w.markers[Math.floor(rnd() * w.markers.length)];
      mk.getWorldPosition(_w); root.worldToLocal(_w); sp.spawn(_w.x, _w.y, _w.z, { life: 0.7, vx: 0, vy: 0, vz: 0, size: 0.16, glint: true });
    }
    sp.update(dt, t);
  };
  g.userData.tick(0);
  g.userData.setColor = (c) => {
    tierMats.forEach(m => m.emissive.set(c)); paint(c);
    gemM.color.copy(tint(c, '#ffffff', 0.35)); gemM.emissive.set(c); glowM.color.set(c); halo.material.color.set(c);
    sp.mat.uniforms.uColor.value.copy(tint(c, '#ffffff', 0.25));
  };
  g.userData.dispose = () => { sp.dispose(); disposeTree(g, new Set([veinTexture(), flakeTexture(), iceEnv()])); };
  g.userData.finalShowcase = true;
  return { bone: 'torso', object: g };
}

// =====================================================================================================
// 2) POLAR CUB SHOULDER PAL (fs_polar_cub_pal, neck slot like penguin_pal / wh_wolf_pup_pal)
// =====================================================================================================

/** Fur strand texture for shells: tiny bright dots of random strength (alphaTest picks fewer per layer). */
let _furTex = null;
function furTexture() {
  if (_furTex) return _furTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) { const v = Math.floor(90 + r() * 165); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.floor(r() * 128), Math.floor(r() * 128), 1 + (r() < 0.3 ? 1 : 0), 2); }
  _furTex = new THREE.CanvasTexture(c); _furTex.wrapS = _furTex.wrapT = THREE.RepeatWrapping; _furTex.repeat.set(5, 3); return _furTex;
}
/** Knit texture tinted to `color` with two snow-white stripes (scarf). */
function knitScarfTexture(color, stripes = true) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
  const base = _c(color), dark = base.clone().multiplyScalar(0.72), light = base.clone().lerp(_c('#ffffff'), 0.22);
  x.fillStyle = base.getStyle(); x.fillRect(0, 0, 64, 128);
  if (stripes) { x.fillStyle = '#f6f3ee'; x.fillRect(0, 34, 64, 12); x.fillRect(0, 82, 64, 12); }
  for (let row = 0; row < 16; row++) for (let col = 0; col < 8; col++) {           // V stitches
    const X = col * 8, Y = row * 8; const onStripe = stripes && ((Y >= 32 && Y < 48) || (Y >= 80 && Y < 96));
    x.strokeStyle = onStripe ? '#ffffff' : light.getStyle(); x.lineWidth = 2.2; x.beginPath(); x.moveTo(X + 1, Y + 1); x.lineTo(X + 4, Y + 7); x.lineTo(X + 7, Y + 1); x.stroke();
    x.strokeStyle = onStripe ? '#cfc8bd' : dark.getStyle(); x.lineWidth = 1; x.beginPath(); x.moveTo(X + 4, Y); x.lineTo(X + 4, Y + 8); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
/** Lumpy sphere (fluffy silhouette): radial noise on a UV sphere. */
function fluffSphere(r, ws = 28, hs = 20, amp = 0.045, seed = 1, phiStart = 0, phiLen = Math.PI * 2) {
  const g = new THREE.SphereGeometry(r, ws, hs, phiStart, phiLen), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = v.clone().normalize();
    const k = Math.sin(n.x * 9 + seed) * Math.sin(n.y * 11 + seed * 2) * Math.sin(n.z * 10 + seed * 3) + 0.5 * Math.sin(n.x * 23 + n.y * 19 + seed);
    v.addScaledVector(n, r * amp * k); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}

function buildPolarCub(color) {
  const g = new THREE.Group(); g.name = 'fs_polar_cub_pal';
  const fit = new THREE.Group(); g.add(fit);
  // cub root: sits on top of the LEFT (armL, -X) shoulder, so right-hand items (e.g. lane 2's lantern staff and its
  // orbiting motes) never pass through it. Authored facing +Z with its waving paw on +x, then mirrored (scale.x -1)
  // so the waving paw is the outer one.
  const P = new THREE.Group(); P.scale.x = -1; fit.add(P);
  const furCol = '#f5f7f6';
  const fur = HQ()
    ? new THREE.MeshPhysicalMaterial({ color: furCol, roughness: 0.92, sheen: 1, sheenRoughness: 0.55, sheenColor: _c('#cfe9ff'), envMap: iceEnv(), envMapIntensity: 0.35 })
    : new THREE.MeshStandardMaterial({ color: furCol, roughness: 0.95 });
  const cream = new THREE.MeshStandardMaterial({ color: '#f3e9d8', roughness: 0.95 });
  const pink = new THREE.MeshStandardMaterial({ color: '#efb3c1', roughness: 0.9 });
  const pad = new THREE.MeshStandardMaterial({ color: '#4c4652', roughness: 0.75 });
  const gloss = HQ()
    ? new THREE.MeshPhysicalMaterial({ color: '#18161c', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05, envMap: iceEnv(), envMapIntensity: 1.2 })
    : new THREE.MeshStandardMaterial({ color: '#18161c', roughness: 0.2, envMap: iceEnv() });
  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  // fur shells (layered geometry => soft fuzzy silhouette); shared strand map, rising alphaTest per layer
  const shellMats = HQ() ? [0.42, 0.58, 0.74].map((a, i) => new THREE.MeshStandardMaterial({ color: tint(furCol, '#dbe9f5', 0.15 * i), roughness: 1, alphaMap: furTexture(), alphaTest: a, transparent: false })) : [];
  const furry = (geo, x, y, z, sc = [1, 1, 1], shells = true, shellGeo = geo) => {
    const m = mesh(geo, fur, x, y, z); m.scale.set(...sc);
    if (shells) shellMats.forEach((sm, i) => { const s = new THREE.Mesh(shellGeo, sm); s.scale.setScalar(1 + 0.035 * (i + 1)); s.castShadow = false; m.add(s); });
    return m;
  };

  // --- body (sitting, chunky), belly patch, tail
  const bodyG = new THREE.Group(); P.add(bodyG);
  const body = furry(fluffSphere(0.15, 24, 18, 0.05, 2), 0, 0.15, -0.01, [1.05, 1.0, 0.98]); bodyG.add(body);
  const belly = mesh(fluffSphere(0.1, 20, 14, 0.04, 5), cream, 0, 0.12, 0.085); belly.scale.set(1, 1.1, 0.6); bodyG.add(belly);
  bodyG.add(furry(new THREE.SphereGeometry(0.04, 12, 10), 0, 0.08, -0.155, [1, 1, 1], true));
  // hind legs stretched forward, paw pads showing (very readable from the front)
  for (const s of [-1, 1]) {
    const leg = furry(fluffSphere(0.065, 16, 12, 0.05, 3 + s), s * 0.085, 0.045, 0.08, [0.9, 0.8, 1.25], false); bodyG.add(leg);
    const foot = new THREE.Group(); foot.position.set(s * 0.09, 0.04, 0.165); bodyG.add(foot);
    // big pad + three toe beans merged into one draw call
    const beans = [new THREE.CircleGeometry(0.03, 16).translate(0, 0, 0.002), ...[0, 1, 2].map(k => new THREE.CircleGeometry(0.011, 10).translate((k - 1) * 0.02, 0.035, 0))];
    const padM = mesh(mergeGeometries(beans), pad); padM.castShadow = false; foot.add(padM); beans.forEach(b => b.dispose());
  }
  // front paws: inner one rests on the knee; outer one (+x) is a pivot for the wave
  const pawRest = furry(fluffSphere(0.045, 14, 10, 0.05, 9), -0.075, 0.12, 0.115, [0.9, 1.3, 0.9], false); pawRest.rotation.x = 0.5; bodyG.add(pawRest);
  const waveArm = new THREE.Group(); waveArm.position.set(0.105, 0.2, 0.06); bodyG.add(waveArm);
  const armM = furry(fluffSphere(0.045, 14, 10, 0.05, 11), 0.0, -0.07, 0.02, [0.9, 1.45, 0.9], false); waveArm.add(armM);
  const palm = mesh(new THREE.CircleGeometry(0.022, 12), pad, 0, -0.125, 0.052); palm.rotation.x = -0.3; waveArm.add(palm);
  waveArm.rotation.set(-0.35, 0, 0.25);

  // --- knit scarf: wrap + knot + hanging tail with fringe, and the tiny ice-pick charm on a cord
  let scarfTex = knitScarfTexture(color), wrapTex = knitScarfTexture(color, false);
  wrapTex.repeat.set(4, 1); scarfTex.repeat.set(1, 1);
  const scarfM = new THREE.MeshStandardMaterial({ map: wrapTex, bumpMap: wrapTex, bumpScale: 0.6, roughness: 0.95 });
  const tailM = new THREE.MeshStandardMaterial({ map: scarfTex, bumpMap: scarfTex, bumpScale: 0.6, roughness: 0.95, side: THREE.DoubleSide });
  const fringeM = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  const wrap = mesh(new THREE.TorusGeometry(0.098, 0.032, 10, 28), scarfM, 0, 0.27, 0.0); wrap.rotation.x = Math.PI / 2 - 0.12; wrap.scale.set(1, 1, 0.85); bodyG.add(wrap);
  const knot = mesh(new THREE.SphereGeometry(0.034, 14, 10), scarfM, -0.055, 0.255, 0.085); knot.scale.set(1, 0.85, 0.8); bodyG.add(knot);
  const scarfTail = new THREE.Group(); scarfTail.position.set(-0.05, 0.25, 0.128); bodyG.add(scarfTail);
  const tailGeo = new THREE.PlaneGeometry(0.056, 0.16, 1, 6); { const p = tailGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, 0.012 * Math.sin((0.08 - y) * 9)); } tailGeo.computeVertexNormals(); }
  const tailMesh = mesh(tailGeo, tailM, 0, -0.08, 0.012); tailMesh.rotation.z = 0.12; scarfTail.add(tailMesh);
  for (let k = 0; k < 5; k++) { const fr = mesh(new THREE.CylinderGeometry(0.0045, 0.003, 0.03, 5), fringeM, -0.022 + k * 0.011 + 0.02, -0.172, 0.016 + 0.006); fr.rotation.z = 0.12; scarfTail.add(fr); }
  // ice-pick charm: wooden shaft, steel pick + adze, frosty grip band, tiny glinting crystal; swings on a cord
  const charm = new THREE.Group(); charm.position.set(0.035, 0.245, 0.135); charm.scale.setScalar(1.45); bodyG.add(charm);
  const cord = mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.05, 5), new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 1 }), 0, -0.025, 0); charm.add(cord);
  const axe = new THREE.Group(); axe.position.set(0, -0.05, 0); axe.rotation.z = 0.35; charm.add(axe);
  const steel = new THREE.MeshStandardMaterial({ color: '#dfe7ee', metalness: 0.9, roughness: 0.22, envMap: iceEnv(), envMapIntensity: 1.3 });
  axe.add(mesh(new THREE.CylinderGeometry(0.0055, 0.0065, 0.085, 8), new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.7 }), 0, -0.045, 0));
  axe.add(mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.022, 8), new THREE.MeshStandardMaterial({ color: '#5fc8ff', roughness: 0.5, emissive: '#2a8fd0', emissiveIntensity: 0.25 }), 0, -0.07, 0));
  const head = new THREE.Group(); head.position.set(0, -0.002, 0); axe.add(head);
  head.add(mesh(new THREE.BoxGeometry(0.018, 0.016, 0.012), steel));
  const pick = mesh(new THREE.ConeGeometry(0.007, 0.05, 4), steel, 0.03, -0.006, 0); pick.rotation.z = -Math.PI / 2 - 0.3; head.add(pick);
  const adze = mesh(new THREE.BoxGeometry(0.03, 0.014, 0.005), steel, -0.022, 0, 0); adze.rotation.z = 0.15; head.add(adze);
  const charmGem = mesh(new THREE.OctahedronGeometry(0.009, 0), new THREE.MeshStandardMaterial({ color: '#bff0ff', emissive: '#7fdcff', emissiveIntensity: 0.8, roughness: 0.05, flatShading: true }), 0, -0.095, 0); axe.add(charmGem);

  // --- head (big, round), muzzle, nose, eyes with lids-by-squash, ears with pink insides, blush
  const headPivot = new THREE.Group(); headPivot.position.set(0, 0.3, 0.0); bodyG.add(headPivot);
  const H = new THREE.Group(); H.position.set(0, 0.09, 0.0); headPivot.add(H);
  // head shells skip the face cap (+Z) so eyes / muzzle stay crisp
  H.add(furry(fluffSphere(0.118, 26, 18, 0.035, 4), 0, 0, 0, [1.08, 0.98, 1.0], true, fluffSphere(0.118, 20, 16, 0.035, 4, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1)));
  const muzzle = mesh(fluffSphere(0.058, 20, 14, 0.03, 6), cream, 0, -0.035, 0.092); muzzle.scale.set(1.12, 0.82, 0.9); H.add(muzzle);
  const nose = mesh(new THREE.SphereGeometry(0.022, 16, 12), gloss, 0, -0.012, 0.142); nose.scale.set(1.25, 0.8, 0.8); H.add(nose);
  H.add(mesh(new THREE.SphereGeometry(0.006, 8, 6), shine, -0.007, -0.004, 0.158));
  const mouth = mesh(new THREE.TorusGeometry(0.013, 0.0028, 6, 12, Math.PI), pad, 0, -0.052, 0.136); mouth.rotation.z = Math.PI; H.add(mouth);
  const eyes = [], ears = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * 0.048, 0.022, 0.104); H.add(e); eyes.push(e);
    const ball = mesh(new THREE.SphereGeometry(0.019, 14, 10), gloss); ball.scale.set(0.95, 1.15, 0.7); e.add(ball);
    e.add(mesh(new THREE.SphereGeometry(0.0062, 8, 6), shine, s * 0.004 + 0.004, 0.008, 0.012));
    e.add(mesh(new THREE.SphereGeometry(0.003, 6, 4), shine, -0.004, -0.006, 0.013));
    const blush = mesh(new THREE.CircleGeometry(0.018, 14), new THREE.MeshBasicMaterial({ color: '#ff9fb4', transparent: true, opacity: 0.45, depthWrite: false }), s * 0.074, -0.03, 0.093);
    blush.rotation.y = s * 0.7; blush.castShadow = false; H.add(blush);
    const ear = new THREE.Group(); ear.position.set(s * 0.082, 0.088, -0.01); ear.rotation.z = -s * 0.35; H.add(ear); ears.push(ear);
    ear.add(furry(new THREE.SphereGeometry(0.036, 16, 12), 0, 0.012, 0, [1, 0.95, 0.55], false));
    const inner = mesh(new THREE.SphereGeometry(0.022, 12, 10), pink, 0, 0.01, 0.014); inner.scale.set(1, 0.95, 0.35); ear.add(inner);
  }
  P.rotation.y = -0.28;         // turned a touch outward (toward -X), still facing the camera

  // --- life: breathing, blinking, ear twitches, look-around (eased), occasional little wave
  let t = 0, seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let blinkIn = 1.4, blinkT = -1, look = { yaw: 0, pitch: 0 }, lookTo = { yaw: -0.25, pitch: 0.05 }, lookIn = 1.8;
  const twitch = [{ in: 2.2, t: -1 }, { in: 3.6, t: -1 }]; let waveIn = 2.2, waveT = -1;
  g.userData.tick = (dt = 0) => {
    dt = Math.min(dt || 0, 0.1); t += dt;
    // place on the real shoulder: x clears both the avatar's head and the cub's own width, y = top of torso
    const F = fitHolder(fit, (sx) => THREE.MathUtils.clamp(0.6 + sx * 0.4, 0.95, 1.25)) || { sx: 1, sy: 1, sz: 1, k: 1 };
    const torsoBone = g.parent?.parent, rig = torsoBone?.parent;
    const headMesh = rig?.children?.find(c => c.name === 'head')?.children?.[0], armL = rig?.children?.find(c => c.name === 'armL');
    const headHalf = headMesh ? headMesh.scale.x / 2 : 0.31, armOuter = armL ? -armL.position.x + (armL.children[0]?.scale.x || 0.5) / 2 : 1;
    const wantX = Math.min(Math.max(F.sx / 2 + 0.02, headHalf + (headHalf > 0.36 ? 0.22 : 0.17) * F.k), armOuter - 0.02 * F.k);
    const fwd = THREE.MathUtils.clamp((headHalf - 0.31) * 0.8, 0, 0.09);   // big heads (Pip): nudge forward so the face doesn't hide it
    P.position.set(-wantX / F.k, (F.sy / 2 - 0.012) / F.k, fwd / F.k);
    // breathing
    const br = Math.sin(t * 2.3);
    body.scale.set(1.05 * (1 + br * 0.018), 1.0 * (1 + br * 0.028), 0.98 * (1 + br * 0.018));
    headPivot.position.y = 0.3 + br * 0.004;
    // look-around (critically-damped toward a new target every few seconds; sometimes peeks at the wearer)
    lookIn -= dt; if (lookIn <= 0) { lookIn = 1.6 + rnd() * 2.6; const r = rnd(); lookTo = r < 0.25 ? { yaw: -0.85, pitch: 0.18 } : { yaw: (rnd() - 0.5) * 1.1, pitch: (rnd() - 0.4) * 0.35 }; }
    look.yaw = damp(look.yaw, lookTo.yaw, 5, dt); look.pitch = damp(look.pitch, lookTo.pitch, 5, dt);
    headPivot.rotation.set(-look.pitch, look.yaw, Math.sin(t * 1.1) * 0.06 - look.yaw * 0.12);
    // blink (sometimes a double blink)
    blinkIn -= dt; if (blinkIn <= 0 && blinkT < 0) { blinkT = 0; blinkIn = 2.2 + rnd() * 3.2; if (rnd() < 0.25) blinkIn = 0.28; }
    let lid = 1; if (blinkT >= 0) { blinkT += dt; const k = blinkT / 0.16; lid = k < 1 ? 1 - Math.sin(k * Math.PI) * 0.92 : 1; if (k >= 1) blinkT = -1; }
    eyes.forEach(e => { e.scale.y = lid; });
    // ear twitches
    twitch.forEach((tw, i) => { tw.in -= dt; if (tw.in <= 0 && tw.t < 0) { tw.t = 0; tw.in = 2.5 + rnd() * 4; }
      let a = 0; if (tw.t >= 0) { tw.t += dt; const k = tw.t / 0.32; a = k < 1 ? Math.sin(k * Math.PI * 3) * (1 - k) * 0.5 : 0; if (k >= 1) tw.t = -1; }
      const s = i ? 1 : -1; ears[i].rotation.set(a * 0.5, 0, -s * 0.35 + s * a); });
    // little wave: lift the outer paw, three waggles, put it back
    waveIn -= dt; if (waveIn <= 0 && waveT < 0) { waveT = 0; waveIn = 6 + rnd() * 5; }
    let lift = 0, wag = 0;
    if (waveT >= 0) { waveT += dt; const D = 1.9, k = waveT / D;
      lift = k < 0.18 ? k / 0.18 : k > 0.82 ? (1 - k) / 0.18 : 1; lift = lift * lift * (3 - 2 * lift);
      wag = Math.sin(waveT * 11) * lift; if (k >= 1) waveT = -1; }
    waveArm.rotation.set(-0.35 + lift * 0.2, 0, 0.25 + lift * 2.45 + wag * 0.3);
    // scarf tail + charm sway (a bit more while waving)
    scarfTail.rotation.set(0.04 + Math.sin(t * 1.9) * 0.05, 0, Math.sin(t * 1.4) * 0.1 + look.yaw * 0.1);
    charm.rotation.set(Math.sin(t * 2.2 + 1) * 0.15, 0, Math.sin(t * 2.7) * 0.22 + wag * 0.15);
    charmGem.rotation.y = t * 2;
    bodyG.rotation.z = -lift * 0.06; bodyG.position.y = Math.abs(br) * 0.002;
  };
  g.userData.tick(0);
  g.userData.setColor = (c) => {
    const nt = knitScarfTexture(c), nw = knitScarfTexture(c, false); nw.repeat.copy(wrapTex.repeat);
    scarfM.map = scarfM.bumpMap = nw; tailM.map = tailM.bumpMap = nt; scarfM.needsUpdate = tailM.needsUpdate = true;
    wrapTex.dispose(); scarfTex.dispose(); wrapTex = nw; scarfTex = nt; fringeM.color.set(c);
  };
  g.userData.dispose = () => disposeTree(g, new Set([furTexture(), iceEnv()]));
  g.userData.finalShowcase = true;
  return { bone: 'torso', object: g };
}

// ---------------------------------------------------------------- registry (spread into avatar.js BUILDERS)
export const FINAL_SHOWCASE_BUILDERS = {
  fs_glacier_wings: (_rc, color) => buildGlacierWings(color),
  fs_polar_cub_pal: (_rc, color) => buildPolarCub(color),
};
/** Camera focus for scripts/final3-preview.html: [x, y, z, dist] in classic space. */
export const FINAL_SHOWCASE_PREVIEW_FOCUS = { fs_glacier_wings: [0, 1.75, -0.3, 5.0], fs_polar_cub_pal: [-0.55, 2.25, 0.1, 1.6] };
