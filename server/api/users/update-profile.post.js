import { createError } from 'h3';
import jwt from 'jsonwebtoken';
import formidable from 'formidable';
import fs from 'node:fs';
import path from 'node:path';

export default defineEventHandler(async (event) => {
  try {
    // Проверяем аутентификацию
    const authHeader = getRequestHeader(event, 'Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createError({
        statusCode: 401,
        message: 'Не авторизован'
      });
    }

    // Получаем токен из заголовка
    const token = authHeader.split(' ')[1];
    if (!token) {
      return createError({
        statusCode: 401,
        message: 'Токен не предоставлен'
      });
    }

    // Создаем директорию для загрузок, если она не существует
    const uploadDir = path.resolve('./public/uploads');
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
    } catch (error) {
      console.error('Ошибка при создании директории для загрузок:', error);
    }

    // Парсим мультиформ данные
    const form = formidable({ 
      multiples: true,
      uploadDir: uploadDir,
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024 // 5MB
    });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(event.node.req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    console.log('Полученные поля:', fields);
    console.log('Полученные файлы:', files ? Object.keys(files) : 'нет файлов');

    // Подготавливаем данные для обновления
    const updateData = {};
    
    // Обрабатываем текстовые поля
    if (fields.name) {
      updateData.name = Array.isArray(fields.name) ? fields.name[0] : fields.name;
    }
    
    if (fields.email) {
      updateData.email = Array.isArray(fields.email) ? fields.email[0] : fields.email;
    }
    
    if (fields.number) {
      updateData.number = Array.isArray(fields.number) ? fields.number[0] : fields.number;
    }

    // Обрабатываем загруженный аватар
    if (files && files.avatar) {
      const avatar = Array.isArray(files.avatar) ? files.avatar[0] : files.avatar;
      const fileName = path.basename(avatar.filepath);
      const publicPath = `/uploads/${fileName}`;
      updateData.avatar = publicPath;
    }

    // Получаем ID пользователя из токена
    const config = useRuntimeConfig();
    let userId;
    
    try {
      const decodedToken = jwt.verify(token, config.jwtSecret);
      userId = decodedToken.id;
    } catch (jwtError) {
      console.error('Ошибка при верификации токена:', jwtError);
      
      // Попытка получить ID пользователя из auth store
      const authStore = useAuthStore();
      if (authStore && authStore.user && authStore.user._id) {
        userId = authStore.user._id;
      } else {
        return createError({
          statusCode: 401,
          message: 'Недействительный токен'
        });
      }
    }

    console.log('Обновление профиля пользователя:', {
      userId,
      updateData
    });

    // Для демонстрации, возвращаем обновленные данные
    // В реальном приложении здесь был бы запрос к бэкенду
    return {
      _id: userId,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Ошибка при обновлении профиля:', error);
    return createError({
      statusCode: 500,
      message: error.message || 'Внутренняя ошибка сервера'
    });
  }
});
