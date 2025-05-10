import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  logoutUser, 
  createAdmin, 
  getAllUsers,
  updateUser,
  updateProfile
} from '../controllers/authController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { uploadUserAvatar, handleUploadError } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Публичные маршруты
router.post('/login', loginUser);
router.post('/logout', logoutUser);

// Маршрут для создания первого администратора
router.post('/create-admin', createAdmin);

// Защищенные маршруты (требуют аутентификации)
router.get('/me', protect, getUserProfile);

router.get('/users', protect, admin, getAllUsers);

// Маршруты, доступные только администраторам
router.post('/register', protect, admin, registerUser);

// Маршрут для обновления пользователя (только для админа)
router.put('/users/:id', protect, admin, updateUser);

// Маршрут для обновления своего профиля
router.post('/update-profile', protect, uploadUserAvatar, handleUploadError, updateProfile);

export default router; 