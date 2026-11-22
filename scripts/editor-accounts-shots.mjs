#!/usr/bin/env node
// Headless screenshots + checks for the editor-accounts first drop.
// Saves to designs/editor-accounts/ at 1440x900 (PC) and 390x844 (phone).
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'designs/editor-accounts');
mkdirSync(OUT, { recursive: true });

const portFree = (port) => new Promise((ok) => { const s = createServer().once('error', () => ok(false)).once('listening', () => s.close(() => ok(true))).listen(port); });
const freePort = async (n) => { for (let i = 0; i < 30; i++) { const p = n + i; if (await portFree(p)) return p; } throw new Error('no free port near ' + n); };

const results = [];
const check = (name, ok, extra = '') => { results.push([ok ? 'PASS' : 'FAIL', name, extra]); console.log(ok ? '  PASS' : '  FAIL', name, extra); };

const API = await freePort(55421);
const WEB = await freePort(8821);
const TMP = `/tmp/iceberg-editor-accounts-${process.pid}`;
const { startDevServer, serveStatic, ANON_KEY } = await import(resolve(ROOT, 'tools/db/dev-server.mjs'));

const build = spawnSync('node', ['scripts/build-site.mjs', '--out', TMP], {
  cwd: ROOT, encoding: 'utf8',
  env: { ...process.env, VITE_SUPABASE_URL: `http://localhost:${API}`, VITE_SUPABASE_ANON_KEY: ANON_KEY, VITE_USERNAME_EMAIL_DOMAIN: 'users.iceberg.test' },
});
check('build site', build.status === 0, (build.stdout + build.stderr).split('\n').slice(-8).join('\n'));
if (build.status !== 0) { for (const r of results) console.log(...r); process.exit(1); }

const dev = await startDevServer({ port: API, quiet: true });
const web = await serveStatic(TMP, WEB, { prefix: '/' });
const BASE = `http://localhost:${WEB}/`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const shot = async (page, name) => { await page.screenshot({ path: resolve(OUT, name), fullPage: true }); };

const fillSignUp = async (page, { username, password, display, dob }) => {
  await page.waitForSelector('#form-signup', { timeout: 20000 });
  await page.fill('#form-signup input[name=username]', username);
  await page.fill('#form-signup input[name=password]', password);
  if (display) await page.fill('#form-signup input[name=display]', display);
  await page.fill('#form-signup input[name=dob]', dob);
  await page.click('#form-signup button[type=submit]');
  await page.waitForSelector('#p-user', { timeout: 20000 });
};

