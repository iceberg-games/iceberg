// Winterhaven quest declarations (STUB, not read by the catalog sync until moved to src/games/<winterhaven game>/quests.js).
// Move it into Game Maker's game folder after cosmetics/winterhaven is merged (the reward items must be in cosmetics.js, earnOnly).
// Same format as src/games/disasterSurvival/quests.js; one-time grant = claim_quest_reward (server-side, once per player).
export const QUESTS = [
  { id: 'wh_quest_lantern',   gameId: 'winterhaven', title: 'Light the Lanterns', goal: 1, event: 'winterhaven', rewardItemId: 'wh_lantern_hat' },
  { id: 'wh_quest_skate',     gameId: 'winterhaven', title: 'Skate the Lake',     goal: 1, event: 'winterhaven', rewardItemId: 'wh_aurora_scarf' },
  { id: 'wh_quest_pine',      gameId: 'winterhaven', title: 'Pine Grove',         goal: 1, event: 'winterhaven', rewardItemId: 'wh_pine_cloak' },
  { id: 'wh_quest_cave',      gameId: 'winterhaven', title: 'Crystal Cave',       goal: 1, event: 'winterhaven', rewardItemId: 'wh_crystal_pet' },
  { id: 'wh_quest_castle',    gameId: 'winterhaven', title: 'Frostspire Castle',  goal: 1, event: 'winterhaven', rewardItemId: 'wh_frostspire_crown' },
  { id: 'wh_quest_frostgate', gameId: 'winterhaven', title: 'The Frostgate',      goal: 1, event: 'winterhaven', rewardItemId: 'wh_blizzard_back' },
  { id: 'wh_quest_snowman',   gameId: 'winterhaven', title: 'Build a Snowman',    goal: 1, event: 'winterhaven', rewardItemId: 'wh_carrot_nose' },
  { id: 'wh_quest_bridge',    gameId: 'winterhaven', title: 'Cross the Bridge',   goal: 1, event: 'winterhaven', rewardItemId: 'wh_bridge_badge' },
  { id: 'wh_quest_carol',     gameId: 'winterhaven', title: 'Sing a Carol',       goal: 1, event: 'winterhaven', rewardItemId: 'wh_carol_bells' },
  { id: 'wh_quest_pass',      gameId: 'winterhaven', title: 'The Mountain Pass',  goal: 1, event: 'winterhaven', rewardItemId: 'wh_pass_goggles' },
  { id: 'wh_quest_outskirts', gameId: 'winterhaven', title: 'The Outskirts',      goal: 1, event: 'winterhaven', rewardItemId: 'wh_snowball_sack' },
  { id: 'wh_quest_baker',     gameId: 'winterhaven', title: 'Help the Baker',     goal: 1, event: 'winterhaven', rewardItemId: 'wh_baker_hat' },
  { id: 'wh_quest_fisher',    gameId: 'winterhaven', title: 'Ice Fishing',        goal: 1, event: 'winterhaven', rewardItemId: 'wh_fishing_lure' },
  { id: 'wh_quest_courier',   gameId: 'winterhaven', title: 'Snow Courier',       goal: 1, event: 'winterhaven', rewardItemId: 'wh_parcel_satchel' },
  { id: 'wh_quest_ranger',    gameId: 'winterhaven', title: 'Forest Ranger',      goal: 1, event: 'winterhaven', rewardItemId: 'wh_ranger_badge' },
  { id: 'wh_quest_pup',       gameId: 'winterhaven', title: 'Find the Wolf Pup',  goal: 1, event: 'winterhaven', rewardItemId: 'wh_wolf_pup_pal' },
];
