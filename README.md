# OrgLink - Система организационных связей

Полнофункциональное веб-приложение для управления организационными связями, построенное на стеке Vue.js (Nuxt) + Express + MongoDB.

## Структура проекта

- Корневая директория - Фронтенд (Nuxt.js)
- `backend/` - Бэкенд API (Express.js + MongoDB)

## Локальная разработка

### Предварительные требования

- Node.js 18 или новее
- MongoDB (локально или удалённо)

### Настройка переменных окружения

Создайте файл `.env` в корневой директории проекта:

```
# Общие настройки
NODE_ENV=development

# Настройки базы данных MongoDB
MONGO_URI=mongodb://localhost:27017/orglink_db

# Настройки JWT
JWT_SECRET=секретный_ключ_для_подписи_jwt
JWT_EXPIRES_IN=30d

# Настройки бэкенда
BACKEND_PORT=5000
BACKEND_URL=http://localhost:5000

# Настройки фронтенда
FRONTEND_URL=http://localhost:3000

# Администратор по умолчанию
ADMIN_EMAIL=admin@orglink.com
ADMIN_PASSWORD=admin123456

# Настройки cookie
COOKIE_MAX_AGE=2592000000
COOKIE_SAME_SITE=lax
```

### Установка зависимостей

Установите все зависимости проекта через Yarn:

```bash
yarn install
```

Это установит:
- Зависимости для фронтенда (Nuxt.js)
- Зависимости для бэкенда (через postinstall хук)

### Запуск в режиме разработки

#### Запуск всего приложения одной командой

```bash
yarn dev
```

Эта команда запустит одновременно:
- Фронтенд на http://localhost:3000
- Бэкенд API на http://localhost:5000

#### Запуск только фронтенда

```bash
yarn dev:frontend
```

#### Запуск только бэкенда

```bash
yarn dev:backend
# или 
yarn api:dev
```

## Деплой на Vercel

### Настройка проекта для Vercel

1. Создайте файл `vercel.json` в корне проекта:

```json
{
  "buildCommand": "npm run vercel-build",
  "outputDirectory": ".output",
  "framework": "nuxt",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" }
  ]
}
```

2. Настройте переменные окружения в Vercel:
   - Перейдите в раздел Settings → Environment Variables
   - Добавьте все переменные из .env файла

### Деплой фронтенда

Подключите репозиторий к Vercel и деплой произойдет автоматически.

### Деплой бэкенда

#### Вариант 1: Отдельный деплой бэкенда на Vercel

```bash
npm run api:deploy
```

#### Вариант 2: Использование Vercel Serverless Functions

Для этого варианта бэкенд уже подготовлен и при деплое основного проекта API будет доступно по пути `/api/...`.

### Важные настройки для деплоя

- Убедитесь, что используете MongoDB Atlas вместо локальной базы данных
- Правильно настройте CORS для взаимодействия между фронтендом и бэкендом
- Для продакшена настройте `NODE_ENV=production`

## Тестирование

### Тестирование аутентификации через cookie

```bash
cd backend
npm run test:cookie
```

## Разработчикам

- При изменении зависимостей бэкенда запустите `cd backend && npm install`
- Проверяйте ошибки CORS при кросс-доменных запросах
- Для локальной разработки с MongoDB можно использовать Docker:
  ```bash
  docker run -d -p 27017:27017 --name mongodb mongo:latest
  ```

## Лицензия

MIT
