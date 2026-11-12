const CACHE_NAME = 'vector-svg-v11';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './svgs.json',
  './css/app.css',
  './css/components.css',
  './css/viewer.css',
  './js/app.js',
  './js/library.js',
  './js/viewer.js',
  './js/export.js',
  './js/storage.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Do not cache API requests
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ status: 'offline' }), {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Network first, falling back to cache
  e.respondWith(
    fetch(e.request).then((response) => {
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }
      const toCache = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(e.request, toCache));
      return response;
    }).catch(() => caches.match(e.request))
  );
});
