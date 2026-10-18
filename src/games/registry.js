// Game registry. To add a game: create a module exporting a definition
// { id, name, tagline, description, thumbnail, music, create(ctx, params) }
// and add it to BUILTIN_GAMES below. See README "Adding a game".
import frostFields from './frostFields.js';
import birgHQ from './birgHQ.js';
import rainbowObby from './rainbowObby.js';
import giantRainbowObby from './giantObby/index.js';
import { creatorDef, customGameDef } from './customGame.js';
import { backend } from '../backend/LocalBackend.js';

export const BUILTIN_GAMES = [
  frostFields,
  birgHQ,
  rainbowObby,
  giantRainbowObby,
];
export const CREATOR = creatorDef;

export function allGames() {
  return [...BUILTIN_GAMES, ...backend.loadCustomGames().map(customGameDef)];
}
export function findGame(id) {
  if (id === CREATOR.id) return CREATOR;
  return allGames().find(g => g.id === id);
}
