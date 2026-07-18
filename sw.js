/* Progressive Web App Service Worker (sw.js) */

const CACHE_NAME = 'unispend-cache-v10';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/state.js',
  './js/dashboard.js',
  './js/activity.js',
  './js/add.js',
  './js/insights.js',
  './js/settings.js',
  './js/partner.js',
  './js/supabase.js',
  './js/pwa.js',
  './manifest.json'
];

// Install: Cache essential assets for offline-first support
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Serve cached assets offline, fallback to network
self.addEventListener('fetch', (e) => {
  // Only handle GET requests and local scope
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background to update cache (stale-while-revalidate)
        fetch(e.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {/* ignore background fetch errors */});
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});

// Push Event: Listen for incoming web push notifications
self.addEventListener('push', (e) => {
  let data = { title: 'UniSpend Alert', body: 'You have a new update.' };
  
  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data = { title: 'UniSpend Alert', body: e.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: 'https://cdn-icons-png.flaticon.com/512/10121/10121175.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/10121/10121175.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    // Required properties for premium feel and iOS capabilities
    actions: [
      { action: 'open', title: 'Open App' }
    ]
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event: Focus or open the PWA when notification is clicked
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  const targetUrl = new URL(e.notification.data?.url || './index.html', self.location.origin).href;

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If window client is open, focus on it
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new PWA standalone viewport
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
