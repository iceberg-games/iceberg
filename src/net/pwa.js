// Registers the service worker that lives at the site root (sw.js), using a path
// relative to the current page so it works under any sub-path (e.g. GitHub Pages /repo/).
export function registerServiceWorker(rootRelative = './') {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return null;
  const url = new URL(rootRelative + 'sw.js', location.href);
  const scope = new URL(rootRelative, location.href).pathname;
  return navigator.serviceWorker.register(url.href, { scope }).catch((e) => { console.warn('SW registration failed', e); return null; });
}
