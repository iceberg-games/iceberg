// Studio editor game instance: free-fly camera, selection, move/rotate/scale
// gizmos, insert/delete/duplicate, properties, scripts, undo/redo, animator.
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
  const selBox = new THREE.BoxHelper(undefined, '#33b5ff'); selBox.visible = false; scene.add(selBox);

  const ed = {
    scene, collision: null, hideAvatar: true, editing: true, cameraController: cam, doc, world, music: doc.music || 'none',
    selectedId: null, tool: 'move', snap: { move: 1, rot: 15 }, space: 'world',
    tc,
    animator: { open: false, rigId: null, animId: null, time: 0, bone: null, playing: false, clip: null },
  };
  const changed = (what = 'doc') => bus.emit('studio:changed', what);
  const instById = (id) => doc.instances.find(i => i.id === id);
  const snapshot = () => JSON.stringify({ instances: doc.instances, animations: doc.animations });
  ed.checkpoint = () => { st.undo.push(snapshot()); if (st.undo.length > 150) st.undo.shift(); st.redo = []; doc.updatedAt = Date.now(); };
  const restore = (s) => { const o = JSON.parse(s); doc.instances = o.instances; doc.animations = o.animations || []; world.rebuildAll(doc.instances); if (!instById(ed.selectedId)) ed.selectedId = null; attach(); changed(); };
  ed.undo = () => { if (!st.undo.length) return false; st.redo.push(snapshot()); restore(st.undo.pop()); return true; };
  ed.redo = () => { if (!st.redo.length) return false; st.undo.push(snapshot()); restore(st.redo.pop()); return true; };
  ed.canUndo = () => st.undo.length > 0; ed.canRedo = () => st.redo.length > 0;

  // ---------- selection & gizmo ----------
  function attach() {
    tc.detach();
    if (ed.animator.open && ed.animator.bone) {
      const rig = world.entries.get(ed.animator.rigId)?.rig; const b = rig?.bones.get(ed.animator.bone);
      if (b) { tc.setMode('rotate'); tc.setSpace('local'); tc.attach(b); }
      selBox.visible = false; return;
    }
    const e = world.entries.get(ed.selectedId);
    if (!e) { selBox.visible = false; return; }
    selBox.setFromObject(e.root); selBox.visible = true;
    if (ed.tool === 'select') return;
    tc.setMode({ move: 'translate', rotate: 'rotate', scale: 'scale' }[ed.tool]);
    tc.setSpace(ed.tool === 'move' ? ed.space : 'local');
    tc.setTranslationSnap(ed.snap.move || null); tc.setRotationSnap(ed.snap.rot ? D2R(ed.snap.rot) : null); tc.setScaleSnap(ed.snap.move ? 0.25 : null);
    tc.attach(e.root);
  }
  ed.select = (id) => { ed.selectedId = id && instById(id) ? id : null; attach(); changed('selection'); };
  ed.setTool = (t) => { ed.tool = t; attach(); changed('tool'); };
  ed.setSnap = (k, v) => { ed.snap[k] = v; attach(); changed('tool'); };
  ed.toggleSpace = () => { ed.space = ed.space === 'world' ? 'local' : 'world'; attach(); changed('tool'); };

  let dragStart = null;
  tc.addEventListener('dragging-changed', (ev) => {
    if (ev.value) { dragStart = snapshot(); return; }
    // drag ended → commit
    if (ed.animator.open && ed.animator.bone) { const a = ed.currentAnim(); if (a) { st.undo.push(dragStart); st.redo = []; setKey(a, ed.animator.bone, ed.animator.time, tc.object); changed('anim'); } return; }
    const inst = instById(ed.selectedId), e = world.entries.get(ed.selectedId); if (!inst || !e) return;
    st.undo.push(dragStart); st.redo = []; doc.updatedAt = Date.now();
    const r = e.root;
    inst.pos = r.position.toArray().map(v => round(v));
    inst.rot = [r.rotation.x, r.rotation.y, r.rotation.z].map(v => round(R2D(v), 2));
    if (Math.abs(r.scale.x - 1) + Math.abs(r.scale.y - 1) + Math.abs(r.scale.z - 1) > 1e-4) inst.size = inst.size.map((s, i) => round(Math.max(0.05, Math.abs(s * r.scale.getComponent(i)))));
    world.rebuild(inst); attach(); changed();
  });
  tc.addEventListener('objectChange', () => { if (!ed.animator.open) selBox.setFromObject(tc.object); else bus.emit('studio:changed', 'bonepose'); });

  let downAxis = null;
  ed.onPointerDown = () => { downAxis = tc.axis; };
  ed.onClick = ({ ray, button }) => {
    if (button !== 0 || downAxis || tc.dragging) return;
    const hit = ray.intersectObjects(world.pickables(), false).find(h => h.object.visible);
    const id = hit ? world.idFromObject(hit.object) : null;
    if (ed.animator.open) { if (id && world.entries.get(id)?.rig) ed.selectRig(id); return; }
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
  ed.insert = (type, over = {}) => {
    ed.checkpoint();
    if (type === 'spawn') { const ex = doc.instances.find(i => i.type === 'spawn'); if (ex) { ex.pos = placementPoint(ex.size); world.rebuild(ex); ed.select(ex.id); changed(); return ex.id; } }
    const inst = makeInstance(type, over);
    if (type === 'checkpoint' && !over.order) inst.order = doc.instances.filter(i => i.type === 'checkpoint').length + 1;
    if (!over.pos) inst.pos = placementPoint(inst.size);
    if (type === 'rig' && !over.pos) inst.pos[1] -= inst.size[1] / 2;
    if (type === 'model' && !over.pos) inst.pos[1] -= inst.size[1] / 2;
    let n = 1; const base = inst.name; while (doc.instances.some(i => i.name === inst.name)) inst.name = `${base}${++n}`;
    doc.instances.push(inst); world.add(inst); ed.select(inst.id);
    if (ed.tool === 'select') ed.setTool('move');
    changed(); return inst.id;
  };
  ed.remove = (id = ed.selectedId) => { if (!instById(id)) return; ed.checkpoint(); doc.instances = doc.instances.filter(i => i.id !== id); doc.animations = (doc.animations || []).filter(a => a.rigId !== id); world.remove(id); if (ed.selectedId === id) ed.select(null); changed(); };
  ed.duplicate = (id = ed.selectedId) => {
    const src = instById(id); if (!src) return null; ed.checkpoint();
    const c = JSON.parse(JSON.stringify(src)); c.id = newId(); c.pos = [c.pos[0] + (ed.snap.move || 1) * 2, c.pos[1], c.pos[2]];
    c.scripts = (c.scripts || []).map(s => ({ ...s, id: newId('s') }));
    let n = 1; const base = src.name.replace(/\d+$/, ''); while (doc.instances.some(i => i.name === c.name)) c.name = `${base}${++n}`;
    doc.instances.push(c); world.add(c); ed.select(c.id); changed(); return c.id;
  };
  ed.setProp = (id, key, value) => {
    const inst = instById(id); if (!inst) return; ed.checkpoint();
    if (['pos', 'rot', 'size'].includes(key)) value = value.map(v => (isFinite(+v) ? +v : 0));
    if (key === 'size') value = value.map(v => Math.max(0.05, v));
    inst[key] = value;
    if (key === 'material' && value === 'lava') inst.kill = true;
    world.rebuild(inst); attach(); changed();
  };
  ed.focus = (id = ed.selectedId) => { const e = world.entries.get(id); if (!e) return; const b = new THREE.Box3().setFromObject(e.root); const c = b.getCenter(new THREE.Vector3()); const r = Math.max(4, b.getSize(new THREE.Vector3()).length()); cam.pos.copy(c).addScaledVector(cam.forward(), -r * 1.4); };

  // ---------- scripts (plain words) ----------
  ed.addScript = (id, text = '') => { const inst = instById(id); if (!inst) return null; ed.checkpoint(); const s = { id: newId('s'), name: 'Script', text, program: translate(text).program, enabled: true }; (inst.scripts ||= []).push(s); changed(); return s.id; };
  ed.updateScript = (id, sid, text) => { const s = instById(id)?.scripts?.find(x => x.id === sid); if (!s) return null; ed.checkpoint(); const r = translate(text); s.text = text; s.program = r.program; changed('script'); return r; };
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

  ed.update = (dt) => {
    world.update(dt, cam.pos.clone().addScaledVector(cam.forward(), 20));
    const A = ed.animator;
    if (A.open && A.playing) { const a = ed.currentAnim(); if (a) { A.time += dt; if (A.time > a.length) A.time = a.loop ? 0 : a.length; ed.poseAt(A.time); bus.emit('studio:changed', 'animtime'); } }
    if (A.open) for (const e of world.entries.values()) e.rig?.mixer?.update(dt);
    if (selBox.visible && !tc.dragging) { const e = world.entries.get(ed.selectedId); if (e) selBox.setFromObject(e.root); }
  };
  ed.dispose = () => { st.cam = cam.state(); tc.detach(); tc.disconnect(); tc.getHelper().traverse(c => { c.geometry?.dispose(); c.material?.dispose?.(); }); }; // r169 tc.dispose() calls this.traverse (bug)
  return ed;
}
