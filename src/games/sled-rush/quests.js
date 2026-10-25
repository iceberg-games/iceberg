// Sled Rush quest (read by the Publisher's quest catalog; the server grants the cosmetic once per account).
// Ids match Publisher stub feature/sled-rush-stub @ e9927e7 and Cosmetics catalog @ fa11e40. No event tag.
export const QUESTS = [
  { id: 'sr_quest_finish', gameId: 'sled-rush', goal: 1, maxPerCall: 1, minIntervalMs: 1000, maxPerHour: 30,
    title: 'Powder Run', description: 'Finish a Sled Rush run with 3 stars.', rewardItemId: 'sr_powder_scarf', rewardName: 'Powder Scarf', rarity: 'epic', slot: 'neck' },
];
