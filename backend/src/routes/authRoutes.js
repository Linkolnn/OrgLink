import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  logoutUser, 
  createAdmin 
} from '../controllers/authController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Публичные маршруты
router.post('/login', loginUser);
router.post('/logout', logoutUser);

// Маршрут для создания первого администратора
router.post('/create-admin', createAdmin);

// Защищенные маршруты (требуют аутентификации)
router.get('/me', protect, getUserProfile);

// Маршруты, доступные только администраторам
router.post('/register', protect, admin, registerUser);

export default router; 