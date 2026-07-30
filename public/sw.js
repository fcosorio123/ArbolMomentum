const CACHE_NAME = 'arbol-v7';

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

function applyBadge(count) {
  if (!('setAppBadge' in self)) return;
  if (count > 0) self.setAppBadge(count).catch(() => {});
  else self.clearAppBadge().catch(() => {});
}

function assetUrl(file) {
  return new URL(file, self.location.href).href;
}

function appEntryUrl() {
  return new URL('./', self.location.href).href;
}

function checkInEntryUrl() {
  return new URL('./?checkin=1', self.location.href).href;
}

function isCheckInUrl(url) {
  try {
    return new URL(url, self.location.href).searchParams.get('checkin') === '1';
  } catch {
    return /[?&]checkin=1\b/.test(String(url || ''));
  }
}

function showArbolNotification(title, body, tag, extra = {}) {
  return self.registration.showNotification(title, {
    body,
    tag: tag || 'arbol',
    renotify: false,
    icon: assetUrl('icon-192.svg'),
    badge: assetUrl('icon-72.svg'),
    data: { url: extra.url || appEntryUrl(), tag: tag || 'arbol' },
    ...extra,
  });
}

self.addEventListener('push', e => {
  let d = {
    title: 'Arbol Momentum',
    body: 'Time to keep your college funding momentum going!',
    tag: 'arbol-push',
    badgeCount: 0,
    url: checkInEntryUrl(),
  };
  try {
    if (e.data) d = { ...d, ...e.data.json() };
  } catch { /* use defaults */ }

  e.waitUntil(
    Promise.resolve()
      .then(() => showArbolNotification(d.title, d.body, d.tag, { data: { url: d.url || checkInEntryUrl(), tag: d.tag } }))
      .then(() => {
        if (typeof d.badgeCount === 'number') applyBadge(d.badgeCount);
      })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || checkInEntryUrl();
  const tag = e.notification.data?.tag || 'arbol';
  const openCheckIn = isCheckInUrl(url) || /check-?in|nudge|morning|midday|evening|streak/i.test(String(tag));

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        client.postMessage({ type: 'NOTIF_CLICKED', tag, url, openCheckIn: !!openCheckIn });
        if (openCheckIn && typeof client.navigate === 'function') {
          return client.navigate(url).then((c) => (c && 'focus' in c ? c.focus() : client.focus())).catch(() => client.focus());
        }
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('message', e => {
  const t = e.data?.type;
  if (t === 'SHOW') {
    const { title, body, tag, badgeCount, url } = e.data;
    e.waitUntil(
      showArbolNotification(title, body, tag, { data: { url: url || checkInEntryUrl(), tag } })
        .then(() => {
          if (typeof badgeCount === 'number') applyBadge(badgeCount);
        })
    );
  }
  if (t === 'BADGE') {
    const { count } = e.data;
    applyBadge(typeof count === 'number' ? count : 0);
  }
});

// Periodic sync: refresh badge when browser wakes SW (Chrome/Android; best-effort)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'arbol-badge-sync') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SYNC_BADGE' }));
      })
    );
  }
});
