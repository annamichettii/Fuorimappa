/* Fuori Mappa · Service Worker minimale: rete prioritaria, cache solo come fallback. */
const CACHE_NAME = 'fuorimappa-pwa-v1';
const APP_SHELL = ['/', '/index.html', '/offline.html', '/app-icon-192.png', '/app-icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('fuorimappa-pwa-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // Do not intercept submissions, analytics, newsletter or partner services.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode !== 'navigate') return;
  event.respondWith(
    fetch(req).then(response => {
      // Current online pages always win; avoid caching forms or submitted data.
      return response;
    }).catch(async () => {
      const cached = await caches.match(req, {ignoreSearch: true});
      return cached || await caches.match('/offline.html');
    })
  );
});