try {
  // PC: required gate
  const pc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await pc.newPage();
  await p.goto(BASE);
  await p.waitForSelector('#form-signup');
  check('PC: games hidden until signed in', !(await p.$('#view-games .game-card')));
  check('PC: sign-up asks for date of birth', !!(await p.$('#form-signup input[name=dob]')));
  await shot(p, 'pc-1440x900-gate.png');

  // invalid DOB
  await p.fill('#form-signup input[name=username]', 'nope_user');
  await p.fill('#form-signup input[name=password]', 'password1');
  await p.fill('#form-signup input[name=dob]', '');
  await p.click('#form-signup button[type=submit]');
  const dobErr = await p.$eval('#form-signup .p-error', e => e.textContent).catch(() => '');
  check('PC: empty date of birth is rejected', /date of birth|valid date|Enter your/i.test(dobErr) || (await p.$('#form-signup input[name=dob]:invalid')) !== null, dobErr);

  await fillSignUp(p, { username: 'goober_test', password: 'snowball123', display: 'Goober', dob: '2001-04-15' });
  check('PC: signed in after sign-up', /goober_test/.test(await p.textContent('#p-user')));
  await p.waitForSelector('#view-games .game-card');
  await shot(p, 'pc-1440x900-home-after-signin.png');

  await p.click('.p-tab[data-view="settings"]');
  await p.waitForSelector('#settings-account');
  check('PC: Settings > Account has date of birth, deactivate, delete',
    !!(await p.$('#settings-account input[name=dob]')) && !!(await p.$('#deactivate-account')) && !!(await p.$('#delete-account')));
  check('PC: Settings > Security & Privacy is present', !!(await p.$('#settings-security')));
  await p.waitForSelector('#session-list .ib-session');
  const badge = await p.$eval('#session-list .ib-session[data-current="1"] .ib-badge', e => e.textContent).catch(() => '');
  check('PC: active sessions lists this device', badge.includes('This device'), badge);
  await shot(p, 'pc-1440x900-settings-account-security.png');

  // Change DOB
  await p.fill('#settings-account input[name=dob]', '1998-12-01');
  await p.click('#settings-account button:has-text("Save date of birth")');
  await p.waitForFunction(() => /saved/i.test(document.querySelector('#account-dob-msg')?.textContent || ''));
  check('PC: date of birth can be changed', /saved/i.test(await p.textContent('#account-dob-msg')));

  // Delete confirm dialog
  await p.click('#delete-account');
  await p.waitForSelector('#delete-username');
  await shot(p, 'pc-1440x900-delete-confirm.png');
  await p.click('.ib-modal button:has-text("Cancel")');
  await p.waitForSelector('#delete-username', { state: 'detached' });

  // Deactivate confirm + complete (reversible)
  await p.click('#deactivate-account');
  await p.waitForSelector('.ib-confirm, .ib-modal');
  await shot(p, 'pc-1440x900-deactivate-confirm.png');
  await p.click('.ib-modal button:has-text("Deactivate")');
  await p.waitForSelector('#form-signin', { timeout: 15000 });
  check('PC: deactivate hides the profile and signs out', !!(await p.$('#form-signin')) && !(await p.$('#p-user')));

  // Sign back in (reactivates)
  await p.fill('#form-signin input[name=username]', 'goober_test');
  await p.fill('#form-signin input[name=password]', 'snowball123');
  await p.click('#form-signin button[type=submit]');
  await p.waitForSelector('#p-user', { timeout: 15000 });
  check('PC: signing in again reactivates the account', /goober_test/.test(await p.textContent('#p-user')));

  // Phone viewport, same session in a fresh context must sign in
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const m = await phone.newPage();
  await m.goto(BASE);
  await m.waitForSelector('#form-signup');
  check('phone: games hidden until signed in', !(await m.$('#view-games .game-card')));
  await shot(m, 'phone-390x844-gate.png');
  await fillSignUp(m, { username: 'phone_pal', password: 'iglooigloo', display: 'Phone', dob: '2000-06-20' });
  await m.click('.p-tab[data-view="settings"]');
  await m.waitForSelector('#settings-account');
  await m.waitForSelector('#settings-security');
  check('phone: Account and Security settings render', !!(await m.$('#deactivate-account')) && !!(await m.$('#form-change-password')));
  await shot(m, 'phone-390x844-settings-account-security.png');

  // Play page gate (signed-out)
  const playCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const play = await playCtx.newPage();
  await play.goto(BASE + 'play/?game=frost-fields');
  await play.waitForSelector('#form-signup, #auth-gate', { timeout: 20000 });
  check('play: signed-out play page shows the sign-in gate, not the game', !(await play.$('#start-btn')) && !!(await play.$('#form-signup')));
  await shot(play, 'pc-1440x900-play-gate.png');
  await playCtx.close();
  await phone.close();
  await pc.close();
} catch (e) {
  check('editor-accounts shots: unexpected error', false, e.stack || e.message);
} finally {
  await browser.close();
  web.close();
  await dev.close();
}

const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} editor-accounts checks passed`);
console.log('screenshots in', OUT);
if (existsSync(resolve(OUT, 'pc-1440x900-gate.png'))) console.log('files:', ['pc-1440x900-gate.png', 'pc-1440x900-home-after-signin.png', 'pc-1440x900-settings-account-security.png', 'pc-1440x900-delete-confirm.png', 'pc-1440x900-deactivate-confirm.png', 'phone-390x844-gate.png', 'phone-390x844-settings-account-security.png', 'pc-1440x900-play-gate.png'].join(', '));
process.exit(failed ? 1 : 0);
