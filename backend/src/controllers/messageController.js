import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import mongoose from 'mongoose';
import { io } from '../server.js';

// @desc    Отправка сообщения в чат
// @route   POST /api/chats/:chatId/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text, media_type, file, thumbnail, mime_type } = req.body;
    
    // Проверяем, существует ли чат и является ли пользователь его участником
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его участником' });
    }
    
    // Проверяем наличие текста или медиа
    if (!text && media_type === 'none') {
      return res.status(400).json({ error: 'Сообщение должно содержать текст или медиа' });
    }
    
    // Создаем новое сообщение
    const newMessage = await Message.create({
      chat: chatId,
      sender: req.user._id,
      text,
      media_type: media_type || 'none',
      file,
      thumbnail,
      mime_type,
      read_by: [req.user._id] // Отправитель автоматически считается прочитавшим сообщение
    });
    
    // Обновляем последнее сообщение в чате
    chat.lastMessage = {
      text: text || 'Медиа-сообщение',
      sender: req.user._id,
      timestamp: new Date()
    };
    
    await chat.save();
    
    // Получаем полные данные сообщения с информацией об отправителе
    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'name email avatar');
    
    console.log(`Отправка сообщения через WebSocket в чат: ${chatId}`);
    
    // Получаем обновленный чат с информацией о последнем сообщении
    const updatedChat = await Chat.findById(chatId)
      .populate('participants', 'name email avatar')
      .populate('lastMessage.sender', 'name email avatar');
    
    // Отправляем сообщение через WebSocket всем подключенным к этому чату
    io.to(`chat:${chatId}`).emit('new-message', {
      message: populatedMessage,
      chatId,
      chat: updatedChat,
      sender: req.user._id
    });
    
    // Отправляем уведомление о новом сообщении всем пользователям
    // Это поможет обновить список чатов у всех пользователей
    io.emit('chat-updated', {
      chatId,
      lastMessage: {
        text: text || 'Медиа-сообщение',
        sender: req.user._id,
        timestamp: new Date()
      }
    });
    
    return res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    return res.status(500).json({ error: 'Ошибка сервера при отправке сообщения' });
  }
};

// @desc    Получение сообщений чата
// @route   GET /api/chats/:chatId/messages
// @access  Private
const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 20, before_id } = req.query;
    
    // Проверяем, существует ли чат и является ли пользователь его участником
    // Используем select только для проверки существования и прав доступа
    const chatExists = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    }).select('_id').lean();
    
    if (!chatExists) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его участником' });
    }
    
    // Базовые условия запроса
    const query = { chat: chatId };
    
    // Если указан before_id, добавляем условие для пагинации
    if (before_id) {
      query._id = { $lt: new mongoose.Types.ObjectId(before_id) };
    }
    
    // Получаем только необходимые поля сообщений для оптимизации
    const messages = await Message.find(query, {
      chat: 1,
      sender: 1,
      text: 1,
      media_type: 1,
      file: 1,
      thumbnail: 1,
      read_by: 1,
      edited: 1,
      createdAt: 1
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'name email avatar')
      .lean();
    
    // Определяем, есть ли еще сообщения для загрузки (оптимизированный запрос)
    const hasMore = messages.length === parseInt(limit);
    
    // Определяем ID самого старого загруженного сообщения для следующей пагинации
    const nextCursor = messages.length > 0 ? messages[messages.length - 1]._id : null;
    
    // Запускаем отметку сообщений как прочитанных асинхронно, не дожидаясь результата
    if (messages.length > 0) {
      Message.updateMany(
        {
          chat: chatId,
          sender: { $ne: req.user._id },
          read_by: { $ne: req.user._id }
        },
        {
          $addToSet: { read_by: req.user._id }
        }
      ).then(result => {
        if (result.modifiedCount > 0) {
          io.to(`chat:${chatId}`).emit('messages-read', {
            chatId,
            userId: req.user._id
          });
        }
      }).catch(err => {
        console.error('Ошибка при отметке сообщений как прочитанных:', err);
      });
    }
    
    return res.status(200).json({
      messages: messages.reverse(), // Переворачиваем массив, чтобы сообщения шли от старых к новым
      pagination: {
        limit: parseInt(limit),
        hasMore,
        nextCursor: nextCursor ? nextCursor.toString() : null
      }
    });
  } catch (error) {
    console.error('Ошибка при получении сообщений:', error);
    return res.status(500).json({ error: 'Ошибка сервера при получении сообщений' });
  }
};

