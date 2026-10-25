# Knockout Floes (filming set)

Trailer set for GM2's Knockout Floes passion project. Not a game: no HUD, scoring, bots or sinking logic.

- King floe at origin (r 6.2, top y 1) with neon ring + score totem/brazier; 7 outer floes on a ring r 11 (r 4.6, height ±0.4).
- Thin ice bridges king→1/3/5 and ring links 2–3, 6–7; the rest are jump gaps.
- Snowball crates and glowing snowball piles (cosmetic), warm lantern posts vs cyan rim neon, crack decals.
- Dark arctic water with splash ripples, light snow sparkle, subtle aurora, distant icebergs + igloo silhouettes. No meteors.
- Walk mode (`G`): spawns on the king floe. `groundHeight` returns `null` over water, so you fall; under y −30 you respawn on the king floe.

Shots: 1 establish · 2 fly between floes · 3 totem orbit · 4 low chase across gaps · 5 neon hero look-up.

`layout.js` is pure data (`FLOES`, `BRIDGES`, `ANCHORS`, `groundHeight`, `rimR`) for Game Maker reuse.

Open: `npm run dev:sets` → http://127.0.0.1:5173/sets/?set=knockout-floes
