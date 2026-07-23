// Service Worker for UniSpend PWA & Push Notifications
const CACHE_NAME = 'unispend-cache-v4';
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
  // Only handle GET requests for http/https
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) {
    return;
  }

  // Bypass cache for API calls to Supabase or internal /api serverless endpoints
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
  let data = { title: 'UniSpend Auto-Track', body: 'New notification received' };
  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data = { title: 'UniSpend Auto-Track', body: e.data.text() };
    }
  }

  // Defensive formatting fallback if payload text is raw JSON
  if (typeof data.body === 'string' && data.body.trim().startsWith('{')) {
    try {
      const parsedBody = JSON.parse(data.body);
      if (parsedBody.amount) {
        data.title = 'UniSpend Auto-Track';
        data.body = `Auto-tracked: ₹${parsedBody.amount} for ${parsedBody.description || 'UPI Payment'}`;
      }
    } catch (err) {}
  }

  // Compatible options for iOS Safari & Android Chrome
  const options = {
    body: data.body || 'Transaction auto-tracked successfully',
    icon: './assets/icon-192.png',
    badge: './assets/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './index.html#activity'
    }
  };

  e.waitUntil(
    self.registration.showNotification(data.title || 'UniSpend Auto-Track', options).catch((err) => {
      console.error('[SW] Notification dispatch fallback:', err);
      return self.registration.showNotification(data.title || 'UniSpend Auto-Track', {
        body: data.body || 'Transaction logged'
      });
    })
  );
});

// Notification Click Event: Focus or open the PWA when notification is clicked
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  const targetUrl = new URL(e.notification.data?.url || './index.html#activity', self.location.origin).href;

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If window client is open, focus on it
      for (const client of windowClients) {
        if (client.url.includes('index.html') && 'focus' in client) {
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
