// Game registry. To add a game: create a module exporting a definition
// { id, name, tagline, description, thumbnail, music, create(ctx, params) }
// and add it to BUILTIN_GAMES below. See README "Adding a game".
import frostFields from './frostFields.js';
import birgHQ from './birgHQ.js';
import giantRainbowObby from './giantObby/index.js';
import cornerBakery from './cornerBakery/index.js';
import naturalDisasterSurvival from './disasterSurvival/index.js';
import winterhaven from './winterhaven/index.js';
import starfallLake from './starfallLake/index.js';
import sledRush from './sled-rush/index.js';
import knockoutFloes from './knockoutFloes/index.js';
import lumenTag from './lumenTag/index.js';
import rimebound from './rimebound/index.js';
import { withEventQuest, frostQuest, hqQuest, obbyQuest } from './_event/hooks.js'; // Natural Disasters event quests (remove to end the event)
import { creatorDef, customGameDef } from './customGame.js';
import { backend } from '../backend/LocalBackend.js';

export const BUILTIN_GAMES = [
  withEventQuest(frostFields, ...frostQuest),
  withEventQuest(birgHQ, ...hqQuest),
  withEventQuest(giantRainbowObby, ...obbyQuest),
  cornerBakery,
  naturalDisasterSurvival,
  winterhaven,
  starfallLake,
  sledRush,
  knockoutFloes,
  lumenTag,
  rimebound,
];
export const CREATOR = creatorDef;

export function allGames() {
  return [...BUILTIN_GAMES, ...backend.loadCustomGames().map(customGameDef)];
}
export function findGame(id) {
  if (id === CREATOR.id) return CREATOR;
  return allGames().find(g => g.id === id);
}
