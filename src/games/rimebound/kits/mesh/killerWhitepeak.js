import * as THREE from 'three';
import { mat, box, socket, body } from './_util.js';
export const KIT_ID = 'killer-whitepeak';
/** Mrs. Whitepeak — cursed resort hostess. ~1.3×. Elegant coat, empty smile, snow veil. */
export function buildKillerWhitepeak(color = 0xf4f7fb) {
  const inner = new THREE.Group(); inner.name = 'body';
  const ivory = mat(color), silver = mat(0xc0c8d4, { metalness: 0.55, roughness: 0.4 });
  const smile = mat(0x3a4550), veil = mat(0xe8eef5, { transparent: true, opacity: 0.55, roughness: 0.2 });
  const tag = mat(0x2a3440);
  body(inner, { legs: ivory, torso: ivory, arms: ivory, head: ivory });
  box(inner, 'coat', [1.15, 1.35, 0.65], [0, 1.45, 0], ivory);
  box(inner, 'coatLapel', [0.35, 0.9, 0.08], [-0.28, 1.7, 0.32], silver);
  box(inner, 'coatLapelR', [0.35, 0.9, 0.08], [0.28, 1.7, 0.32], silver);
  box(inner, 'nameTag', [0.28, 0.14, 0.04], [0.35, 1.85, 0.36], tag);
  box(inner, 'nameTagShine', [0.2, 0.06, 0.03], [0.35, 1.85, 0.38], silver);
  box(inner, 'hat', [0.85, 0.35, 0.85], [0, 2.75, 0], ivory);
  box(inner, 'hatBand', [0.88, 0.08, 0.88], [0, 2.62, 0], silver);
  box(inner, 'hairVolume', [0.9, 0.45, 0.7], [0, 2.55, -0.15], silver);
  box(inner, 'smile', [0.28, 0.05, 0.04], [0, 2.2, 0.34], smile);
  box(inner, 'eyeL', [0.08, 0.04, 0.03], [-0.12, 2.38, 0.33], smile);
  box(inner, 'eyeR', [0.08, 0.04, 0.03], [0.12, 2.38, 0.33], smile);
  box(inner, 'veil', [1.0, 1.2, 0.15], [0, 1.9, 0.45], veil);
  box(inner, 'gloveL', [0.56, 0.3, 0.56], [-0.75, 1.1, 0], silver);
  box(inner, 'gloveR', [0.56, 0.3, 0.56], [0.75, 1.1, 0], silver);
  socket(inner, 'ConciergeSmile', [0, 2.2, 0.4]);
  socket(inner, 'Whiteout', [0, 2.75, 0]);
  socket(inner, 'CheckIn', [0.35, 1.85, 0.45]);
  const g = new THREE.Group(); g.name = KIT_ID; inner.scale.setScalar(1.3); g.add(inner);
  return g;
}
