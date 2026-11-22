// UGC accessory spec: the compact JSON a player's creation is stored as, plus the ONE
// builder that turns it into a Three.js object. The editor preview and the in-game
// avatar (src/game/avatar.js -> applyLoadout) both call buildUgcObject(), so what you
// build is exactly what you wear.
//
// Spec v1 (keep it small; server re-validates in publish_ugc_item / save_ugc_draft):
//   { v: 1, template: 'hat'|'face'|'back'|'shoulder', slot: 'hat'|'face'|'back'|'neck',
//     parts: [ { p: 'box'|'sphere'|'cylinder'|'cone'|'torus'|'wedge',
//                pos: [x,y,z], rot: [degX,degY,degZ], scl: [x,y,z], c: '#rrggbb',
//                m: 'matte'|'glossy'|'metal'|'ice'|'glow' } ] }
// Coordinates are classic-avatar space relative to the slot's bone (same space as the
// built-in cosmetic BUILDERS); body types re-fit through the anchors in bodyTypes.js.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const UGC_SPEC_VERSION = 1;
export const UGC_MAX_PARTS = 24;
export const UGC_NAME_MAX = 32;
export const UGC_PRICE = { min: 50, max: 5000, default: 150 };

export const PRIMITIVES = [
  ['box', 'Box', '🟦'], ['sphere', 'Sphere', '⚪'], ['cylinder', 'Cylinder', '🥫'],
  ['cone', 'Cone', '🔺'], ['torus', 'Ring', '⭕'], ['wedge', 'Wedge', '📐'],
];
export const PRIMITIVE_IDS = PRIMITIVES.map(p => p[0]);

export const MATERIALS = [
  ['matte', 'Matte'], ['glossy', 'Glossy'], ['metal', 'Metal'], ['ice', 'Ice'], ['glow', 'Glow'],
];
export const MATERIAL_IDS = MATERIALS.map(m => m[0]);

// Slot frames (classic space). bone = avatar bone the item rides on; center/ext = the
// box parts must stay inside (so creations hug the slot instead of becoming giant);
// maxScale = per-axis cap for one part.
export const UGC_SLOTS = {
  hat:  { slot: 'hat',  bone: 'head',  label: 'Hat',      icon: '🎩', center: [0, 0.78, 0],     ext: [0.62, 0.62, 0.62], maxScale: 1.1 },
  face: { slot: 'face', bone: 'head',  label: 'Face',     icon: '🕶️', center: [0, 0.34, 0.36],  ext: [0.5, 0.4, 0.3],    maxScale: 0.8 },
  back: { slot: 'back', bone: 'torso', label: 'Back',     icon: '🎒', center: [0, 0.05, -0.5],  ext: [0.9, 0.75, 0.45],  maxScale: 1.2 },
  shoulder: { slot: 'neck', bone: 'torso', label: 'Shoulder', icon: '🐧', center: [0.36, 0.72, 0], ext: [0.5, 0.45, 0.4], maxScale: 0.7 },
};
export const TEMPLATE_IDS = Object.keys(UGC_SLOTS);
const SLOT_TO_TEMPLATE = { hat: 'hat', face: 'face', back: 'back', neck: 'shoulder' };
export const frameFor = (spec) => UGC_SLOTS[spec?.template] || UGC_SLOTS[SLOT_TO_TEMPLATE[spec?.slot]] || UGC_SLOTS.hat;

