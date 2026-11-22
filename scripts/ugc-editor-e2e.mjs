// UGC Accessory Editor e2e (VISIBLE browser: headless:false on $DISPLAY, e.g. :3).
//   DISPLAY=:3 node scripts/ugc-editor-e2e.mjs [http://127.0.0.1:5197/]
// Guest mode (no Supabase env) => drafts + published creations use the localStorage fallback.
import { chromium } from 'playwright';
const URL_ = process.argv[2] || 'http://127.0.0.1:5197/';
const OUT = new URL('../screenshots/ugc/', import.meta.url).pathname;
const shot = (page, name) => page.screenshot({ path: OUT + name + '.png' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ headless: false, slowMo: 40, args: ['--window-size=1440,900', '--window-position=0,0'] });
const errs = []; const ok = {};
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
await ctx.addInitScript(() => { if (!localStorage.getItem('iceberg:v1:deviceMode')) localStorage.setItem('iceberg:v1:deviceMode', 'computer'); });
const page = await ctx.newPage();
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(URL_); await page.waitForFunction(() => window.iceberg);
await page.click('#start-btn'); await wait(600);
await page.evaluate(() => { window.iceberg.economy.demoGrant(5000); });

// 1) empty state
await wait(3200); await page.click('#ugc-open-btn'); await page.waitForSelector('.ugc-start'); await wait(500);
await shot(page, '01-editor-empty-state');
ok.emptyState = await page.locator('.ugc-tpl').count() === 4;

// 2) hat template -> tweak -> add parts
await page.click('.ugc-tpl[data-template="hat"] .ugc-use-tpl'); await page.waitForSelector('.ugc-shell'); await wait(900);
await page.fill('#ugc-name', 'Frostbyte Topper');
await page.click('.ugc-prim[data-prim="cone"]'); await wait(200);
await page.evaluate(() => { const ed = window.iceberg.ugc; ed._setPart(p => { p.pos = [0, 1.32, 0]; p.scl = [0.22, 0.34, 0.22]; p.c = '#9fd8ff'; p.m = 'ice'; }, { full: true }); });
await page.click('.ugc-prim[data-prim="torus"]'); await wait(200);
await page.evaluate(() => { const ed = window.iceberg.ugc; ed._setPart(p => { p.pos = [0, 1.18, 0]; p.rot = [90, 0, 0]; p.scl = [0.5, 0.5, 0.4]; p.c = '#ffd23f'; p.m = 'metal'; }, { full: true }); });
await page.click('.ugc-prim[data-prim="sphere"]'); await wait(200);
await page.evaluate(() => { const ed = window.iceberg.ugc; ed._setPart(p => { p.pos = [-0.22, 0.82, 0.24]; p.scl = [0.14, 0.14, 0.14]; p.c = '#ff8fb8'; p.m = 'glow'; }, { full: true }); });
await page.click('.ugc-part[data-part="1"]'); await wait(300);
await shot(page, '02-hat-built-on-avatar');
ok.hatParts = await page.evaluate(() => window.iceberg.ugc.spec.parts.length);

// 3) material presets: one part per material, inspector showing chips
await page.evaluate(() => {
  const ed = window.iceberg.ugc, mats = ['matte', 'glossy', 'metal', 'ice', 'glow'];
  ed._load({ name: 'Material Sampler', spec: { v: 1, template: 'hat', slot: 'hat', parts: mats.map((m, i) => ({ p: 'sphere', pos: [-0.52 + i * 0.26, 0.86, 0.12], rot: [0, 0, 0], scl: [0.25, 0.25, 0.25], c: ['#3f9de0', '#d83a3f', '#ffd23f', '#9fd8ff', '#5fd6a0'][i], m })) } });
  ed.select(3);
});
await wait(800);
await shot(page, '03-material-presets');
ok.materials = await page.locator('.ugc-mat').count() === 5;

// back to the hat (re-open the saved state by rebuilding it)
await page.evaluate(() => {
  const ed = window.iceberg.ugc;
  ed._load({ name: 'Frostbyte Topper', spec: { v: 1, template: 'hat', slot: 'hat', parts: [
    { p: 'cylinder', pos: [0, 0.64, 0], rot: [0, 0, 0], scl: [1.0, 0.05, 1.0], c: '#26324a', m: 'glossy' },
    { p: 'cylinder', pos: [0, 0.92, 0], rot: [0, 0, 0], scl: [0.62, 0.52, 0.62], c: '#26324a', m: 'glossy' },
    { p: 'cylinder', pos: [0, 0.73, 0], rot: [0, 0, 0], scl: [0.64, 0.1, 0.64], c: '#6cc8ff', m: 'glow' },
    { p: 'cone', pos: [0, 1.36, 0], rot: [0, 0, 0], scl: [0.22, 0.34, 0.22], c: '#9fd8ff', m: 'ice' },
    { p: 'torus', pos: [0, 1.19, 0], rot: [90, 0, 0], scl: [0.5, 0.5, 0.4], c: '#ffd23f', m: 'metal' },
    { p: 'sphere', pos: [0.22, 0.82, 0.24], rot: [0, 0, 0], scl: [0.14, 0.14, 0.14], c: '#e9f7ff', m: 'ice' },
  ] } });
});
await wait(500);
// 4) body type switch
for (const b of ['glacier', 'pip', 'yeti']) { await page.click(`.ugc-body[data-body="${b}"]`); await wait(500); }
await wait(800);
await shot(page, '04-body-type-yeti');
await page.click('.ugc-body[data-body="glacier"]'); await wait(700);
await shot(page, '04b-body-type-glacier');
await page.click('.ugc-body[data-body="classic"]'); await wait(300);

