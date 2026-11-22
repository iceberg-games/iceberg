// Quick create/save/wear screenshots for designs/ugc-polish/ (visible browser).
//   DISPLAY=:4 node scripts/ugc-polish-shots.mjs http://127.0.0.1:5199/
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const URL_ = process.argv[2] || 'http://127.0.0.1:5199/';
const OUT = new URL('../designs/ugc-polish/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: false, slowMo: 30, args: ['--window-size=1440,900', '--window-position=40,40'] });
const errs = []; const ok = {};
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
await ctx.addInitScript(() => { if (!localStorage.getItem('iceberg:v1:deviceMode')) localStorage.setItem('iceberg:v1:deviceMode', 'computer'); });
const page = await ctx.newPage();
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(URL_, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.iceberg, { timeout: 30000 });
await page.click('#start-btn');
await page.waitForSelector('#pc-home #ugc-open-btn', { timeout: 20000 });
await wait(800);
await page.screenshot({ path: OUT + '01-pc-home-accessory-entry.png' });
ok.homeButton = (await page.locator('#ugc-open-btn').count()) === 1;

await page.click('#ugc-open-btn');
await page.waitForSelector('.ugc-start', { timeout: 15000 });
await wait(400);
ok.emptyState = await page.locator('.ugc-tpl').count() >= 4;

await page.click('.ugc-tpl[data-template="hat"] .ugc-use-tpl');
await page.waitForSelector('.ugc-shell');
await page.fill('#ugc-name', 'Frostbyte Topper');
await wait(900);
await page.screenshot({ path: OUT + '02-editor-hat-on-classic.png' });
ok.hatParts = await page.evaluate(() => window.iceberg.ugc.spec.parts.length);
ok.bodyClassic = await page.evaluate(() => window.iceberg.ugc.bodyType === 'classic');

await page.click('#ugc-save');
await wait(400);
ok.draftSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('iceberg:v1:ugcDrafts') || '[]').length);

await page.click('#ugc-publish');
await page.waitForSelector('#ugc-publish-dialog');
await page.fill('#ugc-pub-name', 'Frostbyte Topper');
await page.fill('#ugc-price', '150');
await page.dispatchEvent('#ugc-price', 'input');
await wait(200);
await page.click('#ugc-pub-go');
await page.waitForSelector('.ugc-done', { timeout: 15000 });
await page.click('#ugc-wear');
await wait(300);
await page.click('#ugc-view-catalog').catch(async () => {
  await page.evaluate(() => { window.iceberg.ugc.close(); window.iceberg.ui.shopCat = 'ugc'; });
});
await wait(500);
await page.keyboard.press('Escape').catch(() => {});
await page.evaluate(() => { document.querySelector('#drawer-close')?.click(); window.iceberg.ugc?.close(); });
await wait(800);
// back on home: avatar should be wearing the hat
ok.equippedHat = await page.evaluate(() => window.iceberg.economy.profile.equipped?.hat?.startsWith('ugc_') || false);
ok.attached = await page.evaluate(() => Object.values(window.iceberg.avatar.attached || {}).some(o => String(o.userData?.cosmeticId || '').startsWith('ugc_')));
await page.waitForSelector('#pc-home', { timeout: 10000 }).catch(() => {});
// if catalog drawer covered home, close it and show games
await page.evaluate(() => { window.iceberg.ui?.closeDrawer?.(); window.iceberg.menu?.showGames?.(); });
await wait(1000);
await page.screenshot({ path: OUT + '03-worn-on-home-avatar.png' });
ok.homeVisible = await page.locator('#pc-home').count() > 0;

console.log(JSON.stringify({ ok, errs: errs.slice(0, 20), errCount: errs.length }, null, 2));
const failed = !ok.homeButton || !ok.emptyState || !ok.hatParts || !ok.draftSaved || !ok.equippedHat;
await wait(400);
await browser.close();
process.exit(failed ? 1 : 0);
