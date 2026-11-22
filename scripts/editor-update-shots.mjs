// Screenshots + checks for the Editor Update PC home. Usage: node scripts/editor-update-shots.mjs [baseUrl]
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://127.0.0.1:5216/';
const OUT = new URL('../designs/editor-update/', import.meta.url).pathname;
let fails = 0; const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); if (!c) fails++; };
const b = await chromium.launch();
const mkThumb = (c1, c2, t) => { const s = `<svg xmlns='http://www.w3.org/2000/svg' width='270' height='270'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='270' height='270' fill='url(%23g)'/><text x='135' y='150' font-size='34' font-family='sans-serif' font-weight='900' fill='white' text-anchor='middle'>${t}</text></svg>`; return 'data:image/svg+xml;utf8,' + s.replace(/#/g, '%23').replace(/%2523/g, '%23'); };
const fake = [['Lava Run', '#ff6b4a', '#f5b13d', 'zed'], ['Sky Obby', '#8b6cf0', '#3ecf9a', 'mira'], ['Maze Mania', '#3ecf9a', '#14131a', 'zed'], ['Tower Tag', '#f5b13d', '#ff6b4a', 'kai'], ['Candy Crush Race', '#ff6b4a', '#8b6cf0', 'mira'], ['Cloud Climb', '#6aa8ff', '#8b6cf0', 'kai']]
  .map(([name, a, c, owner], i) => ({ id: 'g_fake' + i, version: 2, name, description: `${name} by ${owner}`, instances: [], thumbnail: mkThumb(a, c, name.split(' ')[0]), owner: 'u_' + owner, ownerName: owner, publishedAt: Date.now() - i * 3600e3 }));
{ // ---- PC 1440x900
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.click('#start-btn'); await p.waitForSelector('#pc-home');
  ok('PC: pc-home renders', true);
  ok('PC: sidebar order', JSON.stringify(await p.$$eval('.pc-side .pc-lbl', e => e.map(x => x.textContent))) === JSON.stringify(['Home', 'Profile', 'Friends', 'Catalog', 'Inventory', 'Avatar', 'Groups', 'Settings', 'Studio', 'Create', 'Download']));
  ok('PC: hello', /Hello, .+!/.test(await p.textContent('.pc-hello h1')));
  ok('PC: friends empty card', /No friends yet\./.test(await p.textContent('#pc-friends-row')));
  await p.evaluate((f) => { const m = window.iceberg.menu; m.serverGames = f; m.serverError = null; m._serverLoading = true; m.showGames(); }, fake);
  await p.waitForSelector('#community-games .game-card');
  const secs = await p.$$eval('.pc-row-head h2', e => e.map(x => x.textContent));
  ok('PC: community rows above built-ins', secs[0] === 'Popular right now' && secs[1] === 'Recently added' && secs.indexOf('Iceberg games') > 1, secs.join(' | '));
  ok('PC: built-in list = HQ + Frost Fields only', JSON.stringify(await p.$$eval('#games-carousel .game-card', e => e.map(x => x.dataset.game).sort())) === JSON.stringify(['birg-hq', 'frost-fields']));
  ok('PC: no Studio card in list', !(await p.$('.game-card[data-game="creator"]')));
  await p.screenshot({ path: OUT + 'pc-home-1440x900.png' });
  // search
  await p.fill('#pc-search', 'zed');
  ok('search by creator', (await p.$$eval('#search-results .game-card', e => e.map(x => x.dataset.game))).sort().join() === 'g_fake0,g_fake2');
  await p.screenshot({ path: OUT + 'pc-search-zed.png' });
  await p.fill('#pc-search', 'frost');
  ok('search by name (built-in)', (await p.$$eval('#search-results .game-card', e => e.map(x => x.dataset.game))).join() === 'frost-fields');
  await p.fill('#pc-search', 'nothingmatches');
  ok('search no results message', /No games match/.test(await p.textContent('#search-results')));
  await p.fill('#pc-search', '');
  ok('search cleared restores rows', !!(await p.$('#community-games .game-card')));
  // sidebar actions
  await p.click('#nav-catalog'); await p.waitForSelector('#drawer:not(.hidden)'); ok('Catalog opens shop drawer + title', /Catalog/.test(await p.textContent('#drawer h2'))); await p.screenshot({ path: OUT + 'pc-catalog-drawer.png' }); await p.click('#drawer-close');
  await p.click('#nav-groups'); await p.waitForSelector('#group-name');
  await p.fill('#group-name', 'Builders'); await p.click('#group-create'); ok('Groups: create', /Builders/.test(await p.textContent('#groups-list')));
  await p.screenshot({ path: OUT + 'pc-groups.png' });
  await p.click('#nav-home');
  await p.click('#nav-create'); ok('Create opens template picker', !!(await p.waitForSelector('#create-dialog [data-template]', { timeout: 3000 }).catch(() => null)));
  await p.screenshot({ path: OUT + 'pc-create-picker.png' }); await p.click('#create-dialog .btn.secondary');
  await p.click('#nav-download'); await p.waitForSelector('#install-dialog'); await p.screenshot({ path: OUT + 'pc-download.png' }); await p.click('#install-close');
  await p.click('#pc-settings'); await p.waitForSelector('#pc-settings-view'); await p.screenshot({ path: OUT + 'pc-settings.png' }); await p.click('#nav-home');
  // pop-out
  const [pop] = await Promise.all([p.waitForEvent('popup', { timeout: 8000 }).catch(() => null), p.click('#games-carousel .game-card[data-game="frost-fields"]')]);
  ok('tile opens a pop-out window', !!pop);
  if (pop) { await pop.waitForSelector('#game-canvas', { timeout: 15000 }).catch(() => {}); await pop.waitForFunction(() => window.iceberg?.engine?.game, null, { timeout: 15000 }).catch(() => {});
    ok('pop-out boots straight into the game', await pop.evaluate(() => window.iceberg?.engine?.def?.id) === 'frost-fields', pop.url());
    ok('home tab still on home', !!(await p.$('#pc-home')));
    await pop.screenshot({ path: OUT + 'pc-popout-game.png' }); await pop.close(); }
  ok('no page errors (PC)', errs.length === 0, errs.join(' | '));
}
{ // ---- phone 390x844: blocked by the gate
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const p = await c.newPage(); await p.goto(BASE); await p.waitForSelector('#mobile-block', { timeout: 8000 }).catch(() => {});
  ok('phone: shows "Sorry, mobile is being fixed right now."', /Sorry, mobile is being fixed right now\./.test(await p.textContent('body')));
  await p.screenshot({ path: OUT + 'phone-390x844-blocked.png' });
  const p2 = await c.newPage(); await p2.goto(BASE + '?allowMobile=1'); await p2.waitForSelector('#start-btn'); await p2.click('#start-btn'); await p2.waitForSelector('.games-screen');
  ok('phone layout code intact behind the flag (?allowMobile=1)', true); await p2.screenshot({ path: OUT + 'phone-390x844-layout-flag.png' });
}
{ // ---- PC narrow window is NOT blocked
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await p.goto(BASE);
  ok('PC browser in a narrow window is not blocked', !!(await p.waitForSelector('#start-btn', { timeout: 8000 }).catch(() => null)) && !(await p.$('#mobile-block')));
}
await b.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
