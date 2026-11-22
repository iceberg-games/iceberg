// PC-only UGC Accessory Editor: build hats, face, back and shoulder accessories from
// templates or primitives, preview them live on your avatar (any body type), save drafts
// and publish to the Catalog's ✨ Creations section for Birg Bucks.
// Opened with bus.emit('ugc:open') (lobby button + Catalog Creations tab). Hidden on phones.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { h, clear } from '../ui/dom.js';
import { bus } from '../core/events.js';
import { isMobile } from '../core/device.js';
import { confirmModal } from '../ui/overlay.js';
import { Avatar } from '../game/avatar.js';
import { BODY_TYPES } from '../game/bodyTypes.js';
import { CURRENCY } from '../core/currency.js';
import {
  UGC_SLOTS, PRIMITIVES, MATERIALS, UGC_MAX_PARTS, UGC_PRICE, UGC_NAME_MAX,
  newSpec, newPart, clampPart, sanitizeSpec, frameFor, buildUgcObject, validateForPublish, nameProblem,
} from './spec.js';
import { listDrafts, saveDraft, deleteDraft, publish, ugcStatus, PRICE_HELP } from './store.js';
import { renderUgcThumb } from './thumb.js';
import './editor.css';

const PRIM = Object.fromEntries(PRIMITIVES.map(([id, label, icon]) => [id, { label, icon }]));
const SWATCHES = ['#f4f8fb', '#9fd8ff', '#3f9de0', '#1f3a5f', '#8b6cf0', '#ff8fb8', '#d83a3f', '#f2a33a', '#ffd23f', '#5fd6a0', '#2f7a4f', '#1d1d22'];
const MAT_SWATCH = { matte: 'radial-gradient(circle at 35% 30%, #cfe3f1, #7d9db5)', glossy: 'radial-gradient(circle at 32% 28%, #fff 0 12%, #6cc8ff 22%, #1f6fae)',
  metal: 'linear-gradient(135deg, #f4f7fa, #8a97a6 45%, #e2e8ee 55%, #5d6b7a)', ice: 'linear-gradient(150deg, rgba(255,255,255,.95), rgba(159,216,255,.6) 50%, rgba(108,200,255,.85))',
  glow: 'radial-gradient(circle, #fff 0 18%, #6cf0ff 40%, rgba(108,200,255,.15) 72%)' };

export class UgcEditor {
  constructor({ economy, ui }) {
    this.economy = economy; this.ui = ui;
    this.el = h('div#ugc-editor.ugc.hidden');
    this.el.addEventListener('keydown', (e) => this._onKey(e));
    this.el.addEventListener('keyup', (e) => e.stopPropagation());
    document.body.append(this.el);
    this.bodyType = 'classic'; this.showGizmo = true; this.uniform = true;
    this._clock = new THREE.Clock();
  }

