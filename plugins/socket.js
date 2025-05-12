import { io } from 'socket.io-client';
import { defineNuxtPlugin } from '#app';
import { useCookie, useAuthStore, useRuntimeConfig, watch } from '#imports';
import { useChatStore } from '~/stores/chat';

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
  // Используем только polling для надежности и совместимости со всеми устройствами
  // Это решает проблемы с подтормаживанием при переключении между транспортами
  const transports = ['polling'];
  console.log(`Socket.IO: Используем транспорты: ${transports.join(', ')}`);
  
  // Определяем, используется ли Safari
  const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  // Уменьшаем таймаут для более быстрого обнаружения проблем с соединением
  const connectionTimeout = 10000; // 10 секунд для всех браузеров
  
  console.log('Browser detection:', { isSafari, isIOS, connectionTimeout });
  
  // Получаем токен для WebSocket соединения
  const token = getToken();
  console.log('Socket.IO: Токен для WebSocket:', token ? 'Установлен' : 'Отсутствует');
  
  // Добавляем токен в URL для лучшей совместимости
  const socketUrl = token ? `${backendUrl}?token=${token}` : backendUrl;
  console.log('Socket.IO: Используем URL с токеном:', socketUrl);
  
  const socket = io(socketUrl, {
    autoConnect: false, // Не подключаемся автоматически
    withCredentials: true,
    reconnection: true,        // Включаем автоматическое переподключение
    reconnectionAttempts: Infinity,  // Бесконечное количество попыток переподключения
    reconnectionDelay: 500,    // Уменьшаем задержку между попытками переподключения
    timeout: connectionTimeout, // Оптимизированный таймаут для быстрого обнаружения проблем
    transports: transports,    // Используем только polling для стабильности
    path: socketPath,          // Используем путь в зависимости от окружения
    forceNew: true,            // Создаем новое соединение
    upgrade: false,            // Отключаем автоматическое обновление транспорта
    pingInterval: 10000,       // Уменьшаем интервал пинга для более быстрого обнаружения проблем
    pingTimeout: 5000,         // Уменьшаем таймаут пинга
    auth: {
      token: token // Инициализируем с токеном
    },
    // Добавляем заголовки для лучшей совместимости
    extraHeaders: {
      "X-Client-Info": "iOS-Safari-Compatible",
      "Authorization": token ? `Bearer ${token}` : undefined,
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
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
    console.log('Socket.IO: Соединение установлено');
    
    // При успешном подключении сбрасываем задержку переподключения на стандартную
    socket.io.reconnectionDelay = 500;
    socket.io.reconnectionDelayMax = 1000;
    
    // Автоматически подключаемся к активному чату, если он есть
    const chatStore = useChatStore();
    if (chatStore.activeChat && chatStore.activeChat._id) {
      socket.emit('join-chat', chatStore.activeChat._id);
    }
    
    // Отправляем событие о подключении для обновления интерфейса
    nuxtApp.hook('socket:connected');
  });

  socket.on('connect_error', (error) => {
    // Логируем ошибку подключения
    console.error('Socket.io connection error:', error.message, error);
    
    // Получаем свежий токен
    const token = getToken();
    
    // Обновляем токен в настройках соединения
    if (token) {
      socket.auth.token = token;
      
      // Обновляем токен в URL для следующего подключения
      const socketUrl = `${backendUrl}?token=${token}`;
      socket.io.uri = socketUrl;
      
      // Обновляем заголовки
      socket.io.opts.extraHeaders = {
        ...socket.io.opts.extraHeaders,
        "Authorization": `Bearer ${token}`
      };
    }
    
    // Убеждаемся, что используем только polling
    if (socket.io.opts.transports.includes('websocket')) {
      console.log('Переключаемся на использование только polling для стабильности');
      socket.io.opts.transports = ['polling'];
    }
    
    // Уменьшаем задержку переподключения для более быстрого восстановления
    socket.io.reconnectionDelay = 300;
    socket.io.reconnectionDelayMax = 1000;
    
    // Устанавливаем отключение автоматического обновления транспорта
    socket.io.opts.upgrade = false;
    
    // Определяем тип ошибки и выбираем оптимальную стратегию восстановления
    const errorType = getErrorType(error);
    
    switch (errorType) {
      case 'auth':
        // Ошибка аутентификации
        console.log('Ошибка аутентификации, пробуем переподключиться с новым токеном');
        setTimeout(() => socket.connect(), 300);
        break;
      
      case 'cors':
        // Ошибка CORS
        console.log('Ошибка CORS, пробуем использовать альтернативный метод подключения');
        
        // Добавляем токен в URL для обхода проблем с CORS
        if (token && !socket.io.uri.includes('token=')) {
          socket.io.uri = `${backendUrl}?token=${token}`;
        }
        
        setTimeout(() => socket.connect(), 300);
        break;
      
      case 'transport':
        // Ошибка транспорта
        console.log('Ошибка транспорта, пробуем использовать только polling');
        socket.io.opts.transports = ['polling'];
        setTimeout(() => socket.connect(), 300);
        break;
      
      default:
        // Неизвестная ошибка
        console.log('Неизвестная ошибка, пробуем переподключиться');
        setTimeout(() => socket.connect(), 500);
    }
  });
  
  // Функция для определения типа ошибки
  const getErrorType = (error) => {
    const errorMsg = error.message || '';
    
    if (errorMsg.includes('Authentication') || errorMsg.includes('auth') || errorMsg.includes('401')) {
      return 'auth';
    }
    
    if (errorMsg.includes('CORS') || errorMsg.includes('Access-Control')) {
      return 'cors';
    }
    
    if (errorMsg.includes('transport') || errorMsg.includes('xhr') || errorMsg.includes('poll')) {
      return 'transport';
    }
    
    return 'unknown';
  };

  socket.on('disconnect', (reason) => {
    // WebSocket соединение разорвано
    console.log('Socket.IO: Соединение разорвано, причина:', reason);
    
    // Если соединение разорвано из-за ошибки аутентификации, обновляем токен
    if (reason === 'io server disconnect' || reason.includes('auth')) {
      const token = getToken();
      if (token) {
        socket.auth.token = token;
        socket.io.opts.extraHeaders['Authorization'] = `Bearer ${token}`;
        
        // Быстрое переподключение
        setTimeout(() => socket.connect(), 100);
      }
    }
    
    // Отправляем событие о отключении для обновления интерфейса
    nuxtApp.hook('socket:disconnected', { reason });
  });
  
  socket.on('reconnect', (attemptNumber) => {
    // WebSocket переподключен
    console.log('Socket.IO: Успешное переподключение после', attemptNumber, 'попыток');
    
    // Автоматически подключаемся к активному чату, если он есть
    const chatStore = useChatStore();
    if (chatStore.activeChat && chatStore.activeChat._id) {
      socket.emit('join-chat', chatStore.activeChat._id);
    }
    
    // Обновляем список чатов и сообщений
    chatStore.loadChats();
    if (chatStore.activeChat && chatStore.activeChat._id) {
      chatStore.loadMessages(chatStore.activeChat._id);
    }
    
    // Отправляем событие о переподключении для обновления интерфейса
    nuxtApp.hook('socket:reconnected');
  });
  
  socket.on('reconnect_attempt', (attemptNumber) => {
    // Попытка переподключения WebSocket
    console.log('Socket.IO: Попытка переподключения #', attemptNumber);
    
    // Обновляем токен перед каждой попыткой переподключения
    const token = getToken();
    if (token) {
      socket.auth.token = token;
      socket.io.opts.extraHeaders['Authorization'] = `Bearer ${token}`;
      
      // Обновляем URL с токеном
      if (!socket.io.uri.includes('token=')) {
        socket.io.uri = `${backendUrl}?token=${token}`;
      }
    }
    
    // Если много попыток, убеждаемся что используем только polling
    if (attemptNumber > 2 && socket.io.opts.transports.includes('websocket')) {
      socket.io.opts.transports = ['polling'];
    }
  });
  
  socket.on('connection-established', (data) => {
    // Сервер подтвердил соединение
    console.log('Socket.IO: Сервер подтвердил соединение', data);
    
    // Отправляем событие о подтверждении соединения для обновления интерфейса
    nuxtApp.hook('socket:established', data);
  });
  
  socket.on('joined-chat', ({ chatId, success }) => {
    // Подключение к комнате чата
    console.log('Socket.IO: ' + (success ? 'Успешное подключение к чату' : 'Ошибка подключения к чату'), chatId);
    
    // Отправляем событие о подключении к чату для обновления интерфейса
    nuxtApp.hook('socket:joined-chat', { chatId, success });
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
