// Enemy + boss visuals (composed primitives, emissive eyes, squash & stretch). Driven by render records
// (host: live sim objects; clients: interpolated snapshots). Views never decide gameplay.
import * as THREE from 'three';
import { DEF, ST } from './enemies.js';

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
const BUILDERS = { slime: () => buildSlime('slime'), slimeBig: () => buildSlime('slimeBig'), slimelet: () => buildSlime('slimelet'), spore: buildSpore, creeper: buildCreeper, moth: buildMoth };

export class EnemyViews {
  constructor(scene, camera) { this.scene = scene; this.camera = camera; this.views = new Map(); }
  _make(rec) {
    const v = BUILDERS[rec.type](); v.type = rec.type; v.flash = 0; v.bar = hpBar(); v.bar.position.y = DEF[rec.type].r * 2 + (rec.type === 'moth' ? 2.3 : rec.type === 'creeper' ? 1.4 : 0.6); v.g.add(v.bar);
    v.g.position.set(rec.x, 0, rec.z); v.spawnT = 0; this.scene.add(v.g); this.views.set(rec.id, v); return v;
  }
  flash(id) { const v = this.views.get(id); if (v) v.flash = 0.14; }
  /** recs: render records; now: ms clock matching atkAt. Returns ids that vanished (for poofs when no slain event arrived). */
  update(recs, dt, t, now) {
    const seen = new Set();
    for (const r of recs) {
      seen.add(r.id); const v = this.views.get(r.id) || this._make(r), d = DEF[r.type];
      v.g.position.x = r.x; v.g.position.z = r.z; v.spawnT = Math.min(1, v.spawnT + dt * 3);
      let ry = v.g.rotation.y, df = Math.atan2(Math.sin(r.facing - ry), Math.cos(r.facing - ry)); v.g.rotation.y = ry + df * Math.min(1, dt * 10);
      const windK = r.st === ST.windup && r.atkAt ? Math.min(1, Math.max(0, 1 - (r.atkAt - d.travel * 1000 - now) / (d.windup * 1000))) : 0;
      const strikeK = r.st === ST.strike && r.atkAt && d.travel ? Math.min(1, Math.max(0, 1 - (r.atkAt - now) / (d.travel * 1000))) : 0;
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
    const moss = this.moss = std('#3f6a3a', { roughness: 0.9, flatShading: true, emissive: '#1a3a10', emissiveIntensity: 0.4 });
    const bulbGeo = new THREE.IcosahedronGeometry(1, 2), p = bulbGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(0.9 + Math.sin(v.x * 7) * Math.cos(v.z * 6) * 0.08); p.setXYZ(i, v.x, v.y, v.z); } bulbGeo.computeVertexNormals();
    const bulb = this.bulb = new THREE.Mesh(bulbGeo, moss); bulb.scale.set(3.0, 2.4, 3.0); bulb.position.y = 1.8; bulb.castShadow = true; g.add(bulb);
    const rootMat = std('#4a3226', { roughness: 0.85, emissive: '#2a1a3a', emissiveIntensity: 0.4 });
    this.tent = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6, r = 2.4 + t * 4.5; pts.push(new THREE.Vector3(Math.cos(a + t * 0.6) * r, 1.4 * (1 - t) + Math.sin(t * Math.PI) * 0.8, Math.sin(a + t * 0.6) * r)); }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.32, 7), rootMat); m.castShadow = true; const pv = new THREE.Group(); pv.add(m); g.add(pv); this.tent.push(pv); }
    const petalMat = this.petalMat = std('#e05aa8', { emissive: '#a01a6a', emissiveIntensity: 0.7, roughness: 0.5, side: THREE.DoubleSide });
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
    const show = !!b && !b.dead; this.g.visible = show || (this.deadT ?? 0) < 1.2; if (!this.g.visible) return;
    if (b?.dead) { this.deadT = (this.deadT ?? 0) + dt; this.g.scale.setScalar(Math.max(0.01, 1 - this.deadT * 0.8)); return; }
    this.deadT = 0; this.g.scale.setScalar(1);
    const stunned = b && now < b.stunUntil, wind = b?.atk && now < b.atkAt ? 1 - Math.max(0, (b.atkAt - now) / 1000) : 0;
    const open = stunned ? 0.1 : b?.atk === 2 ? 0.4 + wind * 0.8 : b?.atk === 1 ? 0.3 + wind * 0.9 : 0.35 + Math.sin(t * 1.5) * 0.1;
    this.petals.forEach((p, i) => { p.rotation.x = -open + Math.sin(t * 2 + i) * 0.05; });
    this.bulb.scale.set(3.0 + Math.sin(t * 1.3) * 0.08, 2.4 - (b?.atk === 1 ? wind * 0.4 : 0) + Math.cos(t * 1.3) * 0.06, 3.0 + Math.sin(t * 1.3) * 0.08);
    this.tent.forEach((p, i) => { p.rotation.y = Math.sin(t * 0.7 + i) * 0.08 + (b?.atk === 2 ? Math.sin(wind * Math.PI) * 0.3 : 0); });
    if (b?.atk === 2) this.maw.rotation.y += (b.dir - this.maw.rotation.y) * Math.min(1, dt * 4);
    if (this.flashT > 0) this.flashT -= dt;
    this.moss.emissive.set(this.flashT > 0 ? '#ffffff' : stunned ? '#5a5a10' : '#1a3a10'); this.moss.emissiveIntensity = this.flashT > 0 ? 1.2 : stunned ? 0.9 + Math.sin(t * 20) * 0.3 : 0.4 + wind * 0.5;
    this.petalMat.emissiveIntensity = 0.7 + wind;
  }
  dispose() { this.g.removeFromParent(); }
}
