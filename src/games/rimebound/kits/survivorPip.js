import * as THREE from 'three';
import { mat, box, socket, body } from './_util.js';
export const KIT_ID = 'survivor-pip';
/** Pip Harlow — shipyard welder. Classic scale. */
export function buildSurvivorPip(color = 0x1f3a5f) {
  const g = new THREE.Group(); g.name = KIT_ID;
  const navy = mat(color), cream = mat(0xf2e8d5), rime = mat(0xb8c7d6, { metalness: 0.6, roughness: 0.35 });
  const visor = mat(0x5fe3ff, { emissive: 0x2bbfe0, emissiveIntensity: 0.8, roughness: 0.2 });
  body(g, { legs: navy, torso: navy, arms: navy, head: cream });
  box(g, 'helmet', [0.72, 0.5, 0.72], [0, 2.5, -0.02], rime);
  box(g, 'visor', [0.6, 0.22, 0.06], [0, 2.32, 0.34], visor);
  box(g, 'apron', [0.8, 0.8, 0.06], [0, 1.45, 0.28], cream);
  box(g, 'toolBelt', [1.06, 0.16, 0.56], [0, 1.08, 0], mat(0x6b4a2e));
  box(g, 'beltTank', [0.18, 0.3, 0.18], [0.42, 1.0, 0.32], rime);
  box(g, 'gloveL', [0.56, 0.3, 0.56], [-0.75, 1.12, 0], rime);
  box(g, 'gloveR', [0.56, 0.3, 0.56], [0.75, 1.12, 0], rime);
  box(g, 'torch', [0.1, 0.1, 0.5], [0.75, 0.95, 0.3], rime);
  box(g, 'sparkCoil', [0.4, 0.55, 0.3], [0, 1.55, -0.4], rime);
  socket(g, 'CoreSpark', [0.75, 0.95, 0.58]);
  socket(g, 'FlareBlind', [0.42, 1.0, 0.45]);
  return g;
}
