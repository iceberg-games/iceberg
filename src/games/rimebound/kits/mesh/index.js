export { buildSurvivorPip } from './survivorPip.js';
export { buildSurvivorNell } from './survivorNell.js';
export { buildSurvivorJuno } from './survivorJuno.js';
export { buildKillerHullwarden } from './killerHullwarden.js';
export { buildKillerKettle } from './killerKettle.js';
export { buildKillerWhitepeak } from './killerWhitepeak.js';

import { buildSurvivorPip } from './survivorPip.js';
import { buildSurvivorNell } from './survivorNell.js';
import { buildSurvivorJuno } from './survivorJuno.js';
import { buildKillerHullwarden } from './killerHullwarden.js';
import { buildKillerKettle } from './killerKettle.js';
import { buildKillerWhitepeak } from './killerWhitepeak.js';

const BUILDERS = {
  'survivor-pip': buildSurvivorPip,
  'survivor-nell': buildSurvivorNell,
  'survivor-juno': buildSurvivorJuno,
  'killer-hullwarden': buildKillerHullwarden,
  'killer-kettle': buildKillerKettle,
  'killer-whitepeak': buildKillerWhitepeak,
};

export function buildKitMesh(kitId, color) {
  const fn = BUILDERS[kitId];
  return fn ? fn(color) : null;
}
