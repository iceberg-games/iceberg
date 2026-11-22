// Small snapshot of the player's REAL avatar (current body, loadout, cosmetics, colors) using the existing avatar
// renderer (Avatar.root). A throw-away WebGL renderer draws it once into a PNG; the avatar is put back exactly as it was.
import * as THREE from 'three';

export function avatarSnapshot(avatar, renderer, { w = 200, h = 280 } = {}) {
  if (!avatar?.root || !renderer) return null;   // no renderer yet: the caller shows a plain figure
  let rt = null; const root = avatar.root, parent = root.parent;
  const saved = { p: root.position.clone(), q: root.quaternion.clone(), s: root.scale.clone() };
  const prevRT = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  try {
    rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#8a8396', 1.6));
    const sun = new THREE.DirectionalLight('#fff4e6', 2.4); sun.position.set(2, 4, 4); scene.add(sun);
    const rim = new THREE.DirectionalLight('#b79cff', 1.1); rim.position.set(-3, 2, -2); scene.add(rim);
    scene.add(root); root.position.set(0, 0, 0); root.quaternion.identity(); root.rotation.y = 0.5; root.scale.set(1, 1, 1); root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root); const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const cam = new THREE.PerspectiveCamera(28, w / h, 0.1, 100);
    const half = Math.tan(THREE.MathUtils.degToRad(14));
    const dist = Math.max(size.y * 0.5 / half, size.x * 0.5 / half / (w / h)) * 1.15;
    cam.position.set(ctr.x, ctr.y + size.y * 0.04, ctr.z + dist); cam.lookAt(ctr);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
    const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);   // GL rows are bottom-up
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  } catch (e) { console.warn('avatar snapshot failed', e); return null; }
  finally {
    try { renderer.setRenderTarget(prevRT); renderer.setClearColor(prevClear, prevAlpha); } catch { /* ignore */ }
    try { root.parent?.remove(root); parent?.add(root); root.position.copy(saved.p); root.quaternion.copy(saved.q); root.scale.copy(saved.s); } catch { /* ignore */ }
    try { rt?.dispose(); } catch { /* ignore */ }
  }
}
