import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';

// Получаем путь к текущему файлу и корневой директории проекта
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Определяем директории для загрузок в зависимости от окружения
// В продакшене используем временную директорию системы
let uploadsDir, chatAvatarsDir, messageFilesDir;

try {
  // Пробуем использовать стандартные пути
  uploadsDir = process.env.NODE_ENV === 'production' 
    ? path.join(os.tmpdir(), 'orglink-uploads') 
    : path.join(__dirname, '../../uploads');
  
  chatAvatarsDir = path.join(uploadsDir, 'chat-avatars');
  messageFilesDir = path.join(uploadsDir, 'message-files');

  // Создаем директории, если они не существуют
  [uploadsDir, chatAvatarsDir, messageFilesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
} catch (error) {
  console.warn('Не удалось создать директории для загрузок:', error.message);
  console.warn('Используем временную директорию системы без создания поддиректорий');
  
  // Если не удалось создать директории, используем корневую временную директорию
  uploadsDir = os.tmpdir();
  chatAvatarsDir = uploadsDir;
  messageFilesDir = uploadsDir;
}

// Настройка хранилища для аватаров чатов
const chatAvatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, chatAvatarsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'chat-avatar-' + uniqueSuffix + ext);
  }
});

// Настройка хранилища для аватаров пользователей
const userAvatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, chatAvatarsDir); // Используем ту же директорию, что и для чатов
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'user-avatar-' + uniqueSuffix + ext);
  }
});

// Настройка хранилища для файлов сообщений
const messageFileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, messageFilesDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'message-file-' + uniqueSuffix + ext);
  }
});

// Функция для фильтрации файлов по типу
const fileFilter = (req, file, cb) => {
  // Разрешенные типы файлов
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', // изображения
    'video/mp4', 'video/webm', // видео
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // документы
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // таблицы
    'application/zip', 'application/x-rar-compressed' // архивы
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Неподдерживаемый тип файла'), false);
  }
};

// Создаем middleware для загрузки аватаров чатов
export const uploadChatAvatar = multer({
  storage: chatAvatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 МБ
  },
  fileFilter: (req, file, cb) => {
    // Только изображения для аватаров
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения могут быть использованы как аватар'), false);
    }
  }
}).single('avatar');

// Создаем middleware для загрузки аватаров пользователей
export const uploadUserAvatar = multer({
  storage: userAvatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 МБ
  },
  fileFilter: (req, file, cb) => {
    // Только изображения для аватаров
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения могут быть использованы как аватар'), false);
    }
  }
}).single('avatar');

// Создаем middleware для загрузки файлов сообщений
export const uploadMessageFile = multer({
  storage: messageFileStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 МБ
  },
  fileFilter
}).single('file');

// Обработчик ошибок для multer
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Файл слишком большой' });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

// Функция для получения URL файла
export const getFileUrl = (filename, type) => {
  if (!filename) {
    console.log('Ошибка: имя файла не указано');
    return null;
  }
  
  console.log('Формирование URL для файла:', filename, 'тип:', type);
  
  // Базовый URL API
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? (process.env.BACKEND_URL || 'https://orglink-production-e9d8.up.railway.app')
    : `http://localhost:${process.env.BACKEND_PORT || 5000}`;
  
  console.log('Базовый URL:', baseUrl);
  
  // Убедимся, что в продакшн-окружении всегда используется HTTPS
  let finalBaseUrl = baseUrl;
  if (process.env.NODE_ENV === 'production' && baseUrl.startsWith('http://')) {
    finalBaseUrl = baseUrl.replace('http://', 'https://');
  } else if (process.env.NODE_ENV !== 'production' && baseUrl.startsWith('https://')) {
    // Для локальной разработки используем HTTP
    finalBaseUrl = baseUrl.replace('https://', 'http://');
  }
  
  console.log('Скорректированный базовый URL:', finalBaseUrl);
  
  // Проверяем, содержит ли имя файла полный путь (для временных файлов)
  if (filename.includes('/tmp/') || filename.includes('\\Temp\\')) {
    // Для временных файлов возвращаем только имя файла без пути
    const baseName = path.basename(filename);
    const url = `${finalBaseUrl}/uploads/${baseName}`;
    console.log('Сформирован URL для временного файла:', url);
    return url;
  }
  
  let url;
  // Для обычных файлов используем стандартные пути
  if (type === 'chat-avatar') {
    url = `${finalBaseUrl}/uploads/chat-avatars/${filename}`;
  } else if (type === 'user-avatar') {
    // Для аватаров пользователей используем ту же директорию, что и для чатов
    url = `${finalBaseUrl}/uploads/chat-avatars/${filename}`;
  } else if (type === 'message-file') {
    url = `${finalBaseUrl}/uploads/message-files/${filename}`;
  } else {
    url = `${finalBaseUrl}/uploads/${filename}`;
  }
  
  // Добавляем временную метку для предотвращения кэширования
  url = `${url}?t=${Date.now()}`;
  
  console.log('Сформирован URL для файла:', url);
  return url;
};
