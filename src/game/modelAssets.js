// Shared custom-model references: content hash + published Storage URL.
// Used by published Studio games and by multiplayer wear sync.
// Remote clients may only fetch glTF/GLB from an allow-listed Storage URL.

export const MAX_MODEL_BYTES = 25 * 1024 * 1024;
export const GAME_MODELS_BUCKET = 'game-models';
export const HASH_RE = /^[0-9a-f]{64}$/;
export const UID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const FORMAT_RE = /^(glb|gltf)$/;
export const WEAR_BONES = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
const PATH_RE = new RegExp(
  `^/storage/v1/object/public/${GAME_MODELS_BUCKET}/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/([0-9a-f]{64})\\.(glb|gltf)$`,
);

export function toArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  if (typeof data === 'string') return new TextEncoder().encode(data).buffer;
  throw new Error('unsupported_data');
}

export function bytesOf(data) {
  if (typeof data === 'string') return new TextEncoder().encode(data).byteLength;
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  return 0;
}

function hexOf(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256hex(data) {
  const buf = toArrayBuffer(data);
  const subtle = globalThis.crypto?.subtle;
  if (subtle) return hexOf(await subtle.digest('SHA-256', buf));
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(Buffer.from(buf)).digest('hex');
}

const GLB_MAGIC = 0x46546c67; // 'glTF'

export function gltfKind(data) {
  const buf = toArrayBuffer(data);
  const u8 = new Uint8Array(buf);
  if (u8.byteLength >= 12) {
    const view = new DataView(buf);
    if (view.getUint32(0, true) === GLB_MAGIC) return 'glb';
  }
  const head = new TextDecoder().decode(u8.subarray(0, Math.min(u8.byteLength, 64))).trimStart();
  if (head.startsWith('{')) return 'gltf';
  return null;
}

function glbJsonChunk(buf) {
  if (buf.byteLength < 20) return null;
  const view = new DataView(buf);
  if (view.getUint32(0, true) !== GLB_MAGIC) return null;
  const jsonLen = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  if (jsonType !== 0x4e4f534a) return null; // 'JSON'
  if (20 + jsonLen > buf.byteLength) return null;
  return new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen));
}

/** Reject glTF documents that point at external files (only data: or relative-buffer-less is ok). */
export function hasExternalUris(data, format) {
  let json = '';
  try {
    if (format === 'glb') json = glbJsonChunk(toArrayBuffer(data)) || '';
    else json = typeof data === 'string' ? data : new TextDecoder().decode(toArrayBuffer(data));
  } catch { return true; }
  if (!json) return format === 'glb';
  const re = /"uri"\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(json))) {
    const uri = m[1];
    if (uri.startsWith('data:')) continue;
    if (uri.startsWith('#')) continue;
    return true;
  }
  return false;
}

export function validateModelBytes(data, { format, hash, maxBytes = MAX_MODEL_BYTES } = {}) {
  const bytes = bytesOf(data);
  if (!bytes) return { ok: false, reason: 'empty' };
  if (bytes > maxBytes) return { ok: false, reason: 'too_large', bytes };
  const kind = gltfKind(data);
  if (!kind) return { ok: false, reason: 'not_gltf', bytes };
  if (format && format !== kind) return { ok: false, reason: 'format_mismatch', format: kind, bytes };
  if (hasExternalUris(data, kind)) return { ok: false, reason: 'external_uri', format: kind, bytes };
  if (hash) {
    return sha256hex(data).then((got) => (got === hash
      ? { ok: true, format: kind, bytes, hash: got }
      : { ok: false, reason: 'hash_mismatch', format: kind, bytes, hash: got }));
  }
  return { ok: true, format: kind, bytes };
}

export function publicObjectPath(userId, hash, format) {
  if (!UID_RE.test(userId) || !HASH_RE.test(hash) || !FORMAT_RE.test(format)) return null;
  return `${userId}/${hash}.${format}`;
}

export function publicObjectUrl(baseUrl, userId, hash, format) {
  const path = publicObjectPath(userId, hash, format);
  if (!path || !baseUrl) return null;
  return `${String(baseUrl).replace(/\/+$/, '')}/storage/v1/object/public/${GAME_MODELS_BUCKET}/${path}`;
}

export function allowedModelUrl(url, { supabaseUrl } = {}) {
  if (typeof url !== 'string' || url.length > 500) return false;
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const m = PATH_RE.exec(u.pathname);
  if (!m) return false;
  const host = u.hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  if (local) return u.protocol === 'http:' || u.protocol === 'https:';
  if (supabaseUrl) {
    try {
      const s = new URL(supabaseUrl);
      return u.protocol === s.protocol && u.host === s.host;
    } catch { return false; }
  }
  return /^[a-z0-9-]+\.supabase\.co$/.test(host) && u.protocol === 'https:';
}

function num(v, lo, hi) {
  return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
}

export function parseModelRef(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'bad_ref' };
  const id = typeof raw.id === 'string' && raw.id.length <= 80 ? raw.id : null;
  const format = typeof raw.format === 'string' ? raw.format.toLowerCase() : '';
  const hash = typeof raw.hash === 'string' ? raw.hash.toLowerCase() : '';
  const url = raw.url;
  const bytes = raw.bytes;
  const name = typeof raw.name === 'string' ? raw.name.slice(0, 80) : '';
  if (!id) return { ok: false, reason: 'bad_id' };
  if (!FORMAT_RE.test(format)) return { ok: false, reason: 'bad_format' };
  if (!HASH_RE.test(hash)) return { ok: false, reason: 'bad_hash' };
  if (!Number.isInteger(bytes) || bytes < 1 || bytes > MAX_MODEL_BYTES) return { ok: false, reason: 'bad_bytes' };
  if (!allowedModelUrl(url, { supabaseUrl: raw._supabaseUrl })) return { ok: false, reason: 'bad_url' };
  return { ok: true, ref: { id, name, format, hash, bytes, url } };
}

