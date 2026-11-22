// Two signed-in browsers against the LOCAL dev backend (migration applied locally only).
// Client A imports a .glb, places it, publishes. Client B joins and should see the model.
// A late joiner (C) then joins the same game. Screenshots go to designs/editor-models/.
//   node scripts/editor-models-two-browser.mjs
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, rmSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { startDevServer, serveStatic, ANON_KEY } = await import(resolve(ROOT, 'tools/db/dev-server.mjs'));
const API = 54721, WEB = 8721, BASE = `http://127.0.0.1:${WEB}/iceberg/`;
const OUT = '/tmp/iceberg-models-v2-site';
const DATA = '/tmp/iceberg-models-v2-devdb';
const SHOTS = join(ROOT, 'designs/editor-models');
const BOX = join(ROOT, 'scripts/fixtures/box.glb');
mkdirSync(SHOTS, { recursive: true });
rmSync(DATA, { recursive: true, force: true });

let fails = 0;
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); if (!c) fails++; };

const r = spawnSync('node', ['scripts/build-site.mjs', '--out', OUT], {
  cwd: ROOT,
  env: { ...process.env, VITE_SUPABASE_URL: `http://127.0.0.1:${API}`, VITE_SUPABASE_ANON_KEY: ANON_KEY, VITE_USERNAME_EMAIL_DOMAIN: 'users.iceberg.test' },
  encoding: 'utf8',
});
ok('site build', r.status === 0, (r.stderr || r.stdout || '').slice(-400));
if (r.status !== 0) { console.error(r.stdout, r.stderr); process.exit(1); }

