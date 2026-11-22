// Small snapshot of the player's REAL avatar (current body, loadout, cosmetics, colors) using the existing avatar
// renderer (Avatar.root). A throw-away WebGL renderer draws it once into a PNG; the avatar is put back exactly as it was.
import * as THREE from 'three';

export function avatarSnapshot(avatar, { w = 200, h = 280 } = {}) {
  if (!avatar?.root) return null;
  let r = null; const root = avatar.root, parent = root.parent;
  const saved = { p: root.position.clone(), q: root.quaternion.clone(), s: root.scale.clone() };
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(w, h); r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#8a8396', 1.5));
    const sun = new THREE.DirectionalLight('#fff4e6', 2.2); sun.position.set(2, 4, 4); scene.add(sun);
    const rim = new THREE.DirectionalLight('#b79cff', 1.0); rim.position.set(-3, 2, -2); scene.add(rim);
    scene.add(root); root.position.set(0, 0, 0); root.quaternion.identity(); root.rotation.y = 0.5; root.scale.set(1, 1, 1); root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root); const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const cam = new THREE.PerspectiveCamera(28, w / h, 0.1, 100);
    const dist = Math.max(size.y * 0.5 / Math.tan(THREE.MathUtils.degToRad(14)), size.x * 0.5 / Math.tan(THREE.MathUtils.degToRad(14)) / (w / h)) * 1.15;
    cam.position.set(ctr.x, ctr.y + size.y * 0.04, ctr.z + dist); cam.lookAt(ctr);
    r.render(scene, cam);
    return r.domElement.toDataURL('image/png');
  } catch (e) { console.warn('avatar snapshot failed', e); return null; }
  finally {
    try { root.parent?.remove(root); parent?.add(root); root.position.copy(saved.p); root.quaternion.copy(saved.q); root.scale.copy(saved.s); } catch { /* ignore */ }
    try { r?.dispose(); r?.forceContextLoss?.(); } catch { /* ignore */ }
  }
}
