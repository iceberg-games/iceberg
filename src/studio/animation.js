// Animation system for rigs.
//  - Built-in R6 rig (same body as the player avatar) with named joints.
//  - Imported rigged .glb models: every THREE.Bone becomes an animatable joint.
//  - Keyframe animations: { id, name, rigId, length, loop, tracks: { boneName: [{t, rot:[deg x,y,z], pos:[x,y,z]}] } }
//  - Animations embedded in a .glb are played with THREE.AnimationMixer.
import * as THREE from 'three';
import { Avatar } from '../game/avatar.js';

const R6_NAMES = { torso: 'Torso', head: 'Head', armL: 'Left Arm', armR: 'Right Arm', legL: 'Left Leg', legR: 'Right Leg' };

export function createR6Rig() {
  const av = new Avatar();
  const bones = new Map();
  bones.set('HumanoidRootPart', av.root);
  for (const [k, name] of Object.entries(R6_NAMES)) { av.bones[k].name = name; bones.set(name, av.bones[k]); }
  return finalizeRig({ kind: 'r6', root: av.root, bones, avatar: av });
}

/** Rig adapter for an imported model (bones from its skeleton). */
export function rigFromModel(object) {
  const bones = new Map();
  object.traverse(o => { if (o.isBone) { let n = o.name || `Bone${bones.size}`; while (bones.has(n)) n += '_'; bones.set(n, o); } });
  if (!bones.size) return null;
  const rig = finalizeRig({ kind: 'imported', root: object, bones });
  if (object.userData.clips?.length) { rig.mixer = new THREE.AnimationMixer(object); rig.clips = object.userData.clips; }
  return rig;
}

function finalizeRig(rig) {
  rig.rest = new Map();
  for (const [n, b] of rig.bones) rig.rest.set(n, { pos: b.position.clone(), quat: b.quaternion.clone() });
  rig.resetPose = () => { for (const [n, b] of rig.bones) { const r = rig.rest.get(n); b.position.copy(r.pos); b.quaternion.copy(r.quat); } };
  rig.playClip = (name, loop = true) => {
    if (!rig.mixer) return null;
    rig.mixer.stopAllAction();
    const clip = rig.clips.find(c => c.name === name); if (!clip) return null;
    const a = rig.mixer.clipAction(clip); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = true; a.reset().play();
    return a;
  };
  rig.stopClips = () => { rig.mixer?.stopAllAction(); rig.resetPose(); };
  return rig;
}

export const boneRot = (b) => [b.rotation.x, b.rotation.y, b.rotation.z].map(r => +THREE.MathUtils.radToDeg(r).toFixed(1));
export const bonePos = (b) => [b.position.x, b.position.y, b.position.z].map(v => +v.toFixed(3));

/** Insert or replace a keyframe for one bone at time t. */
export function setKey(anim, boneName, t, bone) {
  const tr = anim.tracks[boneName] ||= [];
  const k = { t: +t.toFixed(3), rot: boneRot(bone), pos: bonePos(bone) };
  const i = tr.findIndex(x => Math.abs(x.t - k.t) < 0.02);
  if (i >= 0) tr[i] = k; else { tr.push(k); tr.sort((a, b) => a.t - b.t); }
}
export function deleteKey(anim, boneName, t) {
  const tr = anim.tracks[boneName]; if (!tr) return false;
  const i = tr.findIndex(x => Math.abs(x.t - t) < 0.02);
  if (i < 0) return false; tr.splice(i, 1); if (!tr.length) delete anim.tracks[boneName]; return true;
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), ea = new THREE.Euler(), d2r = THREE.MathUtils.degToRad;
/** Pose a rig at time t of a keyframe animation (smooth-step easing between keys). */
export function sampleAnimation(anim, rig, t) {
  if (!anim) return;
  if (anim.loop && anim.length > 0) t = ((t % anim.length) + anim.length) % anim.length; else t = Math.min(t, anim.length);
  for (const [name, keys] of Object.entries(anim.tracks)) {
    const bone = rig.bones.get(name); if (!bone || !keys.length) continue;
    let a = keys[0], b = keys[keys.length - 1];
    for (let i = 0; i < keys.length; i++) { if (keys[i].t <= t) a = keys[i]; if (keys[i].t >= t) { b = keys[i]; break; } }
    if (t >= keys[keys.length - 1].t) a = b = keys[keys.length - 1];
    if (t <= keys[0].t) a = b = keys[0];
    let f = a === b ? 0 : (t - a.t) / (b.t - a.t); f = f * f * (3 - 2 * f);
    qa.setFromEuler(ea.set(d2r(a.rot[0]), d2r(a.rot[1]), d2r(a.rot[2])));
    qb.setFromEuler(ea.set(d2r(b.rot[0]), d2r(b.rot[1]), d2r(b.rot[2])));
    bone.quaternion.copy(qa).slerp(qb, f);
    if (a.pos && b.pos) bone.position.set(a.pos[0] + (b.pos[0] - a.pos[0]) * f, a.pos[1] + (b.pos[1] - a.pos[1]) * f, a.pos[2] + (b.pos[2] - a.pos[2]) * f);
  }
}

/** A ready-made wave animation for the R6 rig (used by the Toolbox). */
export function waveAnimation(rigId) {
  return {
    id: 'a_' + Date.now().toString(36), name: 'Wave', rigId, length: 1.6, loop: true,
    tracks: {
      'Right Arm': [{ t: 0, rot: [0, 0, 0], pos: [0.75, 2, 0] }, { t: 0.4, rot: [0, 0, 150], pos: [0.75, 2, 0] }, { t: 0.8, rot: [0, 0, 120], pos: [0.75, 2, 0] }, { t: 1.2, rot: [0, 0, 150], pos: [0.75, 2, 0] }, { t: 1.6, rot: [0, 0, 0], pos: [0.75, 2, 0] }],
      'Head': [{ t: 0, rot: [0, 0, 0], pos: [0, 2, 0] }, { t: 0.8, rot: [0, 0, -10], pos: [0, 2, 0] }, { t: 1.6, rot: [0, 0, 0], pos: [0, 2, 0] }],
    },
  };
}
