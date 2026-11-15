// Enemy + boss visuals (composed primitives, emissive eyes, squash & stretch). Driven by render records
// (host: live sim objects; clients: interpolated snapshots). Views never decide gameplay.
import * as THREE from 'three';
import { DEF, ST, atkOf } from './enemies.js';

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
const eyeMat = new THREE.MeshBasicMaterial({ color: '#141022' }), glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const G = { sphere: new THREE.SphereGeometry(1, 20, 14), eye: new THREE.SphereGeometry(0.12, 10, 8), glint: new THREE.SphereGeometry(0.04, 6, 4) };

function eyes(parent, y, z, spread, s = 1, mat = eyeMat) {
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(G.eye, mat); e.position.set(sx * spread, y, z); e.scale.setScalar(s); parent.add(e);
    if (mat === eyeMat) { const gl = new THREE.Mesh(G.glint, glintMat); gl.position.set(sx * spread + 0.04 * s, y + 0.05 * s, z + 0.1 * s); gl.scale.setScalar(s); parent.add(gl); } }
}
function hpBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: '#1a0f2a', transparent: true, opacity: 0.75, depthTest: false }));
  const fgGeo = new THREE.PlaneGeometry(1.14, 0.09); fgGeo.translate(0.57, 0, 0);
  const fg = new THREE.Mesh(fgGeo, new THREE.MeshBasicMaterial({ color: '#ff7a5a', depthTest: false })); fg.position.set(-0.57, 0, 0.001);
  bg.renderOrder = fg.renderOrder = 20; g.add(bg, fg); g.visible = false; g.userData.fg = fg; return g;
}

function buildSlime(type) {
  const d = DEF[type], s = d.r, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const col = type === 'slimeBig' ? '#45d9a8' : type === 'slimelet' ? '#7ff0d0' : '#3fe0c0';
  const skin = new THREE.Mesh(G.sphere, std(col, { transparent: true, opacity: 0.78, roughness: 0.15, emissive: '#109a80', emissiveIntensity: 0.55 }));
  skin.scale.set(s, s * 0.82, s); skin.position.y = s * 0.8; skin.castShadow = true; body.add(skin);
  const core = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: '#d8fff4', toneMapped: false })); core.scale.setScalar(s * 0.28); core.position.set(0, s * 0.7, -s * 0.15); body.add(core);
  eyes(body, s * 1.0, s * 0.72, s * 0.3, s * 1.1);
  return { g, body, mats: [skin.material], squash: body };
}
function buildSpore() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.8, 12), std('#e8dcf5', { emissive: '#3a2a5a', emissiveIntensity: 0.3 })); stem.position.y = 0.4; stem.castShadow = true; body.add(stem);
  const cap = new THREE.Mesh(G.sphere, std('#c86bd8', { emissive: '#7a1aa0', emissiveIntensity: 0.6, roughness: 0.5 })); cap.scale.set(1.0, 0.75, 1.0); cap.position.y = 1.15; cap.castShadow = true; body.add(cap);
  const dot = new THREE.MeshBasicMaterial({ color: '#fff08a', toneMapped: false });
  for (let i = 0; i < 12; i++) { const a = i * 2.4, h = 0.2 + (i % 4) * 0.15, m = new THREE.Mesh(G.sphere, dot); m.scale.setScalar(0.09 + (i % 3) * 0.03); m.position.set(Math.cos(a) * 0.85 * Math.sqrt(1 - h * h), 1.15 + h * 0.75, Math.sin(a) * 0.85 * Math.sqrt(1 - h * h)); body.add(m); }
  eyes(body, 0.55, 0.36, 0.16, 0.9);
  return { g, body, mats: [cap.material, stem.material], squash: body, cap };
}
function buildCreeper() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mound = new THREE.Mesh(G.sphere, std('#3a2a22', { roughness: 0.95, flatShading: true })); mound.scale.set(1.0, 0.35, 1.0); mound.position.y = 0.05; mound.castShadow = true; g.add(mound);
  const rootMat = std('#5a3a26', { emissive: '#2a4a10', emissiveIntensity: 0.5, roughness: 0.8 }), tipMat = new THREE.MeshBasicMaterial({ color: '#b6ff7a', toneMapped: false });
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28, c = new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4), new THREE.Vector3(Math.cos(a) * 0.7, 0.9, Math.sin(a) * 0.7), new THREE.Vector3(Math.cos(a + 0.6) * 0.5, 1.7, Math.sin(a + 0.6) * 0.5), new THREE.Vector3(Math.cos(a + 1) * 0.2, 2.2, Math.sin(a + 1) * 0.2)]);
    const t = new THREE.Mesh(new THREE.TubeGeometry(c, 14, 0.12, 6), rootMat); t.castShadow = true; body.add(t); const tip = new THREE.Mesh(G.sphere, tipMat); tip.scale.setScalar(0.1); tip.position.copy(c.getPoint(1)); body.add(tip); }
  const bulb = new THREE.Mesh(G.sphere, std('#6a4a2a', { roughness: 0.7 })); bulb.scale.set(0.55, 0.65, 0.55); bulb.position.y = 0.8; body.add(bulb);
  const eye = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: '#c6ff5a', toneMapped: false })); eye.scale.setScalar(0.17); eye.position.set(0, 0.95, 0.45); body.add(eye);
  return { g, body, mats: [rootMat, bulb.material], squash: body, mound };
}
function buildMoth() {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = 1.7; g.add(body);
  const bmat = std('#2a1a40', { transparent: true, opacity: 1, roughness: 0.4, emissive: '#3a1a6a', emissiveIntensity: 0.5 });
  const torso = new THREE.Mesh(G.sphere, bmat); torso.scale.set(0.22, 0.22, 0.55); body.add(torso);
  const head = new THREE.Mesh(G.sphere, bmat); head.scale.setScalar(0.2); head.position.z = 0.5; body.add(head);
  eyes(body, 0.06, 0.62, 0.09, 0.7, new THREE.MeshBasicMaterial({ color: '#d07aff', toneMapped: false }));
  const wShape = new THREE.Shape(); wShape.moveTo(0, 0); wShape.bezierCurveTo(0.5, 0.5, 1.3, 0.45, 1.25, -0.1); wShape.bezierCurveTo(1.1, -0.6, 0.4, -0.7, 0, -0.15);
  const wmat = new THREE.MeshStandardMaterial({ color: '#3a2266', emissive: '#5a2aa0', emissiveIntensity: 0.6, transparent: true, opacity: 0.9, side: THREE.DoubleSide, roughness: 0.5 });
  const spot = new THREE.MeshBasicMaterial({ color: '#e8a0ff', toneMapped: false, side: THREE.DoubleSide });
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Group(); w.scale.x = s; body.add(w); const m = new THREE.Mesh(new THREE.ShapeGeometry(wShape, 10), wmat); m.rotation.x = -Math.PI / 2; w.add(m);
    const sp = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), spot); sp.rotation.x = -Math.PI / 2; sp.position.set(0.75, 0.01, -0.05); w.add(sp); wings.push(w); }
  return { g, body, mats: [bmat, wmat], fade: [bmat, wmat], wings };
}

