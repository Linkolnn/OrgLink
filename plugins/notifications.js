import { useChatStore } from '~/stores/chat';

export default defineNuxtPlugin((nuxtApp) => {
  // Проверяем поддержку уведомлений в браузере
  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext;
  
  // Проверяем, работает ли сайт по HTTPS
  const isSecureContext = process.client ? window.isSecureContext : false;
  
  // Проверяем, работает ли сайт на локальном хосте или на разрешенном домене
  const isAllowedDomain = process.client ? (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('vercel.app') ||
    window.location.hostname.includes('railway.app')
  ) : false;
  
  // Определяем, является ли браузер Firefox
  const isFirefox = process.client ? navigator.userAgent.toLowerCase().includes('firefox') : false;
  
  // Определяем, является ли устройство мобильным
  const isMobileDevice = process.client ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) : false;
  
  // Состояние разрешения на уведомления
  const notificationPermission = ref(
    (notificationsSupported && isSecureContext)
      ? Notification.permission 
      : 'denied'
  );
  
  // Логируем состояние уведомлений
  if (process.client) {
    console.log('[Notifications] Состояние уведомлений:', { 
      notificationsSupported, 
      isSecureContext, 
      permission: notificationPermission.value 
    });
  }
  
  // Состояние видимости документа и активности окна
  const isDocumentVisible = ref(
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : false
  );
  const isWindowFocused = ref(
    typeof window !== 'undefined' ? document.hasFocus() : false
  );
  
  // Обработчики событий видимости и фокуса
  if (process.client) {
    document.addEventListener('visibilitychange', () => {
      isDocumentVisible.value = document.visibilityState === 'visible';
    });
    
    window.addEventListener('focus', () => {
      isWindowFocused.value = true;
    });
    
    window.addEventListener('blur', () => {
      isWindowFocused.value = false;
    });
  }
  
  // Запрос разрешения на отправку уведомлений
  const requestPermission = async () => {
    // Проверяем поддержку уведомлений
    if (!notificationsSupported) {
      console.warn('[Notifications] Уведомления не поддерживаются в этом браузере');
      return false;
    }
    
    // Проверяем, работает ли сайт по HTTPS
    if (!isSecureContext) {
      console.warn('[Notifications] Уведомления требуют защищенного контекста (HTTPS)');
      return false;
    }
    
    // Если разрешение уже получено, возвращаем true
    if (notificationPermission.value === 'granted') {
      console.log('[Notifications] Разрешение на уведомления уже получено');
      return true;
    }
    
    // Если разрешение уже запрещено, возвращаем false
    if (notificationPermission.value === 'denied') {
      console.warn('[Notifications] Разрешение на уведомления было отклонено пользователем');
      return false;
    }
    
    try {
      console.log('[Notifications] Запрашиваем разрешение на уведомления...');
      
      // В Firefox Notification.requestPermission может не возвращать Promise
      // Поэтому используем обертку, которая работает в обоих случаях
      const permission = await new Promise((resolve) => {
        try {
          const permissionResult = Notification.requestPermission((result) => {
            // Обработка для старого API (callback)
            console.log('[Notifications] Получен результат через callback:', result);
            resolve(result);
          });
          
          // Если возвращается Promise (современные браузеры)
          if (permissionResult instanceof Promise) {
            permissionResult.then((result) => {
              console.log('[Notifications] Получен результат через Promise:', result);
              resolve(result);
            });
          }
        } catch (innerError) {
          console.error('[Notifications] Ошибка при запросе разрешения:', innerError);
          resolve('denied');
        }
      });
      
      console.log('[Notifications] Получено разрешение:', permission);
      notificationPermission.value = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('[Notifications] Ошибка при запросе разрешения на уведомления:', error);
      return false;
    }
  };
  
  // Функция для отправки только системных уведомлений
  const sendNotification = ({ title, body, icon, data = {}, forceShow = false }) => {
    // Проверяем поддержку уведомлений
    if (!notificationsSupported) {
      console.warn('[Notifications] Не удалось отправить уведомление: уведомления не поддерживаются');
      return null;
    }
    
    // Проверяем, работает ли сайт по HTTPS
    if (!isSecureContext) {
      console.warn('[Notifications] Не удалось отправить уведомление: требуется защищенный контекст (HTTPS)');
      return null;
    }
    
    // Проверяем, работает ли сайт на разрешенном домене
    if (!isAllowedDomain) {
      console.warn('[Notifications] Не удалось отправить уведомление: домен не разрешен');
      return null;
    }
    
    // Проверяем разрешение на отправку уведомлений
    if (notificationPermission.value !== 'granted') {
      console.warn('[Notifications] Не удалось отправить уведомление: нет разрешения');
      return null;
    }
    
    // Проверяем, нужно ли показывать уведомление
    if (!forceShow && isDocumentVisible.value && isWindowFocused.value) {
      console.log('[Notifications] Уведомление не отправлено: окно активно');
      return null;
    }
    
    try {
      console.log('[Notifications] Отправка системного уведомления:', { title, body });
      
      // Добавляем абсолютный URL для иконки
      let iconUrl = icon || '/favicon.ico';
      
      // Если иконка начинается с '/', добавляем текущий домен
      if (iconUrl.startsWith('/') && typeof window !== 'undefined') {
        const origin = window.location.origin;
        iconUrl = `${origin}${iconUrl}`;
      }
      
      // Создаем объект с параметрами уведомления
      const notificationOptions = {
        body,
        icon: iconUrl,
        badge: iconUrl,
        tag: data.chatId || 'orglink-notification', // Используем тег для группировки уведомлений
        requireInteraction: !isMobileDevice, // На мобильных устройствах отключаем этот параметр
        silent: false // Включаем звук
      };
      
      // Специальная обработка для Firefox
      if (isFirefox) {
        console.log('[Notifications] Используем специальные настройки для Firefox');
        // Firefox может игнорировать некоторые параметры
        notificationOptions.requireInteraction = false;
      }
      
      // Добавляем данные в объект
      try {
        notificationOptions.data = {
          chatId: data.chatId,
          messageId: data.messageId
        };
      } catch (e) {
        console.warn('[Notifications] Не удалось добавить данные в уведомление:', e);
      }
      
      // Создаем уведомление
      const notification = new Notification(title, notificationOptions);
      
      // Обработка клика по уведомлению
      notification.onclick = (event) => {
        console.log('[Notifications] Клик по уведомлению:', { data, notificationData: notification.data });
        
        if (event) event.preventDefault();
        
        // Фокусируемся на окне при клике на уведомление
        window.focus();
        notification.close();
        
        // Получаем данные из уведомления
        const notificationData = notification.data || data;
        const chatId = notificationData?.chatId || data?.chatId;
        
        // Если есть данные о чате, переходим к нему
        if (chatId) {
          console.log('[Notifications] Переход к чату:', chatId);
          
          try {
            // Пробуем использовать хранилище чата
            const chatStore = useChatStore();
            chatStore.setActiveChat(chatId);
            console.log('[Notifications] Установлен активный чат:', chatId);
            
            // Переходим к чату
            const chatUrl = chatId ? `${window.location.origin}/messenger?chat=${chatId}` : `${window.location.origin}/messenger`;
            window.location.href = chatUrl;
          } catch (e) {
            console.error('[Notifications] Ошибка при переходе к чату:', e);
            // В случае ошибки пробуем просто перейти на страницу мессенджера
            window.location.href = window.location.origin + '/messenger';
          }
        }
      };
      
      return notification;
    } catch (error) {
      console.error('Ошибка при отправке уведомления:', error);
      return null;
    }
  };
  
  // Функция для проверки, отключены ли уведомления для чата
  function isChatMuted(chatId) {
    if (!chatId) return false;
    
    // Получаем список отключенных чатов из localStorage
    const savedMutedChats = localStorage.getItem('mutedChatsObj');
    if (savedMutedChats) {
      try {
        const mutedChats = JSON.parse(savedMutedChats);
        // Проверяем, есть ли текущий chatId в объекте отключенных
        return !!mutedChats[chatId];
      } catch (error) {
        console.error('Ошибка при загрузке списка отключенных чатов:', error);
      }
    }
    
    // Проверяем старый формат для обратной совместимости
    const oldMutedChats = localStorage.getItem('mutedChats');
    if (oldMutedChats) {
      try {
        const mutedChats = JSON.parse(oldMutedChats);
        return mutedChats.some(id => id === chatId);
      } catch (error) {
        console.error('Ошибка при загрузке старого формата списка отключенных чатов:', error);
      }
    }
    
    return false;
  };
  
  // Функция для отправки уведомления о новом сообщении
  const sendMessageNotification = ({ chatName, senderName, message, chatId, chatAvatar, forceShow = false }) => {
    const chatStore = useChatStore();
    
    // Проверяем, не отключены ли уведомления для этого чата
    if (chatId && isChatMuted(chatId)) {
      console.log('Уведомления отключены для чата:', chatId);
      return;
    }
    
    // Проверяем различные состояния чата
    const isActiveChat = chatStore.activeChat && chatStore.activeChat._id === chatId;
    const isInactiveChat = chatStore.inactiveChatId === chatId;
    
    // Если чат активен и не отмечен как неактивный, не показываем уведомление
    if (isActiveChat && !isInactiveChat && !forceShow) {
      console.log('Чат активен, уведомление не отправляется:', chatId);
      return;
    }
    
    // Если чат отмечен как неактивный или активный чат сброшен, показываем уведомление
    if (isInactiveChat || !isActiveChat) {
      console.log('Чат неактивен или сброшен, показываем уведомление:', chatId);
      forceShow = true;
    }
    
    // Формируем заголовок и текст уведомления
    const title = chatName || 'Новое сообщение';
    const body = senderName ? `${senderName}: ${message}` : message;
    
    console.log('Отправляем уведомление для чата:', chatId, title, body);
    
    // Отправляем только системное уведомление
    sendNotification({
      title,
      body,
      icon: chatAvatar || '/favicon.ico',
      data: { chatId },
      forceShow
    });
  };
  
  // Проверяем и запрашиваем разрешение при загрузке страницы
  if (process.client) {
    // Запускаем только на клиенте
    setTimeout(() => {
      if (notificationsSupported && notificationPermission.value === 'default') {
        requestPermission();
      }
    }, 2000); // Задержка для лучшего UX
  }
  
  // Предоставляем методы через composable
  nuxtApp.provide('notifications', {
    supported: notificationsSupported,
    permission: notificationPermission,
    isDocumentVisible,
    isWindowFocused,
    requestPermission,
    sendNotification,
    sendMessageNotification
  });
});
