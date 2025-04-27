import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Получаем путь к текущему файлу и корневой директории проекта
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем директорию для загрузок, если она не существует
const uploadsDir = path.join(__dirname, '../../uploads');
const chatAvatarsDir = path.join(uploadsDir, 'chat-avatars');
const messageFilesDir = path.join(uploadsDir, 'message-files');

// Создаем директории, если они не существуют
[uploadsDir, chatAvatarsDir, messageFilesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

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
  if (!filename) return null;
  
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? process.env.BACKEND_URL || ''
    : `http://localhost:${process.env.BACKEND_PORT || 5000}`;
  
  if (type === 'chat-avatar') {
    return `${baseUrl}/uploads/chat-avatars/${filename}`;
  } else if (type === 'message-file') {
    return `${baseUrl}/uploads/message-files/${filename}`;
  }
  
  return `${baseUrl}/uploads/${filename}`;
};
