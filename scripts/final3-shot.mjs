// Visible (headed) screenshot runner for the final showcase batch. Uses the running dev server.
// node scripts/final3-shot.mjs <jobs.json | inline JSON>   job = { url, out, w, h }
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, existsSync } from 'fs';
import { dirname } from 'path';
const BASE = process.env.BASE || 'http://127.0.0.1:5330';
const arg = process.argv[2]; const jobs = JSON.parse(existsSync(arg) ? readFileSync(arg, 'utf8') : arg);
const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome', args: ['--window-position=0,0', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errs = []; page.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); }); page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
for (const j of jobs) {
  await page.setViewportSize({ width: j.w || 900, height: j.h || 900 });
  await page.goto(BASE + j.url); await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.waitForTimeout(j.wait || 150);
  mkdirSync(dirname(j.out), { recursive: true }); await page.screenshot({ path: j.out });
  console.log('shot', j.out);
}
if (errs.length) console.log('ERRORS', errs.slice(0, 10));
if (!process.env.KEEP) await browser.close(); else console.log('browser left open');
