// User-uploaded 3D models (.glb / .gltf / .obj), persisted in IndexedDB.
// Remote/published models are fetched by hash+URL (see modelAssets.js) and cached.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { bus } from '../core/events.js';
import { CONFIG } from '../net/config.js';
import { MAX_MODEL_BYTES, fetchModelAsset, parseModelRef } from './modelAssets.js';
import { convertObjToGlb } from './objToGlb.js';

export { MAX_MODEL_BYTES };

function normalize(obj, targetSize = 2) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = targetSize / Math.max(size.x, size.y, size.z, 1e-6);
  obj.scale.multiplyScalar(s);
  const box2 = new THREE.Box3().setFromObject(obj);
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box2.min.y;
  const wrap = new THREE.Group(); wrap.add(obj);
  wrap.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return wrap;
}

export class ModelLibrary {
  constructor(store, { assetCache = null } = {}) { this.store = store; this.assetCache = assetCache; this.items = new Map(); this.pending = new Map(); }

  async init() {
    try {
      const recs = await this.store.getAll();
      for (const r of recs || []) { try { await this._register(r); } catch (e) { console.warn('Model failed to load', r.name, e); } }
    } catch (e) { console.warn('IndexedDB unavailable', e); }
  }

  async parse(record) {
    if (record.format === 'obj') {
      const text = typeof record.data === 'string' ? record.data : new TextDecoder().decode(record.data);
      return normalize(new OBJLoader().parse(text));
    }
    const loader = new GLTFLoader();
    const gltf = await new Promise((res, rej) => loader.parse(record.data, '', res, rej));
    const wrap = normalize(gltf.scene);
    let bones = 0; wrap.traverse(o => { if (o.isBone) bones++; });
    wrap.userData.clips = gltf.animations || [];
    wrap.userData.isRig = bones > 0;
    return wrap;
  }

  async _register(record) {
    const template = await this.parse(record);
    this.items.set(record.id, { record, template });
    record.isRig = !!template.userData.isRig;
    record.clipNames = (template.userData.clips || []).map(c => c.name);
    return record;
  }