// ---------- Sunken Mine ----------
const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; parent?.add(m); return m; };
function buildGolem() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const rust = std('#8a5a3a', { metalness: 0.6, roughness: 0.55, flatShading: true, emissive: '#3a1a08', emissiveIntensity: 0.3 }), dark = std('#4a3a34', { metalness: 0.5, roughness: 0.6, flatShading: true });
  const torso = box(1.6, 1.5, 1.1, rust, 0, 1.75, 0, body); box(1.1, 0.5, 0.9, dark, 0, 2.7, 0, body);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.05), new THREE.MeshBasicMaterial({ color: '#ffb03a', toneMapped: false })); visor.position.set(0, 2.72, 0.46); body.add(visor);
  const arms = []; for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * 1.05, 2.2, 0); body.add(a); box(0.5, 1.4, 0.5, dark, 0, -0.6, 0, a); box(0.75, 0.7, 0.75, rust, 0, -1.45, 0.1, a); arms.push(a); }
  for (const s of [-1, 1]) box(0.55, 1.0, 0.6, dark, s * 0.45, 0.5, 0, body);
  const gear = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.09, 6, 10), std('#c79a4a', { metalness: 0.8, roughness: 0.3 })); gear.position.set(0, 1.9, 0.57); body.add(gear);
  return { g, body, mats: [rust], arms, gear, squash: body };
}
function buildBat() {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = 2; g.add(body);
  const fur = std('#2a2030', { roughness: 0.8, emissive: '#1a0a20', emissiveIntensity: 0.3 });
  const torso = new THREE.Mesh(G.sphere, fur); torso.scale.set(0.3, 0.28, 0.38); body.add(torso);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), fur); ear.position.set(s * 0.13, 0.3, 0.12); body.add(ear); }
  eyes(body, 0.08, 0.32, 0.1, 0.7, new THREE.MeshBasicMaterial({ color: '#ffd23a', toneMapped: false }));
  const wShape = new THREE.Shape(); wShape.moveTo(0, 0.1); wShape.lineTo(0.5, 0.3); wShape.lineTo(1.1, 0.15); wShape.lineTo(0.95, -0.15); wShape.lineTo(0.7, -0.05); wShape.lineTo(0.5, -0.25); wShape.lineTo(0.25, -0.1); wShape.lineTo(0, -0.15);
  const wmat = new THREE.MeshStandardMaterial({ color: '#3a2a3a', roughness: 0.7, side: THREE.DoubleSide, emissive: '#2a0a1a', emissiveIntensity: 0.3 }), wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Group(); w.scale.x = s; body.add(w); const m = new THREE.Mesh(new THREE.ShapeGeometry(wShape), wmat); m.rotation.x = -Math.PI / 2; w.add(m); wings.push(w); }
  return { g, body, mats: [fur], wings };
}
function buildKobold() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = std('#9ab8d8', { roughness: 0.7, emissive: '#1a3a5a', emissiveIntensity: 0.3 }), cloth = std('#6a4a2a', { roughness: 0.9 });
  const torso = new THREE.Mesh(G.sphere, cloth); torso.scale.set(0.38, 0.45, 0.32); torso.position.y = 0.75; torso.castShadow = true; body.add(torso);
  const head = new THREE.Mesh(G.sphere, skin); head.scale.set(0.3, 0.27, 0.36); head.position.set(0, 1.35, 0.05); head.castShadow = true; body.add(head);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), std('#c79a4a', { metalness: 0.7, roughness: 0.4 })); helm.position.set(0, 1.42, 0.02); body.add(helm);
  const lamp = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: '#fff0b0', toneMapped: false })); lamp.scale.setScalar(0.07); lamp.position.set(0, 1.6, 0.3); body.add(lamp);
  eyes(body, 1.33, 0.36, 0.11, 0.6, new THREE.MeshBasicMaterial({ color: '#ffe05a', toneMapped: false }));
  const arm = new THREE.Group(); arm.position.set(0.38, 0.95, 0); body.add(arm);
  box(0.06, 0.8, 0.06, std('#5a3a22'), 0, 0.3, 0, arm); const pick = box(0.5, 0.08, 0.08, std('#8a8f9a', { metalness: 0.7 }), 0, 0.68, 0, arm); pick.rotation.z = 0.2;
  return { g, body, mats: [skin], arm, squash: body };
}
function buildWraith() {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = 0.6; g.add(body);
  const cloak = std('#1a1430', { transparent: true, opacity: 1, roughness: 0.6, emissive: '#2a1a5a', emissiveIntensity: 0.6, side: THREE.DoubleSide });
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.0, 10, 3, true), cloak); robe.position.y = 0.9; body.add(robe);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65), cloak); hood.position.y = 1.95; body.add(hood);
  const em = new THREE.MeshBasicMaterial({ color: '#8ad8ff', toneMapped: false, transparent: true, opacity: 1 }); eyes(body, 1.9, 0.3, 0.12, 0.8, em);
  const arms = []; for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.1, 6), cloak); a.position.set(s * 0.6, 1.3, 0.2); a.rotation.z = s * 2.4; body.add(a); arms.push(a); }
  return { g, body, mats: [cloak], fade: [cloak, em], arms };
}
// ---------- Aurora Throne ----------
function buildSentinel() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const iceA = std('#bfe2ff', { roughness: 0.15, metalness: 0.2, flatShading: true, emissive: '#2a7aaa', emissiveIntensity: 0.35 }), dark = std('#3a4a7a', { metalness: 0.5, roughness: 0.4, flatShading: true });
  const torso = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), iceA); torso.scale.set(1, 1.4, 0.7); torso.position.y = 1.5; torso.castShadow = true; body.add(torso);
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), iceA); head.position.y = 2.45; body.add(head);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 4), new THREE.MeshBasicMaterial({ color: '#7affd8', toneMapped: false })); crest.position.y = 2.85; body.add(crest);
  for (const s of [-1, 1]) box(0.22, 0.9, 0.22, dark, s * 0.25, 0.45, 0, body);
  const arm = new THREE.Group(); arm.position.set(0.55, 1.75, 0); body.add(arm);
  const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), dark); spear.rotation.x = Math.PI / 2; spear.position.z = 0.6; arm.add(spear);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), new THREE.MeshBasicMaterial({ color: '#aaffee', toneMapped: false })); tip.rotation.x = Math.PI / 2; tip.position.z = 2.1; arm.add(tip);
  return { g, body, mats: [iceA], arm, squash: body };
}
function buildWisp() {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = 1.6; g.add(body);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), std('#e0fbff', { emissive: '#4ad8ff', emissiveIntensity: 1.4, roughness: 0.1, flatShading: true })); body.add(core);
  const ring = new THREE.Group(); body.add(ring); const sm = std('#bfe8ff', { emissive: '#2a8aff', emissiveIntensity: 0.9, flatShading: true });
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28, m = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), sm); m.scale.y = 2.2; m.position.set(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6); ring.add(m); }
  return { g, body, mats: [core.material, sm], ring };
}
function buildKnight() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const plate = std('#9ab0d8', { metalness: 0.7, roughness: 0.3, flatShading: true, emissive: '#1a2a5a', emissiveIntensity: 0.3 }), dark = std('#2a3050', { metalness: 0.6, roughness: 0.4 });
  box(1.2, 1.3, 0.8, plate, 0, 1.75, 0, body); box(0.75, 0.7, 0.7, plate, 0, 2.75, 0, body);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.05), new THREE.MeshBasicMaterial({ color: '#7affd8', toneMapped: false })); slit.position.set(0, 2.8, 0.36); body.add(slit);
  for (const s of [-1, 1]) { box(0.4, 1.1, 0.45, dark, s * 0.35, 0.55, 0, body); box(0.5, 0.35, 0.6, plate, s * 0.78, 2.35, 0, body); }
  const shieldG = new THREE.Group(); shieldG.position.set(-0.6, 1.6, 0.6); body.add(shieldG);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 6), std('#d8f0ff', { metalness: 0.4, roughness: 0.15, emissive: '#3a8aff', emissiveIntensity: 0.5, flatShading: true })); shield.rotation.x = Math.PI / 2; shieldG.add(shield);
  const arm = new THREE.Group(); arm.position.set(0.8, 2.0, 0); body.add(arm);
  const blade = box(0.14, 1.9, 0.06, std('#e8f6ff', { metalness: 0.8, roughness: 0.2, emissive: '#5aa0ff', emissiveIntensity: 0.4 }), 0, 0.9, 0.2, arm);
  return { g, body, mats: [plate], arm, shieldG, shield, squash: body };
}
function buildShade() {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = 0.2; g.add(body);
  const mat = std('#0a0818', { transparent: true, opacity: 1, roughness: 0.8, emissive: '#3a1a6a', emissiveIntensity: 0.5 });
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(G.sphere, mat); m.scale.set(0.5 - i * 0.06, 0.45, 0.5 - i * 0.06); m.position.y = 0.4 + i * 0.4; body.add(m); }
  const em = new THREE.MeshBasicMaterial({ color: '#ff5ad8', toneMapped: false, transparent: true, opacity: 1 }); eyes(body, 1.9, 0.3, 0.13, 0.9, em);
  const claws = []; for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9, 5), mat); c.position.set(s * 0.55, 1.1, 0.3); c.rotation.x = 1.2; body.add(c); claws.push(c); }
  return { g, body, mats: [mat], fade: [mat, em], claws };
}
const BUILDERS = { slime: () => buildSlime('slime'), slimeBig: () => buildSlime('slimeBig'), slimelet: () => buildSlime('slimelet'), spore: buildSpore, creeper: buildCreeper, moth: buildMoth,
  golem: buildGolem, bat: buildBat, kobold: buildKobold, wraith: buildWraith, sentinel: buildSentinel, wisp: buildWisp, knight: buildKnight, shade: buildShade };
