import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем путь к текущему файлу и корневой директории проекта
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../');

// Загружаем переменные окружения из корневого .env
dotenv.config({ path: path.resolve(rootDir, '.env') });

// Константы для админа по умолчанию
const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Генерация JWT токена
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Установка JWT токена в cookie
const setTokenCookie = (res, token) => {
  // Настройки cookie
  const cookieOptions = {
    httpOnly: true, // Недоступен для JavaScript
    secure: process.env.NODE_ENV === 'production', // HTTPS только в продакшене
    maxAge: parseInt(process.env.COOKIE_MAX_AGE), // Время жизни в миллисекундах
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' для кросс-доменного использования в продакшене
    path: '/' // Доступность cookie на всем сайте
  };
  
  res.cookie('token', token, cookieOptions);
};

// @desc    Создание администратора (если не существует)
// @route   Внутренний вызов
const createAdminIfNotExists = async () => {
  // Задержка для обеспечения подключения к MongoDB перед проверкой
  let connectionEstablished = false;
  let retryCount = 0;
  const maxRetries = 3;

  while (!connectionEstablished && retryCount < maxRetries) {
    try {
      // Проверяем готовность подключения к MongoDB
      const connection = mongoose.connection.readyState;
      if (connection === 1) { // 1 = подключено
        connectionEstablished = true;
      } else {
        retryCount++;
        console.log(`Ожидание подключения к MongoDB перед созданием администратора (попытка ${retryCount}/${maxRetries})...`);
        // Ждем 2 секунды перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('Ошибка при проверке подключения к MongoDB:', error);
      return; // Выходим из функции при ошибке
    }
  }

  if (!connectionEstablished) {
    console.error('Не удалось установить подключение к MongoDB для создания администратора');
    return;
  }

  try {
    // Проверяем наличие обязательных переменных окружения
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.warn('ADMIN_EMAIL или ADMIN_PASSWORD не настроены в .env');
      return;
    }
    
    // Проверяем, существует ли уже администратор в системе
    const adminCount = await User.countDocuments({ role: 'admin' });
    
    if (adminCount > 0) {
      console.log('Администратор уже существует в системе. Пропускаем создание...');
      return;
    }
    
    // Проверяем, существует ли пользователь с email администратора
    const emailExists = await User.findOne({ email: DEFAULT_ADMIN_EMAIL });
    
    if (emailExists) {
      console.log(`Пользователь с email ${DEFAULT_ADMIN_EMAIL} уже существует. Пропускаем создание...`);
      return;
    }
    
    console.log('Создание администратора по умолчанию...');
    
    const admin = await User.create({
      name: 'Admin',
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD,
      role: 'admin',
    });
    
    if (admin) {
      console.log(`Администратор создан с email: ${DEFAULT_ADMIN_EMAIL}`);
    }
  } catch (error) {
    console.error('Ошибка при создании администратора:', error);
  }
};

// Не вызываем функцию создания администратора здесь
// Вместо этого экспортируем для вызова после полной инициализации сервера

// @desc    Регистрация нового пользователя
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Проверяем, существует ли пользователь с таким email
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Определяем роль (только администратор может создать другого администратора)
    const userRole = req.user?.role === 'admin' && role === 'admin' ? 'admin' : 'user';

    // Создаем нового пользователя
    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
    });

    if (user) {
      const token = generateToken(user._id);
      setTokenCookie(res, token);
      
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } else {
      res.status(400).json({ error: 'Некорректные данные пользователя' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// @desc    Аутентификация пользователя и получение токена
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    console.log('============ LOGIN ATTEMPT ============');
    console.log('Request body:', req.body);
    
    const { email, password } = req.body;
    console.log('Попытка входа:', { email, password: password ? '***' : undefined });

    // Находим пользователя по email
    const user = await User.findOne({ email });
    console.log('Найденный пользователь:', user ? { 
      id: user._id, 
      email: user.email, 
      role: user.role,
      password: user.password ? user.password.substring(0, 10) + '...' : undefined
    } : 'не найден');

    if (user) {
      // Проверяем соответствие пароля
      const isMatch = await user.matchPassword(password);
      console.log('Пароль совпадает:', isMatch);
      
      if (isMatch) {
        const token = generateToken(user._id);
        console.log('Токен создан:', token ? token.substring(0, 15) + '...' : 'не создан');
        
        // Устанавливаем токен в cookie
        setTokenCookie(res, token);
        
        const responseData = {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        };
        console.log('Отправляем ответ:', responseData ? responseData : 'нет данных');
        
        res.json(responseData);
      } else {
        console.log('Авторизация отклонена: неверный пароль');
        res.status(401).json({ error: 'Неверный email или пароль' });
      }
    } else {
      console.log('Авторизация отклонена: пользователь не найден');
      res.status(401).json({ error: 'Неверный email или пароль' });
    }
    console.log('============ END LOGIN ATTEMPT ============');
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// @desc    Получение профиля пользователя
// @route   GET /api/auth/me
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: 'Пользователь не найден' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// @desc    Выход пользователя (удаление cookie)
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  
  res.json({ message: 'Вы успешно вышли из системы' });
};

// @desc    Создание администратора вручную
// @route   POST /api/auth/create-admin
// @access  Public (только при инициализации системы)
const createAdmin = async (req, res) => {
  try {
    // Проверяем, существуют ли уже администраторы
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (adminExists) {
      return res.status(400).json({ 
        error: 'Администратор уже существует, создание невозможно' 
      });
    }
    
    const { name, email, password } = req.body;
    
    // Валидация данных
    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: 'Пожалуйста, предоставьте все необходимые данные' 
      });
    }
    
    // Создаем администратора
    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin',
    });
    
    if (admin) {
      const token = generateToken(admin._id);
      setTokenCookie(res, token);
      
      res.status(201).json({
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        message: 'Администратор успешно создан'
      });
    } else {
      res.status(400).json({ error: 'Не удалось создать администратора' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

export { registerUser, loginUser, getUserProfile, logoutUser, createAdmin, createAdminIfNotExists }; 