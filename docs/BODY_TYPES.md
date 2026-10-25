# Body types (branch cosmetics/body-types)
- `avatar.bodyType`: `'classic' | 'tall' | 'stout' | 'pip' | 'glacier' | 'yeti'` (default `classic`, pixel-identical rig to before).
- `avatar.setBodyType(id)`; `applyLoadout({ bodyType })` also honoured.
- `getBodySlots(id)` (src/game/bodyTypes.js, re-exported from avatar.js): bone pivots, limb/torso/head sizes, anchors `hat|neck|back|handL|handR` (+ `sleeveL/R`, `legL/R`) as `{bone, offset, scale}`, and `height`.
- Cosmetics stay authored in classic space; Avatar parents them under per-bone anchor groups (`avatar.anchors[bone]`, shirt-slot clothing under `avatar.clothAnchors[bone]`). No per-item forks.
- Persisted: localStorage `iceberg:v1:bodyType` via `loadBodyType/saveBodyType`. Locker drawer has a Body type row.
- Preview: `npx vite --port 5191` → http://localhost:5191/tools/body-types-preview.html (`?sets=tophat,scarf|crown,...`); screenshot: `node tools/shoot-body-types.mjs`.

## Added body types
- `pip` (procedural): mini, big head. `glacier` (procedural): huge shoulders, short legs.
- `yeti` (Blender): `getBodySlots().mesh` -> `src/assets/bodies/yeti.glb` built by `blender -b -P tools/blender/yeti_body.py -- src/assets/bodies/yeti.glb`. Avatar overlays glb nodes `torso` (replaces torso box; material `body_torso` -> shirt color) and `head` (horns/brow on top of the face cube). Anchors still come from procedural proportions, so cosmetics work unchanged. Falls back to boxes if the glb fails.
