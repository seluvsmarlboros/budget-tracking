// Service Worker for UniSpend PWA & Push Notifications
const CACHE_NAME = 'unispend-cache-v6';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-510.png'
];

// Install Event: Pre-cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches
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

// Fetch Event: Stale-while-revalidate strategy for quick loading and background updates
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) {
    return;
  }

  if (e.request.url.includes('/api/') || e.request.url.includes('.supabase.co')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Push Event: Listen for incoming web push notifications
self.addEventListener('push', (e) => {
  let title = 'UniSpend Auto-Track';
  let body = 'Transaction auto-tracked';
  let url = './index.html#activity';

  if (e.data) {
    try {
      const parsed = e.data.json();
      if (parsed.amount) {
        title = 'UniSpend Auto-Track';
        body = `Auto-tracked: ₹${parsed.amount} for ${parsed.description || 'UPI Payment'}`;
      } else if (parsed.body) {
        title = parsed.title || 'UniSpend Auto-Track';
        body = parsed.body;
        url = parsed.url || url;
      }
    } catch (err) {
      const text = e.data.text();
      if (text && text.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.amount) {
            title = 'UniSpend Auto-Track';
            body = `Auto-tracked: ₹${parsed.amount} for ${parsed.description || 'UPI Payment'}`;
          }
        } catch (e2) {}
      } else if (text) {
        body = text;
      }
    }
  }

  // Deduplicated notification options
  const options = {
    body: body,
    icon: './assets/icon-192.png',
    badge: './assets/icon-192.png',
    vibrate: [100, 50, 100],
    tag: 'autotrack-' + (body || 'default').replace(/\s+/g, '-'),
    renotify: false,
    data: {
      url: url
    }
  };

  e.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error('[SW] Notification dispatch fallback:', err);
    })
  );
});

// Notification Click Event: Focus or open the PWA and navigate to targetUrl
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  const rawUrl = e.notification.data?.url || './index.html#activity';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