const BAR_Y = { moth: 2.3, creeper: 1.4, golem: 1.0, bat: 1.8, wraith: 1.6, sentinel: 1.6, wisp: 1.6, knight: 1.4, shade: 1.0, kobold: 0.6 };

export class EnemyViews {
  constructor(scene, camera) { this.scene = scene; this.camera = camera; this.views = new Map(); }
  _make(rec) {
    const v = BUILDERS[rec.type](); v.type = rec.type; v.flash = 0; v.bar = hpBar(); v.bar.position.y = DEF[rec.type].r * 2 + (BAR_Y[rec.type] ?? 0.6); v.g.add(v.bar);
    v.g.position.set(rec.x, 0, rec.z); v.spawnT = 0; this.scene.add(v.g); this.views.set(rec.id, v); return v;
  }
  flash(id) { const v = this.views.get(id); if (v) v.flash = 0.14; }
  /** recs: render records; now: ms clock matching atkAt. Returns ids that vanished (for poofs when no slain event arrived). */
  update(recs, dt, t, now) {
    const seen = new Set();
    for (const r of recs) {
      seen.add(r.id); let v = this.views.get(r.id); if (v && v.type !== r.type) { this.scene.remove(v.g); this.views.delete(r.id); v = null; } v ||= this._make(r); const d = DEF[r.type];
      v.g.position.x = r.x; v.g.position.z = r.z; v.spawnT = Math.min(1, v.spawnT + dt * 3);
      let ry = v.g.rotation.y, df = Math.atan2(Math.sin(r.facing - ry), Math.cos(r.facing - ry)); v.g.rotation.y = ry + df * Math.min(1, dt * 10);
      const a = atkOf(r), windK = r.st === ST.windup && r.atkAt ? Math.min(1, Math.max(0, 1 - (r.atkAt - a.travel * 1000 - now) / (a.windup * 1000))) : 0;
      const strikeK = r.st === ST.strike && r.atkAt && a.travel ? Math.min(1, Math.max(0, 1 - (r.atkAt - now) / (a.travel * 1000))) : r.st === ST.strike ? 1 : 0;
      const base = v.spawnT;
      if (d.kind === 'slime') { const hop = r.st === ST.strike ? Math.sin(strikeK * Math.PI) * (1.2 + d.r) : Math.abs(Math.sin(t * 4 + r.id)) * 0.12;
        const sq = r.st === ST.windup ? 1 - windK * 0.35 : r.st === ST.strike ? 1.15 : 1 + Math.sin(t * 8 + r.id) * 0.04;
        v.squash.scale.set(base / Math.sqrt(sq), base * sq, base / Math.sqrt(sq)); v.squash.position.y = hop; }
      else if (d.kind === 'spore') { const inf = r.st === ST.windup ? 1 + windK * 0.45 : r.st === ST.strike ? 1.5 : 1 + Math.sin(t * 2 + r.id) * 0.03; v.cap.scale.set(inf, 0.75 * inf, inf); v.squash.scale.setScalar(base); }
      else if (d.kind === 'creeper') { const up = r.st === ST.burrowed ? 0 : r.st === ST.emerge ? 0.6 : 1; v.upK = (v.upK ?? 0) + (up - (v.upK ?? 0)) * Math.min(1, dt * 8);
        v.body.scale.set(base, Math.max(0.01, v.upK) * base * (r.st === ST.windup ? 1 + windK * 0.2 : 1), base); v.body.visible = v.upK > 0.03; v.mound.scale.set(1.0 + Math.sin(t * 10 + r.id) * 0.05 * (r.st === ST.burrowed ? 1 : 0), 0.35, 1.0); v.body.rotation.y = r.st === ST.windup ? windK * 0.4 : Math.sin(t * 2) * 0.1; }
      else if (d.kind === 'moth') { const flap = Math.sin(t * (r.st === ST.strike ? 30 : 16) + r.id) * 0.7; v.wings[0].rotation.z = flap; v.wings[1].rotation.z = -flap;
        v.body.position.y = 1.7 + Math.sin(t * 3 + r.id) * 0.25 - (r.st === ST.strike ? 0.6 : 0) + (r.st === ST.windup ? windK * 0.4 : 0); v.body.scale.setScalar(base);
        const op = r.lit ? 1 : 0.32; for (const m of v.fade) m.opacity += (op - m.opacity) * Math.min(1, dt * 8); }
      else if (d.kind === 'golem') { v.body.scale.setScalar(base); const lean = r.st === ST.windup ? (r.k === 0 ? -windK * 0.35 : 0) : r.st === ST.strike && r.k === 0 ? 0.4 : 0; v.body.rotation.x += (lean - v.body.rotation.x) * Math.min(1, dt * 10);
        const raise = r.st === ST.windup && r.k === 1 ? -windK * 2.6 : r.st === ST.strike && r.k === 1 ? 0.4 : Math.sin(t * 3 + r.id) * 0.15; v.arms.forEach((a, i) => { a.rotation.x = raise + (i ? 0.1 : -0.1) * Math.sin(t * 4); }); v.gear.rotation.z += dt * (r.st === ST.windup ? 12 : 2);
        v.body.position.y = r.st === ST.chase ? Math.abs(Math.sin(t * 5 + r.id)) * 0.06 : 0; }
      else if (d.kind === 'bat') { const flap = Math.sin(t * (r.st === ST.strike ? 34 : 22) + r.id) * 0.8; v.wings[0].rotation.z = flap; v.wings[1].rotation.z = -flap; v.body.scale.setScalar(base);
        v.body.position.y = 2 + Math.sin(t * 4 + r.id) * 0.3 - (r.st === ST.strike ? 1.0 : 0) + (r.st === ST.windup ? windK * 0.5 : 0); }
      else if (d.kind === 'kobold') { v.body.scale.setScalar(base); v.arm.rotation.x = r.st === ST.windup ? -windK * 2.4 : r.st === ST.strike ? 0.8 : Math.sin(t * 6 + r.id) * 0.2; v.body.position.y = r.st === ST.chase ? Math.abs(Math.sin(t * 9 + r.id)) * 0.1 : 0; }
      else if (d.kind === 'wraith' || d.kind === 'shade') { v.body.scale.setScalar(base * (r.st === ST.windup ? 1 + windK * 0.2 : 1)); v.body.position.y = (d.kind === 'wraith' ? 0.6 : 0.2) + Math.sin(t * 2 + r.id) * 0.2;
        (v.arms || v.claws).forEach((a, i) => { a.rotation.y = Math.sin(t * 3 + i * 2) * 0.3 + (r.st === ST.windup ? windK * (i ? 1 : -1) : 0); });
        const op = r.lit ? 1 : 0.32; for (const m of v.fade) m.opacity += (op - m.opacity) * Math.min(1, dt * 8); }
      else if (d.kind === 'sentinel') { v.body.scale.setScalar(base); v.arm.position.z = r.st === ST.windup ? -windK * 0.6 : r.st === ST.strike ? 0.6 : 0; v.body.rotation.x = r.st === ST.strike ? 0.25 : 0; v.body.position.y = Math.sin(t * 2 + r.id) * 0.05; }
      else if (d.kind === 'wisp') { v.body.scale.setScalar(base * (r.st === ST.windup ? 1 + windK * 0.3 : 1)); v.ring.rotation.y += dt * (r.st === ST.windup ? 9 : 2); v.body.position.y = 1.6 + Math.sin(t * 2.5 + r.id) * 0.25; }
      else if (d.kind === 'knight') { v.body.scale.setScalar(base); v.arm.rotation.x = r.st === ST.windup ? -windK * 2.2 : r.st === ST.strike ? 1.2 : 0;
        const sk = r.broken ? 1 : 0; v.shieldG.rotation.z += ((sk ? 1.3 : 0) - v.shieldG.rotation.z) * Math.min(1, dt * 6); v.shieldG.position.y += ((sk ? 0.6 : 1.6) - v.shieldG.position.y) * Math.min(1, dt * 6); v.shield.material.emissiveIntensity = sk ? 0.05 : 0.5; }
      // flash
      if (v.flash > 0) v.flash -= dt;
      for (const m of v.mats) { if (!m.userData.e0) m.userData.e0 = { i: m.emissiveIntensity, c: m.emissive.getHex() }; if (v.flash > 0) { m.emissive.set('#ffffff'); m.emissiveIntensity = 1.4; } else { m.emissive.setHex(m.userData.e0.c); m.emissiveIntensity = m.userData.e0.i + windK * 0.9; } }
      // hp bar
      const pct = (r.hpPct ?? 100) / 100; v.bar.visible = pct < 0.999 && r.st !== ST.burrowed; if (v.bar.visible) { v.bar.userData.fg.scale.x = Math.max(0.001, pct); v.bar.quaternion.copy(this.camera.quaternion); v.bar.quaternion.premultiply(v.g.quaternion.clone().invert()); }
    }
    const gone = [];
    for (const [id, v] of this.views) if (!seen.has(id)) { gone.push({ id, x: v.g.position.x, z: v.g.position.z, type: v.type }); this.scene.remove(v.g); this.views.delete(id); }
    return gone;
  }
  clear() { for (const v of this.views.values()) this.scene.remove(v.g); this.views.clear(); }
}

