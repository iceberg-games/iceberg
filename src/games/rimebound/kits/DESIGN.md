# Rimebound kit stubs (MVP)
Procedural Three.js Groups (no Blender). Authored at classic avatar scale (height ≈ 2.62). Not wired into locker yet.

| id | builder | scale | skin key | VFX sockets |
|---|---|---|---|---|
| survivor-pip (Pip Harlow, welder) | buildSurvivorPip | 1.0 | skin_survivor-pip_default | CoreSpark (torch tip), FlareBlind (belt tank) |
| killer-hullwarden (The Hullwarden) | buildKillerHullwarden | 1.3 | skin_killer-hullwarden_default | IronHull, RimeHook, ShatterSwing |
| killer-kettle (Kettle) | buildKillerKettle | 1.25 | skin_killer-kettle_default | CanaryEar, LanternSweep, GasVent |

Colors: Pip navy #1f3a5f / cream #f2e8d5 / rime #b8c7d6 / cyan visor #5fe3ff. Hullwarden iron #2a3442 / ice #a9e4f5. Kettle coat #3b4a3f / brass #c9a24a / canary #f4d35e / glow #8ff3ff. Sparks/glows icy cyan, no gore.
Sockets are empty Object3D, find via `group.getObjectByName('CoreSpark')`.


## Cosmetics 2 kits (merged from cosmetics/rimebound-c2-stubs @ 881c8f8)

# Rimebound kit stubs — Cosmetics 2 (MVP)

Procedural Three.js Groups (no Blender). Cosmetics 2 lane only — Pip/Hullwarden/Kettle live on Cosmetics 1’s tip.

| id | builder | scale | skin key | VFX sockets |
|---|---|---|---|---|
| survivor-nell (Nell Okafor, mine medic) | buildSurvivorNell | 1.0 | skin_survivor-nell_default | WarmHands (lantern hand), ThawKit (satchel) |
| survivor-juno (Juno Vale, ski patrol) | buildSurvivorJuno | tall-lean ~1.12 Y | skin_survivor-juno_default | RidgeRunner, IceGrapple, Slide |
| killer-whitepeak (Mrs. Whitepeak) | buildKillerWhitepeak | 1.3 | skin_killer-whitepeak_default | ConciergeSmile, Whiteout, CheckIn |

Silhouettes: Nell coat + med satchel + warm lantern glow; Juno lean patrol parka + skis/grapple; Whitepeak elegant coat + empty smile + snow veil.

Shared helpers: `_util.js` (same API as Cosmetics 1). Find sockets via `group.getObjectByName('ThawKit')`. Not wired into cosmetics.js / locker — Cosmetics 1 wires catalog/skin keys.
