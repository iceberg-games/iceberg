// DEV PREVIEW ONLY (imported first by the preview entries; never part of the main site).
// The preview lives on the same origin as the real site (/iceberg/preview/), so it would share
// localStorage + IndexedDB with it: real sessions, guest progress, Studio drafts, settings.
// Before ANY app code runs, give the preview its own namespace so it can never read, overwrite,
// migrate or clear the real site's data:
//   localStorage key k  -> 'iceberg-preview:' + k        (the real keys stay invisible + untouched)
//   IndexedDB db name n -> 'iceberg-preview:' + n
//   no service worker registration, no PWA install prompt.
// The real (prod) sign-in is exposed READ-ONLY to the gate via readRealItem().
export const PREFIX = 'iceberg-preview:';

export function namespacedStorage(real, prefix = PREFIX) {
  const keys = () => { const out = []; for (let i = 0; i < real.length; i++) { const k = real.key(i); if (k != null && k.startsWith(prefix)) out.push(k.slice(prefix.length)); } return out; };
  const api = {
    getItem: (k) => real.getItem(prefix + k),
    setItem: (k, v) => real.setItem(prefix + k, String(v)),
    removeItem: (k) => real.removeItem(prefix + k),
    clear: () => keys().forEach(k => real.removeItem(prefix + k)),
    key: (i) => keys()[i] ?? null,
    get length() { return keys().length; },
  };
  return new Proxy({}, {
    get: (_, k) => (k in api ? api[k] : typeof k === 'string' ? (real.getItem(prefix + k) ?? undefined) : undefined),
    set: (_, k, v) => { if (typeof k === 'string' && !(k in api)) api.setItem(k, v); return true; },
    deleteProperty: (_, k) => { if (typeof k === 'string') api.removeItem(k); return true; },
    has: (_, k) => k in api || (typeof k === 'string' && real.getItem(prefix + k) !== null),
    ownKeys: () => keys(),
    getOwnPropertyDescriptor: (_, k) => (typeof k === 'string' && real.getItem(prefix + k) !== null
      ? { value: real.getItem(prefix + k), writable: true, enumerable: true, configurable: true } : undefined),
  });
}

let realStorage = null;
export const readRealItem = (k) => { try { return realStorage ? realStorage.getItem(k) : null; } catch { return null; } };

export function isolate(win = globalThis) {
  try { realStorage = win.localStorage; } catch { realStorage = null; }
  if (realStorage) Object.defineProperty(win, 'localStorage', { value: namespacedStorage(realStorage), configurable: true, enumerable: true });
  const F = win.IDBFactory?.prototype;
  if (F && !F.__icebergPreview) {
    const open = F.open, del = F.deleteDatabase;
    F.open = function (name, ...rest) { return open.call(this, PREFIX + name, ...rest); };
    F.deleteDatabase = function (name, ...rest) { return del.call(this, PREFIX + name, ...rest); };
    F.__icebergPreview = true;
  }
  const sw = win.navigator?.serviceWorker;
  if (sw) { try { Object.defineProperty(sw, 'register', { value: () => Promise.resolve(null), configurable: true }); } catch { /* ignore */ } }
  win.addEventListener?.('beforeinstallprompt', (e) => e.preventDefault());
}

if (typeof window !== 'undefined') isolate(window);
