// src/sw.js — SHREE GANESH AUTOMOBILE — PRODUCTION SERVICE WORKER
// Strategy: injectManifest (Workbox) — we control all caching logic
// This file lives at src/sw.js; vite-plugin-pwa compiles it to public/sw.js

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import {
  NetworkFirst,
  StaleWhileRevalidate,
  CacheFirst,
  NetworkOnly,
} from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// ─────────────────────────────────────────────────────────────
// 1. PRECACHE — App Shell (injected by vite-plugin-pwa at build)
// ─────────────────────────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ─────────────────────────────────────────────────────────────
// 2. SPA NAVIGATION FALLBACK
//    All navigation requests → serve index.html from cache
// ─────────────────────────────────────────────────────────────
const navigationHandler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [/^\/_/, /\/[^/?]+\.[^/]+$/], // exclude non-HTML assets
});
registerRoute(navigationRoute);

// ─────────────────────────────────────────────────────────────
// 3. FIRESTORE REST API — NetworkFirst with offline fallback
//    Critical: customer lookups & inventory reads work offline
// ─────────────────────────────────────────────────────────────
registerRoute(
  ({ url }) =>
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com'),
  new NetworkFirst({
    cacheName: 'firestore-api-cache',
    networkTimeoutSeconds: 8,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// ─────────────────────────────────────────────────────────────
// 4. FIREBASE STORAGE (PDFs, docs, images) — CacheFirst
//    PDFs and uploaded docs rarely change; cache aggressively
// ─────────────────────────────────────────────────────────────
registerRoute(
  ({ url }) => url.hostname.includes('firebasestorage.googleapis.com'),
  new CacheFirst({
    cacheName: 'firebase-storage-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// ─────────────────────────────────────────────────────────────
// 5. GOOGLE FONTS — CacheFirst (fonts never change)
// ─────────────────────────────────────────────────────────────
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// ─────────────────────────────────────────────────────────────
// 6. STATIC ASSETS — StaleWhileRevalidate
//    JS/CSS chunks, images served from cache immediately,
//    updated in background.
// ─────────────────────────────────────────────────────────────
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: 'static-assets-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// ─────────────────────────────────────────────────────────────
// 7. BACKGROUND SYNC — Queue write operations when offline
//    Invoices, customer creates, inventory updates queue here
// ─────────────────────────────────────────────────────────────
const bgSyncPlugin = new BackgroundSyncPlugin('sga-write-queue', {
  maxRetentionTime: 24 * 60, // retry for up to 24 hours
});

// POST/PUT/PATCH to Firestore go through background sync
registerRoute(
  ({ url, request }) =>
    url.hostname.includes('firestore.googleapis.com') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method),
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  'POST'
);
registerRoute(
  ({ url, request }) =>
    url.hostname.includes('firestore.googleapis.com') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method),
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  'PUT'
);
registerRoute(
  ({ url, request }) =>
    url.hostname.includes('firestore.googleapis.com') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method),
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  'PATCH'
);

// ─────────────────────────────────────────────────────────────
// 8. META / WHATSAPP APIS — NetworkOnly (never cache live msgs)
// ─────────────────────────────────────────────────────────────
registerRoute(
  ({ url }) =>
    url.hostname.includes('graph.facebook.com') ||
    url.hostname.includes('api.whatsapp.com'),
  new NetworkOnly()
);

// ─────────────────────────────────────────────────────────────
// 9. PUSH NOTIFICATION HANDLER (Firebase Cloud Messaging)
// ─────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: 'SGA', body: event.data.text() } };
  }

  const { title, body, icon, tag, data = {} } = payload.notification || payload;

  const notifOptions = {
    body: body || '',
    icon: icon || '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: tag || 'sga-notification',
    data,
    requireInteraction: data.requireInteraction || false,
    actions: getNotificationActions(data.type),
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, notifOptions));
});

function getNotificationActions(type) {
  switch (type) {
    case 'INVOICE_PENDING':
      return [
        { action: 'approve', title: '✓ Approve' },
        { action: 'view',    title: '👁 View' },
      ];
    case 'NEW_MESSAGE':
      return [
        { action: 'reply', title: '↩ Reply' },
        { action: 'view',  title: '👁 Open' },
      ];
    case 'LOW_STOCK':
      return [{ action: 'view', title: '📦 View Inventory' }];
    case 'CNG_REMINDER':
      return [{ action: 'view', title: '🔔 View Customer' }];
    default:
      return [];
  }
}

// ─────────────────────────────────────────────────────────────
// 10. NOTIFICATION CLICK HANDLER
// ─────────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { data, action } = event;
  const urlMap = {
    INVOICE_PENDING: `/invoices/${data?.invoiceId || ''}`,
    NEW_MESSAGE:     `/messaging/${data?.conversationId || ''}`,
    LOW_STOCK:       '/inventory',
    CNG_REMINDER:    `/customers/${data?.customerId || ''}`,
    FOLLOW_UP:       `/messaging`,
  };

  const targetUrl = urlMap[data?.type] || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app already open, focus it and navigate
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

// ─────────────────────────────────────────────────────────────
// 11. BACKGROUND SYNC EVENT (fires when connectivity restored)
// ─────────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sga-write-queue') {
    // BackgroundSyncPlugin handles replaying requests automatically.
    // Notify the app that sync completed so UI can refresh.
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        clientList.forEach((client) =>
          client.postMessage({ type: 'SYNC_COMPLETED' })
        );
      })
    );
  }
});

// ─────────────────────────────────────────────────────────────
// 12. MESSAGE HANDLER — communicate with app shell
// ─────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting(); // Activate new SW immediately on user request
  }
  if (event.data?.type === 'CLIENTS_CLAIM') {
    self.clients.claim();
  }
});

// ─────────────────────────────────────────────────────────────
// 13. INSTALL / ACTIVATE LIFECYCLE
// ─────────────────────────────────────────────────────────────
self.addEventListener('install', () => {
  // Let the SW finish installing before waiting
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !['firestore-api-cache', 'firebase-storage-cache',
                               'google-fonts-cache', 'static-assets-cache',
                               'workbox-precache-v2'].some((v) => name.includes(v)))
          .map((name) => {
            console.log('[SW] Deleting stale cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});
