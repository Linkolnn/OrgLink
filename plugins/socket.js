import { io } from 'socket.io-client';
import { defineNuxtPlugin } from '#app';
import { useCookie, useAuthStore, useRuntimeConfig, watch } from '#imports';

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  
  // Получаем токен из хранилища аутентификации или из локальной cookie
  const getToken = () => {
    // Сначала проверяем хранилище аутентификации
    if (authStore.token) {
      return authStore.token;
    }
    
    // Проверяем локальную копию токена в client_token cookie
    const clientTokenCookie = useCookie('client_token');
    if (clientTokenCookie.value) {
      // Сохраняем в хранилище аутентификации для дальнейшего использования
      authStore.token = clientTokenCookie.value;
      return clientTokenCookie.value;
    }
    
    return null;
  };
  
  // Получаем токен для инициализации
  const token = getToken();
  
  // Инициализация WebSocket соединения
  
  // Определяем, находимся ли мы в production окружении (Vercel)
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
  
  // Определяем URL для Socket.IO
  // Получаем API URL из конфигурации
  const backendUrl = isProduction || isVercel 
    ? (config.public.backendUrl || 'https://org-link.vercel.app')
    : (config.public.backendUrl || 'http://localhost:5000');
  
  console.log('Socket.IO connecting to backend:', backendUrl);
  
  // Прямое соединение с бэкендом, минуя прокси
  const socket = io(backendUrl, {
    autoConnect: false, // Не подключаемся автоматически
    withCredentials: true,
    reconnection: true,        // Включаем автоматическое переподключение
    reconnectionAttempts: 10,  // Максимальное количество попыток переподключения
    reconnectionDelay: 1000,   // Задержка между попытками переподключения
    timeout: 10000,            // Таймаут соединения
    transports: ['polling'],   // Используем только polling для надежности
    auth: {
      token: getToken() // Инициализируем с токеном
    }
  });

  // Обработчики событий сокета
  socket.on('connect', () => {
    // WebSocket соединение установлено
  });

  socket.on('connect_error', (error) => {
    // Логируем ошибку подключения
    console.warn('Socket.io connection error:', error.message);
    
    // Если ошибка связана с аутентификацией, попробуем обновить токен и переподключиться
    if (error.message.includes('Authentication')) {
      const token = getToken();
      if (token) {
        socket.auth.token = token;
        setTimeout(() => {
          socket.connect();
        }, 1000);
      }
    }
    // Если ошибка связана с транспортом, попробуем другой транспорт
    else if (error.message.includes('transport') || error.message.includes('xhr poll error')) {
      // Переключаемся на polling, если websocket не работает
      socket.io.opts.transports = ['polling'];
      setTimeout(() => {
        socket.connect();
      }, 1000);
    }
  });

  socket.on('disconnect', (reason) => {
    // WebSocket соединение разорвано
  });
  
  socket.on('reconnect', (attemptNumber) => {
    // WebSocket переподключен
  });
  
  socket.on('reconnect_attempt', (attemptNumber) => {
    // Попытка переподключения WebSocket
    socket.auth.token = getToken();
  });
  
  socket.on('connection-established', (data) => {
    // Сервер подтвердил соединение
  });
  
  socket.on('joined-chat', ({ chatId, success }) => {
    // Подключение к комнате чата
  });
  
  // Метод для подключения к комнате чата
  const joinChat = (chatId) => {
    const token = getToken();
    
    if (!token) {
      return false;
    }
    
    // Обновляем токен аутентификации
    socket.auth.token = token;
    
    if (!socket.connected) {
      socket.connect();
      
      // Подключаемся к чату после установления соединения
      socket.once('connect', () => {
        socket.emit('join-chat', chatId);
      });
      
      return true;
    }
    
    // Если уже подключены, просто отправляем запрос на подключение к чату
    socket.emit('join-chat', chatId);
    return true;
  };
  
  // Метод для отключения от комнаты чата
  const leaveChat = (chatId) => {
    if (socket.connected) {
      console.log(`Покидаем комнату чата: ${chatId}`);
      socket.emit('leave-chat', chatId);
    }
  };
  
  // Функция для подключения к WebSocket
  const connect = () => {
    const token = getToken();
    
    if (!token) {
      // Невозможно подключиться: токен не найден
      
      // Добавляем отложенную попытку подключения через 1 секунду
      // Это может помочь, если токен появится после инициализации
      setTimeout(() => {
        const newToken = getToken();
        if (newToken) {
          socket.auth.token = newToken;
          socket.connect();
        }
      }, 1000);
      
      return;
    }
    
    // Обновляем токен аутентификации
    socket.auth.token = token;
    
    if (!socket.connected) {
      socket.connect();
    }
  };
  
  // Автоматически подключаемся, если пользователь аутентифицирован
  if (authStore.isAuthenticated && token) {
    connect();
  }
  
  // Следим за изменением статуса аутентификации
  watch(() => authStore.isAuthenticated, (isAuthenticated) => {
    if (isAuthenticated && getToken()) {
      connect();
    } else if (!isAuthenticated) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
  });
  
  // Добавляем сокет и методы в глобальный контекст
  nuxtApp.provide('socket', socket);
  nuxtApp.provide('socketJoinChat', joinChat);
  nuxtApp.provide('socketLeaveChat', leaveChat);
  nuxtApp.provide('socketConnect', connect);
});
