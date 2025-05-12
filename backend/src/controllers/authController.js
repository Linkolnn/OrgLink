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
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      role: user.role,
      email: user.email
    }, 
    process.env.JWT_SECRET, 
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    }
  );
};

// Установка JWT токена в cookie
const setTokenCookie = (res, token) => {
  // Настройки cookie
  const cookieOptions = {
    httpOnly: true, // Недоступен для JavaScript
    secure: process.env.NODE_ENV === 'production', // HTTPS только в продакшене
    maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 2592000000, // Время жизни в миллисекундах (30 дней по умолчанию)
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' для кросс-доменных запросов в продакшене
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
        const token = generateToken(user);
        console.log('Токен создан:', token ? token.substring(0, 15) + '...' : 'не создан');
        
        // Устанавливаем токен в cookie
        setTokenCookie(res, token);
        
        const responseData = {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: token // Добавляем токен в ответ API
        };
        console.log('Отправляем ответ:', responseData ? { ...responseData, token: responseData.token.substring(0, 15) + '...' } : 'нет данных');
        
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
    console.log('Запрос на получение профиля пользователя:', req.user._id);
    
    const user = await User.findById(req.user._id).select('-password');
    
    if (user) {
      console.log('Пользователь найден:', {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      });
      
      // Формируем ответ с явным указанием всех полей
      const responseData = {
        _id: user._id,
        name: user.name,
        email: user.email,
        number: user.number || '',
        avatar: user.avatar || '',
        role: user.role
      };
      
      console.log('Отправляем данные пользователя:', responseData);
      res.json(responseData);
    } else {
      console.log('Пользователь не найден:', req.user._id);
      res.status(404).json({ error: 'Пользователь не найден' });
    }
  } catch (error) {
    console.error('Ошибка при получении профиля пользователя:', error);
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
      const token = generateToken(admin);
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

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users)
  }
  catch (error) {
    console.error(error);
    res.status(500).json({error: 'Ошибка сервера'});
  }
}

// @desc    Обновление пользователя
// @route   PUT /api/auth/users/:id
// @access  Private (только администраторы)
const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Проверяем, существует ли пользователь
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Получаем данные для обновления
    const { name, email, number, password, role } = req.body;
    
    // Обновляем только предоставленные поля
    if (name) user.name = name;
    if (email) user.email = email;
    if (number) user.number = number;
    if (role) user.role = role;
    if (password) user.password = password; // Пароль будет хешироваться через pre-save хук в модели
    
    // Сохраняем обновленного пользователя
    const updatedUser = await user.save();
    
    // Отправляем обновленные данные пользователя (без пароля)
    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      number: updatedUser.number,
      role: updatedUser.role
    });
  } catch (error) {
    console.error('Ошибка при обновлении пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера при обновлении пользователя' });
  }
};

// @desc    Обновление своего профиля
// @route   POST /api/auth/update-profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    // Получаем ID пользователя из токена
    const userId = req.user._id;
    
    // Проверяем, существует ли пользователь
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Получаем данные для обновления
    const { name, email, number } = req.body;
    
    // Обновляем только предоставленные поля
    if (name) user.name = name;
    if (email) user.email = email;
    if (number) user.number = number;
    
    // Обработка загрузки аватара
    console.log('Проверка загрузки аватара:', req.file);
    
    if (req.file) {
      try {
        // Импортируем функцию getFileUrl из uploadMiddleware
        const { getFileUrl } = await import('../middleware/uploadMiddleware.js');
        const avatarUrl = getFileUrl(req.file.filename, 'user-avatar');
        console.log('Сформированный URL аватара:', avatarUrl);
        
        // Устанавливаем URL аватара в модель пользователя
        user.avatar = avatarUrl;
      } catch (error) {
        console.error('Ошибка при обработке аватара:', error);
      }
    } else {
      console.log('Файл аватара не был загружен');
    }
    
    // Сохраняем обновленного пользователя
    console.log('Данные пользователя перед сохранением:', {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar
    });
    
    const updatedUser = await user.save();
    
    console.log('Обновленные данные пользователя после сохранения:', {
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: updatedUser.avatar
    });
    
    // Обновляем токен с новыми данными
    const token = generateToken(updatedUser);
    setTokenCookie(res, token);
    
    // Формируем ответ с обновленными данными
    const responseData = {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      number: updatedUser.number,
      avatar: updatedUser.avatar,
      role: updatedUser.role
    };
    
    console.log('Отправляем ответ клиенту:', responseData);
    
    // Отправляем обновленные данные пользователя (без пароля)
    res.json(responseData);
  } catch (error) {
    console.error('Ошибка при обновлении профиля:', error);
    res.status(500).json({ error: 'Ошибка сервера при обновлении профиля' });
  }
};

// @desc    Удаление пользователя
// @route   DELETE /api/auth/users/:id
// @access  Private (только администраторы)
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Проверяем, что ID валидный
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Неверный ID пользователя' });
    }

    // Находим пользователя по ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Проверяем, что пользователь не является суперадмином
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Нельзя удалить суперадминистратора' });
    }

    // Удаляем пользователя
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'Пользователь успешно удален' });
  } catch (error) {
    console.error('Ошибка при удалении пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера при удалении пользователя' });
  }
};

export { registerUser, loginUser, getUserProfile, logoutUser, createAdmin, createAdminIfNotExists, getAllUsers, updateUser, updateProfile, deleteUser }; 