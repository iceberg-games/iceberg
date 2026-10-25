// Body types (Roblox-like) + shared cosmetic slot map.
//
// Contract (shared with Game Maker / studio):
//   avatar.bodyType : 'classic' | 'tall' | 'stout' | 'pip' | 'glacier' | 'yeti'   (default 'classic')
//   mesh?   : optional Blender .glb URL; Avatar overlays its 'torso'/'head' nodes (material 'body_*' -> body color mats)
//   getBodySlots(bodyType) -> { id, label, icon, height, bones, limbs, torso, head, anchors }
//     bones   : rig pivot positions (same names as avatar.bones)
//     limbs   : { arm:[w,len,d], leg:[w,len,d] }, torso:[w,h,d], head: cube size
//     anchors : hat | neck | back | handL | handR -> { bone, offset:[x,y,z], scale:[x,y,z] }
// Cosmetic builders stay authored in 'classic' space; Avatar parents them under a per-bone
// anchor group that applies the body's offset/scale, so items never fork per body.
// Persisted locally like other avatar prefs: localStorage 'iceberg:v1:bodyType'.

export const BODY_TYPE_IDS = ['classic', 'tall', 'stout', 'pip', 'glacier', 'yeti'];
export const DEFAULT_BODY_TYPE = 'classic';

function make({ id, label, icon, blurb = '', arm, leg, torso, head, mesh = null }) {
  const [tw, th, td] = torso, legLen = leg[1], armLen = arm[1];
  const hipY = legLen, torsoY = hipY + th / 2, shoulderY = hipY + th;
  const armX = tw / 2 + arm[0] / 2, legX = tw / 4;
  const hs = head / 0.62;                         // head scale vs classic 0.62 cube
  const ts = [tw / 1, th / 1, td / 0.5];          // torso scale vs classic 1x1x0.5
  const handDrop = -(armLen - 1);                 // hand items authored at classic arm end (-1)
  return {
    id, label, icon, blurb, mesh, height: shoulderY + head,
    bones: { legL: [-legX, hipY, 0], legR: [legX, hipY, 0], torso: [0, torsoY, 0], armL: [-armX, shoulderY, 0], armR: [armX, shoulderY, 0], head: [0, shoulderY, 0] },
    limbs: { arm, leg }, torso, head,
    anchors: {
      hat:   { bone: 'head',  offset: [0, 0, 0], scale: [hs, hs, hs] },
      neck:  { bone: 'torso', offset: [0, 0, 0], scale: ts },
      back:  { bone: 'torso', offset: [0, 0, 0], scale: ts },
      handL: { bone: 'armL',  offset: [0, handDrop, 0], scale: [arm[0] / 0.5, 1, arm[2] / 0.5] },
      handR: { bone: 'armR',  offset: [0, handDrop, 0], scale: [arm[0] / 0.5, 1, arm[2] / 0.5] },
      // clothing (shirt slot: sweaters, slickers, vests) stretches with the limb instead of riding at the hand
      sleeveL: { bone: 'armL', offset: [0, 0, 0], scale: [arm[0] / 0.5, armLen, arm[2] / 0.5] },
      sleeveR: { bone: 'armR', offset: [0, 0, 0], scale: [arm[0] / 0.5, armLen, arm[2] / 0.5] },
      legL:  { bone: 'legL',  offset: [0, 0, 0], scale: [leg[0] / 0.5, legLen, leg[2] / 0.5] },
      legR:  { bone: 'legR',  offset: [0, 0, 0], scale: [leg[0] / 0.5, legLen, leg[2] / 0.5] },
    },
  };
}

export const BODY_TYPES = {
  classic: make({ id: 'classic', label: 'Classic', icon: '🧊', blurb: 'Blocky & balanced', arm: [0.5, 1, 0.5], leg: [0.5, 1, 0.5], torso: [1, 1, 0.5], head: 0.62 }),
  tall:    make({ id: 'tall', label: 'Tall', icon: '🗼', blurb: 'Lanky & long-legged', arm: [0.42, 1.3, 0.42], leg: [0.44, 1.4, 0.44], torso: [0.88, 1.15, 0.44], head: 0.6 }),
  stout:   make({ id: 'stout', label: 'Stout', icon: '⛄', blurb: 'Short & sturdy', arm: [0.56, 0.78, 0.56], leg: [0.62, 0.68, 0.6], torso: [1.24, 0.9, 0.66], head: 0.7 }),
  // Procedural, deliberately extreme silhouettes:
  pip:     make({ id: 'pip', label: 'Pip', icon: '🐧', blurb: 'Mini & big-headed', arm: [0.36, 0.55, 0.36], leg: [0.4, 0.45, 0.4], torso: [0.78, 0.62, 0.46], head: 0.84 }),
  glacier: make({ id: 'glacier', label: 'Glacier', icon: '🏔️', blurb: 'Huge shoulders, tiny legs', arm: [0.72, 1.15, 0.7], leg: [0.5, 0.6, 0.55], torso: [1.7, 1.25, 0.8], head: 0.56 }),
  // Blender-authored (tools/blender/yeti_body.py -> src/assets/bodies/yeti.glb): rounded fur torso + belly, ice horns
  yeti:    make({ id: 'yeti', label: 'Yeti', icon: '❄️', blurb: 'Fluffy, horned, long arms', arm: [0.58, 1.35, 0.58], leg: [0.6, 0.72, 0.6], torso: [1.3, 1.2, 0.75], head: 0.66, mesh: new URL('../assets/bodies/yeti.glb', import.meta.url).href }),
};

/** bone name -> anchor id used when parenting a cosmetic built for that bone. */
export const BONE_ANCHOR = { head: 'hat', torso: 'back', armR: 'handR', armL: 'handL', legL: 'legL', legR: 'legR' };

/** Shirt-slot clothing uses these instead of BONE_ANCHOR. */
export const CLOTHING_ANCHOR = { head: 'hat', torso: 'neck', armR: 'sleeveR', armL: 'sleeveL', legL: 'legL', legR: 'legR' };

export const normalizeBodyType = (t) => (BODY_TYPE_IDS.includes(t) ? t : DEFAULT_BODY_TYPE);
export const getBodySlots = (t) => BODY_TYPES[normalizeBodyType(t)];

const KEY = 'iceberg:v1:bodyType';
export function loadBodyType() { try { return normalizeBodyType(JSON.parse(localStorage.getItem(KEY))); } catch { return DEFAULT_BODY_TYPE; } }
export function saveBodyType(t) { try { localStorage.setItem(KEY, JSON.stringify(normalizeBodyType(t))); } catch { /* private mode */ } }
