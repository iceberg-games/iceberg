# Glacier Drift (filming set)
Night powder glacier race: summit lodge + start deck at the top, ~600u winding S-curve run through ice ridges and pines,
glowing ice gate arches at each checkpoint, power-up plinths (boost=cyan, shield=gold, magnet=violet, freeze=ice-blue),
finish chute with banners and checker strip. Procedural Three.js only.

- `layout.js` — pure data (no THREE): `TRACK`, `centerX`, `trackHeight`, `groundHeight`, `atT`, `headingAt`,
  `spawns.racer[8]`, `powerups[14]`, `checkpoints[7]`, `finish`, `LODGE`, `anchors`, `bounds`, `walkBounds`, `HOOKS`.
- `shots.js` — lodge, first-curve, chase, powerup-alley, finish, overlook.
- Facing: yaw radians, `Math.PI` = downhill (-z). Track DNA mirrors sled-rush, own route.
