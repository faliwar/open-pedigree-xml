/* Service Worker for OPX Pedigree Editor PWA */
var CACHE_NAME = 'opx-pwa-v2';

var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './version.json',
  './pedigree.min.js',
  './assets/favicon-16x16.png',
  './assets/favicon-32x32.png',
  './assets/apple-touch-icon.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './public/vendor/prototype-1.7.3.js',
  './public/vendor/scriptaculous/effects.js',
  './public/vendor/scriptaculous/dragdrop.js',
  './public/vendor/scriptaculous/slider.js',
  './public/vendor/filesaver/Blob.js',
  './public/vendor/filesaver/FileSaver.js',
  './public/vendor/xwiki/xwiki-min.js',
  './public/vendor/phenotips/Widgets.js',
  './public/vendor/phenotips/DateTimePicker.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(
        PRECACHE_URLS.map(function(url) {
          return cache.add(url).catch(function() {
            // Do not fail installation if an optional asset fails to precache
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') {
    return;
  }

  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  // Only handle same-origin requests; let external APIs (EBI, MyGene, Google Drive) pass through
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(req).then(function(networkResponse) {
      if (networkResponse && networkResponse.ok) {
        var copy = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(req, copy);
        });
      }
      return networkResponse;
    }).catch(function() {
      return caches.match(req, { ignoreSearch: true }).then(function(cached) {
        if (cached) {
          return cached;
        }
        if (req.mode === 'navigate') {
          return caches.match('./index.html', { ignoreSearch: true });
        }
      });
    })
  );
});
