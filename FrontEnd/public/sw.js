// Basic service worker with caching strategies for offline support
const CACHE_NAME = 'abr-catalogo-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// A simple fetch handler:
// - navigation requests: network-first, fallback to cache
// - API requests (/api): network-first
// - other requests: cache-first then network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((resp) => {
        const responseClone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        return resp;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.pathname.startsWith('/api')) {
    // network-first for API
    event.respondWith(
      fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return resp;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // For static resources: try cache first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((resp) => {
      // cache fetched assets for future
      if (resp && resp.status === 200 && request.method === 'GET') {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return resp;
    }).catch(() => {
      // fallback to nothing
      return cached;
    }))
  );
});