// @desc    Отметить сообщения как прочитанные
// @route   POST /api/chats/:chatId/messages/read
// @access  Private
const markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    
    // Проверяем, существует ли чат и является ли пользователь его участником
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его участником' });
    }
    
    // Находим непрочитанные сообщения в чате, которые не были отправлены текущим пользователем
    const unreadMessages = await Message.find({
      chat: chatId,
      sender: { $ne: userId },
      read_by: { $ne: userId }
    });
    
    if (unreadMessages.length === 0) {
      return res.status(200).json({ message: 'Нет непрочитанных сообщений' });
    }
    
    // Отмечаем все сообщения как прочитанные
    const updateResult = await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        read_by: { $ne: userId }
      },
      {
        $addToSet: { read_by: userId }
      }
    );
    
    console.log(`Отмечено ${updateResult.modifiedCount} сообщений как прочитанные пользователем ${userId} в чате ${chatId}`);
    
    // Отправляем уведомление через WebSocket
    io.to(`chat:${chatId}`).emit('messages-read', {
      chatId,
      userId,
      count: updateResult.modifiedCount
    });
    
    return res.status(200).json({
      message: `Отмечено ${updateResult.modifiedCount} сообщений как прочитанные`,
      modifiedCount: updateResult.modifiedCount
    });
  } catch (error) {
    console.error('Ошибка при отметке сообщений как прочитанных:', error);
    return res.status(500).json({ error: 'Ошибка сервера при отметке сообщений как прочитанных' });
  }
};

// @desc    Обновление (редактирование) сообщения
// @route   PUT /api/chats/:chatId/messages/:messageId
// @access  Private
const updateMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { text, edited } = req.body;
    const userId = req.user._id;

    // Проверяем, существует ли чат и является ли пользователь его участником
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его участником' });
    }

    // Находим сообщение и проверяем, является ли пользователь его отправителем
    const message = await Message.findOne({
      _id: messageId,
      chat: chatId
    });

    if (!message) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    // Проверяем, является ли пользователь отправителем сообщения
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Вы не можете редактировать чужие сообщения' });
    }

    // Обновляем сообщение
    message.text = text;
    message.edited = edited === false ? false : true;
    message.updatedAt = new Date();
    
    console.log('Обновляем сообщение:', {
      messageId,
      text,
      edited: message.edited
    });
    
    await message.save();

    // Получаем обновленное сообщение с информацией об отправителе
    const updatedMessage = await Message.findById(messageId)
      .populate('sender', 'name email avatar');

    // Если это последнее сообщение в чате, обновляем его
    try {
      if (chat.lastMessage && chat.lastMessage._id && chat.lastMessage._id.toString() === messageId) {
        console.log('Обновляем последнее сообщение в чате:', {
          chatId,
          messageId,
          lastMessageId: chat.lastMessage._id.toString()
        });
        chat.lastMessage.text = text;
        await chat.save();
      }
    } catch (error) {
      console.error('Ошибка при обновлении последнего сообщения в чате:', error);
      // Продолжаем выполнение, даже если не удалось обновить последнее сообщение
    }

    // Отправляем обновленное сообщение через WebSocket
    io.to(`chat:${chatId}`).emit('message-updated', {
      message: updatedMessage,
      chatId
    });

    return res.status(200).json(updatedMessage);
  } catch (error) {
    console.error('Ошибка при обновлении сообщения:', error);
    console.error('Подробности запроса:', {
      chatId,
      messageId,
      userId: req.user._id,
      body: req.body
    });
    return res.status(500).json({ error: 'Ошибка сервера при обновлении сообщения', details: error.message });
  }
};

// @desc    Удаление сообщения из чата
// @route   DELETE /api/chats/:chatId/messages/:messageId
// @access  Private
const deleteMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    
    // Проверяем, существует ли чат и является ли пользователь его участником
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его участником' });
    }
    
    // Проверяем, существует ли сообщение
    const message = await Message.findOne({
      _id: messageId,
      chat: chatId
    });
    
    if (!message) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }
    
    // Проверяем, является ли пользователь отправителем сообщения
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Вы не можете удалить чужое сообщение' });
    }
    
    // Удаляем сообщение
    await Message.deleteOne({ _id: messageId });
    
    // Проверяем, было ли это последнее сообщение в чате
    if (chat.lastMessage && chat.lastMessage.toString() === messageId) {
      // Находим новое последнее сообщение
      const newLastMessage = await Message.findOne({ chat: chatId })
        .sort({ createdAt: -1 })
        .populate('sender', 'name email avatar');
      
      // Обновляем последнее сообщение в чате
      chat.lastMessage = newLastMessage ? newLastMessage._id : null;
      await chat.save();
    }
    
    // Отправляем уведомление всем участникам чата через WebSocket
    io.to(chatId).emit('message_deleted', { chatId, messageId });
    
    return res.status(200).json({ success: true, message: 'Сообщение успешно удалено' });
  } catch (error) {
    console.error('Ошибка при удалении сообщения:', error);
    return res.status(500).json({ error: 'Ошибка сервера при удалении сообщения', details: error.message });
  }
};

export { sendMessage, getChatMessages, markMessagesAsRead, updateMessage, deleteMessage };
