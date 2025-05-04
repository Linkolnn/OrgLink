export default defineNuxtPlugin((nuxtApp) => {
  // Проверяем, работаем ли мы на localhost
  const isLocalhost = process.client && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1');
  
  console.log('Работаем на localhost:', isLocalhost);
  
  // Проверяем поддержку уведомлений в браузере
  const notificationsSupported = 'Notification' in window;
  
  // Состояние разрешения на уведомления
  const notificationPermission = ref(notificationsSupported ? Notification.permission : 'denied');
  
  console.log('Notifications plugin initialized, supported:', notificationsSupported, 'permission:', notificationPermission.value);
  
  // Запрос разрешения на отправку уведомлений
  const requestPermission = async () => {
    if (!notificationsSupported) {
      console.warn('Уведомления не поддерживаются в этом браузере');
      return false;
    }
    
    try {
      console.log('Запрашиваем разрешение на уведомления...');
      const permission = await Notification.requestPermission();
      notificationPermission.value = permission;
      console.log('Получено разрешение на уведомления:', permission);
      
      // Если мы на localhost и разрешение получено, выводим дополнительную информацию
      if (isLocalhost && permission === 'granted') {
        console.log('Уведомления разрешены на localhost. Обратите внимание, что некоторые браузеры могут блокировать уведомления на localhost даже при наличии разрешения.');
      }
      
      return permission === 'granted';
    } catch (error) {
      console.error('Ошибка при запросе разрешения на уведомления:', error);
      return false;
    }
  };
  
  // Функция для отправки уведомления
  const sendNotification = ({ title, body, icon, data = {} }) => {
    if (!notificationsSupported) {
      console.warn('Уведомления не поддерживаются в этом браузере');
      return null;
    }
    
    if (notificationPermission.value !== 'granted') {
      console.warn('Разрешение на уведомления не предоставлено. Текущее разрешение:', notificationPermission.value);
      // Пробуем запросить разрешение снова
      requestPermission().then(granted => {
        if (granted) {
          // Если разрешение получено, пробуем отправить уведомление снова
          sendNotification({ title, body, icon, data });
        }
      });
      return null;
    }
    
    try {
      console.log('Отправляем уведомление:', { title, body });
      
      // Проверяем, активна ли вкладка
      const isTabActive = document.visibilityState === 'visible';
      
      // Не отправляем уведомление, если вкладка активна и чат открыт
      if (isTabActive && data.chatId && nuxtApp.$router.currentRoute.value.path === '/messenger') {
        const currentChatId = nuxtApp.$router.currentRoute.value.query.chat;
        if (currentChatId === data.chatId) {
          console.log('Не отправляем уведомление, так как чат уже открыт');
          return null;
        }
      }
      
      // Если мы на localhost, используем альтернативный способ уведомлений
      if (isLocalhost) {
        console.log('Используем альтернативный способ уведомлений для localhost');
        
        // Создаем элемент для отображения уведомления внутри приложения
        const notificationDiv = document.createElement('div');
        notificationDiv.style.position = 'fixed';
        notificationDiv.style.top = '20px';
        notificationDiv.style.right = '20px';
        notificationDiv.style.backgroundColor = '#8A2BE2'; // Фиолетовый цвет
        notificationDiv.style.color = 'white';
        notificationDiv.style.padding = '15px';
        notificationDiv.style.borderRadius = '8px';
        notificationDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        notificationDiv.style.zIndex = '9999';
        notificationDiv.style.maxWidth = '300px';
        notificationDiv.style.cursor = 'pointer';
        
        // Создаем заголовок
        const titleEl = document.createElement('div');
        titleEl.style.fontWeight = 'bold';
        titleEl.style.marginBottom = '5px';
        titleEl.textContent = title;
        
        // Создаем текст
        const bodyEl = document.createElement('div');
        bodyEl.textContent = body;
        
        // Добавляем элементы в уведомление
        notificationDiv.appendChild(titleEl);
        notificationDiv.appendChild(bodyEl);
        
        // Добавляем обработчик клика
        notificationDiv.addEventListener('click', () => {
          // Удаляем уведомление
          document.body.removeChild(notificationDiv);
          
          // Если есть данные о чате, открываем его
          if (data.chatId) {
            nuxtApp.$router.push(`/messenger?chat=${data.chatId}`);
          }
        });
        
        // Добавляем уведомление на страницу
        document.body.appendChild(notificationDiv);
        
        // Удаляем уведомление через 5 секунд
        setTimeout(() => {
          if (document.body.contains(notificationDiv)) {
            document.body.removeChild(notificationDiv);
          }
        }, 5000);
        
        return {
          close: () => {
            if (document.body.contains(notificationDiv)) {
              document.body.removeChild(notificationDiv);
            }
          }
        };
      }
      
      // Создаем уведомление
      const notification = new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        data,
        tag: data.chatId || 'message', // Используем tag для группировки уведомлений
        requireInteraction: true // Уведомление не исчезнет автоматически
      });
      
      // Обработчик клика по уведомлению
      notification.onclick = (event) => {
        event.preventDefault();
        console.log('Клик по уведомлению, данные:', data);
        
        // Фокусируем окно
        window.focus();
        
        // Если есть данные о чате, открываем его
        if (data.chatId) {
          nuxtApp.$router.push(`/messenger?chat=${data.chatId}`);
        }
        
        // Закрываем уведомление
        notification.close();
      };
      
      // Обработчик ошибки
      notification.onerror = (error) => {
        console.error('Ошибка при отображении уведомления:', error);
        
        // Если ошибка на localhost, пробуем использовать альтернативный способ
        if (isLocalhost) {
          console.log('Пробуем использовать альтернативный способ уведомлений после ошибки');
          return sendNotification({ title, body, icon, data });
        }
      };
      
      return notification;
    } catch (error) {
      console.error('Ошибка при отправке уведомления:', error);
      
      // Если ошибка на localhost, пробуем использовать альтернативный способ
      if (isLocalhost) {
        console.log('Пробуем использовать альтернативный способ уведомлений после исключения');
        return sendNotification({ title, body, icon, data });
      }
      
      return null;
    }
  };
  
  // Функция для отправки уведомления о новом сообщении
  const sendMessageNotification = ({ chatName, senderName, message, chatId, chatAvatar }) => {
    console.log('Отправляем уведомление о сообщении:', { chatName, senderName, message, chatId });
    
    const title = chatName || 'Новое сообщение';
    const body = senderName ? `${senderName}: ${message}` : message;
    const icon = chatAvatar || '/favicon.ico';
    
    return sendNotification({
      title,
      body,
      icon,
      data: { chatId, type: 'message' }
    });
  };
  
  // Проверяем, поддерживает ли система ServiceWorker для уведомлений
  const checkServiceWorkerSupport = () => {
    if ('serviceWorker' in navigator) {
      console.log('ServiceWorker поддерживается');
      return true;
    } else {
      console.warn('ServiceWorker не поддерживается');
      return false;
    }
  };
  
  // Регистрируем Service Worker для уведомлений
  const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
      console.warn('ServiceWorker не поддерживается в этом браузере');
      return false;
    }
    
    try {
      console.log('Регистрируем Service Worker для уведомлений...');
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker зарегистрирован:', registration);
      
      // Запрашиваем разрешение на push-уведомления, если поддерживаются
      if ('PushManager' in window) {
        console.log('Push API поддерживается');
        
        // Проверяем подписку на push-уведомления
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          console.log('Нет активной подписки на push-уведомления');
        } else {
          console.log('Уже есть подписка на push-уведомления');
        }
      }
      
      return true;
    } catch (error) {
      console.error('Ошибка при регистрации Service Worker:', error);
      return false;
    }
  };
  
  // Инициализация при загрузке плагина
  if (process.client) {
    // Проверяем поддержку ServiceWorker
    if (checkServiceWorkerSupport()) {
      // Регистрируем Service Worker
      registerServiceWorker();
    }
    
    // Если разрешение уже предоставлено, выводим сообщение
    if (notificationPermission.value === 'granted') {
      console.log('Разрешение на уведомления уже предоставлено');
    }
    
    // Обновляем разрешение при изменении видимости страницы
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && notificationsSupported) {
        notificationPermission.value = Notification.permission;
      }
    });
    
    // Слушаем сообщения от Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Получено сообщение от Service Worker:', event.data);
        
        // Обрабатываем сообщение от Service Worker
        if (event.data && event.data.type === 'OPEN_CHAT' && event.data.chatId) {
          nuxtApp.$router.push(`/messenger?chat=${event.data.chatId}`);
        }
      });
    }
  }
  
  // Предоставляем методы через composable
  nuxtApp.provide('notifications', {
    supported: notificationsSupported,
    permission: notificationPermission,
    requestPermission,
    sendNotification,
    sendMessageNotification,
    checkServiceWorkerSupport,
    registerServiceWorker
  });
});
