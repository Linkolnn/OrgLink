#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Установка и запуск проекта OrgLink ===${NC}"

# Проверка наличия yarn
if ! command -v yarn &> /dev/null; then
    echo -e "${RED}Yarn не установлен. Устанавливаем Yarn...${NC}"
    npm install -g yarn
    if [ $? -ne 0 ]; then
        echo -e "${RED}Не удалось установить Yarn. Пожалуйста, установите его вручную: npm install -g yarn${NC}"
        exit 1
    fi
fi

# Проверка наличия .env файла и создание, если отсутствует
if [ ! -f .env ]; then
    echo -e "${YELLOW}Файл .env не найден. Создание .env с настройками по умолчанию...${NC}"
    cat > .env << EOF
# Общие настройки
NODE_ENV=development

# Настройки базы данных MongoDB
MONGO_URI=mongodb://localhost:27017/orglink_db

# Настройки JWT
JWT_SECRET=dev_secret_key_replace_in_production
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
EOF
    echo -e "${GREEN}.env файл создан${NC}"
fi

# Установка зависимостей
echo -e "${YELLOW}Установка зависимостей...${NC}"
yarn install
if [ $? -ne 0 ]; then
    echo -e "${RED}Ошибка при установке зависимостей${NC}"
    exit 1
fi

# Проверка MongoDB
echo -e "${YELLOW}Проверка статуса MongoDB...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker не установлен. Пожалуйста, убедитесь, что MongoDB запущен вручную.${NC}"
else
    # Проверяем, запущен ли контейнер MongoDB
    MONGO_RUNNING=$(docker ps | grep mongo)
    if [ -z "$MONGO_RUNNING" ]; then
        echo -e "${YELLOW}MongoDB не запущен. Пытаемся запустить через Docker...${NC}"
        MONGO_CONTAINER=$(docker ps -a | grep mongo)
        if [ -z "$MONGO_CONTAINER" ]; then
            echo -e "${YELLOW}Создание и запуск контейнера MongoDB...${NC}"
            docker run -d -p 27017:27017 --name mongodb mongo:latest
        else
            echo -e "${YELLOW}Запуск существующего контейнера MongoDB...${NC}"
            docker start $(docker ps -a | grep mongo | awk '{print $1}')
        fi
    else
        echo -e "${GREEN}MongoDB уже запущен${NC}"
    fi
fi

# Запуск проекта
echo -e "${GREEN}Все зависимости установлены. Запуск проекта...${NC}"
echo -e "${YELLOW}Проект будет доступен по адресам:${NC}"
echo -e "${GREEN}Фронтенд: http://localhost:3000${NC}"
echo -e "${GREEN}Бэкенд: http://localhost:5000${NC}"
echo -e "${YELLOW}Для входа используйте:${NC}"
echo -e "${GREEN}Email: admin@orglink.com${NC}"
echo -e "${GREEN}Пароль: admin123456${NC}"
echo -e "${YELLOW}Нажмите Ctrl+C для остановки...${NC}"

# Запуск проекта
yarn dev 