import * as THREE from 'three';
export const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
export function box(parent, name, size, pos, material, rot) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  m.name = name; m.position.set(...pos); if (rot) m.rotation.set(...rot);
  m.castShadow = true; parent.add(m); return m;
}
export function socket(parent, name, pos) {
  const e = new THREE.Object3D(); e.name = name; e.position.set(...pos); parent.add(e); return e;
}
/** Classic blocky body (classic avatar proportions: legs 1, torso 1x1x0.5, head 0.62). */
export function body(g, c) {
  box(g, 'legL', [0.5, 1, 0.5], [-0.25, 0.5, 0], c.legs);
  box(g, 'legR', [0.5, 1, 0.5], [0.25, 0.5, 0], c.legs);
  box(g, 'torso', [1, 1, 0.5], [0, 1.5, 0], c.torso);
  box(g, 'armL', [0.5, 1, 0.5], [-0.75, 1.5, 0], c.arms);
  box(g, 'armR', [0.5, 1, 0.5], [0.75, 1.5, 0], c.arms);
  box(g, 'head', [0.62, 0.62, 0.62], [0, 2.31, 0], c.head);
}
