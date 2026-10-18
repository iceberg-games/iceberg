// Blocky customers (built here, not from the shared avatar) with walk cycles,
// winter outfits, an order bubble and a patience bar.
import * as THREE from 'three';
import { pathIn, pathOut } from './shop.js';
import { mulberry } from './logic.js';
import { prop } from './props.js';

const SKINS = ['#f5cd30', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const COATS = ['#d94f4f', '#3d7bd9', '#2f8f6b', '#8b5cf6', '#f29e38', '#e05b9b', '#4a5568', '#14a3a3', '#c0392b'];
const PANTS = ['#2b3a55', '#3b3b3b', '#5a4632', '#24476b', '#4b4e6d'];
const HATS = ['beanie', 'bobble', 'cap', 'earmuffs', 'hair', 'beret'];

const limbGeo = new THREE.BoxGeometry(0.5, 1, 0.5); limbGeo.translate(0, -0.5, 0);
const torsoGeo = new THREE.BoxGeometry(1, 1, 0.5);
const headGeo = new THREE.BoxGeometry(0.62, 0.62, 0.62);

const faceCache = new Map();
function faceTex(skin, mood) {
  const key = skin + mood; if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = skin; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#1b1b1b';
  const eye = (x) => { g.beginPath(); if (mood === 'happy') { g.lineWidth = 7; g.strokeStyle = '#1b1b1b'; g.arc(x, 56, 9, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } else { g.ellipse(x, 52, 7, 10, 0, 0, 7); g.fill(); } };
  eye(42); eye(86);
  g.lineWidth = 7; g.lineCap = 'round'; g.strokeStyle = '#1b1b1b'; g.beginPath();
  if (mood === 'happy') { g.arc(64, 70, 24, 0.15 * Math.PI, 0.85 * Math.PI); }
  else if (mood === 'meh') { g.moveTo(48, 88); g.lineTo(80, 86); }
  else if (mood === 'angry') { g.arc(64, 102, 18, 1.2 * Math.PI, 1.8 * Math.PI); g.moveTo(30, 34); g.lineTo(52, 42); g.moveTo(98, 34); g.lineTo(76, 42); }
  else { g.arc(64, 72, 20, 0.2 * Math.PI, 0.8 * Math.PI); }
  g.stroke();
  if (mood === 'happy' || mood === 'ok') { g.fillStyle = 'rgba(255,110,110,.35)'; g.beginPath(); g.arc(30, 76, 9, 0, 7); g.arc(98, 76, 9, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; faceCache.set(key, t); return t;
}
export function disposeCustomerCaches() { for (const t of faceCache.values()) t.dispose(); faceCache.clear(); }

function polyAt(path, p) {
  const segs = []; let total = 0;
  for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); segs.push(l); total += l; }
  let d = Math.max(0, Math.min(1, p)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) { const k = segs[i] ? Math.min(1, d / segs[i]) : 1, a = path[i], b = path[i + 1]; return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, dx: b[0] - a[0], dz: b[1] - a[1] }; }
    d -= segs[i];
  }
  const e = path[path.length - 1]; return { x: e[0], z: e[1], dx: 0, dz: -1 };
}
// ease the arc-length parameter so customers slow down as they arrive
const easeIn = (p) => p < 0.85 ? p / 0.85 * 0.9 : 0.9 + (1 - Math.pow(1 - (p - 0.85) / 0.15, 2)) * 0.1;

export class Customers {
  constructor(scene, icons) {
    this.scene = scene; this.icons = icons; this.views = new Map(); this._cur = [];
    this.iconImgs = {};
    for (const [k, url] of Object.entries(icons)) { const im = new Image(); im.src = url; this.iconImgs[k] = im; }
  }
  _mat(color) { const mm = new THREE.MeshStandardMaterial({ color, roughness: 0.65 }); this._cur.push(mm); return mm; }

