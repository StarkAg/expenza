/* Expenza service worker.
 *
 * Design rules this file follows, because the previous version broke each:
 *   1. Never call `event.respondWith()` with a promise that can resolve to
 *      `undefined` -- that surfaces to the page as a network error. Every
 *      path below ends in a real Response.
 *   2. The app shell is precached, so a cold launch with no network renders
 *      something instead of Safari's error page.
 *   3. Activation does not preempt open tabs. `skipWaiting()` runs only when
 *      a client asks for it, which is what keeps the update from reloading
 *      the app out from under someone mid-entry.
 */

const VERSION = 'v11';
const STATIC_CACHE = `expenza-static-${VERSION}`;
const PAGES_CACHE = `expenza-pages-${VERSION}`;
const DATA_CACHE = `expenza-data-${VERSION}`;
const CURRENT = [STATIC_CACHE, PAGES_CACHE, DATA_CACHE];

const OFFLINE_URL = '/offline';

// Kept small on purpose: anything that fails here fails the whole install.
const PRECACHE = [
  OFFLINE_URL,
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-icon.png',
  '/favicon.ico',
];

const NAV_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Individually, so one 404 cannot abort the install.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload', credentials: 'same-origin' });
            if (res.ok) await cache.put(url, res);
          } catch (err) {
            /* offline at install time; the runtime paths will fill this in */
          }
        })
      );
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (err) {
          /* not supported */
        }
      }
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('expenza-') && !CURRENT.includes(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

function offlineJson() {
  return new Response(JSON.stringify({ offline: true }), {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'application/json' },
  });
}

async function offlineDocument() {
  const cached = (await caches.match(OFFLINE_URL)) || (await caches.match('/'));
  if (cached) return cached;
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
      '<title>Offline</title><body style="margin:0;display:grid;place-items:center;height:100dvh;background:#080808;' +
      'color:#f5f5f2;font:600 17px -apple-system,system-ui,sans-serif">Expenza is offline.</body>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/* Navigations: try the network briefly (a hung request offline is worse than
 * a fast fallback), then the last good copy of this page, then the shell. */
async function handleNavigate(event) {
  const { request } = event;
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) {
      if (preloaded.ok) {
        const copy = preloaded.clone();
        event.waitUntil(caches.open(PAGES_CACHE).then((c) => c.put(request, copy)));
      }
      return preloaded;
    }
  } catch (err) {
    /* fall through to fetch */
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NAV_TIMEOUT_MS);
    const res = await fetch(request, { credentials: 'same-origin', signal: controller.signal });
    clearTimeout(timer);
    if (res && res.ok) {
      const copy = res.clone();
      event.waitUntil(caches.open(PAGES_CACHE).then((c) => c.put(request, copy)));
    }
    return res;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    return offlineDocument();
  }
}

/* Build output under /_next/static is content-hashed, so a hit is always
 * correct and needs no revalidation. */
async function handleImmutable(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request, { credentials: 'same-origin' });
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
    }
    return res;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

/* Serve the cached copy immediately, refresh it in the background. The event
 * is passed in so the refresh can be kept alive with `waitUntil` -- the event
 * is still active while its `respondWith` promise is pending, which is why
 * this is valid here and would not be from a detached global. */
async function staleWhileRevalidate(event, cacheName) {
  const { request } = event;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request, { credentials: 'same-origin' })
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(network);
    return cached;
  }

  const res = await network;
  if (res) return res;
  return new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never touch non-GET: an intercepted POST that falls back to cache would
  // silently drop an expense the user just saved.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(event));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleImmutable(request));
    return;
  }

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/data/')) {
    event.respondWith(
      fetch(request, { credentials: 'same-origin' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(DATA_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(request)) || offlineJson())
    );
    return;
  }

  if (/\.(png|jpg|jpeg|gif|svg|ico|webp|avif|woff2?|ttf|eot)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, STATIC_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(event, STATIC_CACHE));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
