const CACHE_NAME = 'joulane-pwa-v4';
const ASSETS = [
  '/',
  '/stock.html',
  '/admin.html',
  '/manifest.json',
  '/manifest-stock.json',
  '/manifest-admin.json',
  '/images/logo.png',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/icon-maskable-192.png',
  '/images/icon-maskable-512.png',
  '/images/joulane-cover.png',
  '/images/303-3.PNG'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).catch(err => console.warn('Cache error:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then(async (response) => {
      const requestUrl = new URL(event.request.url);
      if (response.ok && requestUrl.origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      if (event.request.mode === 'navigate') {
        const fallback = await caches.match('/');
        return fallback || new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      return new Response('', { status: 503, statusText: 'Offline' });
    })
  );
});
