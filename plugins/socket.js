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
  const isVercel = typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || window.location.hostname === 'org-link.vercel.app');
  
  // Определяем URL для Socket.IO
  let backendUrl;
  let socketPath;
  
  // Всегда используем прямое подключение к бэкенду на Render
  backendUrl = config.public.backendUrl || 'https://orglink.onrender.com';
  socketPath = '/socket.io';
  console.log('Socket.IO: Прямое подключение к бэкенду на Render:', backendUrl);
  
  // Проверяем, что URL не заканчивается на слэш для предотвращения проблем с двойными слэшами
  if (backendUrl.endsWith('/')) {
    backendUrl = backendUrl.slice(0, -1);
  }
  
  console.log('Socket.IO connecting to:', backendUrl, 'with path:', socketPath);
  
  // Создаем соединение Socket.IO
  // Для совместимости с Safari на iOS, сначала используем polling, затем websocket
  const transports = ['polling', 'websocket'];
  console.log(`Socket.IO: Используем транспорты: ${transports.join(', ')}`);
  
  // Определяем, используется ли Safari
  const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  // Увеличиваем таймаут для Safari и iOS
  const connectionTimeout = (isSafari || isIOS) ? 30000 : 20000;
  
  console.log('Browser detection:', { isSafari, isIOS, connectionTimeout });
  
  const socket = io(backendUrl, {
    autoConnect: false, // Не подключаемся автоматически
    withCredentials: true,
    reconnection: true,        // Включаем автоматическое переподключение
    reconnectionAttempts: Infinity,  // Бесконечное количество попыток переподключения
    reconnectionDelay: 1000,   // Задержка между попытками переподключения
    timeout: connectionTimeout, // Увеличенный таймаут для Safari/iOS
    transports: transports,    // Используем транспорты в зависимости от окружения
    path: socketPath,          // Используем путь в зависимости от окружения
    forceNew: true,            // Создаем новое соединение
    auth: {
      token: getToken() // Инициализируем с токеном
    },
    // Не используем extraHeaders с Origin, так как Safari запрещает это
    extraHeaders: {
      "X-Client-Info": "iOS-Safari-Compatible"
    }
  });
  
  // Получаем токен для логирования
  const hasToken = getToken() ? 'Токен установлен' : 'Токен отсутствует';
  
  console.log('Socket.IO настройки:', {
    url: backendUrl,
    path: socketPath,
    transports: transports,
    token: hasToken,
    isVercel: isVercel,
    isProduction: isProduction,
    isSafari: isSafari,
    isIOS: isIOS
  });

  // Обработчики событий сокета
  socket.on('connect', () => {
    // WebSocket соединение установлено
  });

  socket.on('connect_error', (error) => {
    // Логируем ошибку подключения
    console.error('Socket.io connection error:', error.message, error);
    
    // Проверка на ошибки CORS
    if (error.message.includes('CORS') || error.message.includes('Access-Control')) {
      console.log('Ошибка CORS, пробуем использовать только polling');
      // Пробуем использовать только polling для Safari/iOS
      socket.io.opts.transports = ['polling'];
      setTimeout(() => {
        socket.connect();
      }, 1000);
      return;
    }
    
    // Проверка на ошибки транспорта
    if (error.message.includes('transport') || error.message.includes('xhr')) {
      console.log('Ошибка транспорта, пробуем использовать только polling');
      socket.io.opts.transports = ['polling'];
      setTimeout(() => {
        socket.connect();
      }, 1000);
      return;
    }
    
    // Если ошибка связана с аутентификацией, попробуем обновить токен и переподключиться
    if (error.message.includes('Authentication') || error.message.includes('auth')) {
      console.log('Ошибка аутентификации, пробуем обновить токен');
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
      console.log('Ошибка транспорта, переключаемся на polling');
      // Переключаемся на polling, если websocket не работает
      socket.io.opts.transports = ['polling'];
      setTimeout(() => {
        socket.connect();
      }, 1000);
    } else {
      // Для других ошибок просто пробуем переподключиться
      console.log('Неизвестная ошибка, пробуем переподключиться');
      setTimeout(() => {
        socket.connect();
      }, 2000);
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
      console.warn('Socket.IO: Невозможно подключиться, токен не найден');
      
      // Добавляем отложенную попытку подключения через 1 секунду
      // Это может помочь, если токен появится после инициализации
      setTimeout(() => {
        const newToken = getToken();
        if (newToken) {
          console.log('Socket.IO: Токен получен, пробуем подключиться');
          socket.auth.token = newToken;
          socket.connect();
        }
      }, 1000);
      
      return;
    }
    
    // Обновляем токен аутентификации
    socket.auth.token = token;
    console.log('Socket.IO: Подключаемся с токеном');
    
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
