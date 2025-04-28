import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req, res, next) => {
  let token;

  // Получаем токен из cookie или заголовка Authorization
  if (req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // Получаем токен из заголовка Authorization
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Не авторизован, токен отсутствует' });
  }

  try {
    // Проверяем и декодируем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Находим пользователя по ID из токена без возврата пароля
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    // Добавляем информацию из токена в объект пользователя
    req.tokenData = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email
    };

    next();
  } catch (error) {
    console.error('Ошибка аутентификации:', error);
    res.status(401).json({ error: 'Не авторизован, токен недействителен' });
  }
};

// Middleware для проверки прав администратора
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
  }
};

// Функция для проверки токена без middleware
const verifyToken = (token) => {
  try {
    if (!token) return null;
    
    // Проверяем и декодируем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('Ошибка проверки токена:', error);
    return null;
  }
};

export { protect, admin, verifyToken }; 