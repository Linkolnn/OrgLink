import { useChatStore } from '~/stores/chat';

export default defineNuxtPlugin((nuxtApp) => {
  // Проверяем, является ли устройство мобильным
  const isMobileDevice = process.client ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) : false;
  
  // Проверяем поддержку уведомлений в браузере
  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext;
  
  // Проверяем, работает ли сайт по HTTPS
  const isSecureContext = process.client ? window.isSecureContext : false;
  
  // Проверяем, работает ли сайт на локальном хосте или на разрешенном домене
  const isAllowedDomain = process.client ? (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('vercel.app') ||
    window.location.hostname.includes('railway.app') ||
    window.location.hostname.includes('org-link') ||
    window.location.hostname.includes('orglink')
  ) : false;
  
  // Логируем текущий домен и информацию об устройстве
  if (process.client) {
    console.log('[Notifications] Информация об устройстве:', { 
      domain: window.location.hostname, 
      isAllowedDomain,
      isMobileDevice,
      userAgent: navigator.userAgent,
      browser: getBrowserInfo()
    });
  }
  
  // Функция для определения браузера
  function getBrowserInfo() {
    if (!process.client) return 'server';
    
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
    let version = '';
    
    // Проверяем Firefox первым, так как он имеет особенности в работе с уведомлениями
    if (ua.indexOf('Firefox') > -1) {
      browserName = 'Firefox';
      const match = ua.match(/Firefox\/(\d+\.\d+)/);
      if (match) version = match[1];
    }
    else if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1 && ua.indexOf('OPR') === -1) {
      browserName = 'Chrome';
      const match = ua.match(/Chrome\/(\d+\.\d+)/);
      if (match) version = match[1];
    }
    else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
      browserName = 'Safari';
      const match = ua.match(/Version\/(\d+\.\d+)/);
      if (match) version = match[1];
    }
    else if (ua.indexOf('Edg') > -1) {
      browserName = 'Edge';
      const match = ua.match(/Edg\/(\d+\.\d+)/);
      if (match) version = match[1];
    }
    else if (ua.indexOf('OPR') > -1 || ua.indexOf('Opera') > -1) {
      browserName = 'Opera';
      const match = ua.match(/(?:OPR|Opera)\/(\d+\.\d+)/);
      if (match) version = match[1];
    }
    
    return { name: browserName, version };
  }
  
  // Проверяем, является ли браузер Firefox
  const isFirefox = process.client ? navigator.userAgent.indexOf('Firefox') > -1 : false;
  
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
    if (Notification.permission === 'granted') {
      console.log('[Notifications] Разрешение на уведомления уже получено');
      notificationPermission.value = 'granted';
      return true;
    }
    
    try {
      // Запрашиваем разрешение на отправку уведомлений
      console.log('[Notifications] Запрашиваем разрешение на уведомления...', { isFirefox, browser: getBrowserInfo() });
      
      // Специальная обработка для Firefox
      if (isFirefox) {
        console.log('[Notifications] Используем специальную обработку для Firefox');
        
        // Firefox использует только Promise API
        try {
          const permission = await Notification.requestPermission();
          console.log('[Notifications] Firefox: результат запроса разрешения:', permission);
          notificationPermission.value = permission;
          
          // Для Firefox дополнительно проверяем, что уведомления работают
          if (permission === 'granted') {
            // Отправляем тестовое уведомление для проверки
            try {
              const testNotification = new Notification('OrgLink', {
                body: 'Уведомления активированы',
                icon: window.location.origin + '/favicon.ico',
                tag: 'test-notification'
              });
              
              // Закрываем тестовое уведомление через 2 секунды
              setTimeout(() => {
                testNotification.close();
              }, 2000);
            } catch (e) {
              console.warn('[Notifications] Firefox: не удалось отправить тестовое уведомление:', e);
            }
          }
          
          return permission === 'granted';
        } catch (firefoxError) {
          console.error('[Notifications] Firefox: ошибка при запросе разрешения:', firefoxError);
          return false;
        }
      }
      
      // Для других браузеров используем стандартный подход
      // Используем Promise для обработки разных реализаций API
      const permission = await new Promise((resolve) => {
        const permissionResult = Notification.requestPermission((result) => {
          resolve(result);
        });
        
        // Для браузеров, использующих Promise API
        if (permissionResult) {
          permissionResult.then(resolve);
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
  
  // Функция для отправки уведомления
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
      console.log('[Notifications] Отправка уведомления:', { 
        title, 
        body, 
        domain: process.client ? window.location.hostname : 'unknown',
        isAllowedDomain,
        isSecureContext,
        notificationsSupported,
        isMobileDevice,
        browser: getBrowserInfo(),
        permission: notificationPermission.value
      });
      
      // Добавляем абсолютный URL для иконки
      let iconUrl = icon || '/favicon.ico';
      
      // Если иконка начинается с '/', добавляем текущий домен
      if (iconUrl.startsWith('/') && typeof window !== 'undefined') {
        const origin = window.location.origin;
        iconUrl = `${origin}${iconUrl}`;
        console.log('[Notifications] Используем абсолютный URL для иконки:', iconUrl);
      }
      
      // Если это мобильное устройство, добавляем специальную обработку
      if (isMobileDevice) {
        console.log('[Notifications] Обнаружено мобильное устройство, применяем специальную обработку');
        
        // На мобильных устройствах может не работать стандартный механизм уведомлений
        // Добавляем визуальное уведомление в интерфейсе
        if (window.$showNotification) {
          window.$showNotification(
            `${title}: ${body}`,
            'info',
            5000 // Показываем уведомление на 5 секунд
          );
        }
        
        // Также можно добавить вибрацию, если браузер поддерживает
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate([200, 100, 200]); // Вибрация: 200мс вкл, 100мс выкл, 200мс вкл
            console.log('[Notifications] Вибрация активирована');
          } catch (e) {
            console.warn('[Notifications] Не удалось активировать вибрацию:', e);
          }
        }
      }
      
      // Создаем объект с параметрами уведомления
      const notificationOptions = {
        body,
        icon: iconUrl,
        badge: iconUrl,
        tag: data.chatId || 'orglink-notification', // Используем тег для группировки уведомлений
        requireInteraction: true, // Уведомление не исчезнет автоматически
        silent: false // Включаем звук
      };
      
      // Специальная обработка для Firefox
      if (isFirefox) {
        console.log('[Notifications] Используем специальные настройки для Firefox');
        // Firefox может игнорировать некоторые параметры
        notificationOptions.requireInteraction = false; // В Firefox этот параметр может работать некорректно
      }
      
      // Добавляем данные в объект, если браузер поддерживает
      if (data) {
        try {
          // В некоторых браузерах нельзя напрямую передать объект data
          notificationOptions.data = {
            chatId: data.chatId,
            messageId: data.messageId,
            url: window.location.origin + '/messenger?chat=' + data.chatId
          };
          console.log('[Notifications] Добавлены данные в уведомление:', notificationOptions.data);
        } catch (e) {
          console.warn('[Notifications] Не удалось добавить данные в уведомление:', e);
        }
      }
      
      console.log('[Notifications] Создание уведомления с параметрами:', notificationOptions);
      
      // Создаем уведомление
      let notification;
      
      // Специальная обработка для Firefox
      if (isFirefox) {
        try {
          // В Firefox могут быть проблемы с некоторыми параметрами, поэтому упрощаем объект
          const firefoxOptions = {
            body: notificationOptions.body,
            icon: notificationOptions.icon,
            tag: notificationOptions.tag
          };
          
          console.log('[Notifications] Firefox: создаем уведомление с упрощенными параметрами');
          notification = new Notification(title, firefoxOptions);
        } catch (firefoxError) {
          console.error('[Notifications] Firefox: ошибка при создании уведомления:', firefoxError);
          
          // Пробуем создать с минимальными параметрами
          try {
            notification = new Notification(title, { body: notificationOptions.body });
          } catch (e) {
            console.error('[Notifications] Firefox: не удалось создать уведомление даже с минимальными параметрами:', e);
            
            // Используем визуальное уведомление в интерфейсе
            if (window.$showNotification) {
              window.$showNotification(
                `${title}: ${body}`,
                'info',
                5000
              );
            }
            
            return null;
          }
        }
      } else {
        // Для других браузеров используем стандартный подход
        notification = new Notification(title, notificationOptions);
      }
      
      // Обработка клика по уведомлению
      notification.onclick = (event) => {
        console.log('[Notifications] Клик по уведомлению:', data, notification.data);
        
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
            
            // Также пробуем перейти по URL
            if (notificationData?.url) {
              window.location.href = notificationData.url;
            } else {
              window.location.href = window.location.origin + '/messenger?chat=' + chatId;
            }
          } catch (e) {
            console.error('[Notifications] Ошибка при переходе к чату:', e);
            // В случае ошибки пробуем просто перейти на страницу мессенджера
            window.location.href = window.location.origin + '/messenger';
          }
        }
      };
      
      // Добавляем обработчик ошибок
      notification.onerror = (error) => {
        console.error('[Notifications] Ошибка при показе уведомления:', error);
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
    
    // Отправляем уведомление
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
