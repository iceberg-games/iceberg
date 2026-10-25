// Sled Rush course: Set Builder's night run (./set, copied from blockworld-sets @ fa56664) for terrain,
// lodge, pines, ramps, boost pads and finish arch; this file adds the gameplay layer on top:
// glowing gates, soft obstacles (snowmen / rocks) and course math in (d = distance downhill, off = lateral).
import * as THREE from 'three';
import SET from './set/index.js';
import { TRACK as ST, RAMPS, BOOST_PADS, ANCHORS, centerX as cx, groundHeight } from './set/layout.js';
import { TRACK } from './config.js';

export const LENGTH = -ST.finishZ;        // 540
export const HALF = ST.halfWidth;         // 8
export const centerX = (d) => cx(-d);
export const heightAt = (d, off = 0) => groundHeight(cx(-d) + off, -d);
export const worldAt = (d, off, out = new THREE.Vector3()) => out.set(cx(-d) + off, heightAt(d, off), -d);
export const headingAt = (d) => Math.atan2(cx(-(d + 1)) - cx(-(d - 1)), 2);  // lateral drift per metre downhill
export const SPAWN = ANCHORS.start;

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

export async function buildTrack(renderer) {
  const set = await SET.create({ renderer });
  const scene = set.scene, root = new THREE.Group(); scene.add(root);
  const disposables = []; const own = (x) => { disposables.push(x); return x; };
  const R = rng(7);
  const items = { gates: [], boosts: [], ramps: [], rocks: [] };

  for (const b of BOOST_PADS) items.boosts.push({ d: -b.z, off: b.x - cx(b.z), half: b.radius, len: b.radius, used: false });
  for (const r of RAMPS) items.ramps.push({ d: -r.z });

  const gateGeo = own(new THREE.TorusGeometry(1, 0.14, 8, 32, Math.PI));
  for (let i = 0; i < TRACK.gates; i++) {
    const d = 25 + i * (LENGTH - 50) / TRACK.gates + R() * 6;
    if (items.ramps.some(r => Math.abs(r.d - d) < 14)) continue;
    const off = (R() - 0.5) * (HALF * 2 - 7), hue = i % 2 ? '#7ff0ff' : '#ff8ae0';
    const mat = own(new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.95, fog: false }));
    const arch = new THREE.Mesh(gateGeo, mat); worldAt(d, off, arch.position); arch.scale.setScalar(2.6);
    arch.rotation.y = headingAt(d); root.add(arch);
    items.gates.push({ d, off, half: 2.3, mesh: arch, mat, hit: false });
  }
  const snowMat = own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }));
  const ballGeo = own(new THREE.SphereGeometry(1, 14, 10)), noseGeo = own(new THREE.ConeGeometry(0.12, 0.6, 6)); noseGeo.rotateX(Math.PI / 2);
  const noseMat = own(new THREE.MeshStandardMaterial({ color: '#ff8a2a', emissive: '#662200' }));
  for (let i = 0; i < TRACK.rocks; i++) {
    const d = 40 + R() * (LENGTH - 80), off = (R() - 0.5) * (HALF * 2 - 3);
    if ([...items.gates, ...items.boosts].some(o => Math.abs(o.d - d) < 9) || items.ramps.some(r => Math.abs(r.d - d) < 18)) continue;
    const o = new THREE.Group(); const a = new THREE.Mesh(ballGeo, snowMat), b = new THREE.Mesh(ballGeo, snowMat), n = new THREE.Mesh(noseGeo, noseMat);
    a.scale.setScalar(0.9); a.position.y = 0.8; b.scale.setScalar(0.6); b.position.y = 2.1; n.position.set(0, 2.15, 0.6); o.add(a, b, n);
    a.castShadow = b.castShadow = true;
    worldAt(d, off, o.position); o.rotation.y = Math.PI; root.add(o); items.rocks.push({ d, off, r: 1.1, mesh: o, hit: false });
  }

  return {
    scene, root, items, set,
    update(dt, t) { set.update?.(dt, t); for (const gt of items.gates) if (!gt.hit) gt.mesh.scale.setScalar(2.6 + Math.sin(t * 4 + gt.d) * 0.1); },
    reset() {
      for (const b of items.boosts) b.used = false;
      for (const gt of items.gates) { gt.hit = false; gt.mat.opacity = 0.95; gt.mesh.visible = true; }
      for (const r of items.rocks) { r.hit = false; r.mesh.visible = true; r.mesh.scale.setScalar(1); }
    },
    dispose() { disposables.forEach(x => x.dispose()); scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); }); }); },
  };
}
