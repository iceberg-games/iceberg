// Iceberg service worker. Scope = the folder this file is served from (relative,
// so it works at / and under a GitHub Pages sub-path like /iceberg/).
// Caches ONLY the static app shell. Never touches auth/API traffic: any cross-origin
// request (Supabase) and any same-origin /auth/, /rest/, /realtime/, /functions/,
// /storage/ path goes straight to the network, uncached.
const VERSION = '__BUILD_ID__';
const CACHE = `iceberg-shell-${VERSION}`;
const SHELL = ['./', './index.html', './play/', './play/index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png'];
const BYPASS = /\/(auth|rest|realtime|functions|storage|graphql)\/v\d/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(p => new URL(p, self.registration.scope)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('iceberg-shell-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                  // Supabase & all third parties: untouched
  if (BYPASS.test(url.pathname) || req.headers.has('authorization')) return;
  if (!url.href.startsWith(self.registration.scope)) return;
  if (req.mode === 'navigate') {                                     // network first, offline fallback
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); if (res.ok) caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match(new URL('./', self.registration.scope)))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {                     // stale-while-revalidate for static files
    const net = fetch(req).then(res => { if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; });
    return hit || net;
  }));
});