const P = (p, pos, scl, c, m = 'matte', rot = [0, 0, 0]) => ({ p, pos, rot, scl, c, m });
/** Starter shapes per template (players can delete everything and start from primitives). */
export const STARTERS = {
  hat: [
    P('cylinder', [0, 0.64, 0], [1.0, 0.05, 1.0], '#26324a', 'glossy'),
    P('cylinder', [0, 0.92, 0], [0.62, 0.52, 0.62], '#26324a', 'glossy'),
    P('cylinder', [0, 0.73, 0], [0.64, 0.1, 0.64], '#6cc8ff', 'glow'),
    P('sphere',   [0.22, 0.82, 0.24], [0.14, 0.14, 0.14], '#e9f7ff', 'ice'),
  ],
  face: [
    P('box', [-0.15, 0.38, 0.33], [0.22, 0.14, 0.04], '#14202e', 'glossy'),
    P('box', [0.15, 0.38, 0.33], [0.22, 0.14, 0.04], '#14202e', 'glossy'),
    P('box', [0, 0.41, 0.33], [0.1, 0.03, 0.03], '#c8d6e5', 'metal'),
  ],
  back: [
    P('box', [0, 0.05, -0.38], [0.6, 0.7, 0.26], '#3f9de0', 'matte'),
    P('box', [0, -0.12, -0.53], [0.46, 0.26, 0.08], '#1f6fae', 'matte'),
    P('cylinder', [0, 0.42, -0.38], [0.5, 0.08, 0.08], '#e9f7ff', 'ice', [0, 0, 90]),
  ],
  shoulder: [
    P('sphere', [0.36, 0.68, 0], [0.26, 0.28, 0.24], '#f4f8fb', 'matte'),
    P('sphere', [0.36, 0.88, 0.02], [0.2, 0.2, 0.2], '#f4f8fb', 'matte'),
    P('cone', [0.36, 0.88, 0.14], [0.06, 0.08, 0.06], '#f2a33a', 'glossy', [90, 0, 0]),
    P('torus', [0.36, 0.78, 0], [0.34, 0.34, 0.5], '#d83a3f', 'matte', [90, 0, 0]),
  ],
};

export function newSpec(template = 'hat', { blank = false } = {}) {
  const f = UGC_SLOTS[template] || UGC_SLOTS.hat;
  return { v: UGC_SPEC_VERSION, template: SLOT_TO_TEMPLATE[f.slot], slot: f.slot,
    parts: blank ? [] : (STARTERS[SLOT_TO_TEMPLATE[f.slot]] || []).map(p => structuredClone(p)) };
}

/** A new primitive placed at the slot centre. */
export function newPart(p, spec, color = '#6cc8ff') {
  const f = frameFor(spec), s = Math.min(0.3, f.maxScale);
  return { p: PRIMITIVE_IDS.includes(p) ? p : 'box', pos: [...f.center], rot: [0, 0, 0], scl: [s, s, s], c: color, m: 'matte' };
}

// ---------- validation / clamping (client mirror of the SQL checks) ----------
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const HEX = /^#[0-9a-f]{6}$/i;

/** Clamp one part into the slot frame. Returns a NEW clean part. */
export function clampPart(part, spec) {
  const f = frameFor(spec);
  const pos = [0, 1, 2].map(i => r3(clamp(num(part?.pos?.[i], f.center[i]), f.center[i] - f.ext[i], f.center[i] + f.ext[i])));
  const rot = [0, 1, 2].map(i => Math.round(clamp(num(part?.rot?.[i]), -180, 180)));
  const scl = [0, 1, 2].map(i => r3(clamp(num(part?.scl?.[i], 0.2), 0.02, f.maxScale)));
  return { p: PRIMITIVE_IDS.includes(part?.p) ? part.p : 'box', pos, rot, scl,
    c: HEX.test(part?.c) ? part.c.toLowerCase() : '#6cc8ff', m: MATERIAL_IDS.includes(part?.m) ? part.m : 'matte' };
}

/** Normalize a whole spec (drops junk keys, clamps every part, caps part count). */
export function sanitizeSpec(spec) {
  const f = frameFor(spec);
  const tpl = SLOT_TO_TEMPLATE[f.slot];
  const out = { v: UGC_SPEC_VERSION, template: tpl, slot: f.slot, parts: [] };
  for (const p of (Array.isArray(spec?.parts) ? spec.parts : []).slice(0, UGC_MAX_PARTS)) out.parts.push(clampPart(p, out));
  return out;
}

