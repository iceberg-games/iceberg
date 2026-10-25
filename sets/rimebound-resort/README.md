# Rimebound Resort

Abandoned ski lodge map for the Rimebound asym-horror game (Forsaken-like, dark stylized).
**Fully procedural Three.js** — no Blender, no GLTF/GLB assets.

## Open
```
npm run dev:sets
```
then http://127.0.0.1:5173/sets/?set=rimebound-resort

## Landmarks
A-frame lodge (boarded windows, warm gable window, fireplace, lockers, broken chandelier), dead/buzzing
OPEN neon sign, ski shed + racks, chairlift pylons/cable/chairs up the north slope, generators + fuel drums,
snow drifts, dead pines, broken fence, ground haze + fog.

## Files
- `index.js` — procedural geometry (`buildResort()`), lights, atmosphere, colliders
- `layout.js` — layout data + `groundHeight`
- `shots.js` — 5 camera shots (arrival, porch, greatroom, lift, overview); walk mode with box colliders
