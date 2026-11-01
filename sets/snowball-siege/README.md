# Snowball Siege (filming set)
Night snowy valley: Red ice/timber fort (west, x=-30) vs Blue fort (east, x=+30), contested courtyard with berms, crates, ice walls and sled barricades, glowing capture crystal at the centre. Procedural Three.js only.

Open: `npm run dev:sets` → http://localhost:5173/sets/?set=snowball-siege

Game Maker hooks (`layout.js`, also `set.hooks` + top-level fields on the created set):
`spawns.red/blue`, `respawns.red/blue`, `objective`, `flags`, `ammoCrates`, `cover` (`kind`: berm|crate|iceWall|sled), `bounds`, `walkBounds`, `groundHeight(x,z)`, `HOOKS`.

Shots: 1 establish, 2 red push-in, 3 blue push-in, 4 crystal orbit, 5 low trench dolly.
