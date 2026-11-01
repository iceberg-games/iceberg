# QoL: R15 avatar hook points

Seam module: `src/game/avatarRig.js` — `registerRigAdapter({ id:'r15', spawn, setBody, attach, anim, dispose })`.
No adapter registered = built-in block avatar (unchanged behaviour).

| Hook | Where it is called today | Purpose |
|---|---|---|
| `rigSpawn(avatar, {local:true})` | `src/main.js` right after `avatar.applyLoadout(...)` | build R15 rig for the local player |
| `rigSpawn(avatar, {local:false, remoteKey, bodyType})` | `src/mp/multiplayer.js` remote-player spawn | R15 for other players |
| `rigSetBody(avatar, type)` | end of `Avatar.setBodyType` (`src/game/avatar.js`) | refit rig to classic/tall/stout/pip/glacier/yeti |
| `rigAttach(avatar, slot, obj)` | **not wired yet** — call from Avatar cosmetic equip (anchors `BONE_ANCHOR` / `CLOTHING_ANCHOR`) | map R6 slots → R15 attachments |
| `rigAnim(avatar, state, dt)` | **not wired yet** — call from Avatar per-frame limb animation; skip built-in swing if it returns true | R15 locomotion clips |
| `rigDispose(avatar)` | **not wired yet** — remote player despawn in multiplayer.js | cleanup |

Register the adapter before `boot()` builds the Avatar (e.g. side-effect import in `main.js`).
Body type allowlist (`src/game/bodyTypes.js` `BODY_TYPE_IDS`) already includes pip/glacier/yeti on main.
