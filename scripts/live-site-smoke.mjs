#!/usr/bin/env node
// Browser smoke of a BUILT site against the REAL Supabase project.
//   node scripts/live-site-smoke.mjs <baseUrl>     e.g. http://localhost:8099/iceberg/ or https://iceberg-games.github.io/iceberg/
// Signs up zz_test_publisher_1 through the portal UI; cleanup is done by live-smoke.mjs --cleanup-only.
import { chromium } from 'playwright';
const BASE = process.argv[2]; if (!BASE) { console.error('usage: live-site-smoke.mjs <baseUrl>'); process.exit(1); }
let pass = 0, fail = 0; const check = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(ok ? 'PASS ' : 'FAIL ', n, ok ? '' : d); };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/400|401|favicon/.test(m.text())) errs.push(m.text()); });
try {
  const res = await p.goto(BASE); check('portal loads (200)', res.ok(), res.status());
  await p.waitForSelector('#featured-banner .fb-slide', { timeout: 20000 });
  check('featured banner from server', (await p.$eval('#featured-banner .fb-slide', e => e.dataset.game)) === 'giant-rainbow-obby');
  const man = await p.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const r = await fetch(l.href); const j = await r.json(); return { ok: r.ok, name: j.name, icons: j.icons?.length, start: j.start_url, display: j.display }; });
  check('manifest served (installable fields)', man.ok && man.icons >= 2 && man.display === 'standalone' && !!man.start, JSON.stringify(man));
  const sw = await p.evaluate(async () => { const r = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 15000))]); return r ? r.active?.scriptURL : null; });
  check('service worker active', !!sw && sw.startsWith(new URL('sw.js', BASE).href.replace(/sw\.js$/, '')), sw);
  await p.click('#p-signin-open');
  await p.fill('#form-signup input[name=username]', 'zz_test_publisher_1');
  await p.fill('#form-signup input[name=password]', 'zz-site-' + Date.now());
  await p.fill('#form-signup input[name=display]', 'ZZ Test');
  await p.click('#form-signup button[type=submit]');
  await p.waitForSelector('#p-user', { timeout: 20000 });
  check('sign up with username via portal UI (real Supabase Auth)', /zz_test_publisher_1/.test(await p.textContent('#p-user')));
  const coins = await p.evaluate(() => window.icebergPortal.economy.profile.coins);
  check('server profile loaded', typeof coins === 'number', coins);
  await p.click('.p-tab[data-view="games"]').catch(() => {});
  await p.waitForSelector('#games-grid .game-card');
  const [tab] = await Promise.all([ctx.waitForEvent('page'), p.click('#featured-banner .fb-play')]);
  await tab.waitForLoadState();
  check('Play opens the game in a new tab', /\/play\/\?game=giant-rainbow-obby$/.test(tab.url()), tab.url());
  await tab.waitForFunction(() => window.iceberg?.economy?.remote, null, { timeout: 25000 }).catch(() => {});
  check('game tab shares the signed-in session', await tab.evaluate(() => !!window.iceberg?.economy?.remote));
  await tab.waitForSelector('#start-btn', { timeout: 20000 }); await tab.click('#start-btn');   // title screen Start (unlocks audio), then ?game= auto-launches
  await tab.waitForFunction(() => window.iceberg?.engine?.game?.obby, null, { timeout: 30000 }).catch(() => {});
  const g = await tab.evaluate(() => ({ loaded: !!window.iceberg?.engine?.game?.obby, canvas: !!document.querySelector('canvas') }));
  check('game loads in the new tab (Giant Rainbow Obby running)', g.loaded && g.canvas, JSON.stringify(g));
  await tab.waitForTimeout(1500); await tab.screenshot({ path: '/tmp/live-play.png' });
  await tab.close();
  await p.screenshot({ path: '/tmp/live-portal.png' });
  check('no page errors', errs.length === 0, errs.join(' | ').slice(0, 400));
} catch (e) { check('unexpected error', false, e.stack); }
await b.close();
console.log(`\n${pass}/${pass + fail} site checks passed`); process.exit(fail ? 1 : 0);
