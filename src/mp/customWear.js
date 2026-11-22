// Apply a published custom-wear model ref on a (usually remote) avatar.
import * as THREE from 'three';
import { CONFIG } from '../net/config.js';
import { parseWearRef } from '../game/modelAssets.js';

export function wearPlaceholder(kind = 'loading') {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshStandardMaterial({ color: kind === 'error' ? '#ff3355' : '#8ecbff', wireframe: true, transparent: true, opacity: 0.85 }),
  );
  mesh.position.y = 0.1;
  mesh.userData.placeholder = kind;
  g.add(mesh);
  g.userData.placeholder = kind;
  return g;
}

export function sameWear(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.hash === b.hash && a.id === b.id && a.bone === b.bone
    && a.scale === b.scale && a.x === b.x && a.y === b.y && a.z === b.z && a.rotY === b.rotY;
}

export async function applyRemoteWear(avatar, raw, library, { supabaseUrl } = {}) {
  if (!avatar) return { ok: false, reason: 'no_avatar' };
  if (!raw) { avatar.setCustomWear(null); return { ok: true, cleared: true }; }
  const parsed = parseWearRef(raw, { supabaseUrl: supabaseUrl || CONFIG.supabaseUrl });
  if (!parsed.ok) {
    avatar.setCustomWear(wearPlaceholder('error'), { bone: 'head', scale: 0.5, x: 0, y: 0.62, z: 0, rotY: 0 });
    return parsed;
  }
  const pose = parsed.ref;
  if (!library?.has(pose.id)) {
    avatar.setCustomWear(wearPlaceholder('loading'), pose);
    const got = await library?.ensureAsset?.(pose);
    if (!got?.ok) {
      avatar.setCustomWear(wearPlaceholder('error'), pose);
      return got || { ok: false, reason: 'no_library' };
    }
  }
  const obj = library.instance(pose.id);
  if (!obj) {
    avatar.setCustomWear(wearPlaceholder('error'), pose);
    return { ok: false, reason: 'missing' };
  }
  avatar.setCustomWear(obj, pose);
  return { ok: true, ref: pose };
}
