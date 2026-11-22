// "Install Iceberg" (PWA). Captures beforeinstallprompt as early as possible so the home screen's Download button can
// trigger the native install dialog. When the browser offers no prompt we show short manual instructions instead.
let deferred = null;
const listeners = new Set();
const emit = () => listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener('appinstalled', () => { deferred = null; try { localStorage.setItem('iceberg:v1:installed', '1'); } catch { /* private */ } emit(); });
}
export const onInstallChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const canPromptInstall = () => !!deferred;
/** Already running as an installed app window. */
export const isInstalledApp = () => { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true; } catch { return false; } };
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const d = deferred; deferred = null; emit();
  try { await d.prompt(); const r = await d.userChoice; return r?.outcome || 'dismissed'; } catch { return 'dismissed'; }
}
/** Short, browser-specific manual steps. */
export function installInstructions() {
  const ua = navigator.userAgent || '';
  if (/Edg\//.test(ua)) return 'In Edge: open the ⋯ menu → Apps → Install Iceberg.';
  if (/Firefox\//.test(ua)) return 'Firefox on desktop cannot install web apps. Use Chrome or Edge, or keep Iceberg open in a tab.';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'In Safari: File menu → Add to Dock.';
  return 'In Chrome: click the install icon at the right end of the address bar (or ⋮ menu → Cast, save and share → Install page as app).';
}