/** Mother Mossmaw: mossy root-bulb with an opening flower maw and swaying root tentacles. */
export class MossmawView {
  constructor(scene, [x, z]) {
    const g = this.g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); this.x = x; this.z = z;
    const moss = this.moss = std('#4f8a46', { roughness: 0.85, flatShading: true, emissive: '#2f6a1a', emissiveIntensity: 0.75 });
    // her own glow so she reads in the dark den (one fixed light, created once: no shader churn)
    const glow = this.glow = new THREE.PointLight('#ff6ac8', 26, 24, 1.4); glow.position.set(x, 5.5, z + 3.5); scene.add(glow);   // in the scene (not the group) so hiding her never changes the light count
    const bulbGeo = new THREE.IcosahedronGeometry(1, 2), p = bulbGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(0.9 + Math.sin(v.x * 7) * Math.cos(v.z * 6) * 0.08); p.setXYZ(i, v.x, v.y, v.z); } bulbGeo.computeVertexNormals();
    const bulb = this.bulb = new THREE.Mesh(bulbGeo, moss); bulb.scale.set(3.0, 2.4, 3.0); bulb.position.y = 1.8; bulb.castShadow = true; g.add(bulb);
    const rootMat = std('#4a3226', { roughness: 0.85, emissive: '#2a1a3a', emissiveIntensity: 0.4 });
    this.tent = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6, r = 2.4 + t * 4.5; pts.push(new THREE.Vector3(Math.cos(a + t * 0.6) * r, 1.4 * (1 - t) + Math.sin(t * Math.PI) * 0.8, Math.sin(a + t * 0.6) * r)); }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.32, 7), rootMat); m.castShadow = true; const pv = new THREE.Group(); pv.add(m); g.add(pv); this.tent.push(pv); }
    const petalMat = this.petalMat = std('#e05aa8', { emissive: '#c02a80', emissiveIntensity: 1.3, roughness: 0.5, side: THREE.DoubleSide });
    this.petals = [];
    const maw = this.maw = new THREE.Group(); maw.position.y = 4.0; g.add(maw);
    for (let i = 0; i < 7; i++) { const pv = new THREE.Group(); pv.rotation.y = i / 7 * 6.28; maw.add(pv); const m = new THREE.Mesh(G.sphere, petalMat); m.scale.set(0.9, 0.15, 1.7); m.position.z = 1.5; pv.add(m); this.petals.push(pv); }
    const throat = new THREE.Mesh(G.sphere, new THREE.MeshBasicMaterial({ color: '#ff9ae0', toneMapped: false })); throat.scale.set(1.0, 0.4, 1.0); maw.add(throat); this.throat = throat;
    const toothMat = std('#fff6e0', { roughness: 0.4 });
    for (let i = 0; i < 12; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 6), toothMat); const a = i / 12 * 6.28; t.position.set(Math.cos(a) * 1.0, 0.25, Math.sin(a) * 1.0); t.rotation.set(Math.sin(a) * -0.5, 0, Math.cos(a) * 0.5); maw.add(t); }
    eyes(bulb, 0.35, 0.92, 0.28, 1.6 / 2.4, new THREE.MeshBasicMaterial({ color: '#ffe05a', toneMapped: false }));
    this.flashT = 0; this.visible = true;
  }
  flash() { this.flashT = 0.15; }
  update(b, dt, t, now) {
    if (b && b.x != null) { this.g.position.x = b.x; this.g.position.z = b.z; this.glow.position.set(b.x, 5.5, b.z + 3.5); }
    if (!b) { this.g.visible = false; this.glow.intensity = 0; this.deadT = 0; return; }
    const show = !b.dead; this.g.visible = show || (this.deadT ?? 0) < 1.2; this.glow.intensity = show ? 26 * (b.stunUntil > now ? 1.6 : 1) : 0; if (!this.g.visible) return;
    if (b?.dead) { this.deadT = (this.deadT ?? 0) + dt; this.g.scale.setScalar(Math.max(0.01, 1 - this.deadT * 0.8)); return; }
    this.deadT = 0; this.g.scale.setScalar(1);
    const stunned = b && now < b.stunUntil, wind = b?.atk && now < b.atkAt ? 1 - Math.max(0, (b.atkAt - now) / 1000) : 0;
    const open = stunned ? 0.1 : b?.atk === 2 ? 0.4 + wind * 0.8 : b?.atk === 1 ? 0.3 + wind * 0.9 : 0.35 + Math.sin(t * 1.5) * 0.1;
    this.petals.forEach((p, i) => { p.rotation.x = -open + Math.sin(t * 2 + i) * 0.05; });
    this.bulb.scale.set(3.0 + Math.sin(t * 1.3) * 0.08, 2.4 - (b?.atk === 1 ? wind * 0.4 : 0) + Math.cos(t * 1.3) * 0.06, 3.0 + Math.sin(t * 1.3) * 0.08);
    this.tent.forEach((p, i) => { p.rotation.y = Math.sin(t * 0.7 + i) * 0.08 + (b?.atk === 2 ? Math.sin(wind * Math.PI) * 0.3 : 0); });
    if (b?.atk === 2) this.maw.rotation.y += (b.dir - this.maw.rotation.y) * Math.min(1, dt * 4);
    if (this.flashT > 0) this.flashT -= dt;
    this.moss.emissive.set(this.flashT > 0 ? '#ffffff' : stunned ? '#5a5a10' : '#2f6a1a'); this.moss.emissiveIntensity = this.flashT > 0 ? 1.2 : stunned ? 0.9 + Math.sin(t * 20) * 0.3 : 0.4 + wind * 0.5;
    this.petalMat.emissiveIntensity = 0.7 + wind;
  }
  dispose() { this.g.removeFromParent(); this.glow.removeFromParent(); }
}

