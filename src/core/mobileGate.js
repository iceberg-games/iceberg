// TEMPORARY phone block (Editor Update): phones / touch-only devices see "Sorry, mobile is being fixed right now."
// ALL phone code (Mobile Studio, touch controls, phone menu layout) stays in the repo behind this gate.
// To re-enable phones, set MOBILE_BLOCKED = false (one flag). Testing escape hatch: add ?allowMobile=1 to the URL.
import { detectDeviceMode } from './device.js';
import './mobileGate.css';

export const MOBILE_BLOCKED = true;

/** True for a real phone/tablet-class touch device with a small screen. PC browsers in a narrow window are NOT blocked. */
export function isBlockedMobile() {
  if (!MOBILE_BLOCKED) return false;
  try {
    if (new URLSearchParams(location.search).get('allowMobile') === '1') return false;
    if (detectDeviceMode() !== 'mobile') return false;        // existing detection (mobile UA / coarse-touch-only), never the saved picker choice
    const small = Math.min(screen.width || 9999, screen.height || 9999) <= 900 || Math.min(innerWidth, innerHeight) <= 600;
    return small;
  } catch { return false; }
}

/** Replace the page with the friendly message. */
export function showMobileBlock(root = document.body) {
  root.innerHTML = '';
  const el = document.createElement('div'); el.id = 'mobile-block';
  el.innerHTML = '<div class="mb-card"><div class="mb-logo">🧊</div><h1>Iceberg</h1><p>Sorry, mobile is being fixed right now.</p><small>Please play on a computer for now. We will be back on phones soon!</small></div>';
  root.append(el);
  document.title = 'Iceberg: mobile is being fixed';
}
