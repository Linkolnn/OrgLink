import { createRequire } from 'module';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

dotenv.config();

// Определяем схему пользователя
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    }
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

async function createTestUser() {
  try {
    // Подключаемся к MongoDB
    console.log('Подключение к MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение установлено');
    
    // Проверяем, существует ли уже тестовый пользователь
    const existingUser = await User.findOne({ email: 'test@example.com' });
    
    if (existingUser) {
      console.log('Тестовый пользователь с email test@example.com уже существует');
      
      // Обновляем пароль существующего пользователя
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);
      
      existingUser.password = hashedPassword;
      await existingUser.save();
      
      console.log('Пароль пользователя обновлен');
      await mongoose.disconnect();
      return;
    }
    
    // Создаем хеш пароля
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);
    
    // Создаем тестового пользователя
    const testUser = new User({
      name: 'Тестовый Пользователь',
      email: 'test@example.com',
      password: hashedPassword,
      role: 'user'
    });
    
    await testUser.save();
    console.log('Тестовый пользователь успешно создан!');
    console.log('Данные для входа:');
    console.log('Email: test@example.com');
    console.log('Пароль: password123');
    
    // Отключаемся от MongoDB
    await mongoose.disconnect();
    console.log('Подключение закрыто');
    
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

// Вывести список всех пользователей
async function listAllUsers() {
  try {
    // Подключаемся к MongoDB
    console.log('Подключение к MongoDB для получения списка пользователей...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение установлено');
    
    const users = await User.find({}).select('name email role');
    console.log('Список всех пользователей:');
    console.log(users);
    
    // Отключаемся от MongoDB
    await mongoose.disconnect();
    console.log('Подключение закрыто');
  } catch (error) {
    console.error('Ошибка при получении списка пользователей:', error);
  }
}

// Выполняем обе функции последовательно
async function main() {
  await createTestUser();
  await listAllUsers();
}

main(); 