/** Common boss-view plumbing: own glow light kept in the scene (never toggled: avoids shader churn), death shrink, flash. */
class BossViewBase {
  constructor(scene, [x, z], color, inten, dist) { this.scene = scene; this.g = new THREE.Group(); this.g.position.set(x, 0, z); scene.add(this.g);
    this.glow = new THREE.PointLight(color, 0, dist, 1.4); this.glow.position.set(x, 4, z); scene.add(this.glow); this.baseGlow = inten; this.flashT = 0; this.deadT = 0; }
  flash() { this.flashT = 0.15; }
  pre(b, dt) { if (!b) { this.g.visible = false; this.glow.intensity = 0; this.deadT = 0; return false; } const show = !b.dead; this.g.visible = show || this.deadT < 1.2; if (!show) this.glow.intensity = 0; if (!this.g.visible) return false;
    if (b?.dead) { this.deadT += dt; this.g.scale.setScalar(Math.max(0.01, 1 - this.deadT * 0.8)); this.glow.intensity = 0; return false; }
    this.deadT = 0; this.g.scale.setScalar(1);
    this.g.position.x += (b.x - this.g.position.x) * Math.min(1, dt * 12); this.g.position.z += (b.z - this.g.position.z) * Math.min(1, dt * 12);
    const ry = this.g.rotation.y; this.g.rotation.y = ry + Math.atan2(Math.sin(b.dir - ry), Math.cos(b.dir - ry)) * Math.min(1, dt * 8);
    if (this.flashT > 0) this.flashT -= dt; return true; }
  dispose() { this.g.removeFromParent(); this.glow.removeFromParent(); }
}