  _build(c) {
    const r = mulberry(c.seed); this._cur = [];
    const pick = (a) => a[Math.floor(r() * a.length)];
    const skin = pick(SKINS), coat = pick(COATS), pants = pick(PANTS), hatKind = pick(HATS), accent = pick(COATS);
    const root = new THREE.Group();
    const sm = this._mat(skin), cm = this._mat(coat), pm = this._mat(pants), am = this._mat(accent);
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex(skin, 'ok'), roughness: 0.6 }); this._cur.push(faceMat);
    const bones = {};
    const mk = (name, x, y, geo, mat, oy = 0) => { const p = new THREE.Group(); p.position.set(x, y, 0); const mesh = new THREE.Mesh(geo, mat); mesh.position.y = oy; mesh.castShadow = true; p.add(mesh); root.add(p); bones[name] = p; return p; };
    mk('legL', -0.25, 1, limbGeo, pm); mk('legR', 0.25, 1, limbGeo, pm);
    mk('torso', 0, 1.5, torsoGeo, cm);
    mk('armL', -0.75, 2, limbGeo, cm); mk('armR', 0.75, 2, limbGeo, cm);
    // hands (skin) at the end of the sleeves
    for (const s of ['armL', 'armR']) { const hnd = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.42), sm); hnd.position.y = -1.0; bones[s].add(hnd); }
    const head = new THREE.Group(); head.position.set(0, 2, 0); root.add(head); bones.head = head;
    const headMesh = new THREE.Mesh(headGeo, [sm, sm, sm, sm, faceMat, sm]); headMesh.position.y = 0.31; headMesh.castShadow = true; head.add(headMesh);
    // scarf
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.2, 0.6), am); scarf.position.set(0, 1.98, 0); root.add(scarf);
    if (r() < 0.6) { const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.06), am); tail.position.set(0.22, 1.7, 0.29); root.add(tail); }
    // hats
    const hm = this._mat(pick(COATS));
    if (hatKind === 'beanie' || hatKind === 'bobble') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.7), hm); b.position.y = 0.72; head.add(b);
      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.72), this._mat('#f4f1ea')); cuff.position.y = 0.6; head.add(cuff);
      if (hatKind === 'bobble') { const bob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), this._mat('#ffffff')); bob.position.y = 0.98; head.add(bob); }
    } else if (hatKind === 'cap') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.18, 0.68), hm); b.position.y = 0.7; head.add(b);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.35), hm); brim.position.set(0, 0.62, 0.45); head.add(brim);
    } else if (hatKind === 'earmuffs') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 6, 16, Math.PI), this._mat('#333')); band.position.y = 0.36; head.add(band);
      for (const s of [-1, 1]) { const muff = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), hm); muff.position.set(s * 0.35, 0.33, 0); head.add(muff); }
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.14, 0.66), this._mat(pick(['#3b2618', '#7a4b26', '#1d1d1d', '#d9b26a']))); hair.position.y = 0.66; head.add(hair);
    } else if (hatKind === 'beret') {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16), hm); b.position.set(0.05, 0.68, 0); b.rotation.z = 0.15; head.add(b);
    } else {
      const hc = this._mat(pick(['#3b2618', '#7a4b26', '#1d1d1d', '#d9b26a', '#a23b2a']));
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.2, 0.68), hc); hair.position.y = 0.68; head.add(hair);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.45, 0.14), hc); back.position.set(0, 0.42, -0.3); head.add(back);
    }
    root.scale.setScalar(0.94 + r() * 0.1);

    // order bubble (canvas sprite) + patience bar
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 150;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    bubble.renderOrder = 10; bubble.scale.set(2.1, 2.1 * 150 / 320, 1); bubble.position.y = 3.55; bubble.visible = false;
    root.add(bubble);
    // emote sprite (heart / anger)
    const ecv = document.createElement('canvas'); ecv.width = ecv.height = 96;
    const etex = new THREE.CanvasTexture(ecv); etex.colorSpace = THREE.SRGBColorSpace;
    const emote = new THREE.Sprite(new THREE.SpriteMaterial({ map: etex, depthTest: false, transparent: true })); emote.renderOrder = 11; emote.scale.set(0.8, 0.8, 1); emote.visible = false; root.add(emote);
    // takeaway bag for happy customers
    const bag = prop('bag', 0.6); bag.traverse(o => { o.userData.shared = true; }); bag.position.set(0, -1.15, 0.1); bag.visible = false; bones.armR.add(bag);

    this.scene.add(root);
    const v = { mats: this._cur, geos: [], c, root, bones, faceMat, skin, bubble, cv, tex, emote, ecv, etex, bag, mood: 'ok', walk: 0, drawKey: '', emoteT: 0 };
    this._place(v, 0);
    return v;
  }

  _drawBubble(v) {
    const c = v.c, frac = c.patience / c.max;
    const key = `${c.got.join()}|${Math.ceil(frac * 30)}|${c.phase}`;
    if (key === v.drawKey) return; v.drawKey = key;
    const g = v.cv.getContext('2d'), W = v.cv.width, H = v.cv.height, n = c.order.length;
    g.clearRect(0, 0, W, H);
    const bw = Math.max(150, 24 + n * 92), x0 = (W - bw) / 2, bh = 112;
    g.fillStyle = 'rgba(20,30,50,.18)'; g.beginPath(); g.roundRect(x0 + 3, 6, bw, bh, 26); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(x0, 2, bw, bh, 26); g.fill();
    g.beginPath(); g.moveTo(W / 2 - 14, bh); g.lineTo(W / 2, bh + 26); g.lineTo(W / 2 + 14, bh); g.fill();
    c.order.forEach((item, i) => {
      const x = x0 + 12 + i * 92 + (bw - 24 - n * 92) / 2, y = 8;
      const im = this.iconImgs[item];
      g.globalAlpha = c.got[i] ? 0.35 : 1;
      if (im && im.complete && im.naturalWidth) g.drawImage(im, x + 2, y, 84, 84);
      else { g.fillStyle = '#e8d2b0'; g.beginPath(); g.arc(x + 44, y + 42, 30, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      if (c.got[i]) { g.strokeStyle = '#2fb35a'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + 22, y + 46); g.lineTo(x + 40, y + 64); g.lineTo(x + 70, y + 26); g.stroke(); }
      if (item === 'donutChoc' || item === 'donutSprk' || item === 'donut') { // tiny label so donut kinds read clearly
        g.font = '900 15px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#6b4a1e'; g.fillText(item === 'donut' ? 'PLAIN' : item === 'donutChoc' ? 'CHOCO' : 'SPRINKLE', x + 44, y + 96);
      }
    });
    // patience bar
    const px = x0 + 16, pw = bw - 32, py = bh - 14;
    g.fillStyle = '#e6edf3'; g.beginPath(); g.roundRect(px, py, pw, 9, 5); g.fill();
    g.fillStyle = frac > 0.5 ? '#3ccf6e' : frac > 0.25 ? '#f6b93b' : '#ef4b4b';
    g.beginPath(); g.roundRect(px, py, Math.max(6, pw * frac), 9, 5); g.fill();
    v.tex.needsUpdate = true;
  }
  _drawEmote(v, kind) {
    const g = v.ecv.getContext('2d'); g.clearRect(0, 0, 96, 96);
    if (kind === 'heart') {
      g.fillStyle = '#ff4f7b'; g.strokeStyle = '#fff'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(48, 80); g.bezierCurveTo(0, 50, 14, 8, 48, 30); g.bezierCurveTo(82, 8, 96, 50, 48, 80); g.closePath(); g.stroke(); g.fill();
    } else {
      g.strokeStyle = '#e53935'; g.lineWidth = 10; g.lineCap = 'round';
      for (const [a, b] of [[[20, 36], [40, 36]], [[40, 16], [40, 36]], [[56, 36], [76, 36]], [[56, 16], [56, 36]], [[20, 60], [40, 60]], [[40, 60], [40, 80]], [[56, 60], [76, 60]], [[56, 60], [56, 80]]]) { g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
    }
    v.etex.needsUpdate = true; v.emote.visible = true; v.emoteT = 1.6;
  }
  _setMood(v, mood) { if (v.mood === mood) return; v.mood = mood; v.faceMat.map = faceTex(v.skin, mood); v.faceMat.needsUpdate = true; }

  _place(v, dt) {
    const c = v.c;
    let pos, moving = false;
    if (c.phase === 'in') { pos = polyAt(pathIn(c.slot, c.side), easeIn(c.p)); moving = c.p < 1; }
    else if (c.phase === 'out') { pos = polyAt(pathOut(c.slot, (c.seed & 1) ? -c.side : c.side), c.p); moving = true; }
    else pos = { x: pathIn(c.slot, c.side).at(-1)[0], z: pathIn(c.slot, c.side).at(-1)[1], dx: 0, dz: -1 };
    v.root.position.set(pos.x, 0, pos.z);
    const face = c.phase === 'wait' ? Math.PI : Math.atan2(pos.dx, pos.dz);
    let d = face - v.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); v.root.rotation.y += d * Math.min(1, dt * 10);
    v.walk += dt * (moving ? 9 : 0);
    const sw = moving ? Math.sin(v.walk) * 0.75 : 0;
    v.bones.legL.rotation.x = sw; v.bones.legR.rotation.x = -sw;
    v.bones.armL.rotation.x = -sw * 0.8;
    v.bones.armR.rotation.x = v.bag.visible ? -0.25 : sw * 0.8;
    // idle: tap foot / bob when waiting
    if (c.phase === 'wait') { const t = performance.now() / 1000 + c.id; v.root.position.y = Math.abs(Math.sin(t * 2.2)) * 0.03; v.bones.head.rotation.y = Math.sin(t * 0.8) * 0.25; if (c.patience / c.max < 0.3) v.bones.legR.rotation.x = Math.max(0, Math.sin(t * 12)) * -0.25; }
    else v.bones.head.rotation.y = 0;
  }

  /** Sync views with the shift's customers. */
  update(dt, customers) {
    const seen = new Set();
    for (const c of customers) {
      seen.add(c.id);
      let v = this.views.get(c.id);
      if (!v) { v = this._build(c); this.views.set(c.id, v); }
      v.c = c;
      if (c.phase === 'wait') { v.bubble.visible = true; this._drawBubble(v); const f = c.patience / c.max; this._setMood(v, f < 0.3 ? 'meh' : 'ok'); }
      else if (c.phase === 'in') { v.bubble.visible = c.p > 0.55; if (v.bubble.visible) this._drawBubble(v); }
      else if (c.phase === 'out') {
        v.bubble.visible = false;
        if (!v.left) { v.left = true; if (c.mood === 'happy') { this._setMood(v, 'happy'); v.bag.visible = true; this._drawEmote(v, 'heart'); } else if (c.mood === 'angry') { this._setMood(v, 'angry'); this._drawEmote(v, 'anger'); } }
      }
      if (v.emoteT > 0) { v.emoteT -= dt; v.emote.position.y = 3.2 + (1.6 - v.emoteT) * 0.5; v.emote.material.opacity = Math.min(1, v.emoteT * 2); if (v.emoteT <= 0) v.emote.visible = false; }
      this._place(v, dt);
    }
    for (const [id, v] of this.views) if (!seen.has(id)) { this._remove(v); this.views.delete(id); }
  }
  /** World position of a customer's head (for HUD/fx). */
  headOf(id) { const v = this.views.get(id); return v ? v.root.position.clone().add(new THREE.Vector3(0, 2.8, 0)) : null; }
  _remove(v) { this.scene.remove(v.root); for (const mm of v.mats) mm.dispose(); v.root.traverse(o => { if (o.isMesh && o.geometry !== limbGeo && o.geometry !== torsoGeo && o.geometry !== headGeo && !o.userData.shared) o.geometry.dispose(); }); v.tex.dispose(); v.etex.dispose(); v.bubble.material.dispose(); v.emote.material.dispose(); }
  clear() { for (const v of this.views.values()) this._remove(v); this.views.clear(); }
  dispose() { this.clear(); }
}
