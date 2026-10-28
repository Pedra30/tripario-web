/*
 * Hand-written service worker (D-015). The build fills VERSION and PRECACHE.
 * Cache-first app shell with a versioned cache; a new version waits until
 * the page asks it to take over (the "new version" prompt).
 */
const VERSION = "9630e706aac2";
const PRECACHE = ["./","assets/index-CGvC_lTf.js","assets/index-CpguelLX.css","assets/sample-J_TofuXh.js","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","manifest.webmanifest"];

const SCOPE = self.registration.scope;
// Cache names carry the scope, so other sites on the same origin
// (GitHub Pages user sites share one) are never touched.
const PREFIX = `shell:${SCOPE}:`;
const CACHE = PREFIX + VERSION;
const INDEX = new URL('./', SCOPE).href;
// Precached files are versioned with the cache, so Vary headers (servers
// send Vary: Origin or Accept-Encoding) must not block a cache hit offline.
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(PRECACHE.map((path) => new Request(new URL(path, SCOPE), { cache: 'reload' }))),
      ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;

  if (request.mode === 'navigate') {
    // Single-page app: every navigation inside the scope gets the shell.
    event.respondWith(
      caches.open(CACHE).then((cache) => cache.match(INDEX, MATCH)).then((cached) => cached || fetch(request)),
    );
    return;
  }

  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(request, { ...MATCH, ignoreSearch: true }))
      .then((cached) => cached || fetch(request)),
  );
});
