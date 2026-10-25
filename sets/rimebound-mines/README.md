# rimebound-mines (thin stub)
Abandoned ice mines, Forsaken-like dark. Procedural Three.js only (no Blender/GLTF). Open: `npm run dev:sets` → `/sets/?set=rimebound-mines`.

## Game Maker hooks (pure data, import from `sets/rimebound-mines/layout.js` — no THREE)
- `spawns.survivor[] / spawns.killer[]` — `{ pos:[x,y,z], facing }` (survivors at south adit, killer at north crosscut)
- `cores[]` — `{ id, pos }` objectives (4 ore crushers, red glow)
- `exits[]` — `{ id, pos, facing }` (surface adit S, ore-lift cage NE)
- `hidingSpots[]` — `{ id, pos }` (carts / timber alcoves)
- `bounds` — `{ min:[x,y,z], max:[x,y,z] }`; `walkBounds` — set-runtime box
- `HOOKS` — all of the above in one object. Same fields also on the created set object (`set.hooks`, etc.).
Floor is flat y=0, ceiling 4.5; tunnels in `TUNNELS`.