export function parseWearRef(raw, { supabaseUrl } = {}) {
  const base = parseModelRef({ ...raw, _supabaseUrl: supabaseUrl });
  if (!base.ok) return base;
  const bone = WEAR_BONES.includes(raw.bone) ? raw.bone : 'head';
  const scale = num(raw.scale, 0.01, 20) ? raw.scale : 0.5;
  const x = num(raw.x, -20, 20) ? raw.x : 0;
  const y = num(raw.y, -20, 20) ? raw.y : 0;
  const z = num(raw.z, -20, 20) ? raw.z : 0;
  const rotY = num(raw.rotY, -8, 8) ? raw.rotY : 0;
  return { ok: true, ref: { ...base.ref, bone, scale, x, y, z, rotY } };
}

export function collectModelIds(doc) {
  const ids = new Set();
  for (const m of [...(doc?.models || []), ...(doc?.instances || [])]) {
    if (m && typeof m.modelId === 'string' && m.modelId) ids.add(m.modelId);
  }
  for (const a of doc?.modelAssets || []) if (a?.id) ids.add(a.id);
  return [...ids];
}

/** Build doc.modelAssets by hashing local library records and uploading glTF files. .obj is skipped. */
export async function attachModelAssets(doc, library, { upload, supabaseUrl } = {}) {
  const ids = collectModelIds(doc);
  const assets = [];
  const skipped = [];
  for (const id of ids) {
    const rec = library?.info?.(id) || library?.items?.get?.(id)?.record;
    if (!rec) { skipped.push({ id, reason: 'missing' }); continue; }
    const format = String(rec.format || '').toLowerCase();
    if (!FORMAT_RE.test(format)) { skipped.push({ id, reason: 'not_gltf', format }); continue; }
    const data = rec.data;
    const check = await Promise.resolve(validateModelBytes(data, { format }));
    if (!check.ok) { skipped.push({ id, reason: check.reason }); continue; }
    const hash = await sha256hex(data);
    if (typeof upload !== 'function') { skipped.push({ id, reason: 'no_uploader' }); continue; }
    let published;
    try { published = await upload({ id, name: rec.name, format: check.format, hash, bytes: check.bytes, data }); }
    catch (e) { skipped.push({ id, reason: e.message || 'upload_failed' }); continue; }
    const url = published?.url || publicObjectUrl(supabaseUrl, published?.userId, hash, check.format);
    const ref = parseModelRef({ id, name: rec.name || id, format: check.format, hash, bytes: check.bytes, url, _supabaseUrl: supabaseUrl });
    if (!ref.ok) { skipped.push({ id, reason: ref.reason }); continue; }
    assets.push(ref.ref);
  }
  const next = { ...doc, modelAssets: assets };
  return { doc: next, assets, skipped, complete: skipped.length === 0 && assets.length === ids.length };
}

export async function fetchModelAsset(ref, { fetchImpl = globalThis.fetch, cache, supabaseUrl, signal } = {}) {
  const parsed = parseModelRef({ ...ref, _supabaseUrl: supabaseUrl });
  if (!parsed.ok) return parsed;
  const { hash, url, format, bytes } = parsed.ref;
  if (cache?.get) {
    try {
      const hit = await cache.get(hash);
      if (hit?.data) {
        const ok = await Promise.resolve(validateModelBytes(hit.data, { format, hash }));
        if (ok.ok) return { ok: true, ref: parsed.ref, data: hit.data, cached: true };
      }
    } catch { /* cache miss */ }
  }
  let res;
  try { res = await fetchImpl(url, { signal, redirect: 'error' }); }
  catch (e) { return { ok: false, reason: 'fetch_failed', message: e.message }; }
  if (!res.ok) return { ok: false, reason: 'http_' + res.status };
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_MODEL_BYTES) return { ok: false, reason: 'too_large' };
  const data = await res.arrayBuffer();
  const ok = await Promise.resolve(validateModelBytes(data, { format, hash }));
  if (!ok.ok) return ok;
  if (cache?.put) { try { await cache.put({ hash, format, data, url, cachedAt: Date.now() }); } catch { /* */ } }
  return { ok: true, ref: parsed.ref, data, cached: false };
}

/** Minimal valid triangle GLB for tests and screenshots. */
export function makeMinimalGlb() {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const indices = new Uint16Array([0, 1, 2]);
  const bin = new Uint8Array(44);
  new Uint8Array(bin.buffer, 0, 36).set(new Uint8Array(positions.buffer));
  new Uint8Array(bin.buffer, 36, 6).set(new Uint8Array(indices.buffer));
  const json = JSON.stringify({
    asset: { version: '2.0', generator: 'iceberg-test' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', max: [1, 1, 0], min: [0, 0, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    buffers: [{ byteLength: 44 }],
  });
  const jsonBytes = new TextEncoder().encode(json);
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const jsonChunkLen = jsonBytes.length + jsonPad;
  const binChunkLen = bin.length + binPad;
  const total = 12 + 8 + jsonChunkLen + 8 + binChunkLen;
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  const u8 = new Uint8Array(out);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunkLen, true);
  view.setUint32(16, 0x4e4f534a, true);
  u8.set(jsonBytes, 20);
  for (let i = 0; i < jsonPad; i++) u8[20 + jsonBytes.length + i] = 0x20;
  const binOff = 20 + jsonChunkLen;
  view.setUint32(binOff, binChunkLen, true);
  view.setUint32(binOff + 4, 0x004e4942, true); // 'BIN\0'
  u8.set(bin, binOff + 8);
  return out;
}
