import * as THREE from 'three';
import { mat, box, socket, body } from './_util.js';
export const KIT_ID = 'survivor-juno';
/** Juno Vale — resort ski patrol. Tall-leaning. Patrol parka + skis/grapple line. */
export function buildSurvivorJuno(color = 0x2c3e50) {
  const g = new THREE.Group(); g.name = KIT_ID;
  const charcoal = mat(color), cyan = mat(0x5fe3ff, { emissive: 0x2bbfe0, emissiveIntensity: 0.5 }), cream = mat(0xf2e8d5);
  const skin = mat(0xe8c4a0), goggle = mat(0x1a3040, { metalness: 0.4, roughness: 0.3 });
  // tall-lean: slightly longer limbs via scale on body parts (authored classic then stretch Y)
  const inner = new THREE.Group(); inner.name = 'body';
  body(inner, { legs: charcoal, torso: charcoal, arms: charcoal, head: skin });
  box(inner, 'parka', [1.05, 1.05, 0.58], [0, 1.5, 0], charcoal);
  box(inner, 'parkaTrim', [1.08, 0.12, 0.6], [0, 1.05, 0], cyan);
  box(inner, 'hood', [0.7, 0.35, 0.7], [0, 2.55, -0.05], cream);
  box(inner, 'goggles', [0.55, 0.16, 0.08], [0, 2.38, 0.34], goggle);
  box(inner, 'lensL', [0.18, 0.12, 0.04], [-0.12, 2.38, 0.38], cyan);
  box(inner, 'lensR', [0.18, 0.12, 0.04], [0.12, 2.38, 0.38], cyan);
  box(inner, 'skiL', [0.12, 0.08, 1.4], [-0.35, 0.08, 0.2], cyan);
  box(inner, 'skiR', [0.12, 0.08, 1.4], [0.35, 0.08, 0.2], cyan);
  box(inner, 'grapple', [0.1, 0.5, 0.1], [0.75, 1.2, -0.15], mat(0xb8c7d6, { metalness: 0.7, roughness: 0.35 }));
  box(inner, 'grappleLine', [0.04, 0.04, 0.7], [0.75, 0.95, 0.25], cream, [0.4, 0, 0]);
  box(inner, 'pack', [0.55, 0.55, 0.3], [0, 1.55, -0.4], cream);
  socket(inner, 'RidgeRunner', [0, 1.05, 0]);
  socket(inner, 'IceGrapple', [0.75, 0.95, 0.55]);
  socket(inner, 'Slide', [0, 0.15, 0.5]);
  inner.scale.set(0.92, 1.12, 0.92); // tall-lean
  g.add(inner);
  return g;
}
