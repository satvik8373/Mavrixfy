importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBWgv_mE8ZAnG2kUJSacCOUgkbo1RxxSpE',
  authDomain: 'spotify-8fefc.firebaseapp.com',
  projectId: 'spotify-8fefc',
  storageBucket: 'spotify-8fefc.firebasestorage.app',
  messagingSenderId: '816396705670',
  appId: '1:816396705670:web:005e724df7139772521607',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body, image } = payload.notification || {};
  const iconUrl = self.location.origin + '/mavrixfy-icons/mavrixfy-icon-maskable-192.png';
  self.registration.showNotification(title || 'Mavrixfy', {
    body: body || '',
    icon: iconUrl,
    badge: iconUrl,
    image: image || undefined,
    data: payload.data || {},
    vibrate: [200, 100, 200],
    tag: 'mavrixfy-notification',
    renotify: true,
  });
});

// Notification click → open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const route = event.notification.data?.route || '/home';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(route);
          return;
        }
      }
      clients.openWindow(self.location.origin + route);
    })
  );
});
