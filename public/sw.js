// Service Worker for Expenza Expense Tracker
const CACHE_NAME = 'expenza-v2';
const urlsToCache = [
  '/',
  '/auth',
  '/add',
  '/stats',
  '/settings',
  '/transactions',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
// Always fetch CSS and JS from network first, then cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip service worker for cross-origin requests (like Supabase, fonts, etc.)
  if (url.origin !== location.origin) {
    return; // Let browser handle cross-origin requests normally
  }
  
  // For CSS and JS files, always try network first
  if (url.pathname.match(/\.(css|js)$/) || url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-cache',
        credentials: 'same-origin',
      })
        .then((response) => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(event.request);
        })
    );
  } else {
    // For HTML pages, try network first, then cache
    event.respondWith(
      fetch(event.request, {
        cache: 'no-cache',
        credentials: 'same-origin',
      })
        .then((response) => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache
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
