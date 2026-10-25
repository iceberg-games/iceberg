#!/usr/bin/env node
// Multiplayer with REAL separate browsers: two Chromium processes, each signs up its own account
// (zz_test_publisher_1 / _2) through the portal UI, then plays together.
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
const GAME = 'frost-fields';
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
  const out = `/tmp/iceberg-mp2-${process.pid}`;
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
// pick a phrase through the Safe Chat menu UI, like a player
async function sayViaMenu(pl, nth = 0) {
  const p = pl.game;
  await p.click('#game-chat-btn');
  await p.waitForSelector('#safe-chat-menu:not(.hidden)');
  if (!(await p.$('#safe-chat-menu .sc-phrase:visible'))) await p.click('#safe-chat-menu .sc-sub >> nth=0');
  const btn = p.locator('#safe-chat-menu .sc-phrase:visible').nth(nth);
  const phrase = { id: await btn.getAttribute('data-phrase'), text: (await btn.innerText()).trim() };
  await btn.click();
  return phrase;
}
// is a bubble with this text showing over that remote avatar's head (screen-space)?
const bubbleOver = (viewer, who, text) => viewer.game.waitForFunction(([w, t]) => {
  const ic = window.iceberg, it = ic.gameChat.bubbles.items.get(w), av = ic.mp._avatarOf(w);
  if (!it || !av || !ic.gameChat.bubbles.isShowing(w) || !it.bubble.textContent.includes(t)) return false;
  const head = (av.bones?.head || av.root).getWorldPosition(new av.root.position.constructor()); head.y += 1.1;
  const v = head.project(ic.engine.camera), r = ic.engine.renderer.domElement.getBoundingClientRect();
  const sx = r.left + (v.x + 1) / 2 * r.width, b = it.bubble.getBoundingClientRect();
  return Math.abs((b.left + b.right) / 2 - sx) < 80;
}, [who, text], { timeout: 10000 }).then(() => true, () => false);

