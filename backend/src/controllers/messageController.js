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
    io.to(`chat:${chatId}`).emit('newMessage', {
      message: populatedMessage,
      chatId,
      chat: updatedChat,
      sender: req.user._id
    });
    
    // Отправляем уведомление о новом сообщении всем пользователям
    // Это поможет обновить список чатов у всех пользователей
    io.emit('chatUpdated', {
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
          io.to(`chat:${chatId}`).emit('messagesRead', {
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
    io.to(`chat:${chatId}`).emit('messagesRead', {
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

    // Проверяем, является ли это последнее сообщение в чате
    let isLastMessage = false;
    
    try {
      // Проверяем, является ли сообщение последним в чате
      if (chat.lastMessage) {
        // Проверяем по ID, если lastMessage - это ObjectId
        if (chat.lastMessage._id && chat.lastMessage._id.toString() === messageId) {
          isLastMessage = true;
        }
        // Проверяем по полю text, если lastMessage - это объект с текстом
        else if (typeof chat.lastMessage === 'object' && chat.lastMessage.text) {
          // Находим последнее сообщение в чате
          const lastMessage = await Message.findOne({ chat: chatId })
            .sort({ createdAt: -1 });
          
          if (lastMessage && lastMessage._id.toString() === messageId) {
            isLastMessage = true;
          }
        }
      }
      
      console.log('Проверка последнего сообщения при редактировании:', {
        chatId,
        messageId,
        isLastMessage,
        lastMessageType: chat.lastMessage ? (typeof chat.lastMessage === 'object' ? 'object' : 'id') : 'null'
      });
      
      // Если это последнее сообщение, обновляем его в чате
      if (isLastMessage) {
        console.log('Обновляем последнее сообщение в чате:', {
          chatId,
          messageId,
          text,
          edited: true
        });
        
        // Создаем полный объект lastMessage с текстом и информацией об отправителе
        await Chat.findByIdAndUpdate(
          chatId,
          { 
            lastMessage: {
              text: text,
              sender: message.sender,
              timestamp: new Date(),
              edited: true
            }
          },
          { new: true }
        );
      }
    } catch (error) {
      console.error('Ошибка при обновлении последнего сообщения в чате:', error);
      // Продолжаем выполнение, даже если не удалось обновить последнее сообщение
    }

    // Получаем обновленное сообщение с информацией об отправителе
    const updatedMessage = await Message.findById(messageId)
      .populate('sender', 'name email avatar');

    // Отправляем уведомление всем участникам чата через WebSocket
    io.to(chatId).emit('messageUpdated', { 
      chatId, 
      messageId,
      message: updatedMessage
    });
    
    // Загружаем полную информацию о чате для отправки в WebSocket
    let fullUpdatedChat = await Chat.findById(chatId)
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name email avatar' }
      })
      .populate('participants', 'name email avatar');
      
    // Проверяем тип последнего сообщения
    console.log('Проверка данных чата при редактировании:', {
      chatId,
      lastMessageType: fullUpdatedChat.lastMessage ? (typeof fullUpdatedChat.lastMessage === 'object' ? 'object' : 'id') : 'null',
      hasLastMessage: !!fullUpdatedChat.lastMessage
    });
    
    // Если lastMessage является только ID, а не полным объектом, загрузим его вручную
    if (fullUpdatedChat.lastMessage && typeof fullUpdatedChat.lastMessage !== 'object') {
      console.log('Загружаем последнее сообщение вручную при редактировании:', fullUpdatedChat.lastMessage);
      const lastMessageData = await Message.findById(fullUpdatedChat.lastMessage)
        .populate('sender', 'name email avatar');
      
      // Создаем копию чата с полным объектом последнего сообщения
      if (lastMessageData) {
        fullUpdatedChat = {
          ...fullUpdatedChat.toObject(),
          lastMessage: lastMessageData.toObject()
        };
      }
    }
    
    // Проверяем, что последнее сообщение загружено корректно
    console.log('Проверка данных чата после загрузки при редактировании:', {
      chatId,
      lastMessageType: fullUpdatedChat.lastMessage ? (typeof fullUpdatedChat.lastMessage === 'object' ? 'object' : 'id') : 'null',
      lastMessageText: fullUpdatedChat.lastMessage && typeof fullUpdatedChat.lastMessage === 'object' ? fullUpdatedChat.lastMessage.text : null
    });
    
    // Формируем объект для отправки
    const chatUpdateData = {
      chatId,
      chat: fullUpdatedChat,
      isLastMessage: isLastMessage // Явно передаем флаг isLastMessage в событие
    };
    
    // Если это последнее сообщение, явно добавляем его в данные для обновления
    if (isLastMessage) {
      console.log('Добавляем полное отредактированное сообщение в данные для отправки:', {
        chatId,
        messageId,
        text,
        edited: true
      });
      
      // Создаем полный объект последнего сообщения
      const lastMessageObj = {
        _id: updatedMessage._id,
        text: text,
        sender: updatedMessage.sender,
        edited: true
      };
      
      // Добавляем его в данные для отправки
      chatUpdateData.lastMessage = lastMessageObj;
      chatUpdateData.lastMessageText = text;
    }
    
    // Добавляем флаг isLastMessage в данные для отправки
    chatUpdateData.isLastMessage = isLastMessage;
    
    // Отправляем событие обновления чата всем клиентам
    io.emit('chatUpdated', chatUpdateData);
    
    console.log('Отправлено событие chatUpdated при редактировании сообщения:', {
      chatId,
      messageId,
      text,
      isLastMessage,
      hasExplicitLastMessage: !!chatUpdateData.lastMessage
    });
    
    return res.status(200).json({ 
      success: true, 
      message: 'Сообщение успешно обновлено',
      message: updatedMessage
    });
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
    
    console.log('Проверяем, было ли это последнее сообщение в чате:', { 
      messageId, 
      lastMessageId: chat.lastMessage ? chat.lastMessage.toString() : null 
    });
    
    // Находим новое последнее сообщение в чате
    const newLastMessage = await Message.findOne({ chat: chatId })
      .sort({ createdAt: -1 })
      .populate('sender', 'name email avatar');
    
    console.log('Найдено новое последнее сообщение:', newLastMessage ? {
      id: newLastMessage._id,
      text: newLastMessage.text,
      sender: newLastMessage.sender ? newLastMessage.sender._id : null,
      senderName: newLastMessage.sender ? newLastMessage.sender.name : null
    } : 'Сообщения отсутствуют');
    
    console.log('Новое последнее сообщение:', newLastMessage ? newLastMessage._id : null);
    
    // Обновляем последнее сообщение в чате
    if (newLastMessage) {
      // Если есть новое последнее сообщение, обновляем его
      // Создаем полный объект lastMessage с текстом и информацией об отправителе
      await Chat.findByIdAndUpdate(
        chatId,
        { 
          lastMessage: {
            text: newLastMessage.text || '',
            sender: newLastMessage.sender._id,
            timestamp: new Date()
          }
        },
        { new: true }
      );
      
      console.log('Обновленный чат с новым последним сообщением:', {
        chatId,
        lastMessageId: newLastMessage._id,
        lastMessageText: newLastMessage.text
      });
    } else {
      // Если больше нет сообщений в чате, устанавливаем lastMessage в объект с текстом "Нет сообщений"
      await Chat.findByIdAndUpdate(
        chatId,
        { lastMessage: { text: 'Нет сообщений', timestamp: new Date() } },
        { new: true }
      );
      
      console.log('Чат обновлен, больше нет сообщений:', chatId);
    }
    
    // Загружаем полную информацию о чате для отправки в WebSocket
    let fullUpdatedChat = await Chat.findById(chatId)
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name email avatar' }
      })
      .populate('participants', 'name email avatar');
    
    // Дополнительная проверка данных чата перед отправкой
    console.log('Проверка данных чата перед отправкой:', {
      chatId,
      lastMessageType: fullUpdatedChat.lastMessage ? (typeof fullUpdatedChat.lastMessage === 'object' ? 'object' : 'id') : 'null',
      hasLastMessage: !!fullUpdatedChat.lastMessage
    });
    
    // Если lastMessage является только ID, а не полным объектом, загрузим его вручную
    if (fullUpdatedChat.lastMessage && typeof fullUpdatedChat.lastMessage !== 'object') {
      console.log('Загружаем последнее сообщение вручную:', fullUpdatedChat.lastMessage);
      const lastMessageData = await Message.findById(fullUpdatedChat.lastMessage)
        .populate('sender', 'name email avatar');
      
      // Создаем копию чата с полным объектом последнего сообщения
      if (lastMessageData) {
        fullUpdatedChat = {
          ...fullUpdatedChat.toObject(),
          lastMessage: lastMessageData.toObject()
        };
      }
    }
    
    // Проверяем, что последнее сообщение загружено корректно
    console.log('Проверка данных чата после загрузки:', {
      chatId,
      lastMessageType: fullUpdatedChat.lastMessage ? (typeof fullUpdatedChat.lastMessage === 'object' ? 'object' : 'id') : 'null',
      lastMessageText: fullUpdatedChat.lastMessage && typeof fullUpdatedChat.lastMessage === 'object' ? fullUpdatedChat.lastMessage.text : null
    });
    
    // Отправляем уведомление всем участникам чата через WebSocket
    io.to(chatId).emit('messageDeleted', { chatId, messageId });
    
    // Формируем объект для отправки
    const chatUpdateData = {
      chatId,
      chat: fullUpdatedChat
    };
    
    // Добавляем данные о последнем сообщении для случая, если оно не загрузилось корректно
    if (newLastMessage) {
      // Создаем полный объект последнего сообщения
      // Сначала преобразуем объект в простой JavaScript объект
      const messageData = newLastMessage.toObject ? newLastMessage.toObject() : { ...newLastMessage };
      
      // Затем создаем новый объект с гарантированными полями
      const lastMessageObj = {
        _id: messageData._id,
        text: messageData.text || 'Медиа-сообщение',
        createdAt: messageData.createdAt,
        updatedAt: messageData.updatedAt,
        type: messageData.type || 'default',
        media_type: messageData.media_type || 'none',
        edited: messageData.edited || false
      };
      
      // Проверяем, что поле text действительно существует
      console.log('Проверка поля text в объекте последнего сообщения:', {
        originalText: messageData.text,
        newText: lastMessageObj.text,
        hasText: 'text' in lastMessageObj
      });
      console.log('Добавлено полное последнее сообщение в данные для отправки:', {
        id: newLastMessage._id,
        text: newLastMessage.text,
        sender: newLastMessage.sender
      });
      
      // Проверяем наличие текста в объекте последнего сообщения
      const messageText = newLastMessage.text || (newLastMessage.type === 'media' ? 'Медиа-сообщение' : 'Сообщение');
      
      console.log('Проверка текста последнего сообщения перед отправкой:', {
        originalText: newLastMessage.text,
        finalText: messageText,
        messageType: newLastMessage.type || 'default'
      });
      
      // Добавляем полный объект последнего сообщения
      chatUpdateData.lastMessage = {
        id: newLastMessage._id,
        text: messageText,
        sender: newLastMessage.sender
      };
      
      // Добавляем текст последнего сообщения в объект чата
      chatUpdateData.chat.lastMessageText = messageText;
      
      // Добавляем полный объект последнего сообщения в объект чата
      chatUpdateData.chat.lastMessage = {
        id: newLastMessage._id,
        text: messageText,
        sender: newLastMessage.sender
      };
      
      // Дублируем текст в объекте чата для надежности
      chatUpdateData.chat.lastMessageObj = {
        text: messageText
      };
    }
    
    // Отправляем событие обновления чата с полной информацией
    io.emit('chatUpdated', chatUpdateData);
    
    console.log('Отправлено событие chatUpdated с актуальной информацией о чате:', {
      chatId,
      lastMessageId: chatUpdateData.lastMessage ? chatUpdateData.lastMessage.id : null,
      lastMessageText: chatUpdateData.lastMessage ? chatUpdateData.lastMessage.text : null
    });
    
    return res.status(200).json({ success: true, message: 'Сообщение успешно удалено' });
  } catch (error) {
    console.error('Ошибка при удалении сообщения:', error);
    return res.status(500).json({ error: 'Ошибка сервера при удалении сообщения', details: error.message });
  }
};

export { sendMessage, getChatMessages, markMessagesAsRead, updateMessage, deleteMessage };
