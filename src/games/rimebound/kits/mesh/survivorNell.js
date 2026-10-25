import * as THREE from 'three';
import { mat, box, socket, body } from './_util.js';
export const KIT_ID = 'survivor-nell';
/** Nell Okafor — mine medic. Classic/stout-leaning. Coat + med satchel, warm lantern glow. */
export function buildSurvivorNell(color = 0x9cc9e3) {
  const g = new THREE.Group(); g.name = KIT_ID;
  const ice = mat(color), cream = mat(0xefe6d2), cross = mat(0x9e3b42);
  const skin = mat(0xc48a5a), pants = mat(0x4a5d73), glow = mat(0xffc07a, { emissive: 0xff9a3c, emissiveIntensity: 1.1 });
  body(g, { legs: pants, torso: ice, arms: ice, head: skin });
  box(g, 'coatHem', [1.1, 0.55, 0.62], [0, 1.15, 0], ice);
  box(g, 'collar', [0.85, 0.18, 0.55], [0, 2.05, 0.02], cream);
  box(g, 'cross', [0.22, 0.22, 0.05], [0.22, 1.65, 0.28], cross);
  box(g, 'crossBar', [0.32, 0.1, 0.05], [0.22, 1.65, 0.28], cross);
  box(g, 'satchel', [0.45, 0.35, 0.2], [-0.55, 1.25, 0.15], mat(0x7a5a44));
  box(g, 'satchelFlap', [0.45, 0.12, 0.22], [-0.55, 1.42, 0.15], mat(0x6a4a36));
  box(g, 'strap', [0.08, 0.9, 0.04], [-0.35, 1.7, 0.05], mat(0x6a4a36), [0, 0, 0.35]);
  box(g, 'lantern', [0.18, 0.28, 0.18], [0.75, 0.95, 0.25], mat(0xc8d3dc, { metalness: 0.5, roughness: 0.4 }));
  box(g, 'lanternGlow', [0.12, 0.16, 0.12], [0.75, 0.95, 0.25], glow);
  box(g, 'gloveL', [0.56, 0.28, 0.56], [-0.75, 1.1, 0], cream);
  box(g, 'gloveR', [0.56, 0.28, 0.56], [0.75, 1.1, 0], cream);
  box(g, 'hair', [0.66, 0.2, 0.66], [0, 2.55, 0], mat(0x2a1a12));
  socket(g, 'WarmHands', [0.75, 1.1, 0.35]);
  socket(g, 'ThawKit', [-0.55, 1.3, 0.35]);
  return g;
}
