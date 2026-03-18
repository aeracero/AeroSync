const CACHE_NAME = 'aerosync-v3';
const STATIC_ASSETS = ['/', '/manifest.json'];

// On install — cache static assets and skip waiting immediately
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS))
  );
  // Force this SW to become active immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// On activate — delete ALL old caches, then claim all clients
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => {
      // Claim all open clients so they immediately use the new SW
      return self.clients.claim();
    }).then(() => {
      // Tell every open tab to reload so they get the latest build
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(clients => {
      clients.forEach(client => {
        // Post message to the page so it can show a "新しいバージョンが利用可能" banner
        // and reload automatically
        client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
      });
    })
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;
  if (e.request.url.includes('/api/')) return; // never cache API calls

  e.respondWith(
    // Network-first for HTML (always get latest app shell)
    e.request.mode === 'navigate'
      ? fetch(e.request).catch(() => caches.match('/'))
      // Cache-first for static assets (JS/CSS/images)
      : caches.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
            }
            return res;
          });
        })
  );
});

self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? { title: 'AeroSync', body: '新しい通知があります' };
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [{ action: 'open', title: '開く' }, { action: 'close', title: '閉じる' }]
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'close') return;
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});
