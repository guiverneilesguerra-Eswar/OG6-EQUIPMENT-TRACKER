self.addEventListener('push', event => {
 let message; try { message = event.data.json(); } catch { return; }
 if (!message || typeof message.title !== 'string') return;
 event.waitUntil(self.registration.showNotification(message.title, { body: message.body || '', tag: message.tag || 'og6-reminder', renotify: false, silent: !!message.silent, data: message.data || {} }));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 const status = ['OVERDUE','DUE TODAY','DUE SOON'].includes(event.notification.data.status) ? event.notification.data.status : 'ACTIVE';
 const target = new URL('/withdrawals?status=' + encodeURIComponent(status), self.location.origin).href;
 event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
  const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
  if (existing) { await existing.navigate(target); return existing.focus(); }
  return self.clients.openWindow(target);
 }));
});
