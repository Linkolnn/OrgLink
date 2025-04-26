import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем путь к текущему файлу и корневой директории проекта
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../');

// Загружаем переменные окружения из корневого .env
dotenv.config({ path: path.resolve(rootDir, '.env') });

// Глобальная переменная для отслеживания статуса подключения к MongoDB
let cachedConnection = null;

const connectDB = async () => {
  // Если у нас уже есть соединение, используем его
  if (cachedConnection) {
    console.log('Используется существующее соединение с MongoDB');
    return cachedConnection;
  }

  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      const error = 'MONGO_URI не определен в переменных окружения';
      console.error(error);
      
      // В serverless среде не останавливаем процесс
      if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
      }
      
      throw new Error(error);
    }
    
    // Настройки подключения для Vercel Serverless
    const options = {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      family: 4
    };
    
    // Подключаемся к MongoDB
    const conn = await mongoose.connect(mongoURI, options);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Кэшируем соединение
    cachedConnection = conn;
    return conn;
  } catch (error) {
    console.error(`Ошибка подключения к MongoDB: ${error.message}`);
    
    // В serverless среде не останавливаем процесс
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
    
    throw error;
  }
};

export default connectDB; 