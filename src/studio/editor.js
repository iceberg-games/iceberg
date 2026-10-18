// Studio editor game instance: free-fly camera, multi-selection (click,
// Shift/Ctrl-click, box select, Ctrl+A), move/rotate/scale gizmos for one part
// or a whole selection, group/ungroup into Models, copy/paste/duplicate/delete,
// properties (incl. multi-edit), scripts, undo/redo and the animator.
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { StudioWorld } from './world.js';
import { makeInstance, newId } from './instances.js';
import { translate } from './nlscript.js';
import { setKey, deleteKey, sampleAnimation, waveAnimation, boneRot } from './animation.js';
import { bus } from '../core/events.js';

const R2D = THREE.MathUtils.radToDeg, D2R = THREE.MathUtils.degToRad;
const round = (v, n = 3) => +(+v).toFixed(n);
const cache = new Map(); // per-doc editor state (undo stacks, camera) that survives scene reloads
const CLIP_KEY = 'iceberg:v1:studioClipboard';
let clipboard = null;

class FlyCamera {
  constructor(camera, st) { this.camera = camera; this.pos = new THREE.Vector3(...(st?.pos || [18, 16, 24])); this.yaw = st?.yaw ?? 0.65; this.pitch = st?.pitch ?? -0.45; this.apply(); }
  forward() { return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
  apply() { this.camera.position.copy(this.pos); this.camera.lookAt(this.pos.clone().add(this.forward())); }
  drag(dx, dy, button) { if (button !== 2 && button !== 1) return; this.yaw -= dx * 0.005; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - dy * 0.005)); }
  wheel(d) { this.pos.addScaledVector(this.forward(), -d * 0.03); }
  update(dt, input) {
    if (input.down('ControlLeft') || input.down('ControlRight') || input.down('MetaLeft') || input.down('MetaRight')) { this.apply(); return; }
    const sp = (input.down('ShiftLeft') || input.down('ShiftRight') ? 60 : 22) * dt;
    const f = this.forward(), r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    if (input.down('KeyW')) this.pos.addScaledVector(f, sp); if (input.down('KeyS')) this.pos.addScaledVector(f, -sp);
    if (input.down('KeyD')) this.pos.addScaledVector(r, sp); if (input.down('KeyA')) this.pos.addScaledVector(r, -sp);
    if (input.down('KeyE')) this.pos.y += sp; if (input.down('KeyQ')) this.pos.y -= sp;
    this.apply();
  }
  state() { return { pos: this.pos.toArray(), yaw: this.yaw, pitch: this.pitch }; }
}

