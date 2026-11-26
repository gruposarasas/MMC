// Avisos de las gift cards de Vistapueblo: muestra la notificación que manda el servidor en cada consumo.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Gift card Vistapueblo', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Gift card Vistapueblo', {
    body: d.body || '',
    icon: '/vistapueblo/icono.png',
    badge: '/vistapueblo/icono.png',
    data: { url: d.url || '/vistapueblo' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/vistapueblo';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
      for (const w of ws) if (w.url === url && 'focus' in w) return w.focus();
      return self.clients.openWindow(url);
    }),
  );
});
