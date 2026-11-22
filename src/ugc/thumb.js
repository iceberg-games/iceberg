// Offscreen thumbnail renderer for UGC catalog cards (one shared tiny WebGL context, cached by spec).
import * as THREE from 'three';
import { buildUgcObject } from './spec.js';

let R = null; const cache = new Map();
function rig() {
  if (R) return R;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(160, 160, false); renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#9ccbe8', 1.6));
  const d = new THREE.DirectionalLight('#ffffff', 2.2); d.position.set(2, 3, 4); scene.add(d);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  return (R = { renderer, scene, camera });
}
/** spec -> PNG data URL (null when WebGL is unavailable). */
export function renderUgcThumb(spec) {
  const key = JSON.stringify(spec);
  if (cache.has(key)) return cache.get(key);
  let url = null;
  try {
    const { renderer, scene, camera } = rig();
    const { object } = buildUgcObject(spec);
    object.rotation.y = -0.55;
    scene.add(object);
    const box = new THREE.Box3().setFromObject(object), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length() || 1;
    camera.position.set(c.x + s * 0.55, c.y + s * 0.45, c.z + s * 1.75); camera.lookAt(c);
    renderer.render(scene, camera);
    url = renderer.domElement.toDataURL('image/png');
    scene.remove(object); object.userData.dispose?.();
  } catch (e) { console.warn('ugc thumb', e); }
  cache.set(key, url);
  return url;
}
