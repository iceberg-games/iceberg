// Mobile Studio: a simple, touch-first creator shown instead of the desktop
// Studio when getDeviceMode() === 'mobile' (like the very first Iceberg
// creator). It drives the same editor instance (src/studio/editor.js) and the
// same save/publish path (src/studio/store.js) as the desktop Studio, so games
// made here open on the computer too, and vice versa.
//
//   Tools:   🧱 Place (tap a surface) · 🎨 Paint (tap a block) · 🗑 Remove · 📍 Spawn (tap to move it)
//   Camera:  one-finger drag = orbit · pinch = zoom · two-finger drag = pan (mouse wheel zooms too)
//   Bar:     ↶ Undo · ▶ Test · 💾 Save · ☰ More (name, 📱 mobile-playable, 🚀 Publish, ✕ Exit)
//
// While active it owns pointer input on the game canvas (capture-phase
// listeners), so the desktop gizmo / box-select never see touches. The
// renderer is resized to the area above the bar so the GUI never covers it.
import * as THREE from 'three';
import { h, clear } from './dom.js';
import { hasPerk } from '../core/plus.js';
import { bus } from '../core/events.js';
import { isMobile } from '../core/device.js';
import { drafts, publish, isPublished } from '../studio/store.js';
import './mobileStudio.css';

export const MOBILE_COLORS = ['#a3a2a5', '#f7fbff', '#bfe9ff', '#3f8fd0', '#22262e', '#e2474b', '#ff8c2a', '#f5c542', '#2f9e6a', '#8b6cf0', '#ff7ac8', '#9a6b43'];
export const BLOCK_SIZE = 2;   // studs per block (cubes on a 2-stud grid)
const TAP_SLOP = 8, TAP_MS = 700;
const snapCell = (v) => Math.floor(v / BLOCK_SIZE) * BLOCK_SIZE + BLOCK_SIZE / 2;
const r3 = (v) => Math.round(v * 1000) / 1000;

