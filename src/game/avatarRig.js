// R15 hook seam (QoL). Iceberg Avatars' R15 rig plugs in HERE — nothing else in
// the platform needs to know which rig is active. Default = the built-in
// block avatar (src/game/avatar.js, R6-style bones), so this file is a no-op
// until an adapter registers. See designs/qol-r15-hooks.md.
//
// Adapter shape (all optional; missing methods fall back to the built-in avatar):
//   {
//     id: 'r15',
//     bodyTypes?: ['classic', …],               // body types this rig supports (else all)
//     spawn(avatar, { local, remoteKey }),      // build/attach the rig onto avatar.root (local or remote player)
//     setBody(avatar, bodyType),                // after Avatar.setBodyType
//     attach(avatar, slot, object3d),           // cosmetics/wearables → rig attachment point
//     anim(avatar, state, dt),                  // per-frame locomotion: 'idle'|'walk'|'run'|'jump'|'fall'|'fly'|'sit'
//     dispose(avatar),
//   }
let adapter = null;
export function registerRigAdapter(a) { adapter = a || null; }
export const rigAdapter = () => adapter;
export const rigId = () => adapter?.id || 'block';

const call = (fn, ...args) => { try { return adapter?.[fn]?.(...args); } catch (e) { console.warn(`[rig:${rigId()}] ${fn}`, e); } };
/** Hook: an Avatar was created (local in main.js, remote in mp/multiplayer.js). */
export const rigSpawn = (avatar, info = {}) => call('spawn', avatar, info);
/** Hook: body type changed (Avatar.setBodyType). */
export const rigSetBody = (avatar, bodyType) => call('setBody', avatar, bodyType);
/** Hook: something equipped onto a slot. Returns true if the rig handled it. */
export const rigAttach = (avatar, slot, obj) => !!call('attach', avatar, slot, obj);
/** Hook: per-frame animation state. Returns true if the rig animated (skip built-in limb swing). */
export const rigAnim = (avatar, state, dt) => !!call('anim', avatar, state, dt);
export const rigDispose = (avatar) => call('dispose', avatar);
