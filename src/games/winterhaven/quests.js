// Winterhaven event quests (read by the Publisher's quest catalog; the server grants each cosmetic once per account).
// Ids/titles/items match the Publisher's stub (bw-tornado docs/winterhaven-quests.stub.js) and Cosmetics (cosmetics/winterhaven).
// gameId comes from ./config.js GAME_ID. Every quest has goal 1: the turn-in (or the Frostgate Run finish) reports it.
const base = { gameId: 'winterhaven', event: 'winterhaven', goal: 1, maxPerCall: 1, minIntervalMs: 1000, maxPerHour: 30 };
export const QUESTS = [
  { ...base, id: 'wh_quest_lantern', title: 'Light the Lanterns', description: 'Find the lantern spark on Lantern Lane for Lamp Lumen.', rewardItemId: 'wh_lantern_hat', rewardName: 'Lantern Hat', rarity: 'rare' },
  { ...base, id: 'wh_quest_skate', title: 'Skate the Lake', description: 'Collect the frost crystal on the Mirrorfrost Lake shore for Skate Sela.', rewardItemId: 'wh_aurora_scarf', rewardName: 'Aurora Scarf', rarity: 'epic' },
  { ...base, id: 'wh_quest_pine', title: 'Pine Grove', description: 'Find the glowing pinecone deep in Whispering Pines for Ranger Ash.', rewardItemId: 'wh_pine_cloak', rewardName: 'Pine Cloak', rarity: 'rare' },
  { ...base, id: 'wh_quest_cave', title: 'Crystal Cave', description: 'Bring a crystal from Glimmer Cave to Shard the miner.', rewardItemId: 'wh_crystal_pet', rewardName: 'Crystal Sprite', rarity: 'epic' },
  { ...base, id: 'wh_quest_castle', title: 'Frostspire Castle', description: 'Climb Frostspire Hill and recover the banner from the castle courtyard for Steward Vale.', rewardItemId: 'wh_frostspire_crown', rewardName: 'Frostspire Crown', rarity: 'legendary' },
  { ...base, id: 'wh_quest_frostgate', title: 'The Frostgate', description: 'Step through the Frostgate arch and finish the ice gate race once.', rewardItemId: 'wh_blizzard_back', rewardName: 'Frostgate Blizzard', rarity: 'epic' },
  { ...base, id: 'wh_quest_snowman', title: 'Build a Snowman', description: 'Find a carrot nose by the market for Puff\'s snowman.', rewardItemId: 'wh_carrot_nose', rewardName: 'Snowman Carrot Nose', rarity: 'rare' },
  { ...base, id: 'wh_quest_bridge', title: 'Cross the Bridge', description: 'Fetch the toll bell from the west ice bridge for Bridge Bryn.', rewardItemId: 'wh_bridge_badge', rewardName: 'Ice Bridge Medal', rarity: 'rare' },
  { ...base, id: 'wh_quest_carol', title: 'Sing a Carol', description: 'Recover the carol song sheet from Lantern Lane for Crier Bole.', rewardItemId: 'wh_carol_bells', rewardName: 'Carol Handbell', rarity: 'epic' },
  { ...base, id: 'wh_quest_pass', title: 'The Mountain Pass', description: 'Climb to the top of Frostbite Pass and bring back the summit snowflake for Guide Tor.', rewardItemId: 'wh_pass_goggles', rewardName: 'Frostbite Pass Glacier Goggles', rarity: 'epic' },
  { ...base, id: 'wh_quest_outskirts', title: 'The Outskirts', description: 'Find Noll\'s snowball sack on the outskirts slope.', rewardItemId: 'wh_snowball_sack', rewardName: 'Snowball Sack', rarity: 'rare' },
  { ...base, id: 'wh_quest_baker', title: 'Help the Baker', description: 'Bring the ice sugar from the Hearth Inn to Oven Mira.', rewardItemId: 'wh_baker_hat', rewardName: 'Gingerbread Baker Hat', rarity: 'rare' },
  { ...base, id: 'wh_quest_fisher', title: 'Ice Fishing', description: 'Find Glint Hook\'s lucky lure by the east shore of the lake.', rewardItemId: 'wh_fishing_lure', rewardName: 'Ice Fishing Rod', rarity: 'rare' },
  { ...base, id: 'wh_quest_courier', title: 'Snow Courier', description: 'Pick up Fern\'s parcel on the outskirts for Courier Swift.', rewardItemId: 'wh_parcel_satchel', rewardName: 'Courier Parcel Satchel', rarity: 'epic' },
  { ...base, id: 'wh_quest_ranger', title: 'Forest Ranger', description: 'Find Ranger Ash\'s trail map on the south-east pines loop.', rewardItemId: 'wh_ranger_badge', rewardName: 'Pine Ranger Badge', rarity: 'epic' },
  { ...base, id: 'wh_quest_pup', title: 'Find the Wolf Pup', description: 'Find Nimbus\'s snowball toy by the big tree in Town Square.', rewardItemId: 'wh_wolf_pup_pal', rewardName: 'Wolf Pup Pal', rarity: 'legendary' },
];
