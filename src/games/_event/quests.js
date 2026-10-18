// Natural Disasters event quests for the two single-file games (BIRG HQ, Frost Fields).
// Declarations only, read by the Publisher's quest catalog. Hooks live in hooks.js.
export const QUESTS = [
  { id: 'nd_quest_frost_fields', gameId: 'frost-fields', title: 'Blizzard Shelter', description: 'Place 30 blocks to build a storm shelter.', goal: 30, event: 'natural_disasters', reward: 'blizzard_hat', rewardName: 'Blizzard Hat', maxPerMinute: 12 },
  { id: 'nd_quest_birg_hq', gameId: 'birg-hq', title: 'Fallen Star', description: 'Find the 5 frozen meteor shards hidden in the cabin.', goal: 5, event: 'natural_disasters', reward: 'meteor_pet', rewardName: 'Frozen Meteor Pet', maxPerMinute: 10 },
];
