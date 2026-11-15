// Lantern Hollow effects: instanced particle bursts, telegraph decals (circle / ring / line / cone),
// soft light-radius decals, slash arcs, ember/material pickups. All pooled; no per-frame allocation in hot paths.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Radial gradient texture (white center → transparent) for soft glows. */
let glowTex = null;
export function getGlowTex() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); glowTex = new THREE.CanvasTexture(c); return glowTex;
}

export class Particles {
  constructor(scene, max = 500) {
    this.max = max; this.parts = [];
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1), new THREE.MeshBasicMaterial({ toneMapped: false }), max);
    this.mesh.frustumCulled = false; this.mesh.count = 0; scene.add(this.mesh);
    this.M = new THREE.Matrix4(); this.Q = new THREE.Quaternion(); this.S = new THREE.Vector3(); this.C = new THREE.Color(); this.E = new THREE.Euler();
  }
  burst(at, colors, n = 16, speed = 4, { up = 3, size = 0.12, life = 0.8, grav = 9, drag = 0 } = {}) {
    for (let i = 0; i < n; i++) { if (this.parts.length >= this.max) this.parts.shift();
      this.parts.push({ p: at.clone(), v: V((Math.random() - 0.5) * speed * 2, Math.random() * up + up * 0.3, (Math.random() - 0.5) * speed * 2), c: colors[i % colors.length], life, max: life, size: size * (0.6 + Math.random() * 0.8), grav, drag, r: Math.random() * 6 }); }
  }
  update(dt) {
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) if ((this.parts[i].life -= dt) <= 0) this.parts.splice(i, 1);
    for (const q of this.parts) {
      q.v.y -= q.grav * dt; if (q.drag) q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt)); q.p.addScaledVector(q.v, dt); q.r += dt * 8;
      const s = q.size * Math.min(1, q.life / q.max * 1.6);
      this.Q.setFromEuler(this.E.set(q.r, q.r * 0.7, 0)); this.S.set(s, s * 1.5, s); this.M.compose(q.p, this.Q, this.S);
      this.mesh.setMatrixAt(n, this.M); this.mesh.setColorAt(n, this.C.set(q.c)); n++;
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------- telegraph decals ----------
const decalMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
/**
 * Telegraphs: shape = { kind: 'circle'|'ring'|'line'|'cone', x, z, r, r0, len, w, dir, arc }, from t0 to t1 (seconds, local clock).
 * The fill grows from edge/origin to full over the wind-up so players read exactly when it lands.
 */
export class Telegraphs {
  constructor(scene) { this.scene = scene; this.active = []; this.pool = {}; }
  _make(kind) {
    const g = new THREE.Group(), color = '#ff5a3a';
    let fill, edge;
    if (kind === 'circle') { fill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), decalMat(color, 0.32)); edge = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48), decalMat('#ffb08a', 0.8)); }
    else if (kind === 'ring') { fill = new THREE.Mesh(new THREE.RingGeometry(0.5, 1, 48), decalMat(color, 0.32)); edge = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 48), decalMat('#ffb08a', 0.8)); }
    else if (kind === 'line') { const pg = new THREE.PlaneGeometry(1, 1); pg.translate(0, 0.5, 0); fill = new THREE.Mesh(pg, decalMat(color, 0.32)); const eg = new THREE.EdgesGeometry(pg); edge = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: '#ffb08a', transparent: true, opacity: 0.85 })); }
    else { fill = new THREE.Mesh(new THREE.CircleGeometry(1, 32, 0, 1), decalMat(color, 0.32)); edge = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 32, 1, 0, 1), decalMat('#ffb08a', 0.8)); }
    for (const m of [fill, edge]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 3; g.add(m); }
    g.userData = { kind, fill, edge }; this.scene.add(g); return g;
  }
  _get(kind) { const p = (this.pool[kind] ||= []); const g = p.pop() || this._make(kind); g.visible = true; return g; }
  /** key dedupes (same attack re-sent in snapshots updates the existing decal). */
  show(key, shape, t0, t1) {
    let a = this.active.find(x => x.key === key);
    if (a && a.shape.kind !== shape.kind) { this._release(a); a = null; }
    if (!a) { a = { key, g: this._get(shape.kind) }; this.active.push(a); }
    a.shape = shape; a.t0 = t0; a.t1 = t1; a.seen = true;
    const { g } = a, s = shape; g.position.set(s.x, 0.06, s.z);
    if (s.kind === 'circle') g.scale.set(s.r, 1, s.r);
    else if (s.kind === 'ring') { g.scale.set(s.r, 1, s.r); const inner = s.r0 / s.r; if (g.userData.inner !== inner) { g.userData.inner = inner; g.userData.fill.geometry.dispose(); g.userData.fill.geometry = new THREE.RingGeometry(inner, 1, 48); } }
    else if (s.kind === 'line') { g.rotation.y = s.dir + Math.PI; g.userData.fill.scale.set(s.w, s.len, 1); g.userData.edge.scale.set(s.w, s.len, 1); }
    else { // cone: geometry spans angle 0..arc; rotate so its centre points along dir (dir 0 = +Z)
      g.scale.set(s.r, 1, s.r);
      if (g.userData.arc !== s.arc) { g.userData.arc = s.arc; g.userData.fill.geometry.dispose(); g.userData.fill.geometry = new THREE.CircleGeometry(1, 32, 0, s.arc); g.userData.edge.geometry.dispose(); g.userData.edge.geometry = new THREE.RingGeometry(0.95, 1, 32, 1, 0, s.arc); }
      g.rotation.y = s.dir - Math.PI / 2 - s.arc / 2; }
    return a;
  }
  _release(a) { a.g.visible = false; (this.pool[a.g.userData.kind] ||= []).push(a.g); }
  update(now) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      if (now > a.t1 + 0.12) { this._release(a); this.active.splice(i, 1); continue; }
      const k = Math.max(0, Math.min(1, (now - a.t0) / Math.max(0.01, a.t1 - a.t0))), { fill, edge, kind } = a.g.userData;
      if (kind === 'line') { fill.scale.y = a.shape.len * k; }
      else if (kind === 'ring') { fill.scale.setScalar(1); fill.material.opacity = 0.12 + 0.35 * k; }
      else fill.scale.setScalar(Math.max(0.02, k));
      fill.material.opacity = (kind === 'ring' ? 0.12 + 0.35 * k : 0.22 + 0.25 * k) * (now > a.t1 ? 2.2 : 1);
      edge.material.opacity = 0.55 + 0.4 * Math.sin(now * 20) * (k > 0.75 ? 1 : 0.3);
    }
  }
  clear(prefix) { for (let i = this.active.length - 1; i >= 0; i--) if (!prefix || String(this.active[i].key).startsWith(prefix)) { this._release(this.active[i]); this.active.splice(i, 1); } }
}

