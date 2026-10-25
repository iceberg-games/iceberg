# Starfall Observatory (filming set)

A glass-domed night observatory on a rocky snow peak: meteor shower overhead, a glowing constellation
mosaic floor, a crystal telescope with floating lenses, a star-map pedestal courtyard, wind ribbons, pennants
and crystal chimes, warm lamplight inside against the cold blue night outside. Filming set only, not a game.

## Open
- Dev: `npm run dev:sets`, then open http://localhost:5173/sets/?set=starfall-observatory
- Clean take: `…/sets/?set=starfall-observatory&shot=4&clean=1&w=1920&h=1080`
- Static: `npm run build:sets` → `dist-sets/sets/index.html?set=starfall-observatory`

## Shots (`shots.js`)
1. Approach up the ridge · 2. Into the dome · 3. Orbit the constellation floor · 4. Look up: meteor shower · 5. Terrace overlook

## Layout (`layout.js`, pure data)
Summit plaza y 40 (r 24) with the dome at (0,-6) (door faces south) and the star-map pedestal at (0,14).
Ring terrace y 35 (r 24–33) with stairs N/E/S/W; the ridge path climbs in from the south (z 33→150).
`groundHeight(x,z)` covers plaza, stairs, terrace, ridge and terrain. Walk mode (`G`) spawns on the ridge;
the dome wall, parapets, railing, lanterns, poles, telescopes and pedestal are solid.

All geometry and shaders are procedural, Iceberg original. No external assets.
