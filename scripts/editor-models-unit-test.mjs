// Unit tests for shared model refs (hash, validate, allow-list, attach, fetch).
// Run: node scripts/editor-models-unit-test.mjs
import http from 'node:http';
import { sha256hex, gltfKind, validateModelBytes, parseModelRef, parseWearRef,
  allowedModelUrl, publicObjectUrl, attachModelAssets, fetchModelAsset,
  makeMinimalGlb, collectModelIds, MAX_MODEL_BYTES, hasExternalUris } from '../src/game/modelAssets.js';

const uid = '11111111-1111-4111-8111-111111111111';
let fail = 0, pass = 0;
async function t(name, fn) {
  try { await fn(); pass++; }
  catch (e) { fail++; console.log('FAIL:', name, e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert'); }

const glb = makeMinimalGlb();
const hash = await sha256hex(glb);

await t('minimal GLB is valid glTF', async () => {
  assert(gltfKind(glb) === 'glb', 'kind');
  const v = await Promise.resolve(validateModelBytes(glb, { format: 'glb', hash }));
  assert(v.ok, v.reason);
});

await t('rejects OBJ / non-gltf', async () => {
  const v = await Promise.resolve(validateModelBytes('v 0 0 0\nf 1 1 1', { format: 'obj' }));
  assert(!v.ok && v.reason === 'not_gltf', v.reason);
});

await t('rejects oversized', async () => {
  const v = await Promise.resolve(validateModelBytes(glb, { maxBytes: 10 }));
  assert(!v.ok && v.reason === 'too_large', v.reason);
});

await t('rejects hash mismatch', async () => {
  const v = await Promise.resolve(validateModelBytes(glb, { format: 'glb', hash: '0'.repeat(64) }));
  assert(!v.ok && v.reason === 'hash_mismatch', v.reason);
});

await t('rejects external uris in gltf json', () => {
  const json = JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'https://evil.example/x.bin', byteLength: 4 }] });
  assert(gltfKind(json) === 'gltf');
  assert(hasExternalUris(json, 'gltf') === true);
  const ok = hasExternalUris(JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'data:application/octet-stream;base64,AAAA', byteLength: 3 }] }), 'gltf');
  assert(ok === false, 'data uri should be allowed');
});

await t('URL allow-list: storage path + host', () => {
  const url = publicObjectUrl('https://abc.supabase.co', uid, hash, 'glb');
  assert(allowedModelUrl(url, { supabaseUrl: 'https://abc.supabase.co' }), 'supabase host');
  assert(!allowedModelUrl(url, { supabaseUrl: 'https://other.supabase.co' }), 'wrong project');
  assert(!allowedModelUrl('https://evil.com/storage/v1/object/public/game-models/' + uid + '/' + hash + '.glb'), 'evil host');
  assert(!allowedModelUrl('https://abc.supabase.co/storage/v1/object/public/other/' + uid + '/' + hash + '.glb'), 'wrong bucket');
  const local = publicObjectUrl('http://127.0.0.1:54321', uid, hash, 'glb');
  assert(allowedModelUrl(local), 'localhost ok');
});

await t('parseModelRef / parseWearRef', () => {
  const url = publicObjectUrl('http://127.0.0.1:54321', uid, hash, 'glb');
  const p = parseModelRef({ id: 'm_1', name: 'box', format: 'glb', hash, bytes: glb.byteLength, url, _supabaseUrl: 'http://127.0.0.1:54321' });
  assert(p.ok, p.reason);
  const w = parseWearRef({ ...p.ref, bone: 'head', scale: 0.5, x: 0, y: 0.6, z: 0, rotY: 0 }, { supabaseUrl: 'http://127.0.0.1:54321' });
  assert(w.ok && w.ref.bone === 'head', w.reason);
  assert(!parseModelRef({ id: 'm_1', format: 'obj', hash, bytes: 10, url }).ok, 'obj ref');
});

await t('collectModelIds + attachModelAssets', async () => {
  const doc = { id: 'g_test', name: 'T', instances: [{ id: 'i1', type: 'model', modelId: 'm_1' }] };
  assert(collectModelIds(doc).join() === 'm_1');
  const library = { info: (id) => id === 'm_1' ? { id, name: 'tri', format: 'glb', data: glb } : null };
  const uploaded = [];
  const supabaseUrl = 'http://127.0.0.1:54321';
  const url = publicObjectUrl(supabaseUrl, uid, hash, 'glb');
  const { doc: next, assets, skipped, complete } = await attachModelAssets(doc, library, {
    supabaseUrl,
    upload: async (rec) => { uploaded.push(rec); return { url, userId: uid }; },
  });
  assert(complete && assets.length === 1 && skipped.length === 0, JSON.stringify({ assets, skipped }));
  assert(next.modelAssets[0].hash === hash && next.modelAssets[0].url === url);
  assert(uploaded[0].hash === hash);
});

await t('attach skips obj and missing', async () => {
  const library = {
    info: (id) => id === 'm_obj' ? { id, name: 'mesh', format: 'obj', data: 'v 0 0 0' } : null,
  };
  const { assets, skipped } = await attachModelAssets({ instances: [{ modelId: 'm_obj' }, { modelId: 'm_gone' }] }, library, { upload: async () => ({}) });
  assert(assets.length === 0);
  assert(skipped.some(s => s.reason === 'not_gltf') && skipped.some(s => s.reason === 'missing'));
});

await t('fetch, cache, validate against a local HTTP asset', async () => {
  const supabaseUrl = 'http://127.0.0.1:0'; // port filled after listen
  const store = new Map();
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const key = u.pathname;
    if (req.method === 'GET' && store.has(key)) {
      const buf = store.get(key);
      res.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Content-Length': buf.byteLength });
      return res.end(Buffer.from(buf));
    }
    res.writeHead(404); res.end();
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const url = publicObjectUrl(base, uid, hash, 'glb');
  store.set(new URL(url).pathname, glb);
  const cache = new Map();
  const c = { get: (h) => cache.get(h), put: (r) => cache.set(r.hash, r) };
  const ref = { id: 'm_1', name: 'tri', format: 'glb', hash, bytes: glb.byteLength, url };
  const a = await fetchModelAsset(ref, { cache: c, supabaseUrl: base });
  assert(a.ok && !a.cached && a.data.byteLength === glb.byteLength, a.reason);
  const b = await fetchModelAsset(ref, { cache: c, supabaseUrl: base });
  assert(b.ok && b.cached, 'second fetch should be cached');
  const bad = await fetchModelAsset({ ...ref, hash: 'a'.repeat(64) }, { cache: c, supabaseUrl: base });
  assert(!bad.ok, 'wrong hash must fail');
  server.close();
});

console.log(`${pass}/${pass + fail} editor-models unit tests passed`);
process.exit(fail ? 1 : 0);
