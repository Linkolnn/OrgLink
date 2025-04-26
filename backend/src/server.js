import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';

// Загружаем переменные окружения
dotenv.config();

// Инициализируем Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Подключаемся к базе данных
console.log('Подключение к MongoDB...');
await connectDB();
console.log('MongoDB подключена');

// Используем маршруты API
app.use('/api/auth', authRoutes);

// Корневой маршрут
app.get('/', (req, res) => {
  res.json({ 
    message: 'API OrgLink работает',
    mode: 'production',
    status: 'connected'
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Что-то пошло не так на сервере!' });
});

// Запускаем сервер
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
}); 