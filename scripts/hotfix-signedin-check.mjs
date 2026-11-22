// Signed-in check (VISIBLE browser, production site build, LOCAL dev backend): account "gooberr478" opens Birg HQ + Frost Fields from the
// home and from search, with the Studio-copy seed applied (copies must not replace or hide the built-ins), and the first screen is the home.
//   DISPLAY=:4 node scripts/hotfix-signedin-check.mjs
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { startDevServer, serveStatic, ANON_KEY } = await import(resolve(ROOT, 'tools/db/dev-server.mjs'));
const API = 54640, WEB = 8640, BASE = `http://localhost:${WEB}/iceberg/`, OUT = '/tmp/iceberg-hf-site', SHOTS = resolve(ROOT, 'designs/editor-hotfix/');
let fails = 0; const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); if (!c) fails++; };
const r = spawnSync('node', ['scripts/build-site.mjs', '--out', OUT], { cwd: ROOT, env: { ...process.env, VITE_SUPABASE_URL: `http://localhost:${API}`, VITE_SUPABASE_ANON_KEY: ANON_KEY, VITE_USERNAME_EMAIL_DOMAIN: 'users.iceberg.test' }, encoding: 'utf8' });
ok('site build', r.status === 0, r.stderr?.slice(-300));
const dev = await startDevServer({ port: API, quiet: true });
const web = await serveStatic(OUT, WEB, { prefix: '/iceberg/' });
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1440,900'] });
try {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  // site root -> the one home (signed out: the sign-in gate, same page as the game)
  await p.goto(BASE); await p.waitForSelector('#form-signup', { timeout: 20000 });
  ok('site root lands on the play page (one UI), not the old portal', /\/play\/$/.test(p.url()), p.url());
  await p.screenshot({ path: SHOTS + '1-signin-gate-after.png' });
  await p.fill('#form-signup input[name=dob]', '2001-04-15'); await p.fill('#form-signup input[name=username]', 'gooberr478'); await p.fill('#form-signup input[name=password]', 'snowball123'); await p.fill('#form-signup input[name=display]', 'gooberr478');
  await p.click('#form-signup button[type=submit]'); await p.waitForSelector('#pc-home', { timeout: 20000 });
  ok('after sign-up the new home is the first thing shown', !(await p.$('.title-screen')) && !!(await p.$('#pc-home')));
  ok('greeting uses the account name', /gooberr478/.test(await p.textContent('.pc-hello h1')));
  // apply the Studio-copies seed to the LOCAL db (never production) and reload
  const seed = readFileSync(resolve(ROOT, 'supabase/seeds/studio_copies_gooberr478.sql'), 'utf8');
  await dev.db.exec(seed);
  const copies = (await dev.db.query("select game_key from custom_games where game_key like 'g\\_%\\_studio' order by 1")).rows.map(x => x.game_key);
  ok('seed applied locally: gooberr478 owns the two Studio copies', copies.length === 2, copies.join());
  await p.reload(); await p.waitForSelector('#pc-home'); await p.waitForTimeout(2500);
  const builtins = await p.$$eval('#games-carousel .game-card', e => e.map(x => ({ id: x.dataset.game, name: x.querySelector('.gc-name')?.textContent })));
  ok('Birg HQ + Frost Fields still listed as built-ins for gooberr478', ['birg-hq', 'frost-fields'].every(id => builtins.some(x => x.id === id)), JSON.stringify(builtins));
  const yours = await p.$$eval('#your-games .game-card', e => e.map(x => x.dataset.game));
  ok('Studio copies show under Your Games (editable) and do not replace the built-ins', yours.length >= 2 && !yours.some(id => ['birg-hq', 'frost-fields'].includes(id)), yours.join());
  ok('built-ins are on screen without scrolling', await p.evaluate(() => { const r = document.querySelector('#games-carousel')?.getBoundingClientRect(); return !!r && r.top < innerHeight - 60; }));
  await p.screenshot({ path: SHOTS + '3-gooberr478-home-after.png' });
  // open Frost Fields + Birg HQ from the tile (pop-out), and from search
  for (const [id, term] of [['frost-fields', 'frost'], ['birg-hq', 'birg']]) {
    for (const via of ['tile', 'search']) {
      if (via === 'search') { await p.fill('#pc-search', term); await p.waitForSelector(`#search-results .game-card[data-game="${id}"]`); }
      const sel = via === 'tile' ? `#games-carousel .game-card[data-game="${id}"]` : `#search-results .game-card[data-game="${id}"]`;
      const [pop] = await Promise.all([p.waitForEvent('popup', { timeout: 10000 }).catch(() => null), p.click(sel)]);
      ok(`${id} opens from ${via} (pop-out)`, !!pop);
      if (pop) {
        await pop.waitForFunction((id) => window.iceberg?.engine?.def?.id === id || window.iceberg?.engine?.game?.def?.id === id, id, { timeout: 25000 }).catch(() => {});
        await pop.waitForTimeout(2500);
        const got = await pop.evaluate(() => window.iceberg?.engine?.def?.id || window.iceberg?.engine?.game?.def?.id);
        ok(`${id} runs for gooberr478 (${via})`, got === id, String(got));
        await pop.screenshot({ path: SHOTS + `3-gooberr478-${id}-${via}-after.png` });
        await pop.close();
      }
      if (via === 'search') await p.fill('#pc-search', '');
    }
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('check completed', false, e.message.split('\n')[0]); }
await b.close(); await web?.close?.(); await dev.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
