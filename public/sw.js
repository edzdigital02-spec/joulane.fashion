const CACHE_NAME = 'joulane-pwa-v14';
const ASSETS = [
  '/',
  '/stock.html',
  '/admin.html',
  '/manifest.json',
  '/manifest-stock.json',
  '/manifest-admin.json',
  'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/skilwjfxosy60qtgwkxw.jpg',
  'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955418/joulane/products/opsarwpedahajpkgostn.png',
  'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955418/joulane/products/ngi3kklpj1yduujoqt4s.png',
  'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955418/joulane/products/hc5wkqa1gaomvsmt5qek.png',
  'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955418/joulane/products/k4flmagfquaghtdm8eer.png',
  'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/qvyvxxiae7cjygigkrtw.jpg',
  'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg'
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
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      if (event.request.mode === 'navigate') {
        const fallbackPath = requestUrl.pathname.endsWith('/admin.html')
          ? '/admin.html'
          : requestUrl.pathname.endsWith('/stock.html') ? '/stock.html' : '/';
        const fallback = await caches.match(fallbackPath);
        return fallback || new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      return new Response('', { status: 503, statusText: 'Offline' });
    })
  );
});
