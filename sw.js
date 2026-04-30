const CACHE = 'barsound-shell-v3';

const ASSETS = [
  './',
  'index.html',
  'style.css',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-180.png'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request).then(cached => {
      if (cached) return cached;

      return fetch(evt.request).catch(() => {
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