export class MobileStudio {
  constructor(root, { engine, ui, onTest, onExit }) {
    Object.assign(this, { root, engine, ui, onTest, onExit });
    this.tool = 'place'; this.color = MOBILE_COLORS[5]; this.active = false;
    this.pointers = new Map(); this.gesture = null; this.dist = 30;
    this.raycaster = new THREE.Raycaster();
    this.el = h('div.mstudio.hidden#mobile-studio', { role: 'toolbar', 'aria-label': 'Mobile Studio' });
    root.append(this.el);
    bus.on('game:loaded', ({ game }) => { if (game.editing && isMobile()) this.show(game); else this.hide(); });
    bus.on('game:unloaded', () => this.hide());
    bus.on('studio:changed', (what) => { if (this.active && what !== 'animtime' && what !== 'bonepose') this.renderBar(); });
    bus.on('device:changed', () => { const g = this.engine.game; if (g?.editing) (isMobile() ? this.show(g) : this.hide()); });
    const canvas = () => this.engine.renderer.domElement;
    const mine = (e) => this.active && e.target === canvas();
    addEventListener('pointerdown', (e) => { if (mine(e)) this._down(e); }, true);
    addEventListener('pointermove', (e) => { if (this.active && this.pointers.has(e.pointerId)) this._move(e); else if (mine(e)) e.stopPropagation(); }, true);
    addEventListener('pointerup', (e) => { if (this.active && this.pointers.has(e.pointerId)) this._up(e, false); }, true);
    addEventListener('pointercancel', (e) => { if (this.active && this.pointers.has(e.pointerId)) this._up(e, true); }, true);
    addEventListener('wheel', (e) => { if (!mine(e)) return; e.stopPropagation(); e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.0015)); }, { capture: true, passive: false });
    addEventListener('resize', () => { if (this.active) this.layout(); });
  }
  get ed() { return this.engine.game?.editing ? this.engine.game : null; }
  get cam() { return this.ed?.cameraController; }

  show(game) {
    if (this.active && this.game === game) return;
    this.active = true; this.game = game;
    if (game.doc.mobile === undefined) game.doc.mobile = true;   // made on mobile → mobile-playable by default
    game.select(null);
    document.body.classList.add('studio-active', 'mobile-studio-active');
    this.el.classList.remove('hidden');
    this.render(); this.layout(); this._initDist();
    if (!this._hinted) { this._hinted = true; this.ui.toast('Tap to build · drag to turn · pinch to zoom · two fingers to pan', '📱'); }
  }
  hide() {
    if (!this.active) return;
    this.active = false; this.game = null; this.pointers.clear(); this.gesture = null;
    this.el.classList.add('hidden');
    document.querySelector('#ms-sheet')?.remove();
    document.body.classList.remove('mobile-studio-active');
    if (!document.querySelector('#creator-panel:not(.hidden)')) document.body.classList.remove('studio-active');
    this._resize(innerWidth, innerHeight);
  }
  /** keep the 3D view above the bar (no overlap) */
  layout() {
    const barH = Math.ceil(this.el.getBoundingClientRect().height);
    this._resize(innerWidth, Math.max(120, innerHeight - barH));
  }
  _resize(w, hgt) {
    const { renderer, camera } = this.engine;
    renderer.setSize(w, hgt); camera.aspect = w / hgt; camera.updateProjectionMatrix();
  }
  viewRect() { return this.engine.renderer.domElement.getBoundingClientRect(); }

  // ---------- UI ----------
  render() {
    clear(this.el).append(h('div.ms-wrap',
      this.palette = h('div.ms-palette#ms-palette', { role: 'radiogroup', 'aria-label': 'Block color' }),
      this.bar = h('div.ms-bar#ms-bar')));
    this.renderPalette(); this.renderBar();
  }
  renderPalette() {
    clear(this.palette).append(...MOBILE_COLORS.map(c => h('button.ms-swatch' + (c === this.color ? '.on' : ''), {
      type: 'button', 'data-color': c, title: c, 'aria-label': `Color ${c}`, 'aria-checked': String(c === this.color), role: 'radio', style: { background: c },
      onclick: () => this.setColor(c),
    })), this.customSwatch());
  }
  // Iceberg Plus perk: free-pick block color. Gated on the Plus flag.
  customSwatch() {
    if (!hasPerk('mobileCustomColor')) return h('button.ms-swatch.ms-custom.plus-lock#ms-custom-color', { type: 'button', title: 'Custom color — Iceberg Plus', 'aria-label': 'Custom color (Iceberg Plus)', disabled: true }, '🔒');
    const custom = !MOBILE_COLORS.includes(this.color);
    return h('label.ms-swatch.ms-custom' + (custom ? '.on' : '') + '#ms-custom-color', { title: 'Custom color (Plus)', style: { background: custom ? this.color : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' } },
      h('input', { type: 'color', value: custom ? this.color : '#ffffff', 'aria-label': 'Custom color (Iceberg Plus)', onchange: (e) => { if (hasPerk('mobileCustomColor')) this.setColor(e.target.value); } }));
  }
  renderBar() {
    const ed = this.ed; if (!ed || !this.bar) return;
    const tool = (id, icon, label) => h('button.ms-btn' + (this.tool === id ? '.on' : ''), { type: 'button', 'data-mtool': id, 'aria-pressed': String(this.tool === id), onclick: () => this.setTool(id) }, h('span', icon), label);
    clear(this.bar).append(
      tool('place', '🧱', 'Place'), tool('paint', '🎨', 'Paint'), tool('remove', '🗑', 'Remove'), tool('spawn', '📍', 'Spawn'),
      h('div.ms-sep'),
      h('button.ms-btn#ms-undo', { type: 'button', disabled: !ed.canUndo(), onclick: () => this.undo() }, h('span', '↶'), 'Undo'),
      h('button.ms-btn.play#ms-test', { type: 'button', onclick: () => this.test() }, h('span', '▶'), 'Test'),
      h('button.ms-btn.save#ms-save', { type: 'button', onclick: () => this.save() }, h('span', '💾'), 'Save'),
      h('button.ms-btn#ms-more', { type: 'button', onclick: () => this.openSheet() }, h('span', '☰'), 'More'));
  }
  setTool(t) { this.tool = t; this.renderBar(); }
  setColor(c) { this.color = c; this.renderPalette(); if (this.tool === 'remove' || this.tool === 'spawn') this.setTool('place'); }
  undo() { const ed = this.ed; if (ed?.undo()) ed.select(null); }

  openSheet() {
    const ed = this.ed; if (!ed) return;
    document.querySelector('#ms-sheet')?.remove();
    const doc = ed.doc;
    const close = () => back.remove();
    const name = h('input#ms-name', { type: 'text', value: doc.name || '', maxLength: 40, autocomplete: 'off', onchange: () => this.setName(name.value) });
    const mobile = h('input#ms-mobile', { type: 'checkbox', checked: doc.mobile !== false, onchange: () => { ed.checkpoint(); doc.mobile = mobile.checked; } });
    const pub = isPublished(doc.id);
    const back = h('div.ms-sheet-back#ms-sheet', { onclick: (e) => { if (e.target === back) { this.setName(name.value); close(); } } },
      h('div.ms-sheet', { role: 'dialog', 'aria-label': 'Game settings' },
        h('h3', '🧊 Mobile Studio'),
        h('label', 'Game name', name),
        h('label.ms-check', mobile, '📱 Mobile-playable'),
        h('p.ms-hint#ms-status', pub ? '✅ Published: it is in the Games menu. Publish again to update it.' : '📝 Draft: only you can see it. Publish to add it to the Games menu.'),
        h('div.ms-row',
          h('button.save#ms-sheet-save', { type: 'button', onclick: () => { this.setName(name.value); this.save(); close(); } }, '💾 Save'),
          h('button.pub#ms-publish', { type: 'button', onclick: () => { this.setName(name.value); this.publishGame(); close(); } }, '🚀 Publish')),
        h('div.ms-row',
          h('button#ms-exit', { type: 'button', onclick: () => { this.setName(name.value); close(); this.exit(); } }, '✕ Exit studio'),
          h('button#ms-close', { type: 'button', onclick: () => { this.setName(name.value); close(); } }, 'Done')),
        h('p.ms-hint', 'Want scripts, shapes and the animator? Open this game on a computer: it\'s the same game.')));
    document.body.append(back);
  }
  setName(v) {
    const ed = this.ed; if (!ed) return;
    const n = String(v || '').trim().slice(0, 40);
    if (n && n !== ed.doc.name) { ed.checkpoint(); ed.doc.name = n; }
  }

  // ---------- persistence (same path as the desktop Studio) ----------
  docWithThumb() { const d = this.ed.serialize(); if (d.mobile === undefined) d.mobile = true; try { d.thumbnail = this.engine.snapshot(); } catch { /* no WebGL frame yet */ } return d; }
  save(silent = false) {
    const d = this.docWithThumb();
    try { drafts.save(d); if (!silent) this.ui.toast(`Saved "${d.name}"`, '💾'); } catch { this.ui.toast('Could not save (browser storage full?)', '⚠️'); }
    return d;
  }
  publishGame() { const d = this.save(true); publish(d); bus.emit('games:changed'); this.ui.toast(`Published "${d.name}" to the Games menu!`, '🚀'); return d; }
  test() { const d = this.save(true); this.onTest?.(d); }
  exit() { if (!this.ed) return; this.save(true); this.ed.saveCamera(); this.onExit?.(); }

  // ---------- picking & building ----------
  rayAt(x, y) {
    const r = this.viewRect();
    const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.engine.camera); return this.raycaster;
  }
  hitAt(x, y) {
    const ed = this.ed; const ray = this.rayAt(x, y);
    const hit = ray.intersectObjects(ed.world.pickables(), false).find(o => o.object.visible && o.distance < 400);
    if (hit) {
      const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
      const ground = !!hit.object.userData.ground;
      return { point: hit.point.clone(), normal: n, ground, id: ground ? null : ed.world.idFromObject(hit.object) };
    }
    // void maps: build on the y = 0 plane
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) && p.distanceTo(ray.ray.origin) < 300) return { point: p, normal: new THREE.Vector3(0, 1, 0), ground: true, id: null };
    return null;
  }
  /** a tap at screen point (x, y) with the current tool; returns what happened (handy for tests) */
  tap(x, y) {
    const ed = this.ed; if (!ed) return null;
    const hit = this.hitAt(x, y);
    if (!hit) return null;
    const inst = hit.id ? ed.doc.instances.find(i => i.id === ed.topAncestor(hit.id)) : null;
    if (this.tool === 'place') return this.placeBlock(hit);
    if (this.tool === 'spawn') return this.placeSpawn(hit);
    if (this.tool === 'remove') {
      if (!inst) return null;
      if (inst.type === 'spawn') { this.ui.toast('Every game needs a spawn point. Use 📍 Spawn to move it.', '📍'); return null; }
      ed.remove(inst.id); ed.select(null); return { removed: inst.id };
    }
    if (this.tool === 'paint') {
      if (!inst || inst.type === 'group') return null;
      ed.setProp(inst.id, 'color', this.color); ed.select(null); return { painted: inst.id };
    }
    return null;
  }
  placeBlock(hit) {
    const ed = this.ed, S = BLOCK_SIZE;
    const c = hit.point.clone().addScaledVector(hit.normal, S / 2);
    const pos = [snapCell(c.x), snapCell(c.y), snapCell(c.z)].map(r3);
    if (hit.ground) pos[1] = Math.max(S / 2, pos[1]);   // never sink into the ground
    const taken = ed.doc.instances.some(i => i.type === 'part' && i.pos.every((v, k) => Math.abs(v - pos[k]) < 0.01) && i.size.every(v => Math.abs(v - S) < 0.01));
    if (taken) return null;
    const id = ed.insert('part', { name: 'Block', shape: 'box', size: [S, S, S], color: this.color, material: 'plastic', pos });
    ed.select(null);
    return { placed: id, pos };
  }
  placeSpawn(hit) {
    const ed = this.ed;
    const pos = [Math.round(hit.point.x), hit.point.y + 0.2, Math.round(hit.point.z)].map(r3);
    const ex = ed.doc.instances.find(i => i.type === 'spawn');
    let id;
    if (ex) { ed.setProp(ex.id, 'pos', pos); id = ex.id; } else id = ed.insert('spawn', { pos });
    ed.select(null);
    return { spawn: id, pos };
  }

  // ---------- touch camera (orbit / pinch zoom / two-finger pan) ----------
  _initDist() {
    const cam = this.cam; if (!cam) return;
    const f = cam.forward(); this.dist = 30;
    if (f.y < -0.05) { const t = -cam.pos.y / f.y; if (t > 4 && t < 150) this.dist = t; }
  }
  target() { const cam = this.cam; return cam.pos.clone().addScaledVector(cam.forward(), this.dist); }
  orbit(dx, dy) {
    const cam = this.cam; if (!cam) return;
    const t = this.target();
    cam.yaw -= dx * 0.008; cam.pitch = Math.max(-1.45, Math.min(0.6, cam.pitch - dy * 0.008));
    cam.pos.copy(t).addScaledVector(cam.forward(), -this.dist);
  }
  zoom(k) {
    const cam = this.cam; if (!cam || !isFinite(k) || k <= 0) return;
    const t = this.target();
    this.dist = Math.max(4, Math.min(200, this.dist * k));
    cam.pos.copy(t).addScaledVector(cam.forward(), -this.dist);
  }
  pan(dx, dy) {
    const cam = this.cam; if (!cam) return;
    const c = this.engine.camera; c.updateMatrixWorld();
    const s = (2 * this.dist * Math.tan(THREE.MathUtils.degToRad(c.fov / 2))) / Math.max(1, this.viewRect().height);
    const right = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 1);
    cam.pos.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
  }
  _pair() { const [a, b] = [...this.pointers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
  _down(e) {
    e.stopPropagation(); e.preventDefault();
    try { e.target.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) this.gesture = { mode: 'tap', x0: e.clientX, y0: e.clientY, t0: performance.now(), lx: e.clientX, ly: e.clientY };
    else if (this.pointers.size === 2) { const p = this._pair(); this.gesture = { mode: 'multi', d: p.d, mx: p.mx, my: p.my }; }
  }
  _move(e) {
    e.stopPropagation(); e.preventDefault();
    const pt = this.pointers.get(e.pointerId); pt.x = e.clientX; pt.y = e.clientY;
    const g = this.gesture; if (!g) return;
    if (this.pointers.size >= 2) {
      if (g.mode !== 'multi') { const p = this._pair(); this.gesture = { mode: 'multi', d: p.d, mx: p.mx, my: p.my }; return; }
      const p = this._pair();
      if (g.d > 10 && p.d > 10) this.zoom(g.d / p.d);
      this.pan(p.mx - g.mx, p.my - g.my);
      Object.assign(g, { d: p.d, mx: p.mx, my: p.my });
      return;
    }
    if (g.mode === 'tap' && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > TAP_SLOP) g.mode = 'orbit';
    if (g.mode === 'orbit') this.orbit(e.clientX - g.lx, e.clientY - g.ly);
    g.lx = e.clientX; g.ly = e.clientY;
  }
  _up(e, cancelled) {
    e.stopPropagation();
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (!cancelled && g?.mode === 'tap' && !this.pointers.size && performance.now() - g.t0 < TAP_MS) this.tap(e.clientX, e.clientY);
    if (!this.pointers.size) this.gesture = null;
    else if (this.pointers.size === 1) { const [p] = this.pointers.values(); this.gesture = { mode: 'orbit', lx: p.x, ly: p.y }; }   // lifted one finger of a pinch
  }
}
