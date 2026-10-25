// Ban system end to end on the real site bundle + local dev backend (PGlite, all migrations):
// dev sees the Ban/Unban panel, bans a player through it; that player's portal + game load show 'You are banned'
// and nothing else; non-devs never see the panel; unban restores access.
//   node scripts/ban-e2e.mjs
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { startDevServer, serveStatic, ANON_KEY } = await import(pathToFileURL(resolve(ROOT, 'tools/db/dev-server.mjs')).href);
const API_PORT = 54610, WEB_PORT = 8610, API = `http://localhost:${API_PORT}`, BASE = `http://localhost:${WEB_PORT}/iceberg/`;
const out = `/tmp/iceberg-ban-${process.pid}`;
const r = spawnSync('node', ['scripts/build-site.mjs', '--out', out], { cwd: ROOT, encoding: 'utf8',
  env: { ...process.env, VITE_SUPABASE_URL: API, VITE_SUPABASE_ANON_KEY: ANON_KEY, VITE_USERNAME_EMAIL_DOMAIN: 'users.iceberg.test' } });
if (r.status !== 0) { console.error(r.stdout + r.stderr); process.exit(1); }
const dev = await startDevServer({ port: API_PORT, quiet: true }); const web = await serveStatic(out, WEB_PORT, { prefix: '/iceberg/' });
const results = []; const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && x ? '\n      ' + String(x).slice(0, 400) : ''}`); };
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
async function signUp(name) {
  const c = await b.newContext({ viewport: { width: 1280, height: 820 } }); const p = await c.newPage();
  await p.goto(BASE); await p.click('#p-signin-open');
  await p.fill('#form-signup input[name=username]', name); await p.fill('#form-signup input[name=password]', 'zz-ban-' + Date.now());
  await p.fill('#form-signup input[name=display]', name); await p.click('#form-signup button[type=submit]');
  await p.waitForSelector('#p-user', { timeout: 20000 }).catch(async (e) => { throw new Error(name + ' sign-up: ' + (await p.evaluate(() => document.querySelector('#form-signup .err, #form-signup [class*=err]')?.textContent || document.body.innerText.slice(0, 300)))); });
  return { c, p };
}
try {
  const devU = await signUp('zz_tester_dev'), pl = await signUp('zz_tester_two');
  check('non-dev: no ban panel', !(await pl.p.$('#ban-panel')));
  await dev.db.exec(`insert into public.dev_accounts (user_id) select id from public.profiles where username = 'zz_tester_dev'`);
  await devU.p.reload(); const panel = await devU.p.waitForSelector('#ban-panel', { timeout: 15000 }).then(() => true, () => false);
  check('dev: Ban/Unban panel shows (username box + 2 buttons)', panel && !!(await devU.p.$('#ban-username')) && !!(await devU.p.$('#ban-btn')) && !!(await devU.p.$('#unban-btn')));
  await devU.p.fill('#ban-username', 'zz_tester_dev'); await devU.p.click('#ban-btn'); await devU.p.waitForTimeout(800);
  check('dev cannot ban a dev (toast)', /cannot_ban_dev/.test(await devU.p.evaluate(() => document.body.innerText)));
  await devU.p.fill('#ban-username', 'zz_tester_two'); await devU.p.click('#ban-btn'); await devU.p.waitForTimeout(800);
  check('dev bans zz_tester_two via the panel', /Banned: zz_tester_two/.test(await devU.p.evaluate(() => document.body.innerText)));
  await pl.p.reload(); const bs = await pl.p.waitForSelector('#banned-screen', { timeout: 15000 }).then(() => true, () => false);
  check("banned player's portal: 'You are banned', no games", bs && !(await pl.p.$('.game-card')) && /You are banned/.test(await pl.p.innerText('body')));
  const g = await pl.c.newPage(); await g.goto(BASE + 'play/?game=giant-rainbow-obby');
  const gb = await g.waitForSelector('#banned-screen', { timeout: 20000 }).then(() => true, () => false);
  check("banned player's game load: 'You are banned', no game/chat/mp", gb && !(await g.evaluate(() => !!window.iceberg?.mp)) && !(await g.$('#start-btn')));
  await devU.p.fill('#ban-username', 'zz_tester_two'); await devU.p.click('#unban-btn'); await devU.p.waitForTimeout(800);
  check('dev unbans via the panel', /Unbanned/.test(await devU.p.evaluate(() => document.body.innerText)));
  await pl.p.reload(); await pl.p.waitForSelector('.game-card', { timeout: 15000 }).catch(() => {});
  check('unbanned player: portal works again', !(await pl.p.$('#banned-screen')) && !!(await pl.p.$('.game-card')));
} catch (e) { check('run completed', false, e.stack); }
await b.close(); web.close(); await dev.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} ban checks passed`); process.exit(results.every(Boolean) ? 0 : 1);
