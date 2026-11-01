// Snowcone Tycoon customers: R6-lite blocky tourists in winter gear that walk
// up to their queue spot, show an order bubble (cone + flavor pattern +
// topping) with a patience ring, and react happy / angry when they leave.
import * as THREE from 'three';
import { A } from './stand.js';
import { mulberry } from './logic.js';
import { drawCone } from './props.js';
import { TOPPINGS } from './config.js';

const SKINS = ['#f5cd30', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const COATS = ['#ff6f91', '#3d9bff', '#2fbf8f', '#9b6cff', '#ffa94d', '#14b8c6', '#f25f5c', '#ffd23f'];
const PANTS = ['#2b3a55', '#3b3b3b', '#24476b', '#4b4e6d', '#5a4632'];
const limbGeo = new THREE.BoxGeometry(0.42, 0.9, 0.42); limbGeo.translate(0, -0.45, 0);
const torsoGeo = new THREE.BoxGeometry(0.9, 0.9, 0.45);
const headGeo = new THREE.BoxGeometry(0.56, 0.56, 0.56);
const hatGeo = new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const pomGeo = new THREE.SphereGeometry(0.1, 10, 8);
const scarfGeo = new THREE.TorusGeometry(0.3, 0.08, 6, 16);

const faceCache = new Map();
function faceTex(skin, mood) {
  const key = skin + mood; if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = skin; g.fillRect(0, 0, 64, 64); g.fillStyle = g.strokeStyle = '#1b1b1b'; g.lineWidth = 4; g.lineCap = 'round';
  if (mood === 'happy') { for (const x of [21, 43]) { g.beginPath(); g.arc(x, 28, 5, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } g.beginPath(); g.arc(32, 36, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  else { for (const x of [21, 43]) { g.beginPath(); g.ellipse(x, 26, 3.5, 5, 0, 0, 7); g.fill(); }
    g.beginPath(); if (mood === 'angry') { g.arc(32, 52, 9, 1.2 * Math.PI, 1.8 * Math.PI); g.moveTo(14, 16); g.lineTo(26, 20); g.moveTo(50, 16); g.lineTo(38, 20); } else if (mood === 'meh') { g.moveTo(24, 44); g.lineTo(40, 43); } else g.arc(32, 36, 10, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
  g.fillStyle = 'rgba(255,110,130,.35)'; g.beginPath(); g.arc(14, 38, 5, 0, 7); g.arc(50, 38, 5, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; faceCache.set(key, t); return t;
}
export function disposeCustomerCaches() { for (const t of faceCache.values()) t.dispose(); faceCache.clear(); }

function along(path, p) {
  const segs = []; let total = 0; for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); segs.push(l); total += l; }
  let d = Math.max(0, Math.min(1, p)) * total;
  for (let i = 0; i < segs.length; i++) { if (d <= segs[i] || i === segs.length - 1) { const k = segs[i] ? Math.min(1, d / segs[i]) : 1, a = path[i], b = path[i + 1]; return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, dx: b[0] - a[0], dz: b[1] - a[1] }; } d -= segs[i]; }
  return { x: path.at(-1)[0], z: path.at(-1)[1], dx: 0, dz: -1 };
}

export class Customers {
  constructor(scene) { this.scene = scene; this.views = new Map(); }
  _build(c) {
    const r = mulberry(c.seed), pick = (a) => a[Math.floor(r() * a.length)], mats = [];
    const mat = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...o }); mats.push(m); return m; };
    const skin = pick(SKINS), coat = pick(COATS), pants = pick(PANTS), hat = pick(COATS);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(0.85 + r() * 0.15);
    const coatM = mat(coat), skinM = mat(skin), pantsM = mat(pants);
    const torso = new THREE.Mesh(torsoGeo, coatM); torso.position.y = 1.35; body.add(torso);
    const faceM = new THREE.MeshStandardMaterial({ map: faceTex(skin, 'ok'), roughness: 0.7 }); mats.push(faceM);
    const head = new THREE.Mesh(headGeo, [skinM, skinM, skinM, skinM, faceM, skinM]); head.position.y = 2.1; body.add(head);
    const hatM = mat(hat); const h = new THREE.Mesh(hatGeo, hatM); h.position.y = 2.36; h.scale.set(1, 0.9, 1); body.add(h);
    const pom = new THREE.Mesh(pomGeo, mat('#ffffff')); pom.position.y = 2.68; body.add(pom);
    const scarf = new THREE.Mesh(scarfGeo, mat(pick(COATS))); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.8; body.add(scarf);
    const limb = (m, x, y) => { const l = new THREE.Mesh(limbGeo, m); l.position.set(x, y, 0); body.add(l); return l; };
    const armL = limb(coatM, -0.66, 1.78), armR = limb(coatM, 0.66, 1.78), legL = limb(pantsM, -0.22, 0.9), legR = limb(pantsM, 0.22, 0.9);
    body.traverse(o => { if (o.isMesh) o.castShadow = true; });
    // order bubble
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 180;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sm = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }); const bubble = new THREE.Sprite(sm); bubble.scale.set(1.15, 1.3, 1); bubble.position.y = 3.6; bubble.renderOrder = 20; bubble.visible = false; root.add(bubble);
    this.scene.add(root);
    return { root, body, head, faceM, skin, armL, armR, legL, legR, bubble, cv, tex, sm, mats, mood: 'ok', key: '', pop: 0, bob: r() * 6 };
  }
  _bubble(v, c, t) {
    const pf = Math.max(0, c.patience / c.maxPatience), key = `${c.order.syrup}|${c.order.topping}|${Math.round(pf * 30)}|${c.slot}`;
    if (key === v.key) return; v.key = key;
    const g = v.cv.getContext('2d'); g.clearRect(0, 0, 160, 180);
    g.fillStyle = '#ffffff'; g.shadowColor = 'rgba(30,60,100,.35)'; g.shadowBlur = 10; g.beginPath(); g.roundRect(10, 8, 140, 140, 34); g.fill();
    g.beginPath(); g.moveTo(66, 146); g.lineTo(80, 170); g.lineTo(94, 146); g.fill(); g.shadowBlur = 0;
    const col = pf > 0.5 ? '#3ccf6e' : pf > 0.25 ? '#ffb020' : '#ff4d5e';
    g.lineWidth = 9; g.lineCap = 'round'; g.strokeStyle = '#e8eef6'; g.beginPath(); g.roundRect(14, 12, 132, 132, 30); g.stroke();
    g.strokeStyle = col; g.beginPath(); g.arc(80, 78, 62, -Math.PI / 2, -Math.PI / 2 + pf * Math.PI * 2); g.stroke();
    drawCone(g, 80, 74, 92, { syrup: c.order.syrup, topping: c.order.topping });
    if (c.order.topping) { g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 34, 20, 0, 7); g.fill(); g.font = '24px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(TOPPINGS[c.order.topping].icon, 128, 36); }
    g.fillStyle = '#1a3d63'; g.beginPath(); g.arc(30, 32, 15, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '900 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(c.slot + 1), 30, 33);
    v.tex.needsUpdate = true;
  }
  setMood(v, mood) { if (v.mood === mood) return; v.mood = mood; v.faceM.map = faceTex(v.skin, mood); v.faceM.needsUpdate = true; }
  headOf(id) { const v = this.views.get(id); if (!v) return null; return v.root.position.clone().setY(3.0); }
  popBubble(id) { const v = this.views.get(id); if (v) v.pop = 1; }
  update(dt, list, t = 0) {
    const live = new Set();
    for (const c of list) {
      live.add(c.id); let v = this.views.get(c.id); if (!v) { v = this._build(c); this.views.set(c.id, v); }
      const x = A.slots[c.slot].x; let walking = false, p;
      if (c.phase === 'walk') { p = along(A.pathIn(x), Math.min(1, c.walkT / c.walkDur)); walking = c.walkT < c.walkDur; }
      else if (c.phase === 'wait') p = { x, z: A.slots[c.slot].z, dx: 0, dz: -1 };
      else { p = along(A.pathOut(x), Math.min(1, c.leaveT / c.leaveDur)); walking = true; }
      v.root.position.set(p.x, 0.08, p.z);
      const yaw = Math.atan2(p.dx, p.dz); v.root.rotation.y += ((yaw - v.root.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 10);
      const sw = walking ? Math.sin(t * 10 + v.bob) * 0.7 : 0;
      v.legL.rotation.x = sw; v.legR.rotation.x = -sw; v.armL.rotation.x = -sw; v.armR.rotation.x = sw;
      v.body.position.y = walking ? Math.abs(Math.sin(t * 10 + v.bob)) * 0.06 : Math.sin(t * 2 + v.bob) * 0.02;
      if (c.phase === 'wait') {
        const pf = c.patience / c.maxPatience; this.setMood(v, pf > 0.5 ? 'ok' : pf > 0.25 ? 'meh' : 'angry');
        v.bubble.visible = true; this._bubble(v, c, t);
        v.pop = Math.max(0, v.pop - dt * 3); const s = 1 + Math.sin(v.pop * Math.PI) * 0.25;
        const shake = pf < 0.25 ? Math.sin(t * 30) * 0.03 : 0;
        v.bubble.scale.set(1.15 * s, 1.3 * s, 1); v.bubble.position.set(shake, 3.6 + Math.sin(t * 2.5 + v.bob) * 0.05, 0);
      } else if (c.phase === 'leave') {
        v.bubble.visible = false; this.setMood(v, c.mood || 'ok');
        if (c.mood === 'happy' || c.mood === 'ok') { v.armL.rotation.x = -2.6 + Math.sin(t * 12) * 0.3; }
      } else v.bubble.visible = false;
    }
    for (const [id, v] of this.views) if (!live.has(id)) this._drop(id, v);
  }
  _drop(id, v) { this.scene.remove(v.root); v.mats.forEach(m => m.dispose()); v.tex.dispose(); v.sm.dispose(); this.views.delete(id); }
  clear() { for (const [id, v] of this.views) this._drop(id, v); }
  dispose() { this.clear(); }
}
