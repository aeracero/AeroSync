const CACHE_NAME = 'aerosync-v1';
const STATIC_ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return; // never cache API calls
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return res;
    }))
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
