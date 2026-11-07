// Offline support: the card must open at the till even with no signal.
// Paths are relative to this file, so the app works at a domain root or in a subfolder (GitHub Pages).
var CACHE = 'hullpops-card-v2';
var LOGO = 'https://hullpops.co.uk/cdn/shop/files/logo_300x300.png?v=1614305197';
var SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'qrcode.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];
var INDEX = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(SHELL).then(function () {
        // Logo is cross-origin; cache it opaquely, and don't fail install if it's unreachable.
        return fetch(LOGO, { mode: 'no-cors' }).then(function (r) { return c.put(LOGO, r); }).catch(function () {});
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // Page loads (any ?m=... URL): network first so updates arrive, fall back to cached shell offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(INDEX, copy); });
        return res;
      }).catch(function () { return caches.match(INDEX); })
    );
    return;
  }

  // Everything else: cache first.
  e.respondWith(
    caches.match(req, { ignoreSearch: req.url.indexOf(self.location.origin) === 0 }).then(function (hit) {
      return hit || fetch(req);
    })
  );
});
