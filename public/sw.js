// Service Worker for Expenza Expense Tracker
const CACHE_NAME = 'expenza-v4';
const STATIC_CACHE_NAME = 'expenza-static-v4';

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Cache static assets immediately
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        // Don't cache HTML pages during install - let them be fetched fresh
        return Promise.resolve();
      }),
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

// Fetch event - optimized for native-like performance
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip service worker for cross-origin requests (like Supabase, fonts, etc.)
  if (url.origin !== location.origin) {
    return; // Let browser handle cross-origin requests normally
  }
  
  // For static assets (CSS, JS, images), use stale-while-revalidate strategy
  if (
    url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          // Return cached version immediately for instant loading
          const fetchPromise = fetch(event.request, {
            cache: 'no-cache',
            credentials: 'same-origin',
          }).then((networkResponse) => {
            // Update cache in background
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
          
          // Return cached version immediately, update in background
          return cachedResponse || fetchPromise;
        });
      })
    );
  } else {
    // For HTML pages, always fetch fresh from network (no caching)
    // This ensures users always get the latest version without refresh
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store',
        credentials: 'same-origin',
      }).catch(() => {
        // Only use cache if network completely fails
        return caches.match(event.request);
      })
    );
  }
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
