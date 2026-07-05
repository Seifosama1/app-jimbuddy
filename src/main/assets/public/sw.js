/* ══════════════════════════════════════════
   JIM BUDDY - Service Worker
   Offline caching + Rich Push Notifications
══════════════════════════════════════════ */

const CACHE_NAME = 'jim-buddy-v2.0.1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/workouts-data.js',
  '/sounds.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ── Install ───────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.map(name => name !== CACHE_NAME && caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch (cache-first) ───────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isCdn = url.hostname.includes('googleapis.com') ||
                url.hostname.includes('gstatic.com')    ||
                url.hostname.includes('jsdelivr.net');
  if (!isSameOrigin && !isCdn) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('/index.html');
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ── Rich notification helper ──────────────────────────────
// Called from the page via postMessage OR from a push event.
function showRichNotification(payload) {
  const {
    title   = 'Jim Buddy 💪',
    body    = '💧 Time to hydrate!',
    tag     = 'hydration',
    icon    = '/icons/icon-192.png',
    badge   = '/icons/icon-72.png',
    image,                          // optional large image below body
    vibrate = [100, 50, 100, 50, 200],
    actions = [],
    data    = {},
  } = payload;

  return self.registration.showNotification(title, {
    body,
    tag,                    // collapses repeated notifications of the same tag
    renotify:  true,        // re-buzz even if same tag is already showing
    icon,
    badge,
    ...(image ? { image } : {}),
    vibrate,
    requireInteraction: false, // dismissed automatically like Instagram
    silent: false,
    timestamp: Date.now(),
    actions,               // quick-reply buttons (Android Chrome only)
    data,
  });
}

// ── Message from page → show notification via SW ─────────
// This fires when the tab is visible AND we still want a real
// system notification (instead of only a toast).
self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'SHOW_NOTIFICATION') return;
  event.waitUntil(showRichNotification(event.data.payload));
});

// ── Push event (future server-push support) ───────────────
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch { /* raw text */ }
  event.waitUntil(showRichNotification(payload));
});

// ── Notification click → open / focus the app ─────────────
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const action       = event.action; // e.g. 'log_water' or 'dismiss'
  notification.close();

  if (action === 'dismiss') return;

  // Build URL; if action is 'log_water' jump straight to water tab
  const targetUrl = action === 'log_water'
    ? (self.location.origin + '/?tab=water')
    : self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Focus an existing window if one is open
        for (const client of clients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.focus();
            // Tell the page to navigate to the right tab
            client.postMessage({ type: 'NOTIFICATION_ACTION', action, targetUrl });
            return;
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      })
  );
});

// ── Notification close (dismissed by swiping away) ────────
self.addEventListener('notificationclose', event => {
  // Nothing to do for hydration reminders.
  // Could be used for analytics in the future.
});