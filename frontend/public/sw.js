/**
 * Crumb & Co. — Progressive Web Application Service Worker
 * Version: crumbco-pwa-v3
 * Supports: Android Chrome/Edge, iOS Safari (Home Screen PWA), Desktop PWA
 */

const CACHE_NAME = 'crumbco-pwa-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
  '/manifest-baker.json',
  '/manifest-owner.json',
  '/assets/logos/crumbandco.svg',
  '/assets/logos/icon-192.png',
  '/assets/logos/icon-512.png',
  '/assets/logos/icon-180.png'
];

// Install: Cache critical App Shell and skip waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Crumb&Co. SW] Non-fatal static cache preload warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up legacy caches and immediately claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('crumbco-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

// Fetch: Strategy customized for navigation, API, and static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignore non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // 2. Bypass Vite dev server internals to prevent hot-reload caching conflicts
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/@fs/') ||
    url.searchParams.has('t')
  ) {
    return;
  }

  // 3. API Requests: Network-first with resilient offline JSON fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            offline: true,
            message: 'You are currently working offline. Reconnect to sync latest bakery orders and stock.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // 4. HTML Navigation: Network-first, fallback to cached index.html app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const cachedShell = (await caches.match('/index.html')) || (await caches.match('/'));
          if (cachedShell) return cachedShell;
          return new Response('Offline. Reconnect to launch Crumb & Co. bakery app.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      })()
    );
    return;
  }

  // 5. Static Assets (Scripts, Styles, Fonts, Images): Cache-first with background revalidation
  if (['script', 'style', 'font', 'image'].includes(request.destination) || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          // Asynchronously revalidate in background
          fetch(request).then(async (networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const cache = await caches.open(CACHE_NAME);
              cache.put(request, networkResponse);
            }
          }).catch(() => {});
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return new Response('', { status: 408, statusText: 'Request timed out or offline' });
        }
      })()
    );
  }
});
