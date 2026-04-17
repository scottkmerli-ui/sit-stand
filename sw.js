// ── Service Worker for Sit/Stand Tracker PWA ──

const CACHE_NAME = 'sitstand-v5';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.svg', './icon-512.svg'];

// Install — cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for app shell
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ── Notification scheduling from the page ──
// The page sends { type: 'SCHEDULE_NOTIFY', delay, title, body, tag }
// We use setTimeout inside the SW — this is more reliable on Android than page timers

let notifyTimer = null;

self.addEventListener('message', e => {
  const data = e.data;

  if (data.type === 'SCHEDULE_NOTIFY') {
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: './icon-192.svg',
        badge: './icon-192.svg',
        tag: 'sitstand-reminder',
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        actions: [
          { action: 'switch', title: data.switchLabel || '🔄 Switch' },
          { action: 'snooze5', title: '⏰ Snooze 5m' },
          { action: 'pause', title: '⏸️ Pause' }
        ]
      });
      // Tell the page to show the overlay too
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SHOW_ALERT' }));
      });
    }, data.delay);
  }

  if (data.type === 'CANCEL_NOTIFY') {
    clearTimeout(notifyTimer);
  }
});

// ── Handle notification actions ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const action = e.action;

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing window or open new one
      const client = clients.find(c => c.visibilityState === 'visible') || clients[0];
      if (client) {
        client.focus();
        if (action === 'switch') {
          client.postMessage({ type: 'DO_SWITCH' });
        } else if (action === 'snooze5') {
          client.postMessage({ type: 'DO_SNOOZE', minutes: 5 });
        } else if (action === 'pause') {
          client.postMessage({ type: 'DO_PAUSE' });
        } else {
          // Default tap — open the app and show the alert
          client.postMessage({ type: 'SHOW_ALERT' });
        }
      } else {
        self.clients.openWindow('./').then(win => {
          // New window will pick up state from localStorage
        });
      }
    })
  );
});
