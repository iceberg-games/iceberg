// Snapshot of the player's real avatar (current body, loadout, cosmetics) using the game renderer.
// Neutral standing pose, ~18° yaw toward the camera, full body framed, head centered on the torso.
import * as THREE from 'three';

const YAW = THREE.MathUtils.degToRad(18);   // 15–20°, face still toward the viewer
const FOV = 18;                              // long lens: keeps the head on the torso (no close-up distortion)
const PAD = 1.16;

export function avatarSnapshot(avatar, renderer, { w = 200, h = 280 } = {}) {
  if (!avatar?.root || !renderer) return null;
  const root = avatar.root, parent = root.parent;
  const savedRoot = { p: root.position.clone(), q: root.quaternion.clone(), s: root.scale.clone() };
  const bones = Object.values(avatar.bones || {});
  const savedBones = bones.map(b => b.rotation.clone());
  const prevRT = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevVP = new THREE.Vector4(); renderer.getViewport(prevVP);
  const rw = w * 2, rh = h * 2;          // 2× then downsample (avoids MSAA readback issues)
  let rt = null;
  try {
    for (const b of bones) b.rotation.set(0, 0, 0);
    root.position.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.rotation.set(0, YAW, 0);
    root.updateMatrixWorld(true);

    const box = bodyBox(avatar);
    const size = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());
    // Aim at the torso midline (not the bbox center, which arms can pull sideways).
    const look = new THREE.Vector3();
    (avatar.bones?.torso || root).getWorldPosition(look);
    look.y = mid.y;

    const cam = new THREE.PerspectiveCamera(FOV, w / h, 0.1, 100);
    const half = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const dist = Math.max(size.y * 0.5 / half, (size.x * 0.5) / half / (w / h)) * PAD;
    cam.position.set(look.x, look.y + size.y * 0.02, look.z + dist);
    cam.lookAt(look);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#8a8396', 1.5));
    const sun = new THREE.DirectionalLight('#fff4e6', 2.2); sun.position.set(2, 4, 6); scene.add(sun);
    const fill = new THREE.DirectionalLight('#ffe8d2', 0.7); fill.position.set(-1, 2, 5); scene.add(fill);
    const rim = new THREE.DirectionalLight('#b79cff', 0.9); rim.position.set(-3, 2, -2); scene.add(rim);
    scene.add(root);

    rt = new THREE.WebGLRenderTarget(rw, rh, { samples: 0 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    renderer.setRenderTarget(rt);
    renderer.setViewport(0, 0, rw, rh);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, cam);

    const px = new Uint8Array(rw * rh * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, rw, rh, px);
    const src = document.createElement('canvas'); src.width = rw; src.height = rh;
    const sg = src.getContext('2d');
    const img = sg.createImageData(rw, rh);
    for (let y = 0; y < rh; y++) img.data.set(px.subarray((rh - 1 - y) * rw * 4, (rh - y) * rw * 4), y * rw * 4);
    sg.putImageData(img, 0, 0);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, w, h);
    return c.toDataURL('image/png');
  } catch (e) {
    console.warn('avatar snapshot failed', e);
    return null;
  } finally {
    try { renderer.setRenderTarget(prevRT); renderer.setClearColor(prevClear, prevAlpha); renderer.setViewport(prevVP); } catch { /* ignore */ }
    try {
      root.parent?.remove(root);
      parent?.add(root);
      root.position.copy(savedRoot.p);
      root.quaternion.copy(savedRoot.q);
      root.scale.copy(savedRoot.s);
      bones.forEach((b, i) => b.rotation.copy(savedBones[i]));
      root.updateMatrixWorld(true);
    } catch { /* ignore */ }
    try { rt?.dispose(); } catch { /* ignore */ }
  }
}

function bodyBox(avatar) {
  const box = new THREE.Box3();
  const parts = ['head', 'torso', 'armL', 'armR', 'legL', 'legR']
    .map(n => avatar.bodyMeshes?.[n] || avatar.bones?.[n])
    .filter(Boolean);
  if (parts.length) parts.forEach(p => box.expandByObject(p));
  else box.setFromObject(avatar.root);
  return box;
}
