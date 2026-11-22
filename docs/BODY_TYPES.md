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
- **Classic blocky body**: `RoundedBoxGeometry` with a *slight* bevel only (world-unit radii in `SOFT_BODY`: head 0.135, torso 0.028, limbs 0.02) and a hairline 0.002 inset so arm/torso joints stay flush (no puffy gaps). Legs use a 0.01 overlap so the pair reads as one block (hairline seam) matching the ref photo. Geometry is built at the real part size then normalised to a unit box, so `bodyMeshes[*].scale` still equals part dimensions. Geometries are cached and shared (`userData.shared`, skipped in `dispose()`).
- **Minimal face**: 128px canvas decal (`avatar.faceMesh`, `avatar.faceMat`) on a flat plane at the head front. Two small dark oval-dot eyes and a thin curved smile — no nose/centre mark, blush, eyebrows, irises or highlights. Subtle idle blink (dots flatten) every ~2–6 s. Talk frames 0/1/2 kept (`talk()`, `setTalking()`): smile, slightly open, a little more open (no teeth/tongue). Mouth-covering cosmetics still get the mouth overlay.
- Default colours (matched to the Editor Update ref photo): skin/arms `#f6f0c4` (pale cream), top `#8a3ff0` (violet), pants `#3e42d8` (indigo). Body materials are matte (`roughness` 0.98, `metalness` 0).
- Rig/anchors and body-type proportions unchanged (still R6-style bones), so all cosmetics and body types attach as before. R15 is follow-up work.
- Preview: `npx vite --port 5193` → `/tools/default-avatar-preview.html` (`?items=a,b`, `?talk=1`, `?walk=1`, `?body=tall`, `?bg=dark`); screenshots: `PORT=5193 node tools/shoot-default-avatar.mjs <outDir>`.
