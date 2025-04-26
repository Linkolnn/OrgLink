import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req, res, next) => {
  let token;

  // Получаем токен из cookie вместо заголовка Authorization
  token = req.cookies.token;

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

export { protect, admin }; 