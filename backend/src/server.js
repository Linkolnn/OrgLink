import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { createAdminIfNotExists } from './controllers/authController.js';

// Получаем путь к текущему файлу и корневой директории проекта
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// Загружаем переменные окружения из корневого .env
dotenv.config({ path: path.resolve(rootDir, '.env') });

// Инициализируем Express
const app = express();
const PORT = process.env.BACKEND_PORT || process.env.PORT;

// Middlewares
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? ['https://org-link.vercel.app', 'https://www.org-link.vercel.app'] : process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Credentials']
}));

// Middleware для предварительной проверки CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (process.env.NODE_ENV === 'production' && 
      (origin === 'https://org-link.vercel.app' || origin === 'https://www.org-link.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.FRONTEND_URL) {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

// Запускаем сервер только в режиме разработки
// В Vercel это не нужно, там приложение запускается как serverless
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });
}

// Экспорт приложения для Vercel
export default app; 