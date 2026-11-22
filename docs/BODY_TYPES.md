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

## Default avatar look (avatars/default-avatar-r15)
- **Soft blocky body**: every part is a `RoundedBoxGeometry` (2 segments) with a 0.04 inset so joints read as slight gaps. Radii in `SOFT_BODY` (avatar.js): head 0.26×size, torso 0.14, limbs 0.12. Geometry is built at the real part size then normalised to a unit box, so `bodyMeshes[*].scale` still equals part dimensions (games/cosmetics that read it keep working). Geometries are cached and shared across avatars (`userData.shared`, skipped in `dispose()`).
- **Expressive face**: 128px canvas decal (`avatar.faceMesh`, material `avatar.faceMat`) on a curved plane hugging the rounded head front; transparent background so features keep their colours. Big eyes with icy iris glow + highlights, eyebrows, blush, idle blink every ~2–6 s. Talk frames 0/1/2 unchanged (`talk()`, `setTalking()`); mouth-covering cosmetics still get the mouth overlay.
- Default colours: skin `#f5cd30`, top `#4aa8e8` (ice blue), pants `#2d4a80` (navy).
- Rig/anchors unchanged (still R6-style bones), so all cosmetics and body types attach exactly as before. R15 is follow-up work.
- Preview: `npx vite --port 5193` → `/tools/default-avatar-preview.html` (`?items=a,b`, `?talk=1`, `?walk=1`, `?body=tall`); screenshots: `PORT=5193 node tools/shoot-default-avatar.mjs <outDir>`.
