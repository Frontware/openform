// Weladee Form Service Worker
// Cache name - update this version to invalidate cache
const CACHE_VERSION = 'v1';
const CACHE_NAME = `weladee-form-${CACHE_VERSION}`;

// Files to cache on install
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/weladee-logo.png',
];

// Cache patterns for runtime
const CACHE_PATTERNS = [
  // Next.js static assets
  /^\/_next\/static\/.+/,
  // Images and icons
  /^\/icons\/.+\.(png|svg|ico)$/,
  /^\/.*\.(png|jpg|jpeg|svg|webp)$/,
];

// Network patterns (never cache - API calls, etc.)
const NETWORK_PATTERNS = [
  /^\/.*\.json$/,
  /^\/api\//,
  /^\/grpc\//,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching app shell');
      return cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: 'reload' })))
        .catch(err => {
          console.warn('[SW] Some precache items failed:', err);
          // Continue even if some items fail - they may not exist yet
          return Promise.resolve();
        });
    })
  );

  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('weladee-form-') && cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Take control of all clients immediately
  return self.clients.claim();
});

// Fetch event - handle requests with cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Network-only patterns (API calls, dynamic content)
  if (NETWORK_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return;
  }

  // Cache-first patterns (static assets)
  if (CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network-first for HTML pages (to get fresh content)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default: network-first with cache fallback
  event.respondWith(networkFirst(request));
});

// Cache-first strategy - try cache, then network
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Network request failed, returning offline page:', request.url);
    return getOfflineResponse(request);
  }
}

// Network-first strategy - try network, then cache, then offline
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache successful responses
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Network request failed, trying cache:', request.url);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return getOfflineResponse(request);
    }

    throw error;
  }
}

// Get offline response or fallback page
async function getOfflineResponse(request) {
  if (request.mode === 'navigate') {
    // Try to serve offline page
    const cache = await caches.open(CACHE_NAME);
    const offlinePage = await cache.match('/offline');

    if (offlinePage) {
      return offlinePage;
    }
  }

  // Return a basic offline response
  return new Response(
    JSON.stringify({ offline: true, message: 'You are currently offline' }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
