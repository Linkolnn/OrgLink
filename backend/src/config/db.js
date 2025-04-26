import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.error('MONGODB_URI не определен в файле .env');
      process.exit(1);
    }
    
    const conn = await mongoose.connect(mongoURI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Ошибка подключения к MongoDB: ${error.message}`);
    console.log('Убедитесь, что MongoDB запущен или проверьте строку подключения в файле .env');
    process.exit(1);
  }
};

export default connectDB; 