/** The Drowned Foreman: a hulking dwarf in a flooded diving suit — porthole helmet with a visor lamp, a drill arm, glowing back vents. */
export class ForemanView extends BossViewBase {
  constructor(scene, at) {
    super(scene, at, '#ffb060', 22, 22);
    const suit = this.suit = std('#6a7a7a', { metalness: 0.65, roughness: 0.45, flatShading: true, emissive: '#1a2a2a', emissiveIntensity: 0.4 }), brass = std('#c79a4a', { metalness: 0.85, roughness: 0.3 }), rust = std('#7a4a32', { metalness: 0.55, roughness: 0.6, flatShading: true });
    const body = this.body = new THREE.Group(); this.g.add(body);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 2.4, 10), suit); torso.position.y = 2.6; torso.castShadow = true; body.add(torso);
    const belly = new THREE.Mesh(G.sphere, suit); belly.scale.set(1.65, 1.1, 1.5); belly.position.y = 1.9; body.add(belly);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.3, 8), rust); leg.position.set(s * 0.8, 0.65, 0); leg.castShadow = true; body.add(leg); box(0.9, 0.35, 1.3, brass, s * 0.8, 0.18, 0.2, body); }
    const helm = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 14), brass); helm.position.y = 4.4; helm.castShadow = true; body.add(helm);
    const port = this.port = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: '#ffe0a0', toneMapped: false })); port.position.set(0, 4.45, 1.12); body.add(port);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 8, 20), brass); rim.position.set(0, 4.45, 1.1); body.add(rim);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CircleGeometry(0.25, 12), port.material); p.position.set(s * 1.0, 4.4, 0.55); p.rotation.y = s * 1.05; body.add(p); }
    // drill arm (right) + lamp hook arm (left)
    const drillArm = this.drillArm = new THREE.Group(); drillArm.position.set(1.85, 3.1, 0); body.add(drillArm);
    box(0.7, 0.7, 1.6, rust, 0, 0, 0.5, drillArm);
    const drill = this.drill = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.2, 10), std('#9aa0aa', { metalness: 0.9, roughness: 0.25, flatShading: true })); drill.rotation.x = Math.PI / 2; drill.position.z = 2.3; drillArm.add(drill);
    const leftArm = this.leftArm = new THREE.Group(); leftArm.position.set(-1.85, 3.1, 0); body.add(leftArm); box(0.65, 1.8, 0.65, rust, 0, -0.7, 0.2, leftArm); box(0.9, 0.6, 0.9, brass, 0, -1.7, 0.3, leftArm);
    // back tank with vents (FLARE here in phase 2)
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.4, 12), rust); tank.position.set(0, 3, -1.6); body.add(tank);
    this.vents = [-0.45, 0.45].map(x => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 10), new THREE.MeshBasicMaterial({ color: '#ff7a2a', toneMapped: false })); m.position.set(x, 4.4, -1.7); body.add(m); return m; });
    // visor lamp: a beam cone
    this.beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe0a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    this.beam.rotation.x = -Math.PI / 2; this.beam.position.set(0, 4.2, 5.6); body.add(this.beam);
  }
  update(b, dt, t, now) {
    if (!this.pre(b, dt)) return;
    const stunned = now < b.stunUntil, p2 = b.ph >= 2 && now >= b.phAt, wind = b.atk && now < b.atkAt ? Math.max(0, 1 - (b.atkAt - now) / 1600) : 0;
    this.glow.position.set(this.g.position.x + Math.sin(this.g.rotation.y) * 4, 4.2, this.g.position.z + Math.cos(this.g.rotation.y) * 4);
    this.glow.intensity = (p2 ? 30 : this.baseGlow) * (stunned ? 0.4 : 1);
    this.beam.material.opacity = p2 && !stunned ? 0.12 + Math.sin(t * 5) * 0.03 : 0;
    this.drill.rotation.y += dt * (b.atk === 1 ? 40 : 4);
    this.drillArm.rotation.x = b.atk === 1 ? -0.2 : Math.sin(t * 1.5) * 0.1; this.leftArm.rotation.x = b.atk === 3 ? -wind * 2 : b.atk === 2 ? -wind * 2.6 : Math.sin(t * 1.3) * 0.1;
    this.body.rotation.x = stunned ? 0.35 + Math.sin(t * 18) * 0.04 : b.atk === 1 && now >= b.atkAt - 800 ? 0.3 : b.atk === 1 ? -wind * 0.25 : 0;
    this.body.position.y = b.atk === 2 ? Math.sin(Math.min(1, wind) * Math.PI) * 0.6 : 0;
    const vk = p2 ? (stunned ? 0.3 : 1) : 0.15; this.vents.forEach((v, i) => { v.material.color.setRGB(1 * vk + 0.1, 0.48 * vk + 0.05, 0.16 * vk + 0.03); v.scale.setScalar(1 + Math.sin(t * 6 + i) * 0.15 * vk); });
    this.port.material.color.set(stunned ? '#5a3a1a' : '#ffe0a0');
    this.suit.emissive.set(this.flashT > 0 ? '#ffffff' : stunned ? '#5a5a10' : '#1a2a2a'); this.suit.emissiveIntensity = this.flashT > 0 ? 1.2 : 0.4 + wind * 0.4;
  }
}

