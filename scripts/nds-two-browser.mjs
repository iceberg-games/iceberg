#!/usr/bin/env node
// Natural Disaster Survival shared rounds with REAL separate browsers (two Chromium processes, own accounts):
// same round start / disaster / seed on both, survivors list shared, host migration when the host leaves,
// net.js sees the full mp game API (isHost/onHostChanged/setState/onState/sendEvent/onEvent/players/localId/now/nearby).
// Harness (build, local dev backend + Realtime stub, sign-up, openGame) copied from scripts/mp-two-browser.mjs.
//
//   node scripts/mp-two-browser.mjs                         # local: builds the site, dev backend + Realtime stub
//   node scripts/mp-two-browser.mjs --base <siteUrl> --api <supabaseUrl> --anon <anonKey> [--cap]
//        real project (after migrations 7-8 are applied at release). --cap also fills an instance to
//        12 with API-only test users zz_test_publisher_3..13. Clean up afterwards with
//        `node scripts/live-smoke.mjs --cleanup-only` (deletes ONLY zz_test_publisher_* rows).
// Covers: see each other move (both ways), join friend from the portal, Safe Chat phrases both ways as
// bubbles over the right avatar, no free typing (UI + server), leave despawns, 12-player cap,
// reconnect after a network drop.
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (f, d = null) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const LOCAL = !arg('--base');
const CAP = LOCAL || process.argv.includes('--cap');
const results = []; const check = (n, ok, x = '') => { results.push([ok ? 'PASS' : 'FAIL', n, x]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && x ? '\n      ' + String(x).slice(0, 900) : ''}`); };
const GAME = 'natural-disaster-survival';
const A = 'zz_test_publisher_1', B = 'zz_test_publisher_2';
const LAUNCH = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };

let BASE, API, ANON, dev = null, web = null;
if (LOCAL) {
  const { startDevServer, serveStatic, ANON_KEY } = await import(pathToFileURL(resolve(ROOT, 'tools/db/dev-server.mjs')).href);
  const { createServer } = await import('node:net');
  const free = (p) => new Promise((ok) => { const s = createServer().once('error', () => ok(false)).once('listening', () => s.close(() => ok(true))).listen(p); });
  let apiPort = 54480; while (!(await free(apiPort))) apiPort += 3;
  let webPort = 8480; while (!(await free(webPort))) webPort += 3;
  API = `http://localhost:${apiPort}`; ANON = ANON_KEY; BASE = `http://localhost:${webPort}/iceberg/`;
  const out = `/tmp/iceberg-nds2-${process.pid}`;
  const r = spawnSync('node', ['scripts/build-site.mjs', '--out', out], { cwd: ROOT, encoding: 'utf8',
    env: { ...process.env, VITE_SUPABASE_URL: API, VITE_SUPABASE_ANON_KEY: ANON, VITE_USERNAME_EMAIL_DOMAIN: 'users.iceberg.test' } });
  if (r.status !== 0) { console.error(r.stdout + r.stderr); process.exit(1); }
  dev = await startDevServer({ port: apiPort, quiet: true });
  web = await serveStatic(out, webPort, { prefix: '/iceberg/' });
} else { BASE = arg('--base'); API = arg('--api'); ANON = arg('--anon'); if (!BASE.endsWith('/')) BASE += '/'; }

