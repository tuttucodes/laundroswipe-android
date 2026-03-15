/* LaundroSwipe service worker – push notifications */
self.addEventListener('push', function (event) {
  let payload = { title: 'LaundroSwipe', body: '' };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (_) {
      payload.body = event.data.text();
    }
  }
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'laundroswipe',
    requireInteraction: false,
    data: { url: payload.url || '/', ...payload },
  };
  event.waitUntil(
    self.registration.showNotification(payload.title || 'LaundroSwipe', options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
