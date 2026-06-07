// frontend/public/sw.js
// Minimal app-shell service worker. Cache-first for same-origin static assets so
// the PWA opens instantly and survives flaky job-site connectivity. Phase 4 does
// NOT cache or queue time-card submissions offline — API calls always hit the
// network (and fail loudly if offline). Bump CACHE when the shell changes.
const CACHE = 'timereport-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/app-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API traffic or non-GET — always go to the network.
  if (request.method !== 'GET' || url.pathname.startsWith('/api') || url.origin !== self.location.origin) {
    return; // default browser handling
  }

  // Navigations: network-first so users get fresh HTML, falling back to the cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets: cache-first, then populate the cache on miss.
  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((resp) => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return resp;
      }).catch(() => cached)
    )
  );
});
