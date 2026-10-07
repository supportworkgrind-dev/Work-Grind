// WorkGrind production PWA worker. Its registration URL carries the Next build ID.
const BUILD_VERSION = new URL(self.location.href).searchParams.get('build') || 'unversioned';
const CACHE_PREFIX = 'workgrind-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/workgrind-icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

const PUBLIC_NAVIGATION_PATHS = new Set([
  '/',
  '/about',
  '/contact',
  '/demo',
  '/features',
  '/how-it-works',
  '/pricing',
  '/privacy',
  '/terms',
]);

const isPublicNavigation = (pathname) => {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  return PUBLIC_NAVIGATION_PATHS.has(normalizedPath);
};

// â”€â”€â”€ DEVELOPMENT MODE GUARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Service workers in dev mode intercept hot-reload chunks and break HMR.
// Production = served over HTTPS or explicitly flagged via SW query param.
// Development = localhost on any port, or 127.0.0.1, or explicit ?dev flag.
const isDevMode = () => {
  try {
    const hostname = self.location.hostname;
    // Any localhost / loopback address = development
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
};

// 1. Install Event
self.addEventListener('install', (event) => {
  // In dev: skip waiting immediately, don't pre-cache anything
  if (isDevMode()) {
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        // Non-fatal: log and continue â€” don't let pre-cache failures break the app
        console.warn('[SW] Pre-cache failed (non-fatal):', err);
        return self.skipWaiting();
      })
  );
});

// 2. Activate Event: Clean up legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(async () => {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        await Promise.all(
          requests.map(async (request) => {
            const url = new URL(request.url);
            const response = await cache.match(request);
            const isHtmlNavigation =
              request.mode === 'navigate' ||
              response?.headers.get('content-type')?.includes('text/html');
            if (isHtmlNavigation && !isPublicNavigation(url.pathname)) {
              await cache.delete(request);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event
self.addEventListener('fetch', (event) => {
  // â”€â”€ DEV MODE: Pass all requests straight through, no interception â”€â”€
  // This is the fix for ERR_CONNECTION_REFUSED and the TypeError in dev.
  if (isDevMode()) {
    return; // Do NOT call event.respondWith() â€” browser handles it natively
  }

  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Never intercept API or Socket.io traffic
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket.io') ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Never cache development/runtime modules; only production's immutable static output is eligible.
  if (url.pathname.startsWith('/_next/') && !url.pathname.startsWith('/_next/static/')) {
    return;
  }

  // A. Static Assets (_next/static, images, fonts) â†’ Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              // Only cache valid, same-origin responses
              if (
                networkResponse &&
                networkResponse.status === 200 &&
                networkResponse.type !== 'opaque'
              ) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              // Network failed â€” return cached version if available
              if (cachedResponse) return cachedResponse;
              // Return a minimal error response instead of letting the promise reject
              return new Response('', { status: 503, statusText: 'Service Unavailable' });
            });

          return cachedResponse || fetchPromise;
        })
      )
    );
    return;
  }

  // B. Navigation Requests (HTML pages) â†’ Network-First with Cache Fallback
  if (request.mode === 'navigate') {
    // Cache Storage is shared across accounts, so only cache an explicit public allowlist.
    if (!isPublicNavigation(url.pathname)) return;

    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful HTML responses
          if (response && response.status === 200 && !response.headers.has('set-cookie')) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          // Network offline â€” try exact page, then root shell, then offline stub
          const exactMatch = await caches.match(request);
          if (exactMatch) return exactMatch;

          // Last resort: return a proper offline HTML response (never undefined)
          return new Response(
            `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WorkGrind â€” Offline</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0;
           background: #0f172a; color: #e2e8f0; text-align: center; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
    p  { color: #94a3b8; font-size: 0.875rem; }
    button { margin-top: 1.5rem; padding: 0.6rem 1.4rem; background: #4f46e5;
             color: #fff; border: none; border-radius: 0.75rem; font-weight: 600;
             cursor: pointer; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div>
    <h1>You are offline</h1>
    <p>WorkGrind requires a connection to load.<br/>Please check your internet and try again.</p>
    <button onclick="window.location.reload()">Retry</button>
  </div>
</body>
</html>`,
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
    );
    return;
  }
});

// 4. Background Sync Listener
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-actions') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_BACKGROUND_SYNC' });
        });
      })
    );
  }
});

// 5. Message Handler â€” supports SKIP_WAITING from the registration script
// so new SW versions activate immediately instead of waiting for all
// tabs to close. This prevents the "tap icon â†’ nothing happens" bug
// caused by an old SW being stuck in the "waiting" state.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