/** The Hollow Queen: tall, crowned with ice, a sweeping gown and twin aurora blades. Translucent and wrapped in night while invulnerable. */
export class QueenView extends BossViewBase {
  constructor(scene, at) {
    super(scene, at, '#b08aff', 24, 24);
    const gown = this.gown = std('#3a2a7a', { roughness: 0.4, metalness: 0.1, emissive: '#5a2aa0', emissiveIntensity: 0.5, transparent: true, opacity: 1, flatShading: true });
    const skin = this.skin = std('#dfe8ff', { roughness: 0.3, emissive: '#6a8aff', emissiveIntensity: 0.4, transparent: true, opacity: 1 });
    const iceM = std('#e8faff', { roughness: 0.1, metalness: 0.2, emissive: '#7affd8', emissiveIntensity: 0.8, flatShading: true });
    const body = this.body = new THREE.Group(); this.g.add(body);
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.8, 12, 2, true), gown); skirt.position.y = 1.4; skirt.castShadow = true; body.add(skirt);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.3, 10), gown); torso.position.y = 3.3; body.add(torso);
    const head = new THREE.Mesh(G.sphere, skin); head.scale.set(0.34, 0.4, 0.34); head.position.y = 4.3; body.add(head);
    eyes(body, 4.35, 0.3, 0.12, 0.8, new THREE.MeshBasicMaterial({ color: '#7affd8', toneMapped: false }));
    const crown = new THREE.Group(); crown.position.y = 4.7; body.add(crown);
    for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.38, m = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5 + (3 - Math.abs(i - 3)) * 0.25, 4), iceM); m.position.set(Math.sin(a) * 0.32, 0.2, Math.cos(a) * 0.28 - 0.05); m.rotation.z = -a * 0.4; crown.add(m); }
    // cape
    const cape = this.cape = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6, 6, 8), std('#1a1450', { side: THREE.DoubleSide, emissive: '#3a1a8a', emissiveIntensity: 0.4, transparent: true, opacity: 1 })); cape.position.set(0, 2.2, -0.6); body.add(cape); this.capeBase = cape.geometry.attributes.position.array.slice();
    this.blades = [-1, 1].map(s => { const arm = new THREE.Group(); arm.position.set(s * 0.6, 3.7, 0); body.add(arm);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.1, 6), gown); sleeve.position.y = -0.5; arm.add(sleeve);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.03), new THREE.MeshBasicMaterial({ color: s > 0 ? '#9affd8' : '#d0a8ff', toneMapped: false })); blade.position.set(0, -1.1, 1.0); blade.rotation.x = Math.PI / 2; arm.add(blade); return arm; });
    // dark aura for the Long Night
    this.aura = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14), new THREE.MeshBasicMaterial({ color: '#05030f', transparent: true, opacity: 0, depthWrite: false, side: THREE.BackSide })); this.aura.position.y = 2.4; this.g.add(this.aura);
    this.fade = [gown, skin, cape.material];
  }
  update(b, dt, t, now) {
    if (!this.pre(b, dt)) return;
    const inv = b.night && !(b.aur > now), aur = b.night && b.aur > now, dash = (b.atk === 1 || b.atk === 4), wind = b.atk && now < b.atkAt ? Math.max(0, 1 - (b.atkAt - now) / 1000) : 1;
    this.glow.position.set(this.g.position.x, 4.5, this.g.position.z + 1.5); this.glow.intensity = aur ? 40 : inv ? 6 : this.baseGlow; this.glow.color.set(aur ? '#9affd8' : '#b08aff');
    const op = inv ? 0.45 : 1; for (const m of this.fade) m.opacity += (op - m.opacity) * Math.min(1, dt * 4);
    this.aura.material.opacity += ((inv ? 0.45 : 0) - this.aura.material.opacity) * Math.min(1, dt * 3);
    this.body.position.y = 0.25 + Math.sin(t * 1.6) * 0.15;
    this.blades.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.x = dash ? -1.2 + Math.sin(t * 14 + i) * 0.4 : b.atk === 2 ? -2.6 * wind : -0.3 + Math.sin(t * 2 + i) * 0.1; a.rotation.z = s * (dash ? 0.8 : 0.25); });
    this.body.rotation.x = dash && now >= b.atkAt - 650 ? 0.35 : 0;
    const p = this.cape.geometry.attributes.position, base = this.capeBase; for (let i = 0; i < p.count; i++) { const y = base[i * 3 + 1]; p.array[i * 3 + 2] = base[i * 3 + 2] - (1.8 - y) * 0.15 * (1 + Math.sin(t * 3 + base[i * 3] * 2 + y) * 0.4) * (dash ? 2 : 1); } p.needsUpdate = true;
    this.gown.emissive.set(this.flashT > 0 ? '#ffffff' : aur ? '#3affc0' : '#5a2aa0'); this.gown.emissiveIntensity = this.flashT > 0 ? 1.3 : aur ? 1.2 : 0.5;
  }
}

export const BOSS_VIEWS = { mossmaw: MossmawView, foreman: ForemanView, queen: QueenView };
