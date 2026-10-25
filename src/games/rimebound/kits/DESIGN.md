# Rimebound kit stubs (MVP)
Procedural Three.js Groups (no Blender). Authored at classic avatar scale (height ≈ 2.62). Not wired into locker yet.

| id | builder | scale | skin key | VFX sockets |
|---|---|---|---|---|
| survivor-pip (Pip Harlow, welder) | buildSurvivorPip | 1.0 | skin_survivor-pip_default | CoreSpark (torch tip), FlareBlind (belt tank) |
| killer-hullwarden (The Hullwarden) | buildKillerHullwarden | 1.3 | skin_killer-hullwarden_default | IronHull, RimeHook, ShatterSwing |
| killer-kettle (Kettle) | buildKillerKettle | 1.25 | skin_killer-kettle_default | CanaryEar, LanternSweep, GasVent |

Colors: Pip navy #1f3a5f / cream #f2e8d5 / rime #b8c7d6 / cyan visor #5fe3ff. Hullwarden iron #2a3442 / ice #a9e4f5. Kettle coat #3b4a3f / brass #c9a24a / canary #f4d35e / glow #8ff3ff. Sparks/glows icy cyan, no gore.
Sockets are empty Object3D, find via `group.getObjectByName('CoreSpark')`.
