// Studio gears = the shared gear catalog from the Giant Rainbow Obby
// (src/games/giantObby/gears.js, owned by the Game Maker). The Studio does not
// define its own gears: any gear added there shows up in the Toolbox.
//
// Creator-added gears (gear givers placed in the game + starter gears) are free
// and unlimited in that game; canUseGear() enforces that rule, so purchased
// gears from other games never leak in.
import { OBBY_GEARS, OBBY_GEAR_LIST, canUseGear, Backpack as ObbyBackpack } from '../games/giantObby/gears.js';

export const GEARS = OBBY_GEARS;
export const GEAR_LIST = OBBY_GEAR_LIST;
export { canUseGear };

/** Gear ids a creator put in this game (givers + starter gears). */
export function creatorGearsOf(doc) {
  const ids = new Set(doc.starterGears || []);
  for (const i of doc.instances || []) if (i.type === 'gear' && i.gearId) ids.add(i.gearId);
  return [...ids].filter(id => GEARS[id]);
}

/** Backpack for Studio games: the shared Backpack, gated by canUseGear(). */
export class Backpack extends ObbyBackpack {
  constructor(player, avatar, onChange, { gameId = null, creatorGears = [], purchases = {} } = {}) {
    super(player, avatar, onChange);
    this.gameId = gameId; this.creatorGears = creatorGears; this.purchases = purchases;
  }
  give(id) { if (!canUseGear(id, this.gameId, this.purchases, this.creatorGears)) return false; return super.give(id); }
  clear() { this.dispose(); this.onChange(); }
}

/** The movement mods a gear applies when equipped (used to restore after timed script effects). */
export function gearMods(id) {
  const base = { speed: 1, gravity: 1, jump: 1, carpet: false };
  const g = GEARS[id]; if (!g) return base;
  const fake = { mods: { ...base } }, saved = g._carpet;
  try { g.equip(fake, { root: { add() {}, remove() {} }, bones: {} }); } catch { /* ignore */ }
  g._carpet = saved;
  return fake.mods;
}