// Light name filter: no shared profanity list exists in the repo (chat is Safe Chat phrases only),
// so this is a small local blocklist + leetspeak fold. The SQL mirrors the same idea.
const BLOCK = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'nigg', 'fag', 'slut', 'whore', 'rape', 'nazi', 'porn', 'sex', 'kys', 'retard', 'asshole'];
const fold = (s) => s.toLowerCase().replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/[5$]/g, 's').replace(/7/g, 't').replace(/[^a-z]/g, '');
export function nameProblem(name) {
  const n = String(name ?? '').trim();
  if (n.length < 3) return 'Name needs at least 3 characters';
  if (n.length > UGC_NAME_MAX) return `Name can be at most ${UGC_NAME_MAX} characters`;
  if (!/^[\p{L}\p{N} '’!?.,&:()-]+$/u.test(n)) return 'Use letters, numbers, spaces and simple punctuation only';
  const f = fold(n);
  if (BLOCK.some(w => f.includes(w))) return 'Please pick a friendlier name';
  return null;
}

/** All problems blocking publish ([] = ok). */
export function validateForPublish({ name, spec, price }) {
  const errs = [];
  const np = nameProblem(name); if (np) errs.push(np);
  if (!spec || !UGC_SLOTS[spec.template] || frameFor(spec).slot !== spec.slot) errs.push('Pick a slot (hat, face, back or shoulder)');
  const n = spec?.parts?.length || 0;
  if (n < 1) errs.push('Add at least one part');
  if (n > UGC_MAX_PARTS) errs.push(`At most ${UGC_MAX_PARTS} parts`);
  const p = Math.round(+price);
  if (!Number.isFinite(p) || p < UGC_PRICE.min || p > UGC_PRICE.max) errs.push(`Price must be ${UGC_PRICE.min}–${UGC_PRICE.max.toLocaleString()} Birg Bucks`);
  if (spec && JSON.stringify(spec).length > 8000) errs.push('Creation is too large');
  return errs;
}

// ---------- builder (shared by editor + avatar) ----------
const GEO = {};
function wedgeGeometry() {
  const s = new THREE.Shape(); s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(-0.5, 0.5); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); g.computeVertexNormals(); return g;
}
export function partGeometry(p) {
  return GEO[p] ||= ({
    box: () => new RoundedBoxGeometry(1, 1, 1, 2, 0.05),
    sphere: () => new THREE.SphereGeometry(0.5, 28, 18),
    cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 28),
    cone: () => new THREE.ConeGeometry(0.5, 1, 28),
    torus: () => new THREE.TorusGeometry(0.36, 0.14, 14, 36),
    wedge: wedgeGeometry,
  }[p] || (() => new THREE.BoxGeometry(1, 1, 1)))();
}

export function partMaterial(m, color) {
  const c = new THREE.Color(color);
  switch (m) {
    case 'glossy': return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.18, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 });
    case 'metal':  return new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 0.85, emissive: c.clone().multiplyScalar(0.08) });
    case 'ice':    return new THREE.MeshPhysicalMaterial({ color: c.clone().lerp(new THREE.Color('#bfe9ff'), 0.35), roughness: 0.04, metalness: 0.05, transparent: true, opacity: 0.8,
      emissive: c.clone().lerp(new THREE.Color('#3fb6ff'), 0.5).multiplyScalar(0.35), clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.6, iridescenceIOR: 1.4,
      specularIntensity: 1, sheen: 0.4, sheenColor: new THREE.Color('#e6f7ff'), flatShading: true, depthWrite: false });
    case 'glow':   return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.35, roughness: 0.5, toneMapped: false });
    default:       return new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0 });
  }
}

/** One mesh for one part (exported so the editor can rebuild a single part live). */
export function buildPartMesh(part) {
  const mesh = new THREE.Mesh(partGeometry(part.p), partMaterial(part.m, part.c));
  mesh.position.fromArray(part.pos);
  mesh.rotation.set(...part.rot.map(d => THREE.MathUtils.degToRad(d)));
  mesh.scale.fromArray(part.scl);
  mesh.castShadow = true;
  if (part.m === 'ice') mesh.renderOrder = 2;
  return mesh;
}

/** Spec -> { bone, object } (the avatar BUILDERS contract). */
export function buildUgcObject(rawSpec) {
  const spec = sanitizeSpec(rawSpec);
  const g = new THREE.Group(); g.name = 'ugc';
  spec.parts.forEach((p, i) => { const m = buildPartMesh(p); m.userData.partIndex = i; g.add(m); });
  const glow = spec.parts.some(p => p.m === 'glow');
  if (glow) {   // gentle pulse on glow parts so creations feel alive
    let t = 0; g.userData.tick = (dt) => { t += dt; const k = 1.15 + Math.sin(t * 2.2) * 0.3; g.traverse(o => { if (o.isMesh && o.material.toneMapped === false) o.material.emissiveIntensity = k; }); };
  }
  g.userData.dispose = () => g.traverse(o => { if (o.isMesh) o.material.dispose(); });
  return { bone: frameFor(spec).bone, object: g };
}
