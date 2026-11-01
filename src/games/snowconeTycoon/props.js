// Snowcone Tycoon props: procedural Three.js models (no external assets) and
// canvas icons (cone + flavor pattern + topping) shared by HUD and bubbles.
import * as THREE from 'three';
import { FLAVORS, TOPPINGS } from './config.js';

/** Track every material/geometry/texture we make so dispose() is one call. */
export class Bag {
  constructor() { this.items = new Set(); }
  add(x) { this.items.add(x); return x; }
  mat(o) { return this.add(new THREE.MeshStandardMaterial({ roughness: 0.6, ...o })); }
  geo(g) { return this.add(g); }
  dispose() { for (const x of this.items) x.dispose?.(); this.items.clear(); }
}

// ---------- canvas pattern helpers (colorblind-safe flavor marks) ----------
export function drawPattern(g, kind, x, y, w, h, ink = 'rgba(255,255,255,.75)') {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = Math.max(2, w / 14);
  const s = w / 5;
  if (kind === 'stripe') for (let i = -h; i < w + h; i += s) { g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + h, y); g.stroke(); }
  else if (kind === 'dots') for (let yy = y + s / 2; yy < y + h; yy += s) for (let xx = x + s / 2 + ((yy / s) % 2) * s / 2; xx < x + w; xx += s) { g.beginPath(); g.arc(xx, yy, s * 0.22, 0, 7); g.fill(); }
  else if (kind === 'swirl') { g.beginPath(); for (let a = 0; a < 18; a += 0.15) { const r = a * w / 40; g.lineTo(x + w / 2 + Math.cos(a) * r, y + h / 2 + Math.sin(a) * r); } g.stroke(); }
  else if (kind === 'zigzag') for (let yy = y + s / 2; yy < y + h; yy += s * 1.2) { g.beginPath(); for (let xx = x, k = 0; xx <= x + w; xx += s / 2, k++) g.lineTo(xx, yy + (k % 2 ? -s / 3 : s / 3)); g.stroke(); }
  else if (kind === 'check') for (let yy = y; yy < y + h; yy += s) for (let xx = x + (Math.round((yy - y) / s) % 2) * s; xx < x + w; xx += s * 2) g.fillRect(xx, yy, s, s);
  else if (kind === 'star') { g.fillStyle = 'rgba(200,140,60,.6)'; for (let yy = y + s / 2; yy < y + h; yy += s * 1.3) for (let xx = x + s / 2; xx < x + w; xx += s * 1.3) star(g, xx, yy, s * 0.35); }
  g.restore();
}
function star(g, x, y, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }

