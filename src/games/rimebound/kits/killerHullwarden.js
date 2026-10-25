import * as THREE from 'three';
import { mat, box, socket, body } from './_util.js';
export const KIT_ID = 'killer-hullwarden';
/** The Hullwarden — ice-armored hull guard, ~1.3× classic, hook hand. */
export function buildKillerHullwarden(color = 0x2a3442) {
  const inner = new THREE.Group(); inner.name = 'body';
  const iron = mat(color, { metalness: 0.5, roughness: 0.5 });
  const ice = mat(0xa9e4f5, { roughness: 0.15, transparent: true, opacity: 0.9 });
  const eye = mat(0x9ff6ff, { emissive: 0x6ff0ff, emissiveIntensity: 1.2 });
  body(inner, { legs: iron, torso: iron, arms: iron, head: iron });
  box(inner, 'iceChest', [1.2, 0.8, 0.7], [0, 1.6, 0], ice);
  box(inner, 'pauldronL', [0.7, 0.35, 0.7], [-0.8, 2.05, 0], ice, [0, 0, 0.25]);
  box(inner, 'pauldronR', [0.7, 0.35, 0.7], [0.8, 2.05, 0], ice, [0, 0, -0.25]);
  box(inner, 'helm', [0.75, 0.75, 0.75], [0, 2.35, 0], iron);
  box(inner, 'eyeSlit', [0.5, 0.08, 0.05], [0, 2.4, 0.39], eye);
  box(inner, 'hookShaft', [0.12, 0.6, 0.12], [0.75, 0.75, 0], iron);
  box(inner, 'hookCurve', [0.12, 0.12, 0.4], [0.75, 0.48, 0.16], ice);
  socket(inner, 'IronHull', [0, 1.6, 0]);
  socket(inner, 'RimeHook', [0.75, 0.45, 0.36]);
  socket(inner, 'ShatterSwing', [0.75, 1.0, 0.3]);
  const g = new THREE.Group(); g.name = KIT_ID; inner.scale.setScalar(1.3); g.add(inner);
  return g;
}
