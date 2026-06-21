const CACHE_NAME = 'arbol-v3';

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', e => {
  let d = { title: 'Arbol Momentum', body: 'Time to keep your streak going!' };
  try { d = e.data?.json() ?? d; } catch {}
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body, tag: d.tag || 'arbol', renotify: true,
      icon: '/icon-192.svg', badge: '/icon-72.svg',
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});

self.addEventListener('message', e => {
  const t = e.data?.type;
  if (t === 'SHOW') {
    const { title, body, tag } = e.data;
    e.waitUntil(
      self.registration.showNotification(title, {
        body, tag, renotify: true,
        icon: '/icon-192.svg', badge: '/icon-72.svg',
      })
    );
  }
  if (t === 'BADGE') {
    const { count } = e.data;
    if ('setAppBadge' in self) {
      count > 0 ? self.setAppBadge(count) : self.clearAppBadge();
    }
  }
});