/** Draw a snowcone (paper cone, ice dome, syrup + pattern, topping) into a 2D context. */
export function drawCone(g, cx, cy, size, { syrup = null, topping = null, ice = 1 } = {}) {
  const w = size * 0.62, coneTop = cy + size * 0.02, coneBot = cy + size * 0.48;
  // paper cone
  g.fillStyle = '#eaf6ff'; g.beginPath(); g.moveTo(cx - w / 2, coneTop); g.lineTo(cx + w / 2, coneTop); g.lineTo(cx, coneBot); g.closePath(); g.fill();
  g.strokeStyle = '#7fb6e6'; g.lineWidth = size / 40; g.stroke();
  g.strokeStyle = 'rgba(80,140,210,.45)'; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(cx - w / 2 + i * w / 4, coneTop); g.lineTo(cx, coneBot); g.stroke(); }
  if (ice <= 0) return;
  // ice dome
  const r = w * 0.56 * Math.max(0.35, ice), dy = coneTop;
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx, dy, w * 0.56, r, 0, Math.PI, 0); g.fill();
  if (syrup) {
    const f = FLAVORS[syrup];
    g.save(); g.beginPath(); g.ellipse(cx, dy, w * 0.56, r, 0, Math.PI, 0); g.clip();
    g.fillStyle = f.color; g.fillRect(cx - w, dy - r, w * 2, r);
    drawPattern(g, f.pattern, cx - w * 0.56, dy - r, w * 1.12, r, f.pattern === 'star' ? '' : 'rgba(255,255,255,.6)');
    g.restore();
  }
  g.strokeStyle = 'rgba(70,120,180,.35)'; g.lineWidth = size / 50; g.beginPath(); g.ellipse(cx, dy, w * 0.56, r, 0, Math.PI, 0); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(cx - w * 0.18, dy - r * 0.6, w * 0.1, r * 0.18, -0.5, 0, 7); g.fill();
  if (topping) {
    const ty = dy - r;
    if (topping === 'cherry') { g.fillStyle = '#d6213b'; g.beginPath(); g.arc(cx, ty - size * 0.04, size * 0.08, 0, 7); g.fill(); g.strokeStyle = '#3f7d2b'; g.lineWidth = size / 30; g.beginPath(); g.moveTo(cx, ty - size * 0.1); g.quadraticCurveTo(cx + size * 0.05, ty - size * 0.2, cx + size * 0.1, ty - size * 0.2); g.stroke(); }
    else if (topping === 'sprinkles') { const cs = ['#ff6fb5', '#ffd23f', '#5fd94a', '#2f8bff', '#fff']; for (let i = 0; i < 14; i++) { g.save(); g.translate(cx + (Math.sin(i * 7.1) * w * 0.4), ty + r * 0.35 + Math.cos(i * 3.3) * r * 0.25); g.rotate(i); g.fillStyle = cs[i % 5]; g.fillRect(-size * 0.03, -size * 0.008, size * 0.06, size * 0.016); g.restore(); } }
    else if (topping === 'mallow') { for (let i = 0; i < 6; i++) { g.fillStyle = '#fff'; g.strokeStyle = '#d6c7b8'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(cx - w * 0.35 + i * w * 0.13, ty + r * 0.2 + (i % 2) * r * 0.2, size * 0.07, size * 0.06, 3); g.fill(); g.stroke(); } }
    else if (topping === 'flake') { g.fillStyle = '#8fe3ff'; g.strokeStyle = '#2f7fb8'; g.lineWidth = 1; for (let i = 0; i < 5; i++) star(g, cx - w * 0.3 + i * w * 0.15, ty + r * 0.35 + (i % 2) * r * 0.15, size * 0.05); }
  }
}

