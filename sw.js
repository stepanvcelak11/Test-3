/* Service worker – cache-first. Při každé změně souborů zvyš VERSION. */
const VERSION = 'v1.0.0';
const CACHE = 'mapovani-trenink-' + VERSION;
const FILES = [
  './', './index.html', './styles.css', './app.js', './data.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  // nová verze čeká, dokud uživatel neklepne na „Načíst“
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('mapovani-trenink-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'skipWaiting') self.skipWaiting();
  if (e.data.type === 'version' && e.ports[0]) e.ports[0].postMessage(VERSION);
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    })
  );
});
