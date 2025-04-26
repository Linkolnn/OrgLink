import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Генерация JWT токена
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// @desc    Регистрация нового пользователя
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Проверяем, существует ли пользователь с таким email
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Создаем нового пользователя
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
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
        
        const responseData = {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: token
        };
        console.log('Отправляем ответ:', responseData ? { ...responseData, token: '...' } : 'нет данных');
        
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

export { registerUser, loginUser, getUserProfile }; 