import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import mongoose from 'mongoose';
import { io } from '../server.js';
import { getFileUrl } from '../middleware/uploadMiddleware.js';

// @desc    Отправка сообщения в чат
// @route   POST /api/chats/:chatId/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    let { text, media_type = 'none' } = req.body;
    let files = [];
    
    // Проверяем, есть ли загруженные файлы
    if (req.files && req.files.length > 0) {
      console.log('Обнаружены загруженные файлы:', req.files.length);
      
      // Функция для правильного декодирования имени файла
      const decodeFileName = (encodedName) => {
        try {
          // Проверяем, если имя файла уже содержит кириллицу
          if (/[\u0400-\u04FF]/.test(encodedName)) {
            console.log('Имя файла уже содержит кириллицу:', encodedName);
            return encodedName;
          }
          
          // Пробуем разные методы декодирования
          
          // Метод 1: Декодирование из binary в utf8
          try {
            const decoded1 = Buffer.from(encodedName, 'binary').toString('utf8');
            if (/[\u0400-\u04FF]/.test(decoded1)) {
              console.log('Успешно декодировано имя файла (binary -> utf8):', decoded1);
              return decoded1;
            }
          } catch (e) {
            console.log('Ошибка при декодировании binary -> utf8:', e.message);
          }
          
          // Метод 2: Декодирование из latin1 в utf8
          try {
            const decoded2 = Buffer.from(encodedName, 'latin1').toString('utf8');
            if (/[\u0400-\u04FF]/.test(decoded2)) {
              console.log('Успешно декодировано имя файла (latin1 -> utf8):', decoded2);
              return decoded2;
            }
          } catch (e) {
            console.log('Ошибка при декодировании latin1 -> utf8:', e.message);
          }
          
          // Метод 3: Декодирование из ascii в utf8
          try {
            const decoded3 = Buffer.from(encodedName, 'ascii').toString('utf8');
            if (/[\u0400-\u04FF]/.test(decoded3)) {
              console.log('Успешно декодировано имя файла (ascii -> utf8):', decoded3);
              return decoded3;
            }
          } catch (e) {
            console.log('Ошибка при декодировании ascii -> utf8:', e.message);
          }
          
          // Если ни один метод не сработал, возвращаем оригинальное имя
          console.log('Не удалось декодировать имя файла, возвращаем оригинал:', encodedName);
          return encodedName;
        } catch (error) {
          console.error('Ошибка при декодировании имени файла:', error);
          return encodedName; // Возвращаем оригинальное имя в случае ошибки
        }
      };
      
      // Обрабатываем все загруженные файлы
      for (const uploadedFile of req.files) {
        // Декодируем имя файла
        const decodedFileName = decodeFileName(uploadedFile.originalname);
        const mime_type = uploadedFile.mimetype;
        
        // Определяем тип медиа на основе MIME-типа
        let file_media_type = 'file';
        if (mime_type.startsWith('image/')) {
          file_media_type = 'image';
        } else if (mime_type.startsWith('video/')) {
          file_media_type = 'video';
        }
        
        // Генерируем URL для файла
        const fileUrl = getFileUrl(uploadedFile.filename, 'message-file');
        
        // Добавляем файл в массив
        files.push({
          file_url: fileUrl,
          file_name: decodedFileName,
          mime_type: mime_type,
          media_type: file_media_type,
          size: uploadedFile.size
        });
        
        // Логируем детали файла
        console.log('Детали загруженного файла:', {
          originalname: uploadedFile.originalname,
          decodedFileName: decodedFileName,
          encoding: uploadedFile.encoding,
          mimetype: mime_type,
          size: uploadedFile.size,
          buffer: uploadedFile.buffer ? 'Доступен' : 'Недоступен'
        });
        
        console.log('Файл обработан:', {
          originalName: decodedFileName,
          mimeType: mime_type,
          mediaType: file_media_type,
          fileUrl: fileUrl
        });
      }
      
      // Если есть файлы, устанавливаем тип медиа для сообщения
      if (files.length > 0) {
        // Определяем тип медиа для сообщения на основе первого файла
        if (files[0].media_type === 'image') {
          media_type = 'image';
        } else if (files[0].media_type === 'video') {
          media_type = 'video';
        } else {
          media_type = 'file';
        }
      }
    } else if (req.body.files && Array.isArray(req.body.files) && req.body.files.length > 0) {
      // Если файлы переданы в теле запроса как массив
      files = req.body.files;
      
      // Определяем тип медиа для сообщения на основе первого файла
      if (files[0].media_type === 'image') {
        media_type = 'image';
      } else if (files[0].media_type === 'video') {
        media_type = 'video';
      } else {
        media_type = 'file';
      }
    } else if (req.body.file) {
      // Если файл передан в теле запроса (для обратной совместимости)
      // Добавляем его в массив файлов
      files.push({
        file_url: req.body.file,
        thumbnail: req.body.thumbnail,
        mime_type: req.body.mime_type,
        media_type: media_type,
        file_name: req.body.file_name || 'Файл'
      });
    }
    
    // Проверяем, существует ли чат и является ли пользователь его участником
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его участником' });
    }
    
    // Проверяем наличие текста или медиа
    if (!text && media_type === 'none' && files.length === 0) {
      return res.status(400).json({ error: 'Сообщение должно содержать текст или медиа' });
    }
    
    // Создаем новое сообщение
    const messageData = {
      chat: chatId,
      sender: req.user._id,
      text,
      media_type: media_type,
      read_by: [req.user._id], // Отправитель автоматически считается прочитавшим сообщение
      files: files
    };
    
    // Для обратной совместимости с существующими клиентами
    if (files.length === 1) {
      messageData.file = files[0].file_url;
      messageData.file_name = files[0].file_name;
      messageData.mime_type = files[0].mime_type;
      if (files[0].thumbnail) {
        messageData.thumbnail = files[0].thumbnail;
      }
    }
    
    const newMessage = await Message.create(messageData);
    
    // Определяем текст для последнего сообщения
    let lastMessageText = text;
    if (!lastMessageText) {
      if (media_type === 'image') {
        lastMessageText = 'Фото';
      } else if (media_type === 'video') {
        lastMessageText = 'Видео';
      } else if (media_type === 'file') {
        lastMessageText = 'Файл';
      } else {
        lastMessageText = 'Медиа-сообщение';
      }
    }
    
    // Обновляем последнее сообщение в чате
    chat.lastMessage = {
      text: lastMessageText,
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
    
    // Проверяем, является ли чат превью-чатом
    const isPreviewChat = chatId.startsWith('preview_');
    
    // Если это не превью-чат, проверяем существование и права доступа
    if (!isPreviewChat) {
      // Используем select только для проверки существования и прав доступа
      const chatExists = await Chat.findOne({
        _id: chatId,
        participants: req.user._id
      }).select('_id').lean();
      
      if (!chatExists) {
        return res.status(404).json({ error: 'Чат не найден или вы не являетесь его участником' });
      }
    } else {
      console.log('Получение сообщений для превью-чата:', chatId);
      // Для превью-чатов не проверяем существование в базе данных
    }
    
    // Базовые условия запроса
    const query = { chat: chatId };
    
    // Если это превью-чат, возвращаем пустой массив сообщений
    if (isPreviewChat) {
      return res.status(200).json({
        messages: [],
        pagination: {
          limit: parseInt(limit),
          hasMore: false,
          nextCursor: null
        }
      });
    }
    
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
      file_name: 1, // Добавляем поле с именем файла
      mime_type: 1, // Добавляем MIME-тип файла
      thumbnail: 1,
      files: 1, // Добавляем массив файлов
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
    
    // Проверяем, является ли чат превью-чатом
    const isPreviewChat = chatId.startsWith('preview_');
    
    // Если это превью-чат, возвращаем успешный ответ без дополнительных проверок
    if (isPreviewChat) {
      console.log('Отметка сообщений как прочитанных для превью-чата:', chatId);
      return res.status(200).json({ message: 'Нет непрочитанных сообщений в превью-чате' });
    }
    
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
    const { text, edited, files, media_type } = req.body;
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
    if (text !== undefined) {
      message.text = text;
    }
    
    message.edited = edited === false ? false : true;
    message.updatedAt = new Date();
    
    // Обновляем файлы, если они есть
    if (files && Array.isArray(files) && files.length > 0) {
      message.files = files;
      
      // Обновляем тип медиа, если он указан
      if (media_type) {
        message.media_type = media_type;
      }
      
      // Для обратной совместимости с существующими клиентами
      if (files.length === 1) {
        message.file = files[0].file_url;
        message.file_name = files[0].file_name;
        message.mime_type = files[0].mime_type;
      }
    }
    
    console.log('Обновляем сообщение:', {
      messageId,
      text: message.text,
      edited: message.edited,
      files: files ? files.length : 0,
      media_type: message.media_type
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
    // Используем формат комнаты chat:${chatId} для совместимости с другими событиями
    io.to(`chat:${chatId}`).emit('messageUpdated', { 
      chatId, 
      messageId,
      message: updatedMessage
    });
    
    // Также отправляем в старом формате для обратной совместимости
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
      // Определяем текст для последнего сообщения в зависимости от типа медиа
      let lastMessageText = newLastMessage.text || '';
      
      // Если текста нет, но есть медиа-тип
      if (!lastMessageText && newLastMessage.media_type && newLastMessage.media_type !== 'none') {
        if (newLastMessage.media_type === 'image') {
          lastMessageText = 'Фото';
        } else if (newLastMessage.media_type === 'video') {
          lastMessageText = 'Видео';
        } else if (newLastMessage.media_type === 'file') {
          lastMessageText = 'Файл';
        } else {
          lastMessageText = 'Медиа-сообщение';
        }
      }
      
      await Chat.findByIdAndUpdate(
        chatId,
        { 
          lastMessage: {
            text: lastMessageText,
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
      // Если больше нет сообщений в чате, устанавливаем пустой объект lastMessage
      await Chat.findByIdAndUpdate(
        chatId,
        { lastMessage: { text: '', timestamp: new Date() } },
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
    // Используем формат комнаты chat:${chatId} для совместимости с другими событиями
    io.to(`chat:${chatId}`).emit('messageDeleted', { chatId, messageId });
    
    // Также отправляем в старом формате для обратной совместимости
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
