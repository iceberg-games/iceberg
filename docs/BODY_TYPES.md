# Body types (branch cosmetics/body-types)
- `avatar.bodyType`: `'classic' | 'tall' | 'stout'` (default `classic`, pixel-identical rig to before).
- `avatar.setBodyType(id)`; `applyLoadout({ bodyType })` also honoured.
- `getBodySlots(id)` (src/game/bodyTypes.js, re-exported from avatar.js): bone pivots, limb/torso/head sizes, anchors `hat|neck|back|handL|handR` (+ `sleeveL/R`, `legL/R`) as `{bone, offset, scale}`, and `height`.
- Cosmetics stay authored in classic space; Avatar parents them under per-bone anchor groups (`avatar.anchors[bone]`, shirt-slot clothing under `avatar.clothAnchors[bone]`). No per-item forks.
- Persisted: localStorage `iceberg:v1:bodyType` via `loadBodyType/saveBodyType`. Locker drawer has a Body type row.
- Preview: `npx vite --port 5191` → http://localhost:5191/tools/body-types-preview.html (`?sets=tophat,scarf|crown,...`); screenshot: `node tools/shoot-body-types.mjs`.
