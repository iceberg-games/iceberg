// Device mode: 'computer' (keyboard + mouse, Create/Studio available) or
// 'mobile' (on-screen touch controls, Create/Studio hidden).
//
//   import { getDeviceMode, setDeviceMode, onDeviceChange } from '../core/device.js';
//   getDeviceMode()            -> 'computer' | 'mobile'
//   setDeviceMode('mobile')    -> saves to localStorage, emits bus 'device:changed'
//   bus.on('device:changed', ({ mode, previous }) => ...)
//   window.addEventListener('device:changed', (e) => e.detail.mode)
//
// The choice is remembered in localStorage (iceberg:v1:deviceMode). Until the
// player picks, getDeviceMode() returns the auto-detected suggestion.
import { bus } from './events.js';

export const DEVICE_MODES = ['computer', 'mobile'];
const KEY = 'iceberg:v1:deviceMode';

/** Best guess from the browser: coarse pointer / touch-only / mobile UA => 'mobile'. */
export function detectDeviceMode() {
  try {
    const mm = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
    const coarse = mm('(pointer: coarse)');
    const fineAvailable = mm('(any-pointer: fine)');
    const touch = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || (typeof window !== 'undefined' && 'ontouchstart' in window);
    const uaData = typeof navigator !== 'undefined' && navigator.userAgentData;
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    const mobileUA = (uaData && uaData.mobile) || /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua);
    // iPadOS reports a desktop Safari UA; it shows up as touch + coarse pointer.
    if (mobileUA) return 'mobile';
    if (coarse && touch && !fineAvailable) return 'mobile';
    return 'computer';
  } catch { return 'computer'; }
}

function readStored() {
  try { const v = localStorage.getItem(KEY); return DEVICE_MODES.includes(v) ? v : null; } catch { return null; }
}

let current = readStored() || detectDeviceMode();

/** True once the player has explicitly chosen (picker can be skipped). */
export function hasChosenDeviceMode() { return readStored() != null; }

export function getDeviceMode() { return current; }
export const isMobile = () => current === 'mobile';

export function setDeviceMode(mode) {
  if (!DEVICE_MODES.includes(mode)) throw new Error(`Unknown device mode: ${mode}`);
  try { localStorage.setItem(KEY, mode); } catch { /* private mode */ }
  const previous = current;
  current = mode;
  applyBodyClass();
  if (previous !== mode) {
    const detail = { mode, previous };
    bus.emit('device:changed', detail);
    try { window.dispatchEvent(new CustomEvent('device:changed', { detail })); } catch { /* non-browser */ }
  }
  return mode;
}

export function onDeviceChange(fn) { return bus.on('device:changed', fn); }

/** Adds body.device-computer / body.device-mobile so CSS can hide Create/Studio etc. */
export function applyBodyClass() {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle('device-mobile', current === 'mobile');
  document.body.classList.toggle('device-computer', current === 'computer');
}
applyBodyClass();
