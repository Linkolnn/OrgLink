import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

dotenv.config();

// НАСТРОЙТЕ ДАННЫЕ АДМИНИСТРАТОРА ЗДЕСЬ
const ADMIN_DATA = {
  name: 'Админ',        // Измените на ваше имя
  email: 'admin@mail.com', // Измените на вашу почту
  password: 'admin1234', // Измените на ваш пароль
  role: 'admin'
};

// Определяем схему пользователя (как в модели)
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

async function createAdmin() {
  try {
    // Подключаемся к MongoDB
    console.log('Подключение к MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Подключение установлено');
    
    // Проверяем, существует ли пользователь с таким email
    const existingUser = await User.findOne({ email: ADMIN_DATA.email });
    
    if (existingUser) {
      console.log(`Пользователь с email ${ADMIN_DATA.email} уже существует.`);
      console.log('Обновление существующего пользователя...');
      
      // Хешируем пароль
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(ADMIN_DATA.password, salt);
      
      // Обновляем существующего пользователя
      await User.findByIdAndUpdate(existingUser._id, {
        name: ADMIN_DATA.name,
        password: hashedPassword,
        role: 'admin'
      });
      
      console.log('Администратор успешно обновлен!');
    } else {
      console.log('Создание нового администратора...');
      
      // Хешируем пароль
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(ADMIN_DATA.password, salt);
      
      // Создаем нового администратора
      const admin = new User({
        name: ADMIN_DATA.name,
        email: ADMIN_DATA.email,
        password: hashedPassword,
        role: 'admin'
      });
      
      await admin.save();
      console.log('Администратор успешно создан!');
    }
    
    // Выводим данные для входа
    console.log('\nДанные для входа:');
    console.log(`Имя: ${ADMIN_DATA.name}`);
    console.log(`Email: ${ADMIN_DATA.email}`);
    console.log(`Пароль: ${ADMIN_DATA.password}`);
    console.log(`Роль: admin`);
    
    // Отображаем всех пользователей для проверки
    const allUsers = await User.find({}).select('name email role');
    console.log('\nСписок всех пользователей:');
    console.log(allUsers);
    
    // Отключаемся от MongoDB
    await mongoose.disconnect();
    console.log('\nПодключение закрыто');
    
  } catch (error) {
    console.error('Ошибка:', error);
    try {
      await mongoose.disconnect();
    } catch (e) {
      console.error('Ошибка при отключении от MongoDB:', e);
    }
  }
}

createAdmin(); 