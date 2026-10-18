// Filming sets. NOT part of the player-facing game list (src/games/registry.js) and not in the
// deployed site build (scripts/build-site.mjs only builds site/portal + site/play).
// Add a set: create sets/<id>/index.js exporting a set definition (see README.md), then add one line here.
export const SETS = {
  winterhaven: () => import('./winterhaven/index.js'),
};
