// Natural Disasters event cosmetics in the built game: shop badges (no Buy), buy() refused,
// quest progress/Claim UI via a stubbed getQuests/claimQuestReward, locker colors after a (test-only) grant.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/natural-disasters', { recursive: true });
const IDS = ['tornado_hat', 'lightning_back', 'meteor_pet', 'blizzard_hat'];
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { try { localStorage.setItem('iceberg.device', 'computer'); } catch {} });
await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForFunction(() => window.iceberg);
// Release A hides/refuses event items until natural_disasters starts: move only the event window to "live".
await p.evaluate(() => { const b = window.iceberg.economy.backend; if (!b?.eventStatus) return; const real = b.eventStatus.bind(b), H = 3600e3;
  b.eventStatus = (id, now = Date.now()) => ({ ...real(id, now), startsAt: new Date(now - 24 * H).toISOString(), endsAt: new Date(now + 6 * 24 * H).toISOString(), active: true }); });

const out = {};
out.buy = await p.evaluate((ids) => { const e = window.iceberg.economy; e.demoGrant(5000); const before = e.coins; return { results: ids.map(id => e.buy(id)), coinsUnchanged: e.coins === before, ownedNone: ids.every(id => !e.owns(id)) }; }, IDS);
await p.evaluate(() => window.iceberg.play('frost-fields')); await p.waitForTimeout(1500);
await p.evaluate(() => { const ui = window.iceberg.ui; ui.shopCat = 'all'; ui.openDrawer('shop'); });
await p.waitForTimeout(300);
out.shopCards = await p.evaluate((ids) => ids.map(id => { const c = document.querySelector(`.card[data-id="${id}"]`); return { id, buyBtn: !!c?.querySelector('button.buy'), badge: c?.querySelector('.earn-badge')?.innerText.replace(/\s+/g, ' ') }; }), IDS);
await p.locator(`.card[data-id="tornado_hat"]`).scrollIntoViewIfNeeded();
await p.screenshot({ path: 'screenshots/natural-disasters/shop-badges.png' });
// Stub Publisher's quest API (test only) to exercise progress + Claim UI.
out.quests = await p.evaluate(async () => {
  const e = window.iceberg.economy, ui = window.iceberg.ui;
  const quests = [
    { id: 'nd_quest_disaster_survival', gameId: 'nds', title: 'Survive 5 disasters', goal: 5, progress: 2, completed: false, claimed: false, reward: 'tornado_hat' },
    { id: 'nd_quest_frost_fields', gameId: 'frost-fields', title: 'Weather the Frost Fields blizzard', goal: 1, progress: 1, completed: true, claimed: false, reward: 'blizzard_hat' },
  ];
  e.getQuests = () => quests;
  e.claimQuestReward = async (qid) => { const q = quests.find(x => x.id === qid); q.claimed = true; e.profile.owned.push(q.reward); window.dispatchEvent(new Event('x')); window.__claimed = qid; return { granted: true, itemId: q.reward, alreadyOwned: false }; };
  ui.refreshDrawer(); await new Promise(r => setTimeout(r, 100));
  const tor = document.querySelector('.card[data-id="tornado_hat"] .earn-badge')?.innerText.replace(/\s+/g, ' ');
  const claimBtn = document.querySelector('.card[data-id="blizzard_hat"] button.claim');
  const claimText = claimBtn?.innerText; claimBtn?.click(); await new Promise(r => setTimeout(r, 200));
  return { tornadoBadge: tor, claimText, claimed: window.__claimed, ownsBlizzard: e.owns('blizzard_hat') };
});
await p.screenshot({ path: 'screenshots/natural-disasters/shop-quests.png' });
// Test-only grant of the rest (simulates the server grant), then equip + locker presets.
out.locker = await p.evaluate(async (ids) => {
  const e = window.iceberg.economy; delete e.getQuests; delete e.claimQuestReward;
  for (const id of ids) if (!e.owns(id)) e.profile.owned.push(id);
  for (const id of ids) e.equip(id);
  return ids.map(id => e.isEquipped(id));
}, IDS);
await p.keyboard.press('KeyL'); await p.waitForTimeout(400);
const res = {};
for (const [id, preset] of [['tornado_hat', 'Aurora'], ['lightning_back', 'Rainbow'], ['meteor_pet', 'Ember Core'], ['blizzard_hat', 'Pink Dusk']]) {
  const sec = p.locator(`.cosmetic-custom[data-id="${id}"]`);
  if (!(await sec.count())) { res[id] = 'no locker section'; continue; }
  await sec.locator('button', { hasText: preset }).click();
  res[id] = await p.evaluate((id) => ({ saved: window.iceberg.economy.profile.cosmeticColors[id], avatar: window.iceberg.avatar.cosmeticColors[id], attached: Object.values(window.iceberg.avatar.attached).some(o => o.userData.cosmeticId === id) }), id);
}
out.lockerColors = res;
await p.keyboard.press('Escape'); await p.waitForTimeout(800);
await p.screenshot({ path: 'screenshots/natural-disasters/in-game-equipped.png' });
console.log(JSON.stringify(out, null, 1)); console.log('errors:', errs);
await b.close();