// 5) save draft (local fallback) + publish dialog
await page.click('#ugc-save'); await wait(500);
ok.draftSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('iceberg:v1:ugcDrafts') || '[]').length);
await page.click('#ugc-publish'); await page.waitForSelector('#ugc-publish-dialog'); await wait(400);
await page.fill('#ugc-price', '150'); await page.dispatchEvent('#ugc-price', 'input'); await wait(200);
await shot(page, '05-publish-dialog');
// validation: bad name blocks publish
await page.fill('#ugc-pub-name', 'x'); await wait(200);
ok.validation = await page.locator('.ugc-errs li').count() > 0;
await page.fill('#ugc-pub-name', 'Frostbyte Topper'); await wait(200);
await page.click('#ugc-pub-go'); await page.waitForSelector('.ugc-done'); await wait(400);
await shot(page, '05b-published');
ok.ownedAfterPublish = await page.evaluate(() => { const id = Object.keys(window.iceberg.economy.profile.owned).length && window.iceberg.economy.profile.owned.find(x => x.startsWith('ugc_')); return id || null; });

// 6) catalog creations
await page.click('#ugc-view-catalog'); await wait(600);
await shot(page, '06-catalog-creations');
ok.catalogCards = await page.locator('.card.ugc-card').count();

// 7) wear it: buy-as-other path is guest-local; owner equips free
await page.locator('.card.ugc-card .btn.equip').first().click(); await wait(400);
await page.click('#drawer-close').catch(() => {});
await page.evaluate(() => window.iceberg.play('frost-fields')); await wait(3500);
await page.keyboard.press('KeyL'); await wait(800);
await shot(page, '07-worn-in-game-locker');
ok.wornInGame = await page.evaluate(() => Object.values(window.iceberg.avatar.attached).some(o => String(o.userData.cosmeticId).startsWith('ugc_')));
await page.keyboard.press('Escape'); await wait(300);
await page.evaluate(() => { const c = window.iceberg.engine; c.cameraYaw = (c.cameraYaw || 0); });
await wait(600);
await shot(page, '07b-worn-in-game');

// 8) buy someone else's creation (guest local purchase) — simulate another creator's published item
ok.buy = await page.evaluate(async () => {
  const { registerUgcItems } = await import('/src/ugc/store.js');
  registerUgcItems([{ id: 'ugc_testother01', name: 'Snow Pal', slot: 'neck', price: 150, creator: 'PenguinPete', spec: { v: 1, template: 'shoulder', slot: 'neck', parts: [{ p: 'sphere', pos: [0.36, 0.7, 0], rot: [0, 0, 0], scl: [0.26, 0.26, 0.26], c: '#ffffff', m: 'matte' }] } }]);
  const e = window.iceberg.economy, before = e.coins;
  const { buyUgc } = await import('/src/ugc/store.js');
  const r = await buyUgc(e, (await import('/src/data/cosmetics.js')).COSMETIC_BY_ID.ugc_testother01);
  return { ok: r.ok, spent: before - e.coins, owns: e.owns('ugc_testother01') };
});

// 9) reload: published + equipped survive (localStorage)
await page.reload(); await page.waitForFunction(() => window.iceberg); await wait(800);
ok.afterReload = await page.evaluate(() => ({ equipped: window.iceberg.economy.profile.equipped.hat, attached: Object.values(window.iceberg.avatar.attached).some(o => String(o.userData.cosmeticId).startsWith('ugc_')) }));

// 10) phone viewport: editor entry hidden + open() refuses
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
await phone.addInitScript(() => localStorage.setItem('iceberg:v1:deviceMode', 'mobile'));
const pp = await phone.newPage(); pp.on('pageerror', e => errs.push('phone: ' + e.message));
await pp.goto(URL_); await pp.waitForFunction(() => window.iceberg);
await pp.click('#start-btn'); await wait(4200);
await pp.screenshot({ path: OUT + '08a-phone-lobby-no-editor-button.png' });
ok.phoneButtonHidden = (await pp.locator('#ugc-open-btn').count()) === 0;
ok.phoneOpenRefused = (await pp.evaluate(() => window.iceberg.ugc.open())) === false;
await pp.evaluate(() => { window.iceberg.ui.shopCat = 'ugc'; window.iceberg.ui.openDrawer('shop'); }); await wait(3600);
ok.phoneCreateBtnHidden = (await pp.locator('#ugc-create-btn').count()) === 0;
await pp.screenshot({ path: OUT + '08b-phone-catalog-create-hidden.png' });
await phone.close();

console.log(JSON.stringify({ ok, errs }, null, 1));
await wait(1500);
await browser.close();