  // ---------- open / close ----------
  async open({ draft = null } = {}) {
    if (isMobile()) { this.ui?.toast('The Accessory Editor is on computers only. Open Iceberg on a PC to create.', '🖥️'); return false; }
    this.el.classList.remove('hidden'); document.body.classList.add('ugc-open');
    this._initThree();
    this.bodyType = this.economy?.profile?.bodyType || this.ui?.avatar?.bodyType || 'classic';
    this.avatar.setBodyType(this.bodyType);
    if (draft) this._load(draft); else await this.showStart();
    this._running = true; this._loop();
    return true;
  }
  close() {
    this._running = false; this.el.classList.add('hidden'); document.body.classList.remove('ugc-open');
    this._dlg?.remove(); this._dlg = null;
  }
  _onKey(e) {
    e.stopPropagation();   // keep WASD / T / L away from the game while typing
    const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    if (e.key === 'Escape') { if (this._dlg) { this._dlg.remove(); this._dlg = null; } else this.close(); }
    if (typing || !this.spec) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel != null) { e.preventDefault(); this.removePart(this.sel); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && this.sel != null) { e.preventDefault(); this.duplicatePart(this.sel); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); this.save(); }
  }

  // ---------- three.js viewport ----------
  _initThree() {
    if (this.renderer) return;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#dff1fd');
    scene.fog = new THREE.Fog('#dff1fd', 14, 30);
    const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;
    scene.add(new THREE.HemisphereLight('#ffffff', '#9fcbe6', 1.1));
    const sun = new THREE.DirectionalLight('#ffffff', 2.2); sun.position.set(4, 8, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 6, bottom: -2 }); scene.add(sun);
    const rim = new THREE.DirectionalLight('#9fe0ff', 1.1); rim.position.set(-5, 4, -6); scene.add(rim);
    // frosted pedestal
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.75, 0.18, 48), new THREE.MeshPhysicalMaterial({ color: '#eaf7ff', roughness: 0.25, clearcoat: 1, transparent: true, opacity: 0.92 }));
    ped.position.y = -0.09; ped.receiveShadow = true; scene.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.68, 0.025, 8, 96), new THREE.MeshStandardMaterial({ color: '#6cc8ff', emissive: '#6cc8ff', emissiveIntensity: 0.9 }));
    ring.rotation.x = Math.PI / 2; scene.add(ring);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: '#cfe8f8', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.18; floor.receiveShadow = true; scene.add(floor);
    this.avatar = new Avatar(); this.avatar.root.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(this.avatar.root);
    this.avatar.root.rotation.y = 0;
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.12, minDistance: 1.4, maxDistance: 9, enablePan: false, maxPolarAngle: Math.PI * 0.62 });
    this.raycaster = new THREE.Raycaster();
    let down = null;
    r.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    r.domElement.addEventListener('pointerup', (e) => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) this._pick(e); down = null; });
    this._ro = new ResizeObserver(() => this._resize());
  }
  _resize() {
    const v = this.viewport; if (!v || !this.renderer) return;
    const w = v.clientWidth, hh = v.clientHeight; if (!w || !hh) return;
    this.renderer.setSize(w, hh, false); this.camera.aspect = w / hh; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._running) return;
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(0.05, this._clock.getDelta());
    this.controls.update();
    this.object?.userData.tick?.(dt);
    if (this.selHelper) this.selHelper.update();
    if (this.gizmo) { this._gt = (this._gt || 0) + dt; this.gizmo.userData.pulse.material.opacity = 0.35 + Math.sin(this._gt * 3) * 0.2; }
    this.renderer.render(this.scene, this.camera);
  }
  _anchor() { return this.avatar._anchorFor(frameFor(this.spec).bone); }
  _focus(reset = true) {
    this.avatar.root.updateMatrixWorld(true);
    const f = frameFor(this.spec), a = this._anchor();
    const c = a.localToWorld(new THREE.Vector3(...f.center));
    this.controls.target.copy(c);
    if (reset) {
      const back = f.slot === 'back' ? -1 : 1, side = f.slot === 'neck' ? 0.9 : 0.6, dist = f.slot === 'back' ? 4.6 : 4.1;
      this.camera.position.set(c.x + 2.3 * side, c.y + 0.85, c.z + dist * back);
      this.controls.target.y -= 0.25;   // a touch of avatar under the item so it reads as worn
    }
    this.controls.update();
  }

  // ---------- model ----------
  _load(draft) {
    this.draftId = draft.id || null; this.name = draft.name || 'My Accessory';
    this.spec = sanitizeSpec(draft.spec || newSpec('hat'));
    this.price = draft.price || UGC_PRICE.default;
    this.sel = this.spec.parts.length ? 0 : null;
    this.dirty = false;
    this._renderShell(); this._rebuild(); this._focus(true);
  }
  _rebuild() {
    if (this.object) { this.object.parent?.remove(this.object); this.object.userData.dispose?.(); }
    if (this.gizmo) this.gizmo.parent?.remove(this.gizmo);
    if (this.selHelper) { this.scene.remove(this.selHelper); this.selHelper = null; }
    const { object } = buildUgcObject(this.spec);
    this.object = object; this._anchor().add(object);
    this.gizmo = this._makeGizmo(); this.gizmo.visible = this.showGizmo; this._anchor().add(this.gizmo);
    const m = this.sel != null && object.children[this.sel];
    if (m) { this.selHelper = new THREE.BoxHelper(m, '#ff9f1a'); this.selHelper.material.depthTest = false; this.selHelper.renderOrder = 10; this.scene.add(this.selHelper); }
    this._refreshParts(); this._refreshInspector(); this._refreshStatus();
  }
  _makeGizmo() {
    const f = frameFor(this.spec), g = new THREE.Group(); g.position.fromArray(f.center);
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(f.ext[0] * 2, f.ext[1] * 2, f.ext[2] * 2)),
      new THREE.LineDashedMaterial({ color: '#3f9de0', dashSize: 0.05, gapSize: 0.04, transparent: true, opacity: 0.75, depthTest: false }));
    box.computeLineDistances(); box.renderOrder = 9; g.add(box);
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), new THREE.MeshBasicMaterial({ color: '#ff9f1a', transparent: true, depthTest: false }));
    pulse.renderOrder = 11; g.add(pulse); g.userData.pulse = pulse;
    const axes = new THREE.AxesHelper(0.22); axes.material.depthTest = false; axes.renderOrder = 11; g.add(axes);
    return g;
  }
  _pick(e) {
    if (!this.object) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.camera);
    const hit = this.raycaster.intersectObjects(this.object.children, false)[0];
    if (hit) this.select(hit.object.userData.partIndex);
  }
  _touch() { this.dirty = true; }
  select(i) { this.sel = i; this._rebuild(); }
  addPart(p) {
    if (this.spec.parts.length >= UGC_MAX_PARTS) { this.ui?.toast(`Max ${UGC_MAX_PARTS} parts per accessory`, '🧊'); return; }
    const last = this.spec.parts[this.sel ?? -1];
    const part = clampPart(newPart(p, this.spec, last?.c || '#6cc8ff'), this.spec);
    this.spec.parts.push(part); this.sel = this.spec.parts.length - 1; this._touch(); this._rebuild();
  }
  duplicatePart(i) {
    if (this.spec.parts.length >= UGC_MAX_PARTS) { this.ui?.toast(`Max ${UGC_MAX_PARTS} parts per accessory`, '🧊'); return; }
    const c = structuredClone(this.spec.parts[i]); c.pos[0] += 0.08;
    this.spec.parts.splice(i + 1, 0, clampPart(c, this.spec)); this.sel = i + 1; this._touch(); this._rebuild();
  }
  removePart(i) {
    this.spec.parts.splice(i, 1);
    this.sel = this.spec.parts.length ? Math.min(i, this.spec.parts.length - 1) : null; this._touch(); this._rebuild();
  }
  /** Live edit of the selected part: rebuild just that mesh while dragging (cheap), full rebuild on change. */
  _setPart(mut, { full = false } = {}) {
    const i = this.sel; if (i == null) return;
    const part = this.spec.parts[i]; mut(part);
    this.spec.parts[i] = clampPart(part, this.spec); this._touch();
    if (full) return this._rebuild();
    const m = this.object.children[i], q = this.spec.parts[i];
    m.position.fromArray(q.pos); m.rotation.set(...q.rot.map(THREE.MathUtils.degToRad)); m.scale.fromArray(q.scl);
    this._syncFields();
  }
  setBody(id) { this.bodyType = id; this.avatar.setBodyType(id); this._focus(false); this._refreshBody(); }

  // ---------- start screen (empty state) ----------
  async showStart() {
    this.spec = null; this.sel = null;
    if (this.object) { this.object.parent?.remove(this.object); this.object = null; }
    if (this.gizmo) { this.gizmo.parent?.remove(this.gizmo); this.gizmo = null; }
    if (this.selHelper) { this.scene.remove(this.selHelper); this.selHelper = null; }
    const drafts = await listDrafts();
    const tplCard = (tid) => { const f = UGC_SLOTS[tid];
      return h('div.ugc-tpl', { 'data-template': tid },
        h('div.ugc-tpl-ico', f.icon), h('b', f.label), h('small', { hat: 'Rides on the head', face: 'Glasses, masks, noses', back: 'Packs, wings, capes', shoulder: 'Pets & pals on the shoulder' }[tid]),
        h('div.ugc-tpl-btns',
          h('button.btn.small.ugc-use-tpl', { onclick: () => this._load({ name: `My ${f.label}`, spec: newSpec(tid) }) }, 'Template'),
          h('button.btn.small.secondary.ugc-blank', { onclick: () => this._load({ name: `My ${f.label}`, spec: newSpec(tid, { blank: true }) }) }, 'Blank'))); };
    clear(this.el).append(h('div.ugc-start',
      h('div.snowbg'),
      h('div.ugc-start-card',
        h('div.ugc-start-head', h('div', h('h1', '🛠️ Accessory Editor'), h('p.muted', 'Build your own hats, shades, backpacks and shoulder pals, then sell them in the Catalog for Birg Bucks.')),
          h('button.icon-btn.ugc-x', { title: 'Close (Esc)', onclick: () => this.close() }, '✕')),
        h('h3', 'Start something new'),
        h('div.ugc-tpls', Object.keys(UGC_SLOTS).map(tplCard)),
        h('h3', `Your drafts ${drafts.length ? `(${drafts.length})` : ''}`),
        drafts.length ? h('div.ugc-drafts', drafts.map(d => h('div.ugc-draft', { 'data-draft': d.id },
          h('img.ugc-draft-thumb', { src: renderUgcThumb(d.spec) || '', alt: '' }),
          h('div.ugc-draft-meta', h('b', d.name), h('small.muted', `${frameFor(d.spec).label} · ${d.spec.parts.length} parts${d.publishedId ? ' · published' : ''}`)),
          h('button.btn.small', { onclick: () => this._load(d) }, 'Open'),
          h('button.btn.small.secondary', { title: 'Delete draft', onclick: async () => { if (await confirmModal(`Delete the draft "${d.name}"?`, { title: 'Delete draft?', okLabel: 'Delete', danger: true })) { await deleteDraft(d.id); this.showStart(); } } }, '🗑'))))
          : h('div.ugc-empty', h('div.ugc-empty-ico', '❄️'), h('b', 'No drafts yet'), h('span.muted', 'Pick a template above, or start blank and stack primitives.')),
        h('p.muted.small.ugc-note', `PC only · up to ${UGC_MAX_PARTS} parts · ${ugcStatus.reason}`))));
  }

  // ---------- editor shell ----------
  _renderShell() {
    const f = frameFor(this.spec);
    this.nameIn = h('input.ugc-name#ugc-name', { value: this.name, maxLength: UGC_NAME_MAX, placeholder: 'Name your accessory', oninput: (e) => { this.name = e.target.value; this._touch(); this._refreshStatus(); } });
    this.statusEl = h('span.ugc-status');
    this.partsEl = h('div.ugc-parts');
    this.inspEl = h('div.ugc-insp');
    this.bodyEl = h('div.ugc-bodies');
    this.viewport = h('div.ugc-viewport', this.renderer.domElement,
      h('div.ugc-vp-top', this.bodyEl),
      h('div.ugc-vp-bottom',
        h('label.ugc-toggle', h('input', { type: 'checkbox', checked: this.showGizmo, onchange: (e) => { this.showGizmo = e.target.checked; if (this.gizmo) this.gizmo.visible = this.showGizmo; } }), ' Slot marker'),
        h('button.btn.small.secondary', { onclick: () => this._focus(true) }, '⟲ Reset view'),
        h('span.muted.small', 'Drag to orbit · scroll to zoom · click a part to select')));
    clear(this.el).append(h('div.ugc-shell',
      h('header.ugc-top',
        h('div.brand', h('span.logo', '🛠️'), h('b', 'Accessory Editor')),
        h('span.ugc-slot-badge', `${f.icon} ${f.label} slot`),
        this.nameIn,
        this.statusEl,
        h('div.ugc-top-actions',
          h('button.btn.small.secondary#ugc-drafts', { onclick: async () => { if (!this.dirty || await confirmModal('Leave without saving your changes?', { title: 'Unsaved changes', okLabel: 'Leave' })) this.showStart(); } }, '📂 Drafts'),
          h('button.btn.small.secondary#ugc-save', { onclick: () => this.save() }, '💾 Save draft'),
          h('button.btn.small.ugc-publish#ugc-publish', { onclick: () => this.openPublish() }, '🚀 Publish…'),
          h('button.icon-btn.ugc-x', { title: 'Close (Esc)', onclick: async () => { if (!this.dirty || await confirmModal('Close without saving your changes?', { title: 'Unsaved changes', okLabel: 'Close' })) this.close(); } }, '✕'))),
      h('aside.ugc-left.ugc-panel',
        h('h3', 'Add a part'),
        h('div.ugc-prims', PRIMITIVES.map(([id, label, icon]) => h('button.ugc-prim', { 'data-prim': id, title: `Add ${label}`, onclick: () => this.addPart(id) }, h('span', icon), h('small', label)))),
        h('div.ugc-parts-head', h('h3#ugc-parts-title', 'Parts'), h('div.row',
          h('button.btn.small.secondary#ugc-dup', { title: 'Duplicate (Ctrl+D)', onclick: () => this.sel != null && this.duplicatePart(this.sel) }, '⧉ Duplicate'),
          h('button.btn.small.secondary.ugc-del#ugc-del', { title: 'Delete (Del)', onclick: () => this.sel != null && this.removePart(this.sel) }, '🗑'))),
        this.partsEl),
      this.viewport,
      h('aside.ugc-right.ugc-panel', this.inspEl)));
    this._ro.disconnect(); this._ro.observe(this.viewport);
    requestAnimationFrame(() => this._resize());
    this._refreshBody();
  }
  _refreshStatus() {
    if (!this.statusEl) return;
    const np = nameProblem(this.name);
    this.statusEl.textContent = this.dirty ? '● Unsaved changes' : (this._savedWhere ? (this._savedWhere === 'account' ? '✓ Saved to your account' : '✓ Saved on this device') : '');
    this.statusEl.classList.toggle('warn', !!this.dirty);
    this.nameIn?.classList.toggle('bad', !!np && (this.name || '').length > 0);
  }
  _refreshBody() {
    if (!this.bodyEl) return;
    clear(this.bodyEl).append(...Object.values(BODY_TYPES).map(b => h('button.ugc-body' + (b.id === this.bodyType ? '.on' : ''), { 'data-body': b.id, title: b.blurb, onclick: () => this.setBody(b.id) }, h('span', b.icon), b.label)));
  }
  _refreshParts() {
    if (!this.partsEl) return;
    const counts = {};
    this.el.querySelector('#ugc-parts-title').textContent = `Parts ${this.spec.parts.length}/${UGC_MAX_PARTS}`;
    clear(this.partsEl).append(...this.spec.parts.map((p, i) => {
      counts[p.p] = (counts[p.p] || 0) + 1;
      return h('button.ugc-part' + (i === this.sel ? '.on' : ''), { 'data-part': i, onclick: () => this.select(i) },
        h('span.ugc-part-ico', PRIM[p.p].icon), h('span.ugc-part-name', `${PRIM[p.p].label} ${counts[p.p]}`),
        h('span.ugc-part-mat', p.m), h('span.ugc-chip', { style: { background: p.c } }));
    }));
    if (!this.spec.parts.length) this.partsEl.append(h('div.ugc-empty.small', h('b', 'No parts yet'), h('span.muted', 'Add a primitive above to start building.')));
    for (const b of this.el.querySelectorAll('.ugc-prim')) b.disabled = this.spec.parts.length >= UGC_MAX_PARTS;
  }
  _refreshInspector() {
    if (!this.inspEl) return;
    const part = this.spec.parts[this.sel ?? -1];
    if (!part) { clear(this.inspEl).append(h('h3', 'Part'), h('div.ugc-empty', h('div.ugc-empty-ico', '👆'), h('b', 'Select a part'), h('span.muted', 'Pick one in the list or click it on the avatar.'))); return; }
    const f = frameFor(this.spec);
    this._fields = [];
    const vec = (key, label, axes, min, max, step) => h('div.ugc-group', h('h4', label),
      ...axes.map((ax, k) => {
        const lo = typeof min === 'function' ? min(k) : min, hi = typeof max === 'function' ? max(k) : max;
        const rng = h('input.ugc-range', { type: 'range', min: lo, max: hi, step, value: part[key][k], 'data-key': `${key}${k}` });
        const numIn = h('input.ugc-num', { type: 'number', min: lo, max: hi, step, value: part[key][k], 'data-key': `${key}${k}n` });
        const set = (v, full) => this._setPart(p => { if (key === 'scl' && this.uniform) { const r = v / (p.scl[k] || 1); p.scl = p.scl.map((s, j) => j === k ? v : s * r); } else p[key][k] = v; }, { full });
        rng.oninput = () => set(+rng.value, false); rng.onchange = () => set(+rng.value, true);
        numIn.onchange = () => set(+numIn.value, true);
        this._fields.push({ key, k, rng, numIn });
        return h('label.ugc-row', h('span.ugc-ax.ax' + ax, ax.toUpperCase()), rng, numIn);
      }));
    clear(this.inspEl).append(
      h('h3', `${PRIM[part.p].icon} ${PRIM[part.p].label}`),
      h('div.ugc-group', h('h4', 'Shape'), h('div.ugc-seg', PRIMITIVES.map(([id, label, icon]) => h('button' + (part.p === id ? '.on' : ''), { title: label, 'data-shape': id, onclick: () => this._setPart(p => { p.p = id; }, { full: true }) }, icon)))),
      vec('pos', 'Position', ['x', 'y', 'z'], (k) => +(f.center[k] - f.ext[k]).toFixed(2), (k) => +(f.center[k] + f.ext[k]).toFixed(2), 0.01),
      vec('rot', 'Rotation°', ['x', 'y', 'z'], -180, 180, 1),
      h('div.ugc-group.ugc-scale-wrap', vec('scl', 'Scale', ['x', 'y', 'z'], 0.02, f.maxScale, 0.01),
        h('label.ugc-toggle.small', h('input#ugc-uniform', { type: 'checkbox', checked: this.uniform, onchange: (e) => { this.uniform = e.target.checked; } }), ' Keep proportions')),
      h('div.ugc-group', h('h4', 'Color'),
        h('div.ugc-colors', h('input.ugc-color#ugc-color', { type: 'color', value: part.c, oninput: (e) => this._setPart(p => { p.c = e.target.value; }, { full: true }) }),
          ...SWATCHES.map(c => h('button.ugc-sw' + (c === part.c ? '.on' : ''), { style: { background: c }, title: c, 'data-color': c, onclick: () => this._setPart(p => { p.c = c; }, { full: true }) })))),
      h('div.ugc-group', h('h4', 'Material'),
        h('div.ugc-mats', MATERIALS.map(([id, label]) => h('button.ugc-mat' + (part.m === id ? '.on' : ''), { 'data-mat': id, onclick: () => this._setPart(p => { p.m = id; }, { full: true }) },
          h('span.ugc-mat-ball', { style: { background: MAT_SWATCH[id] } }), label)))),
      h('p.muted.small', `Parts stay inside the dashed ${f.label.toLowerCase()} box so accessories fit every body type.`));
  }
  _syncFields() {
    const part = this.spec.parts[this.sel ?? -1]; if (!part || !this._fields) return;
    for (const { key, k, rng, numIn } of this._fields) { rng.value = part[key][k]; if (document.activeElement !== numIn) numIn.value = part[key][k]; }
    this._refreshStatus();
  }

  // ---------- save / publish ----------
  async save() {
    if (!this.spec) return null;
    const { draft, where } = await saveDraft({ id: this.draftId, name: this.name, spec: this.spec });
    this.draftId = draft.id; this.dirty = false; this._savedWhere = where; this._refreshStatus();
    this.ui?.toast(where === 'account' ? 'Draft saved to your account' : 'Draft saved on this device', '💾');
    return draft;
  }
  openPublish() {
    if (!this.spec) return;
    const f = frameFor(this.spec);
    const thumb = renderUgcThumb(sanitizeSpec(this.spec));
    let price = this.price || UGC_PRICE.default;
    const errBox = h('ul.ugc-errs');
    const nameIn = h('input.ugc-name#ugc-pub-name', { value: this.name, maxLength: UGC_NAME_MAX, oninput: () => check() });
    const priceNum = h('input.ugc-num.big#ugc-price', { type: 'number', min: UGC_PRICE.min, max: UGC_PRICE.max, step: 10, value: price, oninput: () => { price = +priceNum.value; priceRng.value = price; check(); } });
    const priceRng = h('input.ugc-range#ugc-price-range', { type: 'range', min: UGC_PRICE.min, max: 1000, step: 10, value: Math.min(price, 1000), oninput: () => { price = +priceRng.value; priceNum.value = price; check(); } });
    const go = h('button.btn.big.ugc-publish#ugc-pub-go', { onclick: async () => {
      if (check().length) return;
      go.disabled = true; this.name = nameIn.value.trim(); this.price = price;
      const draft = await this.save().catch(() => null);
      const res = await publish({ draftId: draft?.id || this.draftId, name: this.name, spec: this.spec, price, thumb }, this.economy);
      go.disabled = false;
      if (!res.ok) { clear(errBox).append(...res.errors.map(e => h('li', e))); return; }
      this.nameIn.value = this.name;
      clear(this._dlg.querySelector('.dialog')).append(
        h('div.ugc-done', h('img.ugc-pub-thumb', { src: thumb || '' }), h('h2', `🎉 ${this.name} is in the Catalog!`),
          h('p.muted', res.where === 'account' ? 'Published to your account. Other players can buy it in Catalog → ✨ Creations.' : 'Saved on this device for now (account sync turns on with the server update). Find it in Catalog → ✨ Creations. You already own it, free.'),
          h('div.row.center',
            h('button.btn#ugc-wear', { onclick: () => { this.economy.equip(res.item.id); this.ui?.toast(`Wearing ${this.name}`, '✨'); } }, '✨ Wear it'),
            h('button.btn.secondary#ugc-view-catalog', { onclick: () => { this._dlg.remove(); this._dlg = null; this.close(); this.ui.shopCat = 'ugc'; this.ui.openDrawer('shop'); } }, '🛍️ View in Catalog'),
            h('button.btn.secondary', { onclick: () => { this._dlg.remove(); this._dlg = null; } }, 'Keep editing'))));
    } }, '🚀 Publish to Catalog');
    const check = () => {
      const errs = validateForPublish({ name: nameIn.value, spec: sanitizeSpec(this.spec), price });
      clear(errBox).append(...errs.map(e => h('li', e))); go.classList.toggle('disabled', errs.length > 0); return errs;
    };
    this._dlg?.remove();
    this._dlg = h('div.dialog-backdrop.ugc-dialog#ugc-publish-dialog', h('div.dialog',
      h('div.ugc-pub', h('img.ugc-pub-thumb', { src: thumb || '', alt: 'preview' }),
        h('div.ugc-pub-form',
          h('h2', '🚀 Publish to the Catalog'),
          h('label.ugc-field', h('span', 'Name'), nameIn),
          h('div.ugc-field', h('span', 'Slot'), h('b', `${f.icon} ${f.label}`), h('small.muted', ` · ${this.spec.parts.length}/${UGC_MAX_PARTS} parts`)),
          h('label.ugc-field', h('span', `Price (${CURRENCY.name})`), h('div.ugc-price', priceRng, priceNum, h('b', 'BB'))),
          h('div.ugc-price-presets', [50, 150, 300, 750, 2000].map(v => h('button.btn.small.secondary', { onclick: () => { price = v; priceNum.value = v; priceRng.value = Math.min(v, 1000); check(); } }, `${v.toLocaleString()}`))),
          h('p.muted.small', PRICE_HELP, ' You always wear your own creations for free. Birg Bucks are play money; nothing here costs real money.'),
          errBox,
          h('div.row', go, h('button.btn.secondary', { onclick: () => { this._dlg.remove(); this._dlg = null; } }, 'Cancel'))))));
    this.el.append(this._dlg);
    check(); nameIn.focus();
  }
}

/** Wire the editor: bus 'ugc:open' opens it (PC only). Returns the editor (window.iceberg.ugc). */
export function mountUgcEditor({ economy, ui }) {
  const ed = new UgcEditor({ economy, ui });
  bus.on('ugc:open', (opts) => ed.open(opts || {}));
  return ed;
}
