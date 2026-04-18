/**
 * Service Worker for PWA Support
 *
 * Features:
 * - Cache critical pages and assets
 * - Cache-first strategy for static assets
 * - Network-first strategy for API requests
 * - Offline fallback page
 */

const CACHE_NAME = "trademind-v1";
const urlsToCache = [
  "/",
  "/dashboard",
  "/timeseries",
  "/alerts",
  "/forecasts",
  "/anomalies",
  "/datasets",
  "/apikeys",
  "/offline",
];

// Install event - cache critical resources
self.addEventListener("install", (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event: any) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener("fetch", (event: any) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests - network first, fallback to cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response before using
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request);
        })
    );
    return;
  }

  // Static assets - cache first, fallback to network
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(request).then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    }).catch(() => {
      // Network failed, show offline page for navigation requests
      if (request.mode === "navigate") {
        return caches.match("/offline");
      }
    })
  );
});

// Skip waiting for immediate update
self.addEventListener("message", (event: any) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