const t0 = Date.now();
let pa, pb;
try {
  pa = await player(A, 'ZZ One'); pb = await player(B, 'ZZ Two');
  check('two separate browser processes, each signed up through the portal UI', pa.browser !== pb.browser && !!pa.token && !!pb.token && pa.token !== pb.token);
  // friends (A asks, B accepts) so B can use Join friend
  await rpc(pa.token, 'send_friend_request', { p_username: B }); await rpc(pb.token, 'respond_friend_request', { p_username: A, p_accept: true });
  await openGame(pa, `play/?game=${GAME}`);
  // B joins A from the portal friends list
  await pb.portal.reload(); await pb.portal.click('.p-tab[data-view="friends"]');
  const joinSel = `#friends-lists a.join-friend[data-join="${A}"]`;
  const hasJoin = await pb.portal.waitForSelector(joinSel, { timeout: 15000 }).then(() => true, () => false);
  if (hasJoin) {
    const [tab] = await Promise.all([pb.ctx.waitForEvent('page'), pb.portal.click(joinSel)]);
    watch(tab, B); await tab.waitForSelector('#start-btn', { timeout: 30000 }); await tab.click('#start-btn');
    await tab.waitForFunction(() => window.iceberg?.mp?.info?.instance, null, { timeout: 30000 }); pb.game = tab;
  } else await openGame(pb, `play/?game=${GAME}&join=${A}`);
  const ia = await info(pa), ib = await info(pb);
  check('join friend: portal Join link puts B in A\'s instance', hasJoin && ia.topic === ib.topic && !ib.note, JSON.stringify({ hasJoin, a: ia.topic, b: ib.topic, note: ib.note }));
  check('both see each other', (await sees(pa, B)) && (await sees(pb, A)));
  const m1 = await seenMove(pb, pa, 6), m2 = await seenMove(pa, pb, -5);
  check('A moves -> B sees it (interpolated, settles on the real spot)', m1.ok, JSON.stringify(m1));
  check('B moves -> A sees it', m2.ok, JSON.stringify(m2));
  // Safe Chat both ways, bubble over the right avatar
  const pA = await sayViaMenu(pa, 0);
  check('A -> B: Safe Chat phrase shows as a bubble over A\'s avatar on B\'s screen', !!pA.id && await bubbleOver(pb, A, pA.text), JSON.stringify(pA));
  await pb.game.waitForTimeout(1200);                                                      // server rate limit between posts
  const pB = await sayViaMenu(pb, 1);
  check('B -> A: phrase shows as a bubble over B\'s avatar on A\'s screen', !!pB.id && await bubbleOver(pa, B, pB.text), JSON.stringify(pB));
  // B's own phrase is over B's own head on B's screen, never over A's avatar
  const wrong = await pb.game.evaluate(([w, t]) => { const b = window.iceberg.gameChat.bubbles; return { overA: !!b.items.get(w)?.bubble.textContent.includes(t) && b.isShowing(w), mine: !!b.items.get('me')?.bubble.textContent.includes(t) }; }, [A, pB.text]);
  check('bubble is over the speaker only (not over the other avatar)', !wrong.overA && wrong.mine, JSON.stringify(wrong));
  // free typing impossible: no typable element on the play page, server refuses non-catalog text
  const typable = await pa.game.evaluate(() => [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=button]), textarea, [contenteditable=""], [contenteditable=true]')]
    .filter(e => e.offsetParent !== null).map(e => e.outerHTML.slice(0, 80)));
  check('free typing impossible: no visible text field in the game', typable.length === 0, JSON.stringify(typable));
  const room = await pa.game.evaluate(() => window.iceberg.gameChat.room);
  const free = await rpc(pa.token, 'post_chat', { p_room: room, p_phrase_id: 'hello you can meet me at my house' });
  const freeText = await rpc(pa.token, 'post_chat', { p_room: room, p_text: 'free text' });
  check('free typing impossible: server rejects non-catalog text', !(free.body?.ok) && !(freeText.body?.ok), JSON.stringify([free, freeText]).slice(0, 300));
  check('free text never rendered', !(await pb.game.evaluate(() => document.body.innerText.includes('meet me at my house'))));
  // reconnect after dropping the network (A goes offline; sockets cut)
  await pa.ctx.setOffline(true);
  if (dev) dev.realtime.dropAll();
  const despawned = await gone(pb, A, LOCAL ? 20000 : 60000);   // real Realtime notices a dropped socket only after its own heartbeat timeout
  await pa.game.waitForTimeout(3000);
  await pa.ctx.setOffline(false);
  const back = await sees(pb, A, 40000);
  const m3 = back ? await seenMove(pb, pa, 4) : { ok: false };
  check('network drop: B despawns A, A reconnects by itself and is seen moving again', despawned && back && m3.ok, JSON.stringify({ despawned, back, m3 }));
  check('after reconnect A still sees B', await sees(pa, B, 20000));
  // leaving despawns
  await pb.game.evaluate(() => window.iceberg.goHome());
  check('B leaves -> A despawns B', await gone(pa, B, 15000));
  // 12-player cap, cheaply: API-only test users fill the instance (no browsers)
  if (CAP) {
    await openGame(pb, `play/?game=${GAME}&join=${A}`);                                     // back in: 2 browsers present
    const extra = [];
    for (let i = 3; i <= 13; i++) {
      const n = `zz_test_publisher_${i}`;
      const s = await (await fetch(`${API}/auth/v1/signup`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' },
        body: JSON.stringify({ email: `${n}@${domain}`, password: 'zz-mp2-' + Date.now(), data: { username: n, display_name: `ZZ ${i}` } }) })).json();
      if (!s.access_token) { check(`cap: sign up ${n}`, false, JSON.stringify(s).slice(0, 200)); break; }
      extra.push({ n, token: s.access_token });
    }
    if (extra.length === 11) {
      await rpc(extra[10].token, 'send_friend_request', { p_username: A }); await rpc(pa.token, 'respond_friend_request', { p_username: extra[10].n, p_accept: true });
      const joins = [];
      for (const u of extra.slice(0, 10)) joins.push((await rpc(u.token, 'mp_join', { p_game_id: GAME, p_friend: A })).body);
      const inst = (await info(pa)).instance;
      const thirteenth = (await rpc(extra[10].token, 'mp_join', { p_game_id: GAME, p_friend: A })).body;
      const roster = (await rpc(pa.token, 'mp_heartbeat', { p_game_id: GAME, p_instance: inst })).body;
      check('cap: 12 fit in one instance (2 browsers + 10 API players)', joins.every(j => j.instance === inst) && roster.roster?.length === 12, JSON.stringify({ inst, joins: joins.map(j => j.instance), roster: roster.roster?.length }));
      check('cap: 13th (A\'s friend) -> friend_full, placed in a new instance', thirteenth.note === 'friend_full' && thirteenth.instance !== inst, JSON.stringify(thirteenth));
      check('cap: server throttles send rate at 12 players (free-tier budget)', roster.sendHz >= 1 && roster.sendHz <= 2, String(roster.sendHz));
      for (const u of extra) await rpc(u.token, 'mp_leave');
    }
  }
  const pe = [...errs[A], ...errs[B]];
  check('no page errors in either browser', pe.length === 0, pe.join(' | '));
} catch (e) { check('unexpected error', false, e.stack); }
finally {
  for (const p of [pa, pb]) if (p?.token) await rpc(p.token, 'mp_leave').catch(() => {});
  for (const b of browsers) await b.close().catch(() => {});
  web?.close(); await dev?.close();
}
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} two-browser multiplayer checks passed (${LOCAL ? 'local stub' : BASE}) in ${Math.round((Date.now() - t0) / 1000)} s`);
if (!LOCAL) console.log('Clean up: node scripts/live-smoke.mjs --cleanup-only');
process.exit(failed ? 1 : 0);
