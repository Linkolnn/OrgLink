import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { createAdminIfNotExists } from './controllers/authController.js';
import jwt from 'jsonwebtoken'; // Добавляем импорт jwt
import { verifyToken } from './middleware/authMiddleware.js';

// Получаем путь к текущему файлу и корневой директории проекта
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// Загружаем переменные окружения из корневого .env
dotenv.config({ path: path.resolve(rootDir, '.env') });

// Инициализируем Express и Socket.IO
const app = express();
const httpServer = createServer(app);
// Получаем список разрешенных фронтенд доменов из переменных окружения
const defaultFrontendUrls = ['https://org-link.vercel.app', 'https://www.org-link.vercel.app', 'https://orglink.vercel.app', 'http://localhost:3000'];

// Если указан FRONTEND_URL, разбиваем его по запятым и добавляем к списку разрешенных доменов
let allowedOrigins = [...defaultFrontendUrls];
if (process.env.FRONTEND_URL) {
  const envUrls = process.env.FRONTEND_URL.split(',').map(url => url.trim());
  allowedOrigins = [...new Set([...allowedOrigins, ...envUrls])];
}

// Если указан FRONTEND_URL, добавляем его к списку разрешенных доменов
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

console.log('Разрешенные домены:', allowedOrigins);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
});

// Railway автоматически устанавливает переменную PORT
const PORT = process.env.PORT || process.env.BACKEND_PORT || 5000;

// Глобально экспортируем io для использования в других модулях
export { io };

// Middlewares
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Credentials']
}));

// Middleware для предварительной проверки CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Если источник запроса в списке разрешенных, устанавливаем соответствующий заголовок
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  // Для OPTIONS запросов сразу возвращаем успех
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    return res.status(200).end();
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});
app.use(express.json());
app.use(cookieParser());

// Добавление защитных HTTP-заголовков
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Статические файлы
// Обработка статических файлов в зависимости от окружения
if (process.env.NODE_ENV === 'production') {
  // В продакшене используем временную директорию
  const os = await import('os');
  const tmpDir = os.tmpdir();
  const uploadsDir = path.join(tmpDir, 'orglink-uploads');
  
  // Пробуем создать директорию, если она не существует
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    app.use('/uploads', express.static(uploadsDir));
    
    // Также обслуживаем файлы непосредственно из временной директории
    app.use('/uploads', express.static(tmpDir));
  } catch (error) {
    console.warn('Ошибка при настройке статических файлов:', error.message);
    // В случае ошибки просто используем временную директорию
    app.use('/uploads', express.static(tmpDir));
  }
} else {
  // В разработке используем стандартную директорию
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

// Флаг, что соединение с MongoDB установлено
let isConnected = false;

// Подключение к MongoDB при первом запросе для Vercel serverless
app.use(async (req, res, next) => {
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
      console.log('MongoDB подключена');
      
      // После успешного подключения к БД инициализируем администратора
      console.log('Проверка наличия и создание администратора по умолчанию...');
      await createAdminIfNotExists();
    } catch (error) {
      console.error('Ошибка подключения к MongoDB:', error);
      return res.status(500).json({ error: 'Ошибка подключения к базе данных' });
    }
  }
  next();
});

// Используем маршруты API
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/admin', adminRoutes);

// Корневой маршрут
app.get('/', (req, res) => {
  res.json({ 
    message: 'API OrgLink работает',
    mode: process.env.NODE_ENV,
    status: 'connected'
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Что-то пошло не так на сервере!' });
});

// Создаем хранилище для сокетов пользователей
app.locals.userSockets = {};
app.locals.io = io;

// Настройка WebSocket соединений
// Middleware для аутентификации WebSocket
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    console.log('WebSocket аутентификация, токен получен:', !!token);
    
    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }
    
    // Верифицируем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    
    console.log('WebSocket аутентификация успешна для пользователя:', socket.userId);
    
    // Сохраняем сокет пользователя для отправки уведомлений
    app.locals.userSockets[socket.userId] = socket;
    
    next();
  } catch (error) {
    console.error('Ошибка аутентификации WebSocket:', error.message);
    next(new Error('Authentication error: ' + error.message));
  }
});

// Обработка соединений
io.on('connection', (socket) => {
  console.log(`Пользователь подключен: ${socket.userId}`);
  
  // Подписка на чаты
  socket.on('join-chat', (chatId) => {
    const roomName = `chat:${chatId}`;
    socket.join(roomName);
    console.log(`Пользователь ${socket.userId} подключился к чату ${chatId}`);
    
    // Отправляем подтверждение подключения к комнате
    socket.emit('joined-chat', { chatId, success: true });
  });
  
  // Отписка от чата
  socket.on('leave-chat', (chatId) => {
    const roomName = `chat:${chatId}`;
    socket.leave(roomName);
    console.log(`Пользователь ${socket.userId} покинул чат ${chatId}`);
  });
  
  // Обработка отключения
  socket.on('disconnect', () => {
    console.log(`Пользователь отключен: ${socket.userId}`);
    
    // Удаляем сокет пользователя из хранилища
    delete app.locals.userSockets[socket.userId];
  });
  
  // Отправка тестового сообщения для проверки соединения
  socket.emit('connection-established', { 
    message: 'WebSocket соединение установлено',
    userId: socket.userId
  });
});

// Запускаем сервер всегда, кроме случая когда это Vercel serverless
// Для Railway нужно запускать сервер в любом режиме
const isVercelServerless = process.env.VERCEL === '1';

if (!isVercelServerless) {
  // Запускаем сервер для локальной разработки и Railway
  httpServer.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT} в режиме ${process.env.NODE_ENV}`);
  });
}

// Экспорт приложения для Vercel
export default app; 