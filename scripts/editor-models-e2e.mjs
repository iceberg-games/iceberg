// Two-client local backend test: publish a game with a hashed model, the other
// client fetches and validates it; wear refs land on the roster after save_loadout.
// Uses the in-process dev server (PGlite + storage stub). No live DB writes.
// Run: node scripts/editor-models-e2e.mjs
import assert from 'node:assert/strict';
import { startDevServer, ANON_KEY } from '../tools/db/dev-server.mjs';
import { SupabaseClient } from '../src/net/supabaseClient.js';
import { SupabaseBackend } from '../src/net/SupabaseBackend.js';
import { makeMinimalGlb, sha256hex, fetchModelAsset, attachModelAssets, publicObjectUrl, parseWearRef } from '../src/game/modelAssets.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

let fail = 0, pass = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('  PASS', name); }
  catch (e) { fail++; console.log('  FAIL', name, e.message); }
}

const dev = await startDevServer({ port: 0, quiet: true });
const port = dev.server.address().port;
const url = `http://127.0.0.1:${port}`;
const glb = makeMinimalGlb();
const hash = await sha256hex(glb);

function client() {
  const c = new SupabaseClient({ url, anonKey: ANON_KEY, storage: mem() });
  return new SupabaseBackend(c);
}

async function signup(backend, username) {
  await backend.client.signUp({
    email: `${username}@users.iceberg.invalid`,
    password: 'testpass1',
    data: { username, display_name: username },
  });
  assert.ok(backend.signedIn, 'signed in');
  return backend;
}

const A = client(), B = client();
await signup(A, 'modeler_a');
await signup(B, 'modeler_b');

await t('A uploads a GLB to game-models under their user id', async () => {
  const rec = await A.uploadGameModel({ hash, format: 'glb', data: glb });
  assert.equal(rec.hash, hash);
  assert.ok(rec.url.includes(`/storage/v1/object/public/game-models/${A.userId}/${hash}.glb`));
  const res = await fetch(rec.url);
  assert.equal(res.status, 200);
  const buf = await res.arrayBuffer();
  assert.equal(buf.byteLength, glb.byteLength);
  assert.equal(await sha256hex(buf), hash);
});

await t('B cannot upload under A’s path (storage stub enforces uid prefix)', async () => {
  const path = `${A.userId}/${hash}.glb`;
  let err = null;
  try { await B.client.uploadObject('game-models', path, glb); } catch (e) { err = e; }
  assert.ok(err, 'expected 403');
  assert.equal(err.status, 403);
});

let pubUrl;
await t('A attaches modelAssets and publishes a Studio game', async () => {
  const library = { info: (id) => id === 'm_tri' ? { id: 'm_tri', name: 'Triangle', format: 'glb', data: glb } : null };
  const doc = { id: 'g_shared_models', name: 'Shared Models', instances: [{ id: 'i1', type: 'model', modelId: 'm_tri', pos: [0, 0, 0], size: [1, 1, 1] }] };
  const attached = await attachModelAssets(doc, library, { supabaseUrl: url, upload: (rec) => A.uploadGameModel(rec) });
  assert.equal(attached.complete, true, JSON.stringify(attached.skipped));
  pubUrl = attached.assets[0].url;
  const r = await A.publishCustomGame(attached.doc);
  assert.equal(r.ok, true, JSON.stringify(r));
});

await t('B loads the published game and fetches the model (cache + hash check)', async () => {
  const g = await B.getPublishedGame('g_shared_models');
  assert.ok(g?.doc, 'published game');
  const assets = g.doc.modelAssets;
  assert.ok(Array.isArray(assets) && assets.length === 1, 'modelAssets present');
  assert.equal(assets[0].hash, hash);
  const cache = new Map();
  const c = { get: (h) => cache.get(h), put: (r) => cache.set(r.hash, r) };
  const got = await fetchModelAsset(assets[0], { cache: c, supabaseUrl: url });
  assert.equal(got.ok, true, got.reason);
  assert.equal(got.cached, false);
  assert.equal(got.data.byteLength, glb.byteLength);
  const again = await fetchModelAsset(assets[0], { cache: c, supabaseUrl: url });
  assert.equal(again.ok && again.cached, true);
});

await t('A saves customWear; B sees it on the mp roster', async () => {
  const wear = parseWearRef({
    id: 'm_tri', name: 'Triangle', format: 'glb', hash, bytes: glb.byteLength, url: pubUrl,
    bone: 'head', scale: 0.5, x: 0, y: 0.62, z: 0, rotY: 0, _supabaseUrl: url,
  }, { supabaseUrl: url });
  assert.ok(wear.ok, wear.reason);
  const saved = await A.saveLoadout({ customWear: wear.ref });
  assert.equal(saved.customWear?.hash, hash, JSON.stringify(saved));
  const profile = await A.loadProfile();
  assert.equal(profile.customWear?.hash, hash);
  // Join the same instance so B's heartbeat roster includes A
  const joinA = await A.mpJoin('g_shared_models');
  assert.equal(joinA.ok, true, JSON.stringify(joinA));
  const joinB = await B.mpJoin('g_shared_models');
  assert.equal(joinB.ok, true);
  const meOnB = (joinB.roster || []).find((p) => p.username === 'modeler_a');
  assert.ok(meOnB, 'A is on B’s roster');
  assert.equal(meOnB.customWear?.hash, hash, JSON.stringify(meOnB));
  assert.equal(meOnB.customWear?.bone, 'head');
  await A.mpLeave(); await B.mpLeave();
});

await t('empty object clears customWear (null arg would leave it unchanged)', async () => {
  const saved = await A.saveLoadout({ customWear: {} });
  assert.equal(saved.customWear, null);
});

await t('invalid wear payload is rejected (cleaned to null, not stored raw)', async () => {
  const saved = await A.saveLoadout({ customWear: { url: 'https://evil.example/x.glb', hash: 'abcd', format: 'glb', bytes: 10 } });
  assert.equal(saved.customWear, null);
});

await dev.close();
console.log(`${pass}/${pass + fail} editor-models e2e tests passed`);
process.exit(fail ? 1 : 0);
