// Game registry. To add a game: create a module exporting a definition
// { id, name, tagline, description, thumbnail, music, create(ctx, params) }
// and add it to BUILTIN_GAMES below. See README "Adding a game".
import frostFields from './frostFields.js';
import birgHQ from './birgHQ.js';
import giantRainbowObby from './giantObby/index.js';
import cornerBakery from './cornerBakery/index.js';
import snowconeTycoon from './snowconeTycoon/index.js';
import naturalDisasterSurvival from './disasterSurvival/index.js';
import winterhaven from './winterhaven/index.js';
import starfallLake from './starfallLake/index.js';
import sledRush from './sled-rush/index.js';
import knockoutFloes from './knockoutFloes/index.js';
import lumenTag from './lumenTag/index.js';
import snowballSiege from './snowball-siege/index.js';
import rimebound from './rimebound/index.js';
import glacierDrift from './glacier-drift/index.js';
import penguPlaza from './pengu-plaza/index.js';
import crystalSpire from './crystalSpire/index.js';
import lanternHollow from './lanternHollow/index.js';
import frostlings from './frostlings/index.js';
import { withEventQuest, frostQuest, hqQuest, obbyQuest } from './_event/hooks.js'; // Natural Disasters event quests (remove to end the event)
import { creatorDef, customGameDef } from './customGame.js';
import { backend } from '../backend/LocalBackend.js';

export const BUILTIN_GAMES = [
  withEventQuest(frostFields, ...frostQuest),
  withEventQuest(birgHQ, ...hqQuest),
  withEventQuest(giantRainbowObby, ...obbyQuest),
  cornerBakery,
  snowconeTycoon,
  naturalDisasterSurvival,
  winterhaven,
  starfallLake,
  sledRush,
  knockoutFloes,
  lumenTag,
  rimebound,
  glacierDrift,
  snowballSiege,
  penguPlaza,
  crystalSpire,
  lanternHollow,
  frostlings,
];

// LISTING FLAG (Editor Update): built-in games are still registered (code, assets, data and play-by-link all keep
// working via BUILTIN_GAMES / findGame) but only LISTED_GAMES appear on the Games menu and the portal.
// To bring a game back on the list, delete its id from UNLISTED_IDS (one-line change). Empty the set to show all.
export const UNLISTED_IDS = new Set([
  'natural-disaster-survival', 'winterhaven', 'starfall-lake', 'sled-rush', 'knockout-floes', 'lumen-tag', 'rimebound',
  'glacier-drift', 'snowball-siege', 'pengu-plaza', 'crystal-spire', 'lantern-hollow', 'frostlings', 'corner-bakery',
  'snowcone-tycoon', 'giant-rainbow-obby',
]);
export const LISTED_GAMES = BUILTIN_GAMES.filter(g => !UNLISTED_IDS.has(g.id));
export const CREATOR = creatorDef;

export function allGames() {
  return [...BUILTIN_GAMES, ...backend.loadCustomGames().map(customGameDef)];
}
export function findGame(id) {
  if (id === CREATOR.id) return CREATOR;
  return allGames().find(g => g.id === id);
}
