// The ONE THREE.AudioListener for the whole app (positional audio: cosmetics, games, sound effects).
// Everyone reuses it: import { getAudioListener } from '../core/audio.js', or window.iceberg.getAudioListener().
// Never create another AudioListener. It is attached to the engine camera by main.js (setAudioCamera).
//
//   getAudioListener()        -> THREE.AudioListener (created on first call; its AudioContext starts
//                                suspended and is resumed on the first user gesture, per browser autoplay rules)
//   setAudioCamera(camera)    -> parent the listener to this camera (idempotent)
//   audioUnlocked()           -> true once the AudioContext is running
import * as THREE from 'three';

let listener = null, camera = null, hooked = false;

function hookResume(ctx) {
  if (hooked || typeof addEventListener !== 'function') return;
  hooked = true;
  const resume = () => {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (ctx.state === 'running') for (const ev of ['pointerdown', 'keydown', 'touchend']) removeEventListener(ev, resume, true);
  };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, resume, { capture: true, passive: true });
}

export function getAudioListener() {
  if (!listener) {
    listener = new THREE.AudioListener();
    hookResume(listener.context);
    if (camera && listener.parent !== camera) camera.add(listener);
  }
  return listener;
}
export function setAudioCamera(cam) {
  camera = cam || null;
  if (listener && camera && listener.parent !== camera) camera.add(listener);
}
export const audioUnlocked = () => listener?.context.state === 'running';
