import express from 'express';
import { 
  createChat, 
  getUserChats, 
  getChatById, 
  updateChat,
  addChatParticipants,
  removeChatParticipant,
  leaveChat,
  deleteChat,
  searchUsers
} from '../controllers/chatController.js';
import { 
  sendMessage, 
  getChatMessages, 
  markMessagesAsRead,
  updateMessage,
  deleteMessage 
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadChatAvatar, uploadMessageFile, handleUploadError } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Маршруты для поиска пользователей
router.get('/search-users', protect, searchUsers);

// Маршруты для чатов
router.post('/', protect, uploadChatAvatar, handleUploadError, createChat);
router.get('/', protect, getUserChats);
router.get('/:id', protect, getChatById);
router.put('/:id', protect, uploadChatAvatar, handleUploadError, updateChat);
router.delete('/:id', protect, deleteChat);

// Маршруты для управления участниками
router.put('/:id/participants', protect, addChatParticipants);
router.delete('/:id/participants/:userId', protect, removeChatParticipant);
router.delete('/:id/leave', protect, leaveChat);

// Маршруты для сообщений
router.post('/:chatId/messages', protect, sendMessage);
router.post('/:chatId/messages/upload', protect, uploadMessageFile.array('files', 10), handleUploadError, sendMessage);
router.get('/:chatId/messages', protect, getChatMessages);
router.post('/:chatId/messages/read', protect, markMessagesAsRead);
router.put('/:chatId/messages/:messageId', protect, updateMessage);
router.delete('/:chatId/messages/:messageId', protect, deleteMessage);

export default router;
