# OrgLink Backend API

REST API для приложения OrgLink, оптимизированное для деплоя на Vercel.

## Деплой на Vercel

### Подготовка

1. Установите Vercel CLI:
```bash
npm install -g vercel
```

2. Авторизуйтесь в Vercel:
```bash
vercel login
```

3. Создайте базу данных MongoDB Atlas:
   - Зарегистрируйтесь на [MongoDB Atlas](https://www.mongodb.com/atlas/database)
   - Создайте кластер (бесплатный тариф доступен)
   - Добавьте пользователя базы данных
   - Добавьте ваш IP в список разрешенных или разрешите доступ с любого IP (0.0.0.0/0)
   - Получите строку подключения

### Настройка переменных окружения

В интерфейсе Vercel добавьте следующие переменные окружения:

- `MONGO_URI` - строка подключения к MongoDB Atlas
- `JWT_SECRET` - секретный ключ для JWT токенов
- `JWT_EXPIRES_IN` - срок действия токена (например, "30d")
- `NODE_ENV` - установите "production"
- `FRONTEND_URL` - URL вашего фронтенда (например, "https://orglink.vercel.app")
- `ADMIN_EMAIL` - email администратора по умолчанию
- `ADMIN_PASSWORD` - пароль администратора по умолчанию
- `COOKIE_MAX_AGE` - время жизни куки в миллисекундах (например, 2592000000 для 30 дней)

### Локальная разработка с Vercel

Для тестирования serverless-функций локально:

```bash
npm run vercel-dev
```

### Деплой

```bash
npm run deploy
```

или

```bash
vercel --prod
```

## Важные особенности

- Backend использует Express.js, адаптированный для serverless-окружения
- MongoDB подключается "лениво" при первом запросе
- В production режиме cookie настроены для cross-origin запросов с `sameSite: 'none'`
- На localhost используется `sameSite: 'lax'`

## Проверка работоспособности

После деплоя откройте URL вашего API в браузере (обычно `https://<project-name>.vercel.app`).
Вы должны увидеть JSON-ответ с сообщением о работоспособности API.

## Локальная разработка

Для локальной разработки без Vercel:

```bash
npm run dev
```

## Тестирование авторизации

```bash
npm run test:cookie
``` 