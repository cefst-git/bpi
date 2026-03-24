// BPI-82 Service Worker — cache-first, offline-capable
const CACHE_NAME = 'bpi82-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/desktop.html',
  '/mobile.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap'
];

// Install: pre-cache all core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can; ignore failures for external resources
      return Promise.allSettled(
        ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('Cache miss:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for local assets, network-first for external
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;
  const isChartJs = event.request.url.includes('chart.umd.min.js');
  const isFonts = event.request.url.includes('fonts.googleapis.com') ||
                  event.request.url.includes('fonts.gstatic.com');

  if (isLocal || isChartJs || isFonts) {
    // Cache-first
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          // Offline fallback for HTML pages
          if (event.request.destination === 'document') {
            return caches.match('/mobile.html') || caches.match('/index.html');
          }
        });
      })
    );
  } else {
    // Network-first for everything else
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
