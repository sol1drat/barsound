const CACHE = 'barsound-shell-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  // do not cache dynamic blobs from IndexedDB
];

self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', evt => {
  // ignore requests for object URLs and IndexedDB data (they're not network requests)
  evt.respondWith(
    caches.match(evt.request).then(cached => cached || fetch(evt.request).catch(() => cached))
  );
});