const dev = await startDevServer({ port: API, dataDir: DATA, quiet: true });
const web = await serveStatic(OUT, WEB, { prefix: '/iceberg/' });
const browser = await chromium.launch({
  args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const GL_ARGS = ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

async function signUp(name) {
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await c.addInitScript(() => { try { localStorage.setItem('iceberg:v1:portal', '1'); } catch {} });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(BASE + '?portal=1', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#form-signup', { timeout: 20000 });
  await p.fill('#form-signup input[name=dob]', '2001-04-15');
  await p.fill('#form-signup input[name=username]', name);
  await p.fill('#form-signup input[name=password]', 'snowball123');
  await p.fill('#form-signup input[name=display]', name);
  await p.click('#form-signup button[type=submit]');
  await p.waitForSelector('#p-user', { timeout: 20000 });
  return { c, p, errs };
}

async function openHome(ctx) {
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + 'play/', { waitUntil: 'domcontentloaded' });
  await p.click('#start-btn').catch(() => {});
  await p.waitForSelector('#pc-home', { timeout: 20000 });
  return { p, errs };
}

async function playGame(page, name) {
  const ctx = page.context();
  const popP = ctx.waitForEvent('page', { timeout: 10000 }).catch(() => null);
  const card = page.locator('.game-card', { hasText: name }).first();
  await card.waitFor({ timeout: 20000 });
  await card.locator('.play').first().click({ timeout: 8000 });
  const pop = await popP;
  const gp = pop || page;
  await gp.waitForFunction(() => window.iceberg?.engine?.game?.runtime === true, null, { timeout: 25000 }).catch(() => {});
  return gp;
}

function modelStateFn() {
  return () => {
    const ice = window.iceberg;
    const g = ice?.engine?.game;
    if (!g) return { ready: false, why: 'no-game' };
    const inst = [...(g.doc?.instances || []), ...(g.doc?.models || [])].find(i => i && i.modelId);
    if (!inst) return { ready: false, why: 'no-instance', instCount: (g.doc?.instances || []).length, assets: (g.doc?.modelAssets || []).length };
    const lib = ice.engine.models || ice.models;
    const has = !!(lib?.instance?.(inst.modelId) || lib?.has?.(inst.modelId));
    const ph = [];
    g.scene?.traverse?.((o) => { if (o.userData?.placeholder) ph.push(o.userData.placeholder); });
    const assets = (g.doc.modelAssets || []).map(a => ({ id: a.id, hash: a.hash, format: a.format, url: !!a.url }));
    return { ready: has && ph.length === 0, has, placeholders: ph, modelId: inst.modelId, name: inst.name, assets, runtime: !!g.runtime, editing: !!g.editing };
  };
}

try {
  const A = await signUp('model_maker');
  const B = await signUp('model_viewer');
  ok('A and B signed up', true);

  const Ah = await openHome(A.c);
  await Ah.p.click('#create-btn');
  await Ah.p.click('[data-template=blank]');
  await Ah.p.waitForFunction(() => window.iceberg?.engine?.game?.editing === true, null, { timeout: 20000 });
  ok('A opened a blank Studio game', true);

  await Ah.p.click('[data-tab=toolbox]');
  await Ah.p.waitForSelector('#studio-model-file', { state: 'attached', timeout: 10000 });
  await Ah.p.setInputFiles('#studio-model-file', BOX);
  await Ah.p.waitForFunction(() => {
    const g = window.iceberg?.engine?.game;
    return (g?.doc?.instances || []).some(i => i.modelId);
  }, null, { timeout: 15000 });
  // Place the cube near the spawn so both cameras see it, and name the game.
  await Ah.p.evaluate(() => {
    const g = window.iceberg.engine.game;
    const inst = g.doc.instances.find(i => i.modelId);
    if (inst) { inst.pos = [0, 1.2, 6]; inst.scale = inst.scale || [2, 2, 2]; g.select(inst.id); g.touch?.(); }
    g.doc.name = 'Shared Cube';
    g.doc.updatedAt = Date.now();
  });
  await Ah.p.waitForTimeout(400);
  const afterImport = await Ah.p.evaluate(modelStateFn());
  ok('A imported and placed the .glb', afterImport.has || afterImport.modelId, JSON.stringify(afterImport));
  await Ah.p.screenshot({ path: join(SHOTS, 'v2-client-a-studio.png') });

  await Ah.p.click('#publish-game');
  await Ah.p.waitForFunction(() => {
    const t = document.body.innerText || '';
    return /Published/i.test(t) || /publish/i.test(document.querySelector('#publish-status')?.textContent || '');
  }, null, { timeout: 20000 }).catch(() => {});
  const pub = await Ah.p.evaluate(async () => {
    const g = window.iceberg.engine.game;
    const doc = g.doc;
    const listed = window.iceberg.backend.loadCustomGames().find(x => x.id === doc.id);
    return {
      name: doc.name,
      id: doc.id,
      assets: (doc.modelAssets || listed?.modelAssets || []).map(a => ({ id: a.id, format: a.format, hash: a.hash, url: a.url })),
      status: document.querySelector('#publish-status')?.textContent || '',
      published: !!(listed?.published || doc.fromServer),
    };
  });
  ok('A published with modelAssets', pub.assets.length >= 1 && !!pub.assets[0]?.url, JSON.stringify(pub));
  await Ah.p.screenshot({ path: join(SHOTS, 'v2-client-a-published.png') });

  // A exits studio and plays their published game so they are in the multiplayer session.
  await Ah.p.click('#exit-editor').catch(() => {});
  await Ah.p.waitForSelector('#pc-home', { timeout: 15000 });
  const Ap = await playGame(Ah.p, 'Shared Cube');
  ok('A is playing the published game', await Ap.evaluate(() => window.iceberg?.engine?.game?.runtime === true));
  await Ap.waitForFunction(modelStateFn(), null, { timeout: 20000 }).catch(() => {});
  const aPlay = await Ap.evaluate(modelStateFn());
  ok('A sees the placed model in play', aPlay.ready, JSON.stringify(aPlay));
  await Ap.screenshot({ path: join(SHOTS, 'v2-client-a-play.png') });

  const Bh = await openHome(B.c);
  // Community / Your / search — wait until the published game is listed for B.
  await Bh.p.waitForFunction(() => [...document.querySelectorAll('.game-card .gc-name')].some(e => /Shared Cube/.test(e.textContent)), null, { timeout: 25000 }).catch(() => {});
  const bNames = await Bh.p.evaluate(() => [...document.querySelectorAll('.game-card .gc-name')].map(e => e.textContent));
  ok('B sees Shared Cube in the menu', bNames.includes('Shared Cube'), bNames.join(', '));
  const Bp = await playGame(Bh.p, 'Shared Cube');
  ok('B is in the published game', await Bp.evaluate(() => window.iceberg?.engine?.game?.runtime === true));
  await Bp.waitForFunction((fn) => fn(), modelStateFn(), { timeout: 20000 }).catch(async () => {
    // waitForFunction can't take a function declared in Node; poll instead
  });
  // Poll for the model to finish fetching on B.
  let bState = { ready: false };
  for (let i = 0; i < 20 && !bState.ready; i++) {
    bState = await Bp.evaluate(modelStateFn());
    if (bState.ready) break;
    await Bp.waitForTimeout(500);
  }
  ok('B sees the published model (not a placeholder)', bState.ready, JSON.stringify(bState));
  await Bp.screenshot({ path: join(SHOTS, 'v2-client-b-play.png') });

  // Late joiner C arrives after A and B are already in the game.
  const C = await signUp('model_late');
  const Ch = await openHome(C.c);
  await Ch.p.waitForFunction(() => [...document.querySelectorAll('.game-card .gc-name')].some(e => /Shared Cube/.test(e.textContent)), null, { timeout: 25000 }).catch(() => {});
  const Cp = await playGame(Ch.p, 'Shared Cube');
  ok('C (late joiner) is in the published game', await Cp.evaluate(() => window.iceberg?.engine?.game?.runtime === true));
  let cState = { ready: false };
  for (let i = 0; i < 20 && !cState.ready; i++) {
    cState = await Cp.evaluate(modelStateFn());
    if (cState.ready) break;
    await Cp.waitForTimeout(500);
  }
  ok('C (late joiner) sees the published model', cState.ready, JSON.stringify(cState));
  await Cp.screenshot({ path: join(SHOTS, 'v2-client-c-late.png') });

  // Capture A and B again so both views are current.
  await Ap.screenshot({ path: join(SHOTS, 'v2-client-a-with-others.png') });
  await Bp.screenshot({ path: join(SHOTS, 'v2-client-b-with-others.png') });

  const aErrs = [...A.errs, ...Ah.errs].slice(0, 8);
  ok('no page errors on A/B', aErrs.length === 0 && B.errs.length === 0, JSON.stringify({ a: aErrs, b: B.errs.slice(0, 8), c: C.errs.slice(0, 8) }));
} catch (e) {
  ok('two-browser run aborted', false, e.stack || e.message);
} finally {
  await browser.close().catch(() => {});
  try { await dev.close?.(); } catch {}
  try { await new Promise((ok) => web.close(ok)); } catch {}
}

console.log(`${fails === 0 ? 'ALL PASS' : fails + ' failed'}`);
process.exit(fails ? 1 : 0);
