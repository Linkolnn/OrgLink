import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req, res, next) => {
  let token;

  // Проверяем наличие токена в заголовке Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Получаем токен из заголовка
      token = req.headers.authorization.split(' ')[1];

      // Проверяем и декодируем токен
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Находим пользователя по ID из токена без возврата пароля
      req.user = await User.findById(decoded.id).select('-password');

      next();
      return; // Добавляем return, чтобы избежать выполнения кода ниже
    } catch (error) {
      console.error(error);
      res.status(401).json({ error: 'Не авторизован, токен недействителен' });
      return; // Добавляем return для раннего выхода
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Не авторизован, токен отсутствует' });
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