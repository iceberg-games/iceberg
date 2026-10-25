import * as THREE from 'three';
import { mat, box, socket, body } from './_util.js';
export const KIT_ID = 'killer-kettle';
/** Kettle — canary-masked boiler miner, ~1.25× classic, lantern. */
export function buildKillerKettle(color = 0x3b4a3f) {
  const inner = new THREE.Group(); inner.name = 'body';
  const coat = mat(color), brass = mat(0xc9a24a, { metalness: 0.6, roughness: 0.4 });
  const canary = mat(0xf4d35e), glow = mat(0x8ff3ff, { emissive: 0x5fe3ff, emissiveIntensity: 1.5 });
  body(inner, { legs: coat, torso: coat, arms: coat, head: canary });
  box(inner, 'maskBeak', [0.2, 0.16, 0.3], [0, 2.25, 0.45], brass);
  box(inner, 'eyeL', [0.12, 0.12, 0.04], [-0.15, 2.4, 0.32], glow);
  box(inner, 'eyeR', [0.12, 0.12, 0.04], [0.15, 2.4, 0.32], glow);
  box(inner, 'boilerTank', [0.7, 0.9, 0.4], [0, 1.55, -0.45], brass);
  box(inner, 'ventPipe', [0.14, 0.5, 0.14], [0.22, 2.2, -0.5], brass);
  box(inner, 'lanternFrame', [0.3, 0.4, 0.3], [-0.75, 0.75, 0.1], brass);
  box(inner, 'lanternGlow', [0.2, 0.28, 0.2], [-0.75, 0.75, 0.1], glow);
  box(inner, 'lampHelm', [0.7, 0.18, 0.7], [0, 2.68, 0], brass);
  box(inner, 'helmLamp', [0.18, 0.18, 0.08], [0, 2.68, 0.36], glow);
  inner.rotation.x = 0.12; // crouched lean
  socket(inner, 'CanaryEar', [0, 2.62, 0]);
  socket(inner, 'LanternSweep', [-0.75, 0.75, 0.3]);
  socket(inner, 'GasVent', [0.22, 2.5, -0.5]);
  const g = new THREE.Group(); g.name = KIT_ID; inner.scale.setScalar(1.25); g.add(inner);
  return g;
}
