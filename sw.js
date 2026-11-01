/*
 * Hand-written service worker (D-015). The build fills VERSION and PRECACHE.
 * Cache-first app shell with a versioned cache; a new version waits until
 * the page asks it to take over (the "new version" prompt).
 */
const VERSION = "c4400dd650f6";
const PRECACHE = ["./","assets/index-BDMczx1S.css","assets/index-CO87VMrK.js","assets/report-DYON988N.js","assets/sample-1h59ceDV.js","brand/tripario-logo-full-white.webp","brand/tripario-symbol-white.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","manifest.webmanifest"];

const SCOPE = self.registration.scope;
// Cache names carry the scope, so other sites on the same origin
// (GitHub Pages user sites share one) are never touched.
const PREFIX = `shell:${SCOPE}:`;
const CACHE = PREFIX + VERSION;
const INDEX = new URL('./', SCOPE).href;
// Precached files are versioned with the cache, so Vary headers (servers
// send Vary: Origin or Accept-Encoding) must not block a cache hit offline.
const MATCH = { ignoreVary: true };

// Web Share Target (D-057): a file shared to the installed app arrives as a POST to this address.
// The file waits in its own cache (never the shell cache, so the update logic is untouched) until
// the import screen takes it and deletes it. The cache name does not start with PREFIX, so
// activation never deletes it, and the page uses the same name and key (src/ui/sharedFile.ts).
const SHARE_URL = new URL('share-target', SCOPE).href;
const SHARE_CACHE = `share:${SCOPE}`;
const SHARE_KEY = new URL('shared-file', SCOPE).href;
const SHARE_MAX = 25 * 1000 * 1000;

async function receiveShare(request) {
  try {
    const form = await request.formData();
    const file = form.getAll('file').find((entry) => typeof entry !== 'string' && entry.size <= SHARE_MAX);
    if (file) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        SHARE_KEY,
        new Response(file, { headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name || 'shared-file') } }),
      );
    }
  } catch {
    // Nothing usable arrived: the import screen opens anyway, with its normal file picker.
  }
  return Response.redirect(INDEX + '#/import', 303);
}

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
  if (request.method === 'POST' && request.url === SHARE_URL) {
    event.respondWith(receiveShare(request));
    return;
  }
  // Only this app's own files are handled. Anything outside the scope, such as the
  // exchange-rate request to api.frankfurter.dev (D-052), is never intercepted or cached.
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
