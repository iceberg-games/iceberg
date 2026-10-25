// Natural Disasters event quests for the two single-file games (BIRG HQ, Frost Fields).
// Declarations only, read by the Publisher's quest catalog. Hooks live in hooks.js.
export const QUESTS = [
  { id: 'nd_quest_frost_fields', endsAt: '2026-10-25T08:21:40Z', startsAt: '2026-10-18T08:21:40Z', gameId: 'frost-fields', title: 'Blizzard Shelter', description: 'Place 30 blocks to build a storm shelter.', goal: 30, event: 'natural_disasters', rewardItemId: 'blizzard_hat', rewardName: 'Blizzard Cloud', maxPerCall: 10, minIntervalMs: 3000, maxPerHour: 600 },
  { id: 'nd_quest_birg_hq', endsAt: '2026-10-25T08:21:40Z', startsAt: '2026-10-18T08:21:40Z', gameId: 'birg-hq', title: 'Fallen Star', description: 'Find the 5 frozen meteor shards hidden in the cabin.', goal: 5, event: 'natural_disasters', rewardItemId: 'meteor_pet', rewardName: 'Frozen Meteor Pet', maxPerCall: 1, minIntervalMs: 2000, maxPerHour: 60 },
];
