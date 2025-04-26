import express from 'express';
import { registerUser, loginUser, getUserProfile } from '../controllers/authController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Публичные маршруты
router.post('/login', loginUser);

// Защищенные маршруты (требуют аутентификации)
router.get('/me', protect, getUserProfile);

// Маршруты, доступные только администраторам
router.post('/register', protect, admin, registerUser);

export default router; 