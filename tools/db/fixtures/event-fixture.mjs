// Test fixture for the Natural Disasters event, shaped exactly like the files Game Maker and
// Cosmetics will add (until their branches land). Used by tools/db/test-db.mjs and the e2e test.
export const ND_GAME_ID = 'natural-disaster-survival';
export const EVENT_COSMETICS = [   // src/data/cosmetics.js entries (Cosmetics): shape of cosmetics/natural-disasters f2190b4: earnOnly + unlock=<questId>
  { id: 'tornado_hat', name: 'Tornado Hat', slot: 'hat', price: 0, earnOnly: true, unlock: 'nd_quest_disaster_survival' },
  { id: 'blizzard_hat', name: 'Blizzard Hat', slot: 'hat', price: 0, earnOnly: true, unlock: 'nd_quest_frost_fields' },
  { id: 'lightning_back', name: 'Lightning Bolt Back', slot: 'back', price: 0, earnOnly: true, unlock: 'nd_quest_giant_obby' },
  { id: 'meteor_pet', name: 'Meteor Pet', slot: 'neck', price: 0, earnOnly: true, unlock: 'nd_quest_birg_hq' },
];
// src/games/naturalDisasters/config.js (Game Maker)
export const GEAR_PRICES_BB = { greenBalloon: 150 };
export const CONSUMABLE_PRICES_BB = { apple: 10, biggerStorm: 25 };
// src/games/naturalDisasters/quests.js (Game Maker)
export const QUESTS = [
  { id: 'nd_quest_disaster_survival', gameId: ND_GAME_ID, title: 'Survive 5 disasters', goal: 5, rewardItemId: 'tornado_hat',
    eventId: 'natural-disasters', startsAt: '2026-10-01T00:00:00Z', endsAt: '2099-01-01T00:00:00Z', maxPerCall: 1, minIntervalMs: 2000, maxPerHour: 30 },
  { id: 'nd_quest_frost_fields', gameId: 'frost-fields', title: 'Collect 20 snowflakes in Frost Fields', goal: 20, rewardItemId: 'blizzard_hat',
    eventId: 'natural-disasters', startsAt: '2026-10-01T00:00:00Z', endsAt: '2099-01-01T00:00:00Z', maxPerCall: 5, minIntervalMs: 1000, maxPerHour: 40 },
  { id: 'nd_quest_giant_obby', gameId: 'giant-rainbow-obby', title: 'Reach stage 50 in Giant Rainbow Obby', goal: 50, rewardItemId: 'lightning_back',
    eventId: 'natural-disasters', startsAt: '2026-10-01T00:00:00Z', endsAt: '2099-01-01T00:00:00Z', maxPerCall: 10, minIntervalMs: 0, maxPerHour: 200 },
  { id: 'nd_quest_birg_hq', gameId: 'birg-hq', title: 'Warm up by the BIRG HQ fire 3 times', goal: 3, rewardItemId: 'meteor_pet',
    eventId: 'natural-disasters', startsAt: '2026-10-01T00:00:00Z', endsAt: '2099-01-01T00:00:00Z' },
];
/** sync-catalog sources with the event fixture merged in */
export function withEvent(src) {
  return {
    ...src,
    items: [...src.items.filter(c => !EVENT_COSMETICS.some(e => e.id === c.id)), ...EVENT_COSMETICS],
    games: src.games.some(g => g.id === ND_GAME_ID) ? src.games : [...src.games, { id: ND_GAME_ID, publishedAt: '2026-10-18T00:00:00Z', active: true, from: 'fixture' }],
    gears: [...src.gears.filter(g => g.gameId !== ND_GAME_ID), ...Object.entries(GEAR_PRICES_BB).map(([gearId, price]) => ({ gameId: ND_GAME_ID, gearId, price, from: 'fixture' }))],
    consumables: [...(src.consumables || []).filter(c => c.gameId !== ND_GAME_ID), ...Object.entries(CONSUMABLE_PRICES_BB).map(([itemId, price]) => ({ gameId: ND_GAME_ID, itemId, price, from: 'fixture' }))],
    quests: [...(src.quests || []).filter(x => !QUESTS.some(y => y.id === x.id)), ...QUESTS.map(x => ({ ...x, from: 'fixture' }))],
  };
}
