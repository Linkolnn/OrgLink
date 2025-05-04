// Service Worker для поддержки уведомлений
self.addEventListener('install', (event) => {
  console.log('Service Worker установлен');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker активирован');
  return self.clients.claim();
});

// Обработка уведомлений
self.addEventListener('push', (event) => {
  console.log('Получено push-уведомление', event.data?.text());
  
  if (event.data) {
    const data = event.data.json();
    
    const title = data.title || 'Новое сообщение';
    const options = {
      body: data.body || '',
      icon: data.icon || '/favicon.ico',
      badge: '/favicon.ico',
      data: data.data || {},
      requireInteraction: true
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  console.log('Клик по уведомлению', event.notification.data);
  
  event.notification.close();
  
  const data = event.notification.data;
  
  // Открываем чат, если есть ID чата
  if (data && data.chatId) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Если есть открытое окно, фокусируем его и открываем чат
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            client.postMessage({
              type: 'OPEN_CHAT',
              chatId: data.chatId
            });
            return;
          }
        }
        
        // Если нет открытых окон, открываем новое
        if (clients.openWindow) {
          return clients.openWindow(`/messenger?chat=${data.chatId}`);
        }
      })
    );
  }
});
