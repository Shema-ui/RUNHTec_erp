/* RUNHTec ERP service worker: makes the portal installable, loads it faster,
 * shows a friendly page when offline, and shows phone notifications.
 * Data (quotes, invoices, ...) is NEVER cached: it always comes live from the server.
 * Change VERSION to force every device to refresh its saved copy. */
const VERSION = 'v1';
const CACHE = `runhtec-${VERSION}`;
const PRECACHE = ['/offline.html', '/icon-192.png', '/icon-512.png', '/badge-96.png', '/logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('runhtec-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // the API and fonts go straight to the network

  // Pages: always try the network first so everyone gets updates at once;
  // fall back to the offline page when there's no connection.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }

  // Built files have a unique name per version (/assets/index-AbC123.js), so a
  // saved copy is always right: serve it instantly, fetch and keep it otherwise.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // Icons and other small files: show the saved copy, refresh it in the background.
  if (/\.(png|ico|svg|webmanifest)$/.test(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    }));
  }
});

// A notification sent by the server (see apps/server/src/webpush.js).
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'RUNHTec';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'You have a new notification.',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    tag: data.tag || undefined,
    data: { link: data.link || '/notifications' },
  }));
});

// Tapping a notification opens the right page (reusing an open window when there is one).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.link || '/notifications', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        await w.focus();
        if ('navigate' in w) return w.navigate(target).catch(() => self.clients.openWindow(target));
        return undefined;
      }
    }
    return self.clients.openWindow(target);
  })());
});