const rpc = async (token, fn, args = {}) => {
  const r = await fetch(`${API}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json', authorization: `Bearer ${token || ANON}` }, body: JSON.stringify(args) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j };
};
const domain = LOCAL ? 'users.iceberg.test' : (arg('--email-domain') || process.env.VITE_USERNAME_EMAIL_DOMAIN || 'users.iceberg.invalid');

const browsers = [], errs = { [A]: [], [B]: [] };
const watch = (p, who) => { p.on('pageerror', e => errs[who].push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|40[1349]|Failed to load resource|ERR_INTERNET_DISCONNECTED|WebSocket/.test(m.text())) errs[who].push(m.text()); }); };

async function player(name, display) {
  const browser = await chromium.launch(LAUNCH); browsers.push(browser);            // separate browser process per player
  const ctx = await browser.newContext({ viewport: { width: 640, height: 420 } });
  const portal = await ctx.newPage(); watch(portal, name);
  await portal.goto(BASE);
  await portal.click('#p-signin-open');
  await portal.fill('#form-signup input[name=username]', name);
  await portal.fill('#form-signup input[name=password]', 'zz-mp2-' + Date.now());
  await portal.fill('#form-signup input[name=display]', display);
  await portal.click('#form-signup button[type=submit]');
  await portal.waitForSelector('#p-user', { timeout: 20000 });
  const session = await portal.evaluate(() => JSON.parse(localStorage.getItem('iceberg:v1:session')));
  return { name, browser, ctx, portal, token: session.access_token, game: null };
}
async function openGame(pl, url) {
  const p = await pl.ctx.newPage(); watch(p, pl.name);
  await p.goto(BASE + url); await p.waitForSelector('#start-btn', { timeout: 30000 }); await p.click('#start-btn');
  await p.waitForFunction(() => window.iceberg?.mp?.info?.instance, null, { timeout: 30000 });
  pl.game = p; return p;
}
const info = (pl) => pl.game.evaluate(() => window.iceberg.mp.info);
const sees = (pl, who, ms = 15000) => pl.game.waitForFunction((w) => window.iceberg.mp.info?.others.some(o => o.username === w && o.visible), who, { timeout: ms }).then(() => true, () => false);
const gone = (pl, who, ms = 15000) => pl.game.waitForFunction((w) => !window.iceberg.mp.info?.others.some(o => o.username === w), who, { timeout: ms }).then(() => true, () => false);
const walk = (pl, dx) => pl.game.evaluate((dx) => new Promise((ok) => { const p = window.iceberg.engine.player; let n = 0; const id = setInterval(() => { p.pos.x += dx / 30; if (++n >= 30) { clearInterval(id); ok(p.pos.toArray()); } }, 50); }), dx);
async function seenMove(viewer, mover, dx) {
  const real = await walk(mover, dx);
  const ok = await viewer.game.waitForFunction(([w, x, z]) => { const o = window.iceberg.mp.info.others.find(o => o.username === w); return o && Math.hypot(o.pos[0] - x, o.pos[2] - z) < 0.3; }, [mover.name, real[0], real[2]], { timeout: 8000 }).then(() => true, () => false);
  return { ok, real, seen: (await info(viewer)).others.find(o => o.username === mover.name)?.pos };
}

const nds = (pl) => pl.game.evaluate(() => { const a = window.iceberg.engine.game?.nds; const r = a?.roundState;
  return a && { phase: a.phase, round: a.round, disaster: a.disaster, roundState: r && { n: r.n, disaster: r.disaster, seed: r.seed, startsAt: r.startsAt, big: r.big },
    lastResults: a.lastResults || null, online: !!a.net?.online, host: a.net?.isHost?.(), selfId: a.net?.selfId }; });
const waitNds = (pl, fn, arg, ms = 20000) => pl.game.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
let pa, pb;
try {
  pa = await player(A, 'Ana'); pb = await player(B, 'Ben');
  // A wears the Frost Tornado Hat (local test DB only): nearby() on B must report it
  await dev.db.exec(`insert into public.inventory (user_id, item_id) select id, 'tornado_hat' from public.profiles where username = '${A}' on conflict do nothing;
    update public.profiles set equipped = '{"hat":"tornado_hat"}'::jsonb where username = '${A}';`);
  await openGame(pa, `play/?game=${GAME}`);
  await new Promise(r => setTimeout(r, 1500));                       // A joins first -> A is host
  await openGame(pb, `play/?game=${GAME}`);
  const ia = await info(pa), ib = await info(pb);
  check('both in the same NDS instance', ia.instance === ib.instance && ia.gameId === ib.gameId, JSON.stringify([ia.instance, ib.instance]));
  check('A sees B and B sees A', await sees(pa, B) && await sees(pb, A));
  const api = await pb.game.evaluate(() => ['isHost', 'onHostChanged', 'setState', 'onState', 'sendEvent', 'onEvent', 'players', 'localId', 'now', 'nearby'].filter(k => typeof window.iceberg.mp[k] !== 'function'));
  check('mp game API complete (net.js feature-detects all of it)', api.length === 0, 'missing: ' + api.join());
  await waitNds(pa, () => window.iceberg.engine.game?.nds?.net); await waitNds(pb, () => window.iceberg.engine.game?.nds?.net);
  await waitNds(pb, () => window.iceberg.mp.players().length === 2);
  let sa = await nds(pa), sb = await nds(pb);
  check('net.js online on both; A is host, B is not', sa.online && sb.online && sa.host === true && sb.host === false, JSON.stringify([sa, sb]));
  check('players() agrees on both (host first)', JSON.stringify(await pa.game.evaluate(() => window.iceberg.mp.players().map(p => [p.id, p.isHost]))) === JSON.stringify(await pb.game.evaluate(() => window.iceberg.mp.players().map(p => [p.id, p.isHost]))));
  // nearby: put both on the same spot, then far apart
  const nb = await pb.game.evaluate(() => window.iceberg.mp.nearby(1e6).map(p => [p.id, typeof p.name, typeof p.position?.x]));
  check('mp.nearby(r) on B lists A with {id, name, position}', nb.length === 1 && nb[0][0] === A && nb[0][1] === 'string' && nb[0][2] === 'number', JSON.stringify(nb));
  const hats = [await pb.game.evaluate(() => window.iceberg.mp.nearby(1e6).map(p => p.hat)), await pa.game.evaluate(() => window.iceberg.mp.nearby(1e6).map(p => p.hat))];
  check("mp.nearby hat: B sees A's 'tornado_hat', A sees B's null", JSON.stringify(hats) === JSON.stringify([['tornado_hat'], [null]]), JSON.stringify(hats));
  // god mode on both so everyone survives; host starts the round now
  await pa.game.evaluate(() => { window.iceberg.engine.game.nds.godMode = true; }); await pb.game.evaluate(() => { window.iceberg.engine.game.nds.godMode = true; });
  const before = sa.roundState?.n || sa.round || 0;
  // a non-host can't start a round
  await pb.game.evaluate(() => window.iceberg.engine.game.nds.skipLobby()); await new Promise(r => setTimeout(r, 800));
  check('non-host skipLobby does not start a round', ((await nds(pa)).roundState?.n || 0) === before && ((await nds(pb)).roundState?.n || 0) === before);
  await pa.game.evaluate(() => window.iceberg.engine.game.nds.skipLobby());
  const gotA = await waitNds(pa, (n) => window.iceberg.engine.game.nds.roundState?.n > n, before), gotB = await waitNds(pb, (n) => window.iceberg.engine.game.nds.roundState?.n > n, before);
  sa = await nds(pa); sb = await nds(pb);
  check('same round start on both (n, disaster, seed, startsAt, big)', gotA && gotB && JSON.stringify(sa.roundState) === JSON.stringify(sb.roundState), JSON.stringify([sa.roundState, sb.roundState]));
  // software GL here runs the game clock at a few % of real time (dt is clamped per frame), so drive the phases with
  // NDS's own debug helpers. Each client leaves 'warning' on its own clock in real play, exactly like endPhase() here.
  await pa.game.evaluate(() => window.iceberg.engine.game.nds.endPhase()); await pb.game.evaluate(() => window.iceberg.engine.game.nds.endPhase());
  const inDis = (await waitNds(pa, () => window.iceberg.engine.game.nds.phase === 'disaster', null, 15000)) && (await waitNds(pb, () => window.iceberg.engine.game.nds.phase === 'disaster', null, 15000));
  sa = await nds(pa); sb = await nds(pb);
  check('same disaster running on both pages', inDis && sa.disaster && sa.disaster === sb.disaster && sa.disaster === sa.roundState.disaster, JSON.stringify([sa.phase, sa.disaster, sb.phase, sb.disaster]));
  // end the disaster: B first (sends 'survived'), then the host (publishes results 600 ms later)
  await pb.game.evaluate(() => window.iceberg.engine.game.nds.endPhase()); await new Promise(r => setTimeout(r, 400));
  await pa.game.evaluate(() => window.iceberg.engine.game.nds.endPhase());
  const n = sa.roundState.n;
  const resA = await waitNds(pa, (n) => window.iceberg.engine.game.nds.lastResults?.n === n, n), resB = await waitNds(pb, (n) => window.iceberg.engine.game.nds.lastResults?.n === n, n);
  sa = await nds(pa); sb = await nds(pb);
  const surv = (r) => JSON.stringify([...(r?.survivors || [])].sort());
  check('same survivors on both pages (both players)', resA && resB && surv(sa.lastResults) === surv(sb.lastResults) && surv(sa.lastResults) === JSON.stringify([A, B].sort()), JSON.stringify([sa.lastResults, sb.lastResults]));
  // host migration: the host leaves; B becomes host and carries the game on
  await pa.game.close(); pa.game = null;
  const migrated = await waitNds(pb, () => window.iceberg.mp.isHost() && window.iceberg.mp.players().length === 1, null, 40000);
  check('host migration: B becomes host after A leaves', migrated, JSON.stringify(await pb.game.evaluate(() => [window.iceberg.mp.hostId(), window.iceberg.mp.players().map(p => p.id)])));
  await pb.game.evaluate(() => { const g = window.iceberg.engine.game.nds; if (g.phase === 'results') g.endPhase(); });   // results -> intermission
  await pb.game.evaluate(() => window.iceberg.engine.game.nds.skipLobby());
  const next = await waitNds(pb, (n) => window.iceberg.engine.game.nds.roundState?.n === n + 1, n, 10000);
  sb = await nds(pb);
  check('new host starts the next round (n+1)', next && sb.host === true, JSON.stringify(sb.roundState));
  check('no page errors', !errs[A].length && !errs[B].length, JSON.stringify(errs).slice(0, 800));
} catch (e) { check('run completed', false, e.stack); }
for (const b of browsers) await b.close().catch(() => {});
await web?.close?.(); await dev?.close?.();
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} NDS two-browser checks passed`);
process.exit(failed ? 1 : 0);