  /** Accepts a File from an <input type=file>. Returns the stored record.
   *  .obj files are converted to .glb when possible so other players can fetch them. */
  async addFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['glb', 'gltf', 'obj'].includes(ext)) throw new Error('Use a .glb, .gltf or .obj file');
    if (file.size > MAX_MODEL_BYTES) throw new Error('File is larger than 25 MB');
    const data = ext === 'glb' ? await file.arrayBuffer() : await file.text();
    const rec = { id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: file.name.replace(/\.[^.]+$/, ''), format: ext, data, createdAt: Date.now() };
    if (ext === 'obj') {
      try {
        rec.data = await convertObjToGlb(data);
        rec.format = 'glb';
        rec.convertedFrom = 'obj';
      } catch (e) {
        rec.unshareable = true;
        rec.unshareableReason = e.message || 'Could not convert this .obj';
      }
    }
    return this.addRecord(rec);
  }
  /** Return a glTF/GLB record for publishing; convert a stored .obj in place when possible. */
  async toShareable(id) {
    const rec = this.info(id); if (!rec) return null;
    if (rec.format === 'glb' || rec.format === 'gltf') return rec;
    if (rec.format !== 'obj') { rec.unshareable = true; return rec; }
    try {
      const data = await convertObjToGlb(rec.data);
      const next = { ...rec, format: 'glb', data, convertedFrom: 'obj' };
      delete next.unshareable; delete next.unshareableReason;
      await this._register(next);
      try { await this.store.put(next); } catch { /* still shareable this session */ }
      bus.emit('models:changed');
      return next;
    } catch (e) {
      rec.unshareable = true;
      rec.unshareableReason = e.message || 'Could not convert this .obj';
      return rec;
    }
  }
  async addRecord(record) {
    await this._register(record); // throws if the file can't be parsed
    try { await this.store.put(record); } catch (e) { console.warn('Could not persist model', e); }
    bus.emit('models:changed');
    return record;
  }
  async remove(id) {
    this.items.delete(id);
    try { await this.store.delete(id); } catch {}
    bus.emit('models:changed');
  }
  has(id) { return this.items.has(id); }
  isLoading(id) { return this.pending.has(id); }
  /** Local uploads only (excludes models fetched for someone else's game or wear). */
  list() { return [...this.items.values()].map(i => i.record).filter(r => !r.remote); }
  listAll() { return [...this.items.values()].map(i => i.record); }

  /**
   * Fetch, validate, cache and register a published model ref so instance(id) works for everyone.
   * Safe to call repeatedly; in-flight requests are shared.
   */
  async ensureAsset(ref, { cache, fetchImpl, supabaseUrl } = {}) {
    const parsed = parseModelRef({ ...ref, _supabaseUrl: supabaseUrl || CONFIG.supabaseUrl });
    if (!parsed.ok) return parsed;
    const { id } = parsed.ref;
    if (this.has(id)) return { ok: true, id, cached: true };
    if (this.pending.has(id)) return this.pending.get(id);
    const work = this._loadRemote(parsed.ref, { cache, fetchImpl, supabaseUrl }).finally(() => this.pending.delete(id));
    this.pending.set(id, work);
    return work;
  }
  async _loadRemote(ref, { cache, fetchImpl, supabaseUrl } = {}) {
    const result = await fetchModelAsset(ref, {
      cache: cache || this.assetCache,
      fetchImpl,
      supabaseUrl: supabaseUrl || CONFIG.supabaseUrl,
    });
    if (!result.ok) {
      bus.emit('models:failed', { id: ref.id, reason: result.reason });
      return result;
    }
    const record = { id: ref.id, name: ref.name || ref.id, format: ref.format, data: result.data, createdAt: Date.now(), remote: true, hash: ref.hash, url: ref.url };
    try { await this._register(record); }
    catch (e) {
      bus.emit('models:failed', { id: ref.id, reason: 'parse_failed' });
      return { ok: false, reason: 'parse_failed', message: e.message };
    }
    bus.emit('models:changed');
    bus.emit('models:ready', { id: ref.id, hash: ref.hash });
    return { ok: true, id: ref.id, cached: !!result.cached };
  }
  async ensureAssets(refs, opts = {}) {
    const list = Array.isArray(refs) ? refs : [];
    return Promise.all(list.map((r) => this.ensureAsset(r, opts)));
  }
  /** Clone of a model (SkeletonUtils keeps skinned meshes bound to their own bones). */
  instance(id) {
    const it = this.items.get(id); if (!it) return null;
    const c = it.template.userData.isRig ? skeletonClone(it.template) : it.template.clone(true);
    c.userData.clips = it.template.userData.clips; c.userData.isRig = it.template.userData.isRig;
    return c;
  }
  info(id) { return this.items.get(id)?.record || null; }
}

/** Places model instances in a game scene with simple box colliders. */
export class ModelPlacer {
  constructor(scene, library, collision, { placements = [], onChange = () => {} } = {}) {
    this.scene = scene; this.library = library; this.collision = collision; this.onChange = onChange;
    this.items = []; this.pending = null;
    for (const p of placements) this._add(p);
  }
  _add(p) {
    const obj = this.library.instance(p.modelId);
    if (!obj) return null;
    const holder = new THREE.Group(); holder.add(obj);
    holder.position.set(p.x, p.y, p.z); holder.rotation.y = p.rotY || 0; holder.scale.setScalar(p.scale || 1);
    holder.userData.placement = p;
    this.scene.add(holder);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    const collider = this.collision ? this.collision.addBox3(box) : null;
    const item = { p, holder, collider };
    holder.traverse(o => { o.userData.modelItem = item; });
    this.items.push(item);
    return item;
  }
  place(modelId, point, scale = 1) {
    const p = { modelId, x: +point.x.toFixed(2), y: +point.y.toFixed(2), z: +point.z.toFixed(2), rotY: 0, scale };
    const it = this._add(p); if (it) this.onChange();
    return it;
  }
  removeItem(item) {
    this.scene.remove(item.holder);
    if (item.collider) this.collision.removeBox(item.collider);
    this.items.splice(this.items.indexOf(item), 1);
    this.onChange();
  }
  meshes() { const out = []; for (const it of this.items) it.holder.traverse(o => { if (o.isMesh) out.push(o); }); return out; }
  serialize() { return this.items.map(i => i.p); }
  dispose() { for (const it of this.items) this.scene.remove(it.holder); }
}