/** Is point (px,pz) inside a telegraph shape? (cone dir = angle in XZ: dir 0 = +Z, measured like atan2(dx, dz)). */
export function inShape(s, px, pz, pad = 0.35) {
  const dx = px - s.x, dz = pz - s.z, d = Math.hypot(dx, dz);
  if (s.kind === 'circle') return d <= s.r + pad;
  if (s.kind === 'ring') return d <= s.r + pad && d >= s.r0 - pad;
  if (s.kind === 'line') { const fx = Math.sin(s.dir), fz = Math.cos(s.dir), along = dx * fx + dz * fz, side = Math.abs(-dx * fz + dz * fx); return along >= -pad && along <= s.len + pad && side <= s.w / 2 + pad; }
  if (s.kind === 'cone') { if (d > s.r + pad) return false; if (d < 0.8) return true; let a = Math.atan2(dx, dz) - s.dir; a = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(a) <= s.arc / 2 + 0.08; }
  return false;
}

/** Soft additive ground glow (light radius, lamp posts, wisps). */
export function makeGlowDecal(color = '#ffb347', opacity = 0.22) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: getGlowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 2; return m;
}

/** Slash arc in front of the player (fades out). */
export function makeSlash() {
  const geo = new THREE.RingGeometry(1.2, 2.7, 32, 1, -Math.PI * 0.4, Math.PI * 0.8);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffe2a8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 4; return m;
}

/** Pickups: embers (orange), glowcap (teal), glow motes (amber), tonic. Magnet to the player, collected on touch. */
export class Pickups {
  constructor(scene) {
    this.scene = scene; this.list = [];
    this.geo = { ember: new THREE.OctahedronGeometry(0.16), glowcap: new THREE.SphereGeometry(0.17, 10, 8), mote: new THREE.SphereGeometry(0.12, 8, 6), sigil: new THREE.OctahedronGeometry(0.32), rustcog: new THREE.TorusGeometry(0.15, 0.07, 6, 8), shard: new THREE.OctahedronGeometry(0.2) };
    this.mat = { ember: new THREE.MeshBasicMaterial({ color: '#ff9a3c', toneMapped: false }), glowcap: new THREE.MeshBasicMaterial({ color: '#4ff0d0', toneMapped: false }), mote: new THREE.MeshBasicMaterial({ color: '#ffe08a', toneMapped: false }), sigil: new THREE.MeshBasicMaterial({ color: '#ff8fd0', toneMapped: false }), rustcog: new THREE.MeshBasicMaterial({ color: '#d08a4a', toneMapped: false }), shard: new THREE.MeshBasicMaterial({ color: '#8affe8', toneMapped: false }) };
  }
  spawn(kind, x, z, value = 1, n = 1, home = false) {   // home: boss loot flies to you after a beat so it's never left behind
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(this.geo[kind], this.mat[kind]); const a = Math.random() * 6.28, sp = 2 + Math.random() * 3;
      m.position.set(x, 0.8, z); this.scene.add(m); this.list.push({ kind, value, m, v: V(Math.cos(a) * sp, 5 + Math.random() * 3, Math.sin(a) * sp), age: 0, home }); }
  }
  /** Returns array of collected {kind, value}. */
  update(dt, t, pos, magnet = 3.5) {
    const got = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i], m = p.m; p.age += dt;
      const dx = pos.x - m.position.x, dy = pos.y + 1.1 - m.position.y, dz = pos.z - m.position.z, d = Math.hypot(dx, dy, dz);
      if (p.age > 0.45 && (d < magnet || (p.home && p.age > 1.8 + (i % 12) * 0.06))) { const s = Math.min(1, dt * (8 + Math.max(0, magnet - d) * 4)); m.position.x += dx * s; m.position.y += dy * s; m.position.z += dz * s; }
      else { p.v.y -= 18 * dt; m.position.addScaledVector(p.v, dt); if (m.position.y < 0.35) { m.position.y = 0.35; p.v.set(p.v.x * 0.5, Math.abs(p.v.y) * 0.3, p.v.z * 0.5); if (Math.abs(p.v.y) < 0.6) p.v.set(0, 0, 0); } if (!p.v.lengthSq()) m.position.y = 0.45 + Math.sin(t * 3 + i) * 0.1; }
      m.rotation.y += dt * 3;
      if (p.age > 0.45 && d < 0.75) { got.push({ kind: p.kind, value: p.value }); m.removeFromParent(); this.list.splice(i, 1); }
      else if (p.age > 60) { m.removeFromParent(); this.list.splice(i, 1); }
    }
    return got;
  }
  clear() { for (const p of this.list) p.m.removeFromParent(); this.list = []; }
}