/** Data-URL icons: one per flavor (full cone), per topping, plus 'cone' (empty ice). */
export function makeIcons(size = 96) {
  const out = {};
  const mk = (fn) => { const c = document.createElement('canvas'); c.width = c.height = size; fn(c.getContext('2d')); return c.toDataURL(); };
  for (const k of Object.keys(FLAVORS)) out[k] = mk(g => drawCone(g, size / 2, size * 0.48, size, { syrup: k }));
  out.ice = mk(g => drawCone(g, size / 2, size * 0.48, size, {}));
  for (const k of Object.keys(TOPPINGS)) out['t_' + k] = mk(g => { g.font = `${size * 0.62}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(TOPPINGS[k].icon, size / 2, size / 2 + 4); });
  return out;
}

// ---------- 3D models ----------
/** A held / served 3D snowcone. Call .set(cone) to update. */
export function buildCone3D(bag) {
  const root = new THREE.Group();
  const paperTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#eaf6ff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#5aa7e8'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 7, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.x = 2; return bag.add(t); })();
  const paper = new THREE.Mesh(bag.geo(new THREE.ConeGeometry(0.17, 0.42, 20, 1, true)), bag.mat({ map: paperTex, side: THREE.DoubleSide, roughness: 0.8 }));
  paper.rotation.x = Math.PI; paper.position.y = 0.21; root.add(paper);
  const iceMat = bag.mat({ color: '#ffffff', roughness: 0.35, emissive: '#000000', emissiveIntensity: 0.25 });
  const dome = new THREE.Mesh(bag.geo(new THREE.SphereGeometry(0.19, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), iceMat); dome.position.y = 0.42; root.add(dome);
  // little ice crystals on the dome
  const bumps = new THREE.InstancedMesh(bag.geo(new THREE.IcosahedronGeometry(0.035, 0)), iceMat, 14);
  const m = new THREE.Matrix4(); for (let i = 0; i < 14; i++) { const a = i * 2.4, el = 0.25 + (i % 5) * 0.25; m.makeTranslation(Math.cos(a) * 0.17 * Math.cos(el), 0.42 + Math.sin(el) * 0.17, Math.sin(a) * 0.17 * Math.cos(el)); bumps.setMatrixAt(i, m); }
  root.add(bumps);
  const tops = new THREE.Group(); root.add(tops);
  const cherry = new THREE.Mesh(bag.geo(new THREE.SphereGeometry(0.06, 14, 10)), bag.mat({ color: '#d6213b', roughness: 0.25 })); cherry.position.y = 0.64; tops.add(cherry);
  const spr = new THREE.InstancedMesh(bag.geo(new THREE.CapsuleGeometry(0.008, 0.03, 2, 4)), bag.mat({ color: '#ffffff' }), 22);
  const cols = ['#ff6fb5', '#ffd23f', '#5fd94a', '#2f8bff', '#ffffff'].map(c => new THREE.Color(c));
  for (let i = 0; i < 22; i++) { const a = i * 2.1, el = 0.4 + (i % 4) * 0.28; const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 2, 0)); m.compose(new THREE.Vector3(Math.cos(a) * 0.19 * Math.cos(el), 0.42 + Math.sin(el) * 0.19, Math.sin(a) * 0.19 * Math.cos(el)), q, new THREE.Vector3(1, 1, 1)); spr.setMatrixAt(i, m); spr.setColorAt(i, cols[i % 5]); }
  tops.add(spr);
  const mallow = new THREE.InstancedMesh(bag.geo(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 10)), bag.mat({ color: '#fffaf2', roughness: 0.9 }), 8);
  for (let i = 0; i < 8; i++) { const a = i * 0.8; m.makeTranslation(Math.cos(a) * 0.12, 0.56 + (i % 2) * 0.03, Math.sin(a) * 0.12); mallow.setMatrixAt(i, m); } tops.add(mallow);
  const flake = new THREE.InstancedMesh(bag.geo(new THREE.OctahedronGeometry(0.035, 0)), bag.mat({ color: '#8fe3ff', emissive: '#4fc8ff', emissiveIntensity: 0.6, roughness: 0.2 }), 7);
  for (let i = 0; i < 7; i++) { const a = i * 0.9; m.makeTranslation(Math.cos(a) * 0.11, 0.57 + (i % 3) * 0.02, Math.sin(a) * 0.11); flake.setMatrixAt(i, m); } tops.add(flake);
  const byTop = { cherry, sprinkles: spr, mallow, flake };
  root.userData.set = (cone) => {
    root.visible = !!cone; if (!cone) return;
    const s = Math.max(0.05, cone.ice); dome.scale.set(1, s, 1); dome.visible = bumps.visible = cone.ice > 0.02; bumps.scale.set(1, 1, 1);
    if (cone.syrup) { iceMat.color.set(FLAVORS[cone.syrup].color).lerp(new THREE.Color('#ffffff'), 0.15); iceMat.emissive.set(FLAVORS[cone.syrup].color); }
    else { iceMat.color.set('#ffffff'); iceMat.emissive.set('#000000'); }
    for (const [k, o] of Object.entries(byTop)) o.visible = cone.topping === k;
  };
  return root;
}

/** Glass syrup bottle with an emissive liquid and a chrome pump. */
export function buildBottle(bag, color) {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.16, 0], [0.18, 0.04], [0.18, 0.46], [0.14, 0.56], [0.07, 0.62], [0.07, 0.7]].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(bag.geo(new THREE.LatheGeometry(prof, 24)), bag.mat({ color: '#e6f6ff', transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1, depthWrite: false }));
  glass.renderOrder = 3; g.add(glass);
  const liquidMat = bag.mat({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.2, transparent: true, opacity: 0.92 });
  const liquid = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.155, 0.155, 0.4, 20)), liquidMat); liquid.position.y = 0.23; g.add(liquid);
  const chrome = bag.mat({ color: '#dfe6ee', metalness: 0.9, roughness: 0.2 });
  const cap = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 16)), chrome); cap.position.y = 0.72; g.add(cap);
  const stem = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8)), chrome); stem.position.y = 0.82; g.add(stem);
  const head = new THREE.Mesh(bag.geo(new THREE.BoxGeometry(0.2, 0.05, 0.07)), chrome); head.position.set(0.05, 0.92, 0); g.add(head);
  const spout = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6)), chrome); spout.rotation.z = Math.PI / 2; spout.position.set(0.2, 0.92, 0); g.add(spout);
  g.userData = { liquid, liquidMat, head };
  return g;
}
