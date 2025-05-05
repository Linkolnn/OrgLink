import { useChatStore } from '~/stores/chat';

export default defineNuxtPlugin((nuxtApp) => {
  // Проверяем поддержку уведомлений в браузере
  const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;
  
  // Состояние разрешения на уведомления
  const notificationPermission = ref(
    notificationsSupported 
      ? Notification.permission 
      : 'denied'
  );
  
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
    if (!notificationsSupported) {
      return false;
    }
    
    // Если разрешение уже получено, возвращаем true
    if (notificationPermission.value === 'granted') {
      return true;
    }
    
    // Если разрешение уже запрещено, возвращаем false
    if (notificationPermission.value === 'denied') {
      return false;
    }
    
    try {
      // В Firefox Notification.requestPermission может не возвращать Promise
      // Поэтому используем обертку, которая работает в обоих случаях
      const permission = await new Promise((resolve) => {
        const permissionResult = Notification.requestPermission((result) => {
          // Обработка для старого API (callback)
          resolve(result);
        });
        
        // Если возвращается Promise (современные браузеры)
        if (permissionResult instanceof Promise) {
          permissionResult.then(resolve);
        }
      });
      
      notificationPermission.value = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Ошибка при запросе разрешения на уведомления:', error);
      return false;
    }
  };
  
  // Функция для отправки уведомления
  const sendNotification = ({ title, body, icon, data = {}, forceShow = false }) => {
    if (!notificationsSupported) {
      return null;
    }
    
    if (notificationPermission.value !== 'granted') {
      return null;
    }
    
    // Проверяем, нужно ли показывать уведомление
    if (!forceShow && isDocumentVisible.value && isWindowFocused.value) {
      return null;
    }
    
    try {
      // Создаем уведомление с обработкой ошибок для разных браузеров
      let notification;
      
      try {
        notification = new Notification(title, {
          body,
          icon: icon || '/favicon.ico',
          tag: 'message-' + Date.now(), // Уникальный тег для каждого уведомления
          requireInteraction: true, // Уведомление не будет автоматически закрываться
          data
        });
      } catch (error) {
        // Пробуем создать уведомление без дополнительных опций
        notification = new Notification(title, {
          body,
          icon: icon || '/favicon.ico'
        });
      }
      
      // Обработчик клика по уведомлению
      notification.onclick = (event) => {
        event.preventDefault();
        
        // Фокусируем окно
        window.focus();
        
        // Если есть данные о чате, открываем его
        if (data && data.chatId) {
          nuxtApp.$router.push(`/messenger?chat=${data.chatId}`);
        }
        
        // Закрываем уведомление
        notification.close();
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
