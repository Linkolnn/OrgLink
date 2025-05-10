import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import { getAdminUserChats, getAdminChatMessages } from '../controllers/chatController.js';

const router = express.Router();

// Маршруты для админ-панели
router.get('/users/:userId/chats', protect, admin, getAdminUserChats);
router.get('/chats/:chatId/messages', protect, admin, getAdminChatMessages);

export default router;
