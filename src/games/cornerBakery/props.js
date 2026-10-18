// Kenney CC0 props (see CREDITS.md), packed into one meshopt-compressed GLB.
// Each model is a top-level node named after its source file, e.g. "croissant".
// The file is imported as a URL; the single-file build inlines it as a data: URI.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import propsUrl from './assets/bakery-props.glb?url';

let loading = null;
const templates = new Map();

/** Load once per session; resolves to true when the models are available. */
export function loadProps() {
  if (!loading) {
    loading = new Promise((resolve) => {
      const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(propsUrl, (gltf) => {
        for (const node of [...gltf.scene.children]) {
          node.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.side = THREE.FrontSide; } });
          templates.set(node.name, node);
        }
        resolve(true);
      }, undefined, (err) => { console.warn('[corner-bakery] props failed to load, using placeholders', err); resolve(false); });
    });
  }
  return loading;
}
export const hasProp = (name) => templates.has(name);

/**
 * A fresh instance of a prop, scaled so its largest dimension (or height, with
 * {by:'height'}) equals `size`, centred on x/z and resting on y = 0.
 */
export function prop(name, size = 1, { by = 'max', color = null } = {}) {
  const t = templates.get(name);
  let obj;
  if (t) obj = t.clone(true);
  else { obj = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: color || '#c9a27a' })); obj.position.y = 0.5; }
  obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0); obj.scale.set(1, 1, 1);
  const wrap = new THREE.Group(); wrap.add(obj); wrap.name = name;
  const box = new THREE.Box3().setFromObject(wrap), sz = box.getSize(new THREE.Vector3());
  const s = size / Math.max(by === 'height' ? sz.y : Math.max(sz.x, sz.y, sz.z), 1e-6);
  obj.scale.setScalar(s);
  const b2 = new THREE.Box3().setFromObject(wrap), c = b2.getCenter(new THREE.Vector3());
  obj.position.set(-c.x, -b2.min.y, -c.z);
  return wrap;
}

/**
 * Renders small transparent icons of props with the game's renderer.
 * Render targets skip output colour conversion, so pixels are converted
 * linear -> sRGB by hand. Returns { [key]: dataURL }.
 */
export function renderIcons(renderer, list, size = 112) {
  const out = {};
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9a27a', 2.2));
  const key = new THREE.DirectionalLight('#fff4e0', 2.6); key.position.set(2, 4, 3); scene.add(key);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  const prevTarget = renderer.getRenderTarget(), prevColor = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  const buf = new Uint8Array(size * size * 4);
  const lut = new Uint8Array(256); for (let i = 0; i < 256; i++) { const l = i / 255; lut[i] = Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055)); }
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; const g = canvas.getContext('2d');
  try {
    for (const [k, name, tint] of list) {
      const obj = prop(name, 1);
      if (tint) obj.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); } });
      scene.add(obj);
      const sph = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
      cam.position.set(sph.center.x + sph.radius * 1.9, sph.center.y + sph.radius * 2.2, sph.center.z + sph.radius * 2.9);
      cam.lookAt(sph.center); cam.near = sph.radius * 0.1; cam.far = sph.radius * 20; cam.updateProjectionMatrix();
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
      const img = g.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const si = ((size - 1 - y) * size + x) * 4, di = (y * size + x) * 4, a = buf[si + 3];
        // MSAA edges come out premultiplied (blended over transparent black): un-premultiply, then convert
        const k = a > 0 ? 255 / a : 0, ch = (v) => lut[Math.min(255, Math.round(v * k))];
        img.data[di] = ch(buf[si]); img.data[di + 1] = ch(buf[si + 1]); img.data[di + 2] = ch(buf[si + 2]); img.data[di + 3] = a;
      }
      g.clearRect(0, 0, size, size); g.putImageData(img, 0, 0);
      out[k] = canvas.toDataURL('image/png');
      scene.remove(obj);
      if (tint) obj.traverse(o => { if (o.isMesh) o.material.dispose(); });
    }
  } catch (e) { console.warn('[corner-bakery] icon render failed', e); }
  renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevColor, prevAlpha);
  rt.dispose();
  return out;
}