export async function createEditor(ctx, doc) {
  const { engine, models } = ctx;
  const scene = new THREE.Scene();
  const world = new StudioWorld(scene, doc, { models, editing: true });
  const st = cache.get(doc.id) || { undo: [], redo: [], cam: null };
  cache.set(doc.id, st);
  const cam = new FlyCamera(engine.camera, st.cam);
  const grid = new THREE.GridHelper(512, 512, '#9fb3c4', '#8193a3'); grid.position.y = 0.01; grid.material.transparent = true; grid.material.opacity = 0.18;
  if (doc.ground !== 'void') scene.add(grid);

  const tc = new TransformControls(engine.camera, engine.renderer.domElement);
  tc.setSize(0.9);
  const helper = tc.getHelper(); scene.add(helper);
  const pivot = new THREE.Object3D(); pivot.name = 'SelectionPivot'; scene.add(pivot);
  const boxes = new THREE.Group(); scene.add(boxes);
  const marquee = document.createElement('div'); marquee.className = 'st-marquee hidden'; document.body.append(marquee);

  const ed = {
    scene, collision: null, hideAvatar: true, editing: true, cameraController: cam, doc, world, music: doc.music || 'none',
    selection: [], tool: 'move', snap: { move: 1, rot: 15 }, space: 'world',
    tc, pivot,
    animator: { open: false, rigId: null, animId: null, time: 0, bone: null, playing: false, clip: null },
  };
  // selectedId = the primary (last clicked) selection, kept for single-selection callers
  Object.defineProperty(ed, 'selectedId', { get: () => ed.selection[ed.selection.length - 1] || null, set: (id) => { ed.selection = id ? [id] : []; } });
  const changed = (what = 'doc') => bus.emit('studio:changed', what);
  const instById = (id) => doc.instances.find(i => i.id === id);
  const snapshot = () => JSON.stringify({ instances: doc.instances, animations: doc.animations });
  ed.checkpoint = () => { st.undo.push(snapshot()); if (st.undo.length > 150) st.undo.shift(); st.redo = []; doc.updatedAt = Date.now(); };
  const restore = (s) => { const o = JSON.parse(s); doc.instances = o.instances; doc.animations = o.animations || []; world.rebuildAll(doc.instances); ed.selection = ed.selection.filter(instById); attach(); changed(); };
  ed.undo = () => { if (!st.undo.length) return false; st.redo.push(snapshot()); restore(st.undo.pop()); return true; };
  ed.redo = () => { if (!st.redo.length) return false; st.undo.push(snapshot()); restore(st.redo.pop()); return true; };
  ed.canUndo = () => st.undo.length > 0; ed.canRedo = () => st.redo.length > 0;

  // ---------- hierarchy helpers (Models = 'group' instances; children have .parent) ----------
  const childrenOf = (id) => doc.instances.filter(i => i.parent === id);
  const descendants = (id) => { const out = []; const walk = (p) => { for (const c of childrenOf(p)) { out.push(c); walk(c.id); } }; walk(id); return out; };
  const topAncestor = (id) => { let i = instById(id); while (i?.parent && instById(i.parent)) i = instById(i.parent); return i?.id || id; };
  const isGroup = (i) => i?.type === 'group';
  ed.childrenOf = childrenOf; ed.descendants = descendants; ed.topAncestor = topAncestor;
  /** the parts a transform applies to: selected parts + every part inside selected Models */
  const moveSet = () => { const ids = new Set(); for (const id of ed.selection) { const i = instById(id); if (!i) continue; if (isGroup(i)) descendants(id).filter(d => !isGroup(d)).forEach(d => ids.add(d.id)); else ids.add(id); } return [...ids]; };
  ed.moveSet = moveSet;
  const boundsOf = (ids) => { const b = new THREE.Box3(); for (const id of ids) { const e = world.entries.get(id); if (e) b.expandByObject(e.root); } return b; };
  function updateGroupCenters() {
    for (const g of doc.instances.filter(isGroup)) { const kids = descendants(g.id).filter(d => !isGroup(d)).map(d => d.id); if (!kids.length) continue; const c = boundsOf(kids).getCenter(new THREE.Vector3()); g.pos = c.toArray().map(v => round(v)); const e = world.entries.get(g.id); if (e) e.root.position.copy(c); }
  }

  // ---------- selection & gizmo ----------
  const groupMode = () => { const ms = moveSet(); return ms.length > 1 || (ed.selection.length === 1 && isGroup(instById(ed.selection[0]))); };
  function drawBoxes() {
    for (const h of boxes.children) { h.geometry?.dispose(); h.material?.dispose(); }
    boxes.clear();
    if (ed.animator.open) return;
    const ids = moveSet().slice(0, 300);
    for (const id of ids) { const e = world.entries.get(id); if (!e) continue; const h = new THREE.BoxHelper(e.root, ed.selection.length > 1 || groupMode() ? '#ffb02e' : '#33b5ff'); boxes.add(h); }
    if (groupMode()) { const h = new THREE.Box3Helper(boundsOf(ids), '#33b5ff'); boxes.add(h); }
  }
  function attach() {
    tc.detach();
    if (ed.animator.open && ed.animator.bone) {
      const rig = world.entries.get(ed.animator.rigId)?.rig; const b = rig?.bones.get(ed.animator.bone);
      if (b) { tc.setMode('rotate'); tc.setSpace('local'); tc.attach(b); }
      boxes.clear(); return;
    }
    drawBoxes();
    const ids = moveSet();
    if (!ids.length || ed.tool === 'select') return;
    tc.setMode({ move: 'translate', rotate: 'rotate', scale: 'scale' }[ed.tool]);
    tc.setTranslationSnap(ed.snap.move || null); tc.setRotationSnap(ed.snap.rot ? D2R(ed.snap.rot) : null); tc.setScaleSnap(ed.snap.move ? 0.25 : null);
    if (groupMode()) {
      // gizmo on a pivot at the selection centre; parts follow the pivot's transform
      pivot.position.copy(boundsOf(ids).getCenter(new THREE.Vector3())); pivot.rotation.set(0, 0, 0); pivot.scale.set(1, 1, 1); pivot.updateMatrixWorld(true);
      tc.setSpace('world'); tc.attach(pivot);
    } else {
      tc.setSpace(ed.tool === 'move' ? ed.space : 'local');
      tc.attach(world.entries.get(ids[0]).root);
    }
  }
  ed.isSelected = (id) => ed.selection.includes(id);
  ed.select = (id) => { ed.selection = id && instById(id) ? [id] : []; attach(); changed('selection'); };
  ed.selectMany = (ids, add = false) => { const list = add ? [...ed.selection] : []; for (const id of ids) if (instById(id) && !list.includes(id)) list.push(id); ed.selection = list; attach(); changed('selection'); };
  ed.toggleSelect = (id) => { if (!instById(id)) return; ed.selection = ed.isSelected(id) ? ed.selection.filter(x => x !== id) : [...ed.selection, id]; attach(); changed('selection'); };
  ed.selectAll = () => ed.selectMany(doc.instances.filter(i => !i.parent).map(i => i.id));
  ed.setTool = (t) => { ed.tool = t; attach(); changed('tool'); };
  ed.setSnap = (k, v) => { ed.snap[k] = v; attach(); changed('tool'); };
  ed.toggleSpace = () => { ed.space = ed.space === 'world' ? 'local' : 'world'; attach(); changed('tool'); };

  let dragStart = null, groupStart = null;
  const P0inv = new THREE.Matrix4(), M = new THREE.Matrix4();
  tc.addEventListener('dragging-changed', (ev) => {
    if (ev.value) {
      dragStart = snapshot();
      if (tc.object === pivot) { pivot.updateMatrixWorld(true); P0inv.copy(pivot.matrixWorld).invert(); groupStart = moveSet().map(id => { const e = world.entries.get(id); e.root.updateMatrix(); return { id, m: e.root.matrix.clone() }; }); }
      return;
    }
    // drag ended → commit
    if (ed.animator.open && ed.animator.bone) { const a = ed.currentAnim(); if (a) { st.undo.push(dragStart); st.redo = []; setKey(a, ed.animator.bone, ed.animator.time, tc.object); changed('anim'); } return; }
    const commit = (inst, r, scale) => {
      inst.pos = r.position.toArray().map(v => round(v));
      inst.rot = [r.rotation.x, r.rotation.y, r.rotation.z].map(v => round(R2D(v), 2));
      if (Math.abs(scale.x - 1) + Math.abs(scale.y - 1) + Math.abs(scale.z - 1) > 1e-4) inst.size = inst.size.map((s, i) => round(Math.max(0.05, Math.abs(s * scale.getComponent(i)))));
      r.scale.set(1, 1, 1); world.rebuild(inst);
    };
    if (tc.object === pivot && groupStart) {
      st.undo.push(dragStart); st.redo = []; doc.updatedAt = Date.now();
      for (const g of groupStart) { const inst = instById(g.id), e = world.entries.get(g.id); if (inst && e) commit(inst, e.root, e.root.scale.clone()); }
      groupStart = null; updateGroupCenters(); attach(); changed(); return;
    }
    const id = moveSet()[0]; const inst = instById(id), e = world.entries.get(id); if (!inst || !e) return;
    st.undo.push(dragStart); st.redo = []; doc.updatedAt = Date.now();
    commit(inst, e.root, e.root.scale.clone()); updateGroupCenters(); attach(); changed();
  });
  tc.addEventListener('objectChange', () => {
    if (ed.animator.open) { bus.emit('studio:changed', 'bonepose'); return; }
    if (tc.object === pivot && groupStart) {
      pivot.updateMatrixWorld(true); M.copy(pivot.matrixWorld).multiply(P0inv);
      for (const g of groupStart) { const e = world.entries.get(g.id); if (!e) continue; const m = M.clone().multiply(g.m); m.decompose(e.root.position, e.root.quaternion, e.root.scale); }
    }
    drawBoxes();
  });

  // ---------- viewport picking & box select ----------
  let downAxis = null;
  const pickId = (ray) => { const hit = ray.intersectObjects(world.pickables(), false).find(h => h.object.visible); return hit && !hit.object.userData.ground ? world.idFromObject(hit.object) : null; };
  ed.onPointerDown = (e, ray) => {
    downAxis = tc.axis;
    if (e.button !== 0 || tc.axis || ed.animator.open) return null;
    // drag on empty space (or Shift+drag anywhere) draws a selection box
    return (!pickId(ray) || e.shiftKey) ? 'drag' : null;
  };
  ed.onPointerDrag = ({ x0, y0, x, y }) => {
    Object.assign(marquee.style, { left: `${Math.min(x0, x)}px`, top: `${Math.min(y0, y)}px`, width: `${Math.abs(x - x0)}px`, height: `${Math.abs(y - y0)}px` });
    marquee.classList.remove('hidden');
  };
  ed.boxSelect = (x0, y0, x1, y1, add = false) => {
    const rect = engine.renderer.domElement.getBoundingClientRect();
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    const ids = new Set();
    for (const inst of doc.instances) {
      if (isGroup(inst)) continue;
      const e = world.entries.get(inst.id); if (!e) continue;
      const c = new THREE.Box3().setFromObject(e.root).getCenter(new THREE.Vector3()).project(engine.camera);
      if (c.z > 1) continue;
      const sx = rect.left + (c.x + 1) / 2 * rect.width, sy = rect.top + (1 - c.y) / 2 * rect.height;
      if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) ids.add(topAncestor(inst.id));
    }
    ed.selectMany([...ids], add); return [...ids];
  };
  ed.onPointerDragEnd = ({ x0, y0, x, y, shift, ctrl }) => { marquee.classList.add('hidden'); ed.boxSelect(x0, y0, x, y, shift || ctrl); };
  ed.onClick = ({ ray, button, shift, ctrl }) => {
    if (button !== 0 || downAxis || tc.dragging) return;
    const raw = pickId(ray);
    if (ed.animator.open) { if (raw && world.entries.get(raw)?.rig) ed.selectRig(raw); return; }
    const id = raw ? topAncestor(raw) : null; // clicking a part inside a Model selects the Model
    if (shift || ctrl) { if (id) ed.toggleSelect(id); return; }
    ed.select(id);
  };

  // ---------- operations ----------
  function placementPoint(size) {
    const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(0, 0), engine.camera);
    const hit = rc.intersectObjects(world.pickables(), false)[0];
    let p;
    if (hit && hit.distance < 200) { const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0); p = hit.point.clone(); if (n.y > 0.5) p.y += size[1] / 2; else p.addScaledVector(n, Math.max(size[0], size[2]) / 2); }
    else p = cam.pos.clone().addScaledVector(cam.forward(), 16);
    const s = ed.snap.move || 0; if (s) { p.x = Math.round(p.x / s) * s; p.z = Math.round(p.z / s) * s; }
    return p.toArray().map(v => round(v));
  }
  const uniqueName = (base) => { base = base.replace(/\d+$/, '') || 'Part'; let name = base, n = 1; while (doc.instances.some(i => i.name === name)) name = `${base}${++n}`; return name; };
  ed.insert = (type, over = {}) => {
    ed.checkpoint();
    if (type === 'spawn') { const ex = doc.instances.find(i => i.type === 'spawn'); if (ex) { ex.pos = placementPoint(ex.size); world.rebuild(ex); ed.select(ex.id); changed(); return ex.id; } }
    const inst = makeInstance(type, over);
    if (type === 'checkpoint' && !over.order) inst.order = doc.instances.filter(i => i.type === 'checkpoint').length + 1;
    if (!over.pos) inst.pos = placementPoint(inst.size);
    if (type === 'rig' && !over.pos) inst.pos[1] -= inst.size[1] / 2;
    if (type === 'model' && !over.pos) inst.pos[1] -= inst.size[1] / 2;
    if (doc.instances.some(i => i.name === inst.name)) inst.name = uniqueName(inst.name);
    doc.instances.push(inst); world.add(inst); ed.select(inst.id);
    if (ed.tool === 'select') ed.setTool('move');
    changed(); return inst.id;
  };
  const asList = (ids) => (ids == null ? [...ed.selection] : Array.isArray(ids) ? ids : [ids]).filter(id => instById(id));
  /** delete parts/Models (and everything inside them) as one undo step */
  ed.remove = (ids) => {
    const list = asList(ids); if (!list.length) return 0;
    ed.checkpoint();
    const gone = new Set(); for (const id of list) { gone.add(id); descendants(id).forEach(d => gone.add(d.id)); }
    doc.instances = doc.instances.filter(i => !gone.has(i.id));
    doc.animations = (doc.animations || []).filter(a => !gone.has(a.rigId));
    for (const id of gone) world.remove(id);
    ed.selection = ed.selection.filter(id => !gone.has(id)); updateGroupCenters(); attach(); changed(); return gone.size;
  };
  /** deep-copy instances (with their Model children) giving fresh ids; returns the new top-level instances + all */
  function cloneTree(list, offset) {
    const srcIds = new Set(); for (const id of list) { srcIds.add(id); descendants(id).forEach(d => srcIds.add(d.id)); }
    const src = doc.instances.filter(i => srcIds.has(i.id));
    return cloneInstances(JSON.parse(JSON.stringify(src)), offset, (doc.animations || []).filter(a => srcIds.has(a.rigId)));
  }
  function cloneInstances(src, offset, anims = []) {
    const map = new Map(); for (const i of src) map.set(i.id, newId());
    const all = src.map(i => {
      const c = JSON.parse(JSON.stringify(i)); c.id = map.get(i.id);
      c.parent = c.parent && map.has(c.parent) ? map.get(c.parent) : null;
      if (offset) c.pos = [c.pos[0] + offset[0], c.pos[1] + offset[1], c.pos[2] + offset[2]];
      c.scripts = (c.scripts || []).map(s => ({ ...s, id: newId('s') }));
      return c;
    });
    for (const c of all) if (doc.instances.some(i => i.name === c.name) || all.some(o => o !== c && o.name === c.name && all.indexOf(o) < all.indexOf(c))) c.name = uniqueName(c.name);
    const animations = anims.filter(a => map.has(a.rigId)).map(a => ({ ...JSON.parse(JSON.stringify(a)), id: newId('a'), rigId: map.get(a.rigId) }));
    return { all, top: all.filter(c => !c.parent), animations };
  }
  function addClones({ all, top, animations }) {
    for (const c of all) { doc.instances.push(c); world.add(c); }
    if (animations.length) (doc.animations ||= []).push(...animations);
    ed.selection = top.map(c => c.id); updateGroupCenters(); attach(); changed();
    return top.map(c => c.id);
  }
  /** duplicate the selection; returns the new ids (primary id when one part, for older callers) */
  ed.duplicate = (ids) => {
    const list = asList(ids); if (!list.length) return null;
    ed.checkpoint();
    const out = addClones(cloneTree(list, [(ed.snap.move || 1) * 2, 0, 0]));
    return out.length === 1 ? out[0] : out;
  };
  ed.copy = (ids) => {
    const list = asList(ids); if (!list.length) return 0;
    const srcIds = new Set(); for (const id of list) { srcIds.add(id); descendants(id).forEach(d => srcIds.add(d.id)); }
    clipboard = { instances: JSON.parse(JSON.stringify(doc.instances.filter(i => srcIds.has(i.id)))).map(i => (srcIds.has(i.parent) ? i : { ...i, parent: null })), animations: JSON.parse(JSON.stringify((doc.animations || []).filter(a => srcIds.has(a.rigId)))) };
    try { localStorage.setItem(CLIP_KEY, JSON.stringify(clipboard)); } catch { /* storage full/blocked: memory clipboard still works */ }
    changed('clipboard'); return clipboard.instances.length;
  };
  ed.cut = (ids) => { const n = ed.copy(ids); if (n) ed.remove(ids); return n; };
  ed.hasClipboard = () => { if (clipboard) return true; try { return !!localStorage.getItem(CLIP_KEY); } catch { return false; } };
  ed.paste = () => {
    let clip = clipboard; if (!clip) { try { clip = JSON.parse(localStorage.getItem(CLIP_KEY) || 'null'); } catch { clip = null; } }
    if (!clip?.instances?.length) return [];
    ed.checkpoint();
    // paste in front of the camera, keeping the copied layout
    const b = new THREE.Box3(); for (const i of clip.instances) if (i.type !== 'group') b.expandByPoint(new THREE.Vector3(...i.pos));
    const c = b.isEmpty() ? new THREE.Vector3() : b.getCenter(new THREE.Vector3());
    const target = new THREE.Vector3(...placementPoint([1, Math.max(1, b.isEmpty() ? 1 : b.max.y - b.min.y + 1), 1]));
    const off = [target.x - c.x, Math.max(target.y - c.y, -b.min.y + 0.5 || 0), target.z - c.z].map(v => round(v));
    return addClones(cloneInstances(clip.instances, off, clip.animations || []));
  };

  // ---------- Models (groups) ----------
  ed.group = (ids, name = 'Model') => {
    const list = asList(ids); if (!list.length) return null;
    ed.checkpoint();
    const parents = new Set(list.map(id => instById(id).parent || null));
    const g = makeInstance('group', { name: uniqueName(name) });
    g.parent = parents.size === 1 ? [...parents][0] : null;
    // never parent a Model into one of its own members
    if (g.parent && list.includes(g.parent)) g.parent = null;
    for (const id of list) instById(id).parent = g.id;
    const first = Math.min(...list.map(id => doc.instances.findIndex(i => i.id === id)));
    doc.instances.splice(first, 0, g); world.add(g);
    updateGroupCenters(); ed.selection = [g.id]; attach(); changed(); return g.id;
  };
  ed.ungroup = (ids) => {
    const groups = asList(ids).map(instById).filter(isGroup); if (!groups.length) return [];
    ed.checkpoint();
    const freed = [];
    for (const g of groups) { for (const c of childrenOf(g.id)) { c.parent = g.parent || null; freed.push(c.id); } doc.instances = doc.instances.filter(i => i !== g); world.remove(g.id); }
    ed.selection = freed.filter(instById); attach(); changed(); return freed;
  };

  // ---------- properties ----------
  function applyProp(inst, key, value) {
    if (['pos', 'rot', 'size'].includes(key)) value = value.map(v => (isFinite(+v) ? +v : 0));
    if (key === 'size') value = value.map(v => Math.max(0.05, v));
    if (isGroup(inst) && key === 'pos') { // moving a Model moves everything inside it
      const d = value.map((v, i) => v - inst.pos[i]);
      for (const c of descendants(inst.id)) { c.pos = c.pos.map((v, i) => round(v + d[i])); world.rebuild(c); }
    }
    if (isGroup(inst) && (key === 'rot' || key === 'size')) return;
    inst[key] = value;
    if (key === 'material' && value === 'lava') inst.kill = true;
    world.rebuild(inst);
  }
  ed.setProp = (id, key, value) => { const inst = instById(id); if (!inst) return; ed.checkpoint(); applyProp(inst, key, value); updateGroupCenters(); attach(); changed(); };
  /** multi-edit: set one property on many instances (one undo step). For vectors pass comp to change only x/y/z. */
  ed.setPropMany = (ids, key, value, comp = null) => {
    const list = asList(ids).map(instById); if (!list.length) return;
    ed.checkpoint();
    for (const inst of list) {
      if (comp != null) { if (!Array.isArray(inst[key])) continue; const v = [...inst[key]]; v[comp] = +value; applyProp(inst, key, v); }
      else if (key === 'name' && list.length > 1) applyProp(inst, key, uniqueName(value));
      else applyProp(inst, key, Array.isArray(value) ? [...value] : value);
    }
    updateGroupCenters(); attach(); changed();
  };
  ed.focus = (id) => {
    const ids = id ? [id] : moveSet(); const b = boundsOf(ids.flatMap(x => (isGroup(instById(x)) ? descendants(x).map(d => d.id) : [x]))); if (b.isEmpty()) return;
    const c = b.getCenter(new THREE.Vector3()); const r = Math.max(4, b.getSize(new THREE.Vector3()).length()); cam.pos.copy(c).addScaledVector(cam.forward(), -r * 1.4);
  };

  // ---------- scripts (plain words) ----------
  const tctx = () => ({ names: doc.instances.map(i => i.name).filter(Boolean) });
  ed.translate = (text) => translate(text, tctx());
  ed.addScript = (id, text = '') => { const inst = instById(id); if (!inst) return null; ed.checkpoint(); const s = { id: newId('s'), name: 'Script', text, program: translate(text, tctx()).program, enabled: true }; (inst.scripts ||= []).push(s); changed(); return s.id; };
  ed.updateScript = (id, sid, text) => { const s = instById(id)?.scripts?.find(x => x.id === sid); if (!s) return null; ed.checkpoint(); const r = translate(text, tctx()); s.text = text; s.program = r.program; changed('script'); return r; };
  ed.removeScript = (id, sid) => { const inst = instById(id); if (!inst) return; ed.checkpoint(); inst.scripts = inst.scripts.filter(s => s.id !== sid); changed(); };

  // ---------- animator ----------
  ed.rigs = () => doc.instances.filter(i => world.entries.get(i.id)?.rig);
  ed.currentAnim = () => (doc.animations || []).find(a => a.id === ed.animator.animId);
  ed.openAnimator = (open = true) => {
    const A = ed.animator; A.open = open; A.playing = false;
    if (open) { if (!A.rigId || !world.entries.get(A.rigId)?.rig) { const sel = world.entries.get(ed.selectedId); A.rigId = sel?.rig ? ed.selectedId : ed.rigs()[0]?.id || null; } ed.selectRig(A.rigId); }
    else { for (const e of world.entries.values()) if (e.rig) { e.rig.stopClips?.(); e.rig.resetPose(); } A.bone = null; attach(); }
    changed('anim');
  };
  ed.selectRig = (id) => {
    const A = ed.animator; A.rigId = id; A.bone = null; A.clip = null;
    const anims = (doc.animations || []).filter(a => a.rigId === id); A.animId = anims[0]?.id || null; A.time = 0;
    ed.poseAt(0); attach(); changed('anim');
  };
  ed.newAnimation = (name = 'Animation', preset = null) => {
    const A = ed.animator; if (!A.rigId) return null; ed.checkpoint();
    const a = preset === 'wave' ? waveAnimation(A.rigId) : { id: newId('a'), name, rigId: A.rigId, length: 2, loop: true, tracks: {} };
    a.name = name; (doc.animations ||= []).push(a); A.animId = a.id; A.time = 0; ed.poseAt(0); changed('anim'); return a.id;
  };
  ed.setAnimProp = (key, value) => { const a = ed.currentAnim(); if (!a) return; ed.checkpoint(); a[key] = value; changed('anim'); };
  ed.deleteAnimation = () => { const a = ed.currentAnim(); if (!a) return; ed.checkpoint(); doc.animations = doc.animations.filter(x => x !== a); ed.animator.animId = null; changed('anim'); };
  ed.poseAt = (t) => { const A = ed.animator; A.time = Math.max(0, t); const e = world.entries.get(A.rigId); if (!e?.rig) return; e.rig.resetPose(); const a = ed.currentAnim(); if (a) sampleAnimation({ ...a, loop: false }, e.rig, A.time); };
  ed.selectBone = (name) => { ed.animator.bone = name; attach(); changed('anim'); };
  ed.boneRotation = () => { const b = world.entries.get(ed.animator.rigId)?.rig?.bones.get(ed.animator.bone); return b ? boneRot(b) : [0, 0, 0]; };
  ed.setBoneRotation = (deg) => { const b = world.entries.get(ed.animator.rigId)?.rig?.bones.get(ed.animator.bone); if (!b) return; b.rotation.set(D2R(deg[0]), D2R(deg[1]), D2R(deg[2])); };
  ed.keyBone = () => { const a = ed.currentAnim(), b = world.entries.get(ed.animator.rigId)?.rig?.bones.get(ed.animator.bone); if (!a || !b) return false; ed.checkpoint(); setKey(a, ed.animator.bone, ed.animator.time, b); changed('anim'); return true; };
  ed.unkeyBone = () => { const a = ed.currentAnim(); if (!a) return; ed.checkpoint(); deleteKey(a, ed.animator.bone, ed.animator.time); ed.poseAt(ed.animator.time); changed('anim'); };
  ed.togglePlay = () => { ed.animator.playing = !ed.animator.playing; changed('anim'); };
  ed.playClip = (name) => { const r = world.entries.get(ed.animator.rigId)?.rig; if (!r) return; ed.animator.clip = name; if (name) r.playClip(name, true); else r.stopClips(); changed('anim'); };


  // ---------- doc ----------
  ed.serialize = () => { st.cam = cam.state(); return JSON.parse(JSON.stringify({ ...doc, updatedAt: Date.now() })); };
  ed.saveCamera = () => { st.cam = cam.state(); };

  let boxTimer = 0;
  ed.update = (dt) => {
    world.update(dt, cam.pos.clone().addScaledVector(cam.forward(), 20));
    const A = ed.animator;
    if (A.open && A.playing) { const a = ed.currentAnim(); if (a) { A.time += dt; if (A.time > a.length) A.time = a.loop ? 0 : a.length; ed.poseAt(A.time); bus.emit('studio:changed', 'animtime'); } }
    if (A.open) for (const e of world.entries.values()) e.rig?.mixer?.update(dt);
    if (!tc.dragging && boxes.children.length && (boxTimer += dt) > 0.25) { boxTimer = 0; drawBoxes(); }
  };
  ed.dispose = () => { st.cam = cam.state(); marquee.remove(); tc.detach(); tc.disconnect(); tc.getHelper().traverse(c => { c.geometry?.dispose(); c.material?.dispose?.(); }); }; // r169 tc.dispose() calls this.traverse (bug)
  return ed;
}
