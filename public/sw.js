// Service Worker for Expenza Expense Tracker
const CACHE_NAME = 'expenza-v5';
const STATIC_CACHE_NAME = 'expenza-static-v5';

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Skip waiting immediately for faster activation
      self.skipWaiting(),
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all pages immediately
      self.clients.claim(),
    ])
  );
});

// Fetch event - network-first for CSS, cache-first for other assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const request = event.request;
  
  // Skip service worker for cross-origin requests (like Supabase, fonts, etc.)
  if (url.origin !== location.origin) {
    return; // Let browser handle cross-origin requests normally
  }
  
  // CRITICAL: For CSS files, always use network-first strategy
  // This ensures CSS is never stale and always loads correctly
  if (url.pathname.match(/\.css$/) || url.pathname.includes('/_next/static/css/')) {
    event.respondWith(
      fetch(request, {
        cache: 'no-cache',
        credentials: 'same-origin',
      })
        .then((networkResponse) => {
          // Only cache successful CSS responses
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Only use cache if network fails completely
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If no cache and network fails, return a minimal CSS to prevent blank page
            return new Response('/* CSS failed to load */', {
              headers: { 'Content-Type': 'text/css' },
            });
          });
        })
    );
    return;
  }
  
  // For JavaScript files, use network-first but with cache fallback
  if (url.pathname.match(/\.js$/) || url.pathname.startsWith('/_next/static/chunks/')) {
    event.respondWith(
      fetch(request, {
        cache: 'no-cache',
        credentials: 'same-origin',
      })
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }
  
  // For other static assets (images, fonts), use cache-first with network update
  if (
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request, {
            cache: 'no-cache',
            credentials: 'same-origin',
          }).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Return cached version if network fails
            return cachedResponse;
          });
          
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }
  
  // For HTML pages, always fetch fresh from network (no caching)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request, {
        cache: 'no-store',
        credentials: 'same-origin',
      }).catch(() => {
        // Only use cache if network completely fails
        return caches.match(request);
      })
    );
    return;
  }
  
  // For all other requests, use network-first
  event.respondWith(
    fetch(request, {
      cache: 'no-cache',
      credentials: 'same-origin',
    }).catch(() => {
      return caches.match(request);
    })
  );
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
