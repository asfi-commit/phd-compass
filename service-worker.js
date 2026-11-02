const CACHE = 'phd-compass-shell-v2';
const URLS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './seed.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('phd-compass-shell-') && k !== CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkFetch);
        return cached;
      }
      const response = await networkFetch;
      if (response) return response;
      if (event.request.mode === 'navigate') {
        return cache.match('./index.html');
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});
