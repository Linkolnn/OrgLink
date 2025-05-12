import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { getFileUrl } from '../middleware/uploadMiddleware.js';

// Вспомогательная функция для создания служебных сообщений
const createServiceMessage = async (chatId, text, userId) => {
  try {
    // Создаем новое служебное сообщение
    const serviceMessage = await Message.create({
      chat: chatId,
      sender: userId, // Отправитель - пользователь, который вызвал действие
      text: text,
      type: 'service',
      media_type: 'none',
      read_by: [userId] // По умолчанию считаем, что отправитель уже прочитал сообщение
    });
    
    // Загружаем данные отправителя
    await serviceMessage.populate('sender', 'name email avatar');
    
    return serviceMessage;
  } catch (error) {
    console.error('Ошибка при создании служебного сообщения:', error);
    return null;
  }
};

// @desc    Создание нового чата
// @route   POST /api/chats
// @access  Private
const createChat = async (req, res) => {
  try {
    // Получаем данные из запроса
    const { name, description, participants, type, initialMessage } = req.body;
    let participantIds = [];
    
    // Проверяем, что массив участников передан и не пустой
    if (participants && Array.isArray(participants)) {
      // Проверяем, существуют ли пользователи
      const existingUsers = await User.find({ _id: { $in: participants } });
      
      if (existingUsers.length !== participants.length) {
        return res.status(400).json({ error: 'Некоторые пользователи не найдены' });
      }
      
      participantIds = participants;
    }
    
    // Добавляем создателя в список участников, если его там еще нет
    if (!participantIds.includes(req.user._id.toString())) {
      participantIds.push(req.user._id);
    }
    
    console.log(`Создание нового чата типа: ${type}, с участниками:`, participants);
  
    const chatData = {
      name,
      description,
      type,
      creator: req.user._id,
      participants: [...new Set([...participants, req.user._id])], // Добавляем создателя и удаляем дубликаты
      isGroup: type === 'group', // Для обратной совместимости
      avatar: null
    };
    
    // Если загружен аватар, добавляем его
    if (req.file) {
      chatData.avatar = getFileUrl(req.file.filename, 'chat-avatar');
    }
    
    const newChat = await Chat.create(chatData);
    
    // Получаем полные данные чата с информацией об участниках
    const populatedChat = await Chat.findById(newChat._id)
      .populate('creator', 'name email avatar')
      .populate('participants', 'name email avatar');
    
    // Создаем служебное сообщение о создании чата (только для групповых чатов)
    let messages = [];
    if (type === 'group') {
      const serviceMessage = await createServiceMessage(
        populatedChat._id, 
        `${req.user.name} создал групповой чат "${populatedChat.name}"`, 
        req.user._id
      );
      
      if (serviceMessage) {
        messages.push(serviceMessage);
      }
    }
    
    // Создаем первое сообщение, если оно было передано
    if (initialMessage || (req.body.files && req.body.files.length > 0)) {
      // Определяем тип сообщения в зависимости от типа чата
      // Для приватных чатов - обычное сообщение, для групповых - служебное
      const messageType = populatedChat.type === 'private' ? 'default' : 'service';
      console.log(`Создание первого сообщения для чата типа ${populatedChat.type} с типом сообщения ${messageType}`);
      console.log(`Текст первого сообщения: ${initialMessage || ''}`);
      
      // Проверяем, есть ли файлы в запросе
      const files = req.body.files || [];
      console.log(`Файлы в первом сообщении:`, files.length > 0 ? files.length : 'нет');
      
      try {
        // Создаем объект с данными для первого сообщения
        const messageData = {
          chat: populatedChat._id,
          sender: req.user._id,
          text: initialMessage || '',
          read_by: [req.user._id],
          type: messageType // Явно устанавливаем тип сообщения
        };
        
        // Добавляем файлы, если они есть
        if (files && files.length > 0) {
          // Определяем тип медиа на основе первого файла
          let media_type = 'none';
          const firstFile = files[0];
          
          if (firstFile.mime_type && firstFile.mime_type.startsWith('image/')) {
            media_type = 'image';
          } else if (firstFile.mime_type && firstFile.mime_type.startsWith('video/')) {
            media_type = 'video';
          } else {
            media_type = 'file';
          }
          
          messageData.media_type = media_type;
          messageData.files = files;
          
          // Для обратной совместимости с существующими клиентами
          if (files.length === 1) {
            messageData.file = files[0].file_url;
            messageData.file_name = files[0].file_name;
            messageData.mime_type = files[0].mime_type;
          }
        }
        
        const firstMessage = await Message.create(messageData);
        
        console.log(`Первое сообщение создано с ID: ${firstMessage._id}`);
        
        // Загружаем данные отправителя
        await firstMessage.populate('sender', 'name email avatar');
        messages.push(firstMessage);
        
        // Обновляем последнее сообщение в чате
        populatedChat.lastMessage = {
          text: initialMessage,
          sender: req.user._id,
          timestamp: new Date()
        };
        await populatedChat.save();
      } catch (error) {
        console.error(`Ошибка при создании первого сообщения:`, error);
      }
    }
    
    // Добавляем сообщения в ответ
    populatedChat._doc.messages = messages;
    
    // Отправляем уведомление всем участникам чата через WebSocket
    populatedChat.participants.forEach(participant => {
      // Отправляем событие только если пользователь онлайн и это не создатель чата
      if (participant._id.toString() !== req.user._id.toString() && 
          req.app.locals.io && 
          req.app.locals.userSockets[participant._id.toString()]) {
        
        console.log(`Отправка уведомления о новом чате пользователю ${participant.name}`);
        
        // Отправляем событие в сокет пользователя
        const socketId = req.app.locals.userSockets[participant._id.toString()].id;
        req.app.locals.io.to(socketId).emit('new-chat', populatedChat);
      }
    });
    
    res.status(201).json(populatedChat);
  } catch (error) {
    console.error('Ошибка создания чата:', error);
    res.status(500).json({ error: 'Ошибка сервера при создании чата' });
  }
};

// @desc    Получение списка чатов пользователя
// @route   GET /api/chats
// @access  Private
const getUserChats = async (req, res) => {
  try {
    // Находим все чаты, в которых пользователь является участником
    const chats = await Chat.find({ participants: req.user._id })
      .populate('creator', 'name email avatar')
      .populate('participants', 'name email avatar')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name'
        }
      })
      .sort({ updatedAt: -1 }); // Сортировка по дате обновления (новые сверху)
    
    // Для каждого чата получаем количество непрочитанных сообщений
    const chatsWithUnreadCount = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          chat: chat._id,
          read_by: { $ne: req.user._id },
          sender: { $ne: req.user._id } // Не считаем собственные сообщения как непрочитанные
        });
        
        return {
          ...chat.toObject(),
          unread: unreadCount
        };
      })
    );
    
    res.json(chatsWithUnreadCount);
  } catch (error) {
    console.error('Ошибка получения чатов:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении чатов' });
  }
};

// @desc    Получение информации о конкретном чате
// @route   GET /api/chats/:id
// @access  Private
const getChatById = async (req, res) => {
  try {
    const chatId = req.params.id;
    
    // Проверяем, существует ли чат и является ли пользователь его участником
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    })
      .populate('creator', 'name email avatar')
      .populate('participants', 'name email avatar')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name'
        }
      });
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его участником' });
    }
    
    res.json(chat);
  } catch (error) {
    console.error('Ошибка получения информации о чате:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении информации о чате' });
  }
};

// @desc    Редактирование чата
// @route   PUT /api/chats/:id
// @access  Private
const updateChat = async (req, res) => {
  try {
    const chatId = req.params.id;
    const { name, description } = req.body;
    
    // Сначала находим чат по ID
    const chat = await Chat.findById(chatId);
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }
    
    // Проверяем права доступа в зависимости от типа чата
    // Для приватных чатов - любой участник может обновлять
    // Для групповых чатов - только создатель
    if (chat.type === 'private') {
      // Проверяем, является ли пользователь участником чата
      // Используем some и equals для корректного сравнения ObjectId
      const isParticipant = chat.participants.some(participantId => 
        participantId.equals(req.user._id)
      );
      
      if (!isParticipant) {
        return res.status(403).json({ error: 'Вы не являетесь участником этого чата' });
      }
    } else {
      // Для групповых чатов проверяем, является ли пользователь создателем
      if (!chat.creator.equals(req.user._id)) {
        return res.status(403).json({ error: 'Вы не являетесь создателем этого чата' });
      }
    }
    
    try {
      // Создаем объект с обновлениями
      const updateData = {};
      
      // Добавляем только те поля, которые нужно обновить
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      
      // Если загружен новый аватар, добавляем его в обновления
      if (req.file) {
        updateData.avatar = getFileUrl(req.file.filename, 'chat-avatar');
      }
      
      // Обновляем чат с помощью findByIdAndUpdate вместо save()
      await Chat.findByIdAndUpdate(chatId, updateData, { new: true });
    } catch (error) {
      console.error('Ошибка при обновлении чата:', error);
      return res.status(500).json({ error: 'Ошибка сервера при обновлении чата' });
    }
    
    // Создаем сервисное сообщение об обновлении чата
    await Message.create({
      chat: chatId,
      sender: req.user._id,
      text: `${req.user.name} обновил(а) информацию о чате`,
      type: 'service'
    });
    
    // Получаем обновленные данные чата
    const updatedChat = await Chat.findById(chatId)
      .populate('creator', 'name email avatar')
      .populate('participants', 'name email avatar')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name'
        }
      });
    
    // Отправляем уведомление всем участникам чата через WebSocket
    updatedChat.participants.forEach(participant => {
      // Отправляем событие только если пользователь онлайн и это не тот, кто обновил чат
      if (participant._id.toString() !== req.user._id.toString() && 
          req.app.locals.io && 
          req.app.locals.userSockets[participant._id.toString()]) {
        
        console.log(`Отправка уведомления об обновлении чата пользователю ${participant.name}`);
        const socketId = req.app.locals.userSockets[participant._id.toString()].id;
        req.app.locals.io.to(socketId).emit('chat-updated', updatedChat);
      }
    });
    
    res.json(updatedChat);
  } catch (error) {
    console.error('Ошибка обновления чата:', error);
    res.status(500).json({ error: 'Ошибка сервера при обновлении чата' });
  }
};

// @desc    Добавление участников в чат
// @route   PUT /api/chats/:id/participants
// @access  Private
const addChatParticipants = async (req, res) => {
  try {
    const chatId = req.params.id;
    const { participants } = req.body;
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'Необходимо указать список участников' });
    }
    
    // Проверяем, существует ли чат и является ли пользователь его создателем или участником
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его участником' });
    }
    
    // Проверяем, существуют ли пользователи
    const existingUsers = await User.find({ _id: { $in: participants } });
    
    if (existingUsers.length !== participants.length) {
      return res.status(400).json({ error: 'Некоторые пользователи не найдены' });
    }
    
    // Добавляем новых участников, исключая дубликаты
    const newParticipants = participants.filter(
      (id) => !chat.participants.some(p => p.toString() === id)
    );
    
    if (newParticipants.length === 0) {
      return res.status(400).json({ error: 'Все указанные пользователи уже являются участниками чата' });
    }
    
    // Обновляем список участников
    chat.participants = [...chat.participants, ...newParticipants];
    
    // Если в чате больше 2 участников, устанавливаем флаг группового чата
    if (chat.participants.length > 2) {
      chat.isGroup = true;
    }
    
    await chat.save();
    
    // Создаем сервисное сообщение о добавлении участников
    const newUsers = await User.find({ _id: { $in: newParticipants } });
    const userNames = newUsers.map(user => user.name).join(', ');
    
    // Формируем текст сообщения в зависимости от количества добавленных пользователей
    let messageText;
    if (newUsers.length === 1) {
      messageText = `${req.user.name} добавил в чат пользователя ${userNames}`;
    } else {
      messageText = `${req.user.name} добавил в чат пользователей: ${userNames}`;
    }
    
    const serviceMessage = await createServiceMessage(
      chatId,
      messageText,
      req.user._id
    );
    
    // Отправляем уведомление о новом сообщении всем участникам чата через WebSocket
    if (serviceMessage && req.app.locals.io) {
      chat.participants.forEach(participantId => {
        const socketId = req.app.locals.userSockets[participantId.toString()]?.id;
        if (socketId) {
          req.app.locals.io.to(socketId).emit('new-message', { 
            message: serviceMessage, 
            chatId: chatId 
          });
        }
      });
    }
    
    // Получаем обновленные данные чата
    const updatedChat = await Chat.findById(chatId)
      .populate('creator', 'name email avatar')
      .populate('participants', 'name email avatar')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name'
        }
      });
    
    res.json(updatedChat);
  } catch (error) {
    console.error('Ошибка добавления участников:', error);
    res.status(500).json({ error: 'Ошибка сервера при добавлении участников' });
  }
};

// @desc    Удаление участника из чата
// @route   DELETE /api/chats/:id/participants/:userId
// @access  Private
const removeChatParticipant = async (req, res) => {
  try {
    const chatId = req.params.id;
    const userId = req.params.userId;
    
    // Проверяем, существует ли чат и является ли пользователь его создателем
    const chat = await Chat.findOne({
      _id: chatId,
      creator: req.user._id
    }).populate('participants', 'name email avatar');
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его создателем' });
    }
    
    // Проверяем, существует ли пользователь, которого нужно удалить
    const userToRemove = await User.findById(userId);
    
    if (!userToRemove) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Проверяем, является ли пользователь участником чата
    const participantExists = chat.participants.some(p => p._id.toString() === userId);
    if (!participantExists) {
      return res.status(400).json({ error: 'Пользователь не является участником чата' });
    }
    
    // Сохраняем информацию о чате для уведомления
    const chatName = chat.name;
    const chatType = chat.type;
    const removedUserName = userToRemove.name;
    const removedUserId = userToRemove._id.toString();
    const removedByUserId = req.user._id.toString();
    const removedByUserName = req.user.name;
    
    // Сохраняем список участников для отправки уведомлений
    const participants = [...chat.participants];
    
    // Удаляем пользователя из списка участников
    chat.participants = chat.participants.filter(p => !p._id.equals(userId));
    
    // Если в чате не осталось участников, удаляем его
    if (chat.participants.length === 0) {
      await Message.deleteMany({ chat: chatId });
      await Chat.deleteOne({ _id: chatId });
      return res.json({ message: 'Чат удален, так как в нем не осталось участников' });
    }
    
    // Сохраняем тип чата независимо от количества участников
    // Групповой чат всегда остается групповым
    
    await chat.save();
    
    // Создаем служебное сообщение об удалении пользователя
    const serviceMessage = await createServiceMessage(
      chatId,
      `${removedByUserName} удалил из чата пользователя ${removedUserName}`,
      req.user._id
    );
    
    // Получаем обновленные данные чата
    const updatedChat = await Chat.findById(chatId)
      .populate('creator', 'name email avatar')
      .populate('participants', 'name email avatar')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name'
        }
      });
    
    // Отправляем уведомление оставшимся участникам об обновлении чата
    participants.forEach(participant => {
      if (req.app.locals.userSockets[participant._id.toString()]) {
        const socketId = req.app.locals.userSockets[participant._id.toString()].id;
        req.app.locals.io.to(socketId).emit('chat-updated', updatedChat);
        
        // Отправляем служебное сообщение
        if (serviceMessage) {
          req.app.locals.io.to(socketId).emit('new-message', serviceMessage);
        }
      }
    });
    
    // Отправляем уведомление удаленному пользователю
    if (req.app.locals.userSockets[removedUserId]) {
      const socketId = req.app.locals.userSockets[removedUserId].id;
      req.app.locals.io.to(socketId).emit('participant-removed', {
        chatId,
        chatName,
        removedBy: removedByUserId,
        removedByName: removedByUserName,
        removedUser: removedUserId,
        removedUserName: removedUserName
      });
    }
    
    res.json(updatedChat);
  } catch (error) {
    console.error('Ошибка удаления участника:', error);
    res.status(500).json({ error: 'Ошибка сервера при удалении участника' });
  }
};

// @desc    Выход из чата
// @route   DELETE /api/chats/:id/leave
// @access  Private
const leaveChat = async (req, res) => {
  try {
    const chatId = req.params.id;
    
    // Проверяем, существует ли чат и является ли пользователь его участником
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    }).populate('participants', 'name email avatar');
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его участником' });
    }
    
    // Сохраняем информацию о чате для уведомления
    const chatName = chat.name;
    const chatType = chat.type;
    const leavingUserId = req.user._id.toString();
    const leavingUserName = req.user.name;
    
    // Сохраняем список участников для отправки уведомлений
    const participants = [...chat.participants];
    
    // Если это приватный чат, то удаляем его полностью
    if (chat.type === 'private') {
      await Message.deleteMany({ chat: chatId });
      await Chat.deleteOne({ _id: chatId });
      
      // Отправляем уведомление всем участникам о удалении чата
      participants.forEach(participant => {
        if (req.app.locals.userSockets[participant._id.toString()]) {
          const socketId = req.app.locals.userSockets[participant._id.toString()].id;
          req.app.locals.io.to(socketId).emit('chat-deleted', {
            chatId,
            chatName,
            chatType,
            deletedBy: leavingUserId,
            message: 'Личный чат был удален'
          });
        }
      });
      
      return res.json({ message: 'Чат успешно удален' });
    }
    
    // Если это групповой чат, то удаляем пользователя из списка участников
    chat.participants = chat.participants.filter(p => !p._id.equals(req.user._id));
    
    // Если пользователь был создателем чата, назначаем нового создателя
    if (chat.creator.equals(req.user._id) && chat.participants.length > 0) {
      chat.creator = chat.participants[0]._id;
    }
    
    // Если в чате не осталось участников, удаляем его
    if (chat.participants.length === 0) {
      await Message.deleteMany({ chat: chatId });
      await Chat.deleteOne({ _id: chatId });
      return res.json({ message: 'Чат успешно удален' });
    }
    
    // Сохраняем тип чата независимо от количества участников
    // Групповой чат всегда остается групповым
    
    await chat.save();
    
    // Создаем служебное сообщение о выходе из чата
    const serviceMessage = await createServiceMessage(
      chatId,
      `${req.user.name} покинул чат`,
      req.user._id
    );
    
    // Получаем обновленные данные чата для отправки уведомления
    const updatedChat = await Chat.findById(chatId)
      .populate('creator', 'name email avatar')
      .populate('participants', 'name email avatar')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name'
        }
      });
    
    // Отправляем уведомление оставшимся участникам об обновлении чата
    chat.participants.forEach(participant => {
      if (req.app.locals.userSockets[participant._id.toString()]) {
        const socketId = req.app.locals.userSockets[participant._id.toString()].id;
        req.app.locals.io.to(socketId).emit('chat-updated', updatedChat);
      }
    });
    
    // Отправляем уведомление покинувшему пользователю о выходе из чата
    if (req.app.locals.userSockets[leavingUserId]) {
      const socketId = req.app.locals.userSockets[leavingUserId].id;
      req.app.locals.io.to(socketId).emit('participant-left', {
        chatId,
        userId: leavingUserId,
        userName: leavingUserName,
        message: `Вы покинули чат "${chatName}"`
      });
    }
    
    res.json({ message: 'Вы успешно покинули чат' });
  } catch (error) {
    console.error('Ошибка выхода из чата:', error);
    res.status(500).json({ error: 'Ошибка сервера при выходе из чата' });
  }
};

// @desc    Удаление чата
// @route   DELETE /api/chats/:id
// @access  Private
const deleteChat = async (req, res) => {
  try {
    const chatId = req.params.id;
    
    // Находим чат
    const chat = await Chat.findById(chatId);
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }
    
    // Проверяем права на удаление:
    // 1. Для приватных чатов - пользователь должен быть участником
    // 2. Для групповых чатов - пользователь должен быть создателем
    if (chat.type === 'private') {
      // Для приватных чатов проверяем, что пользователь является участником
      if (!chat.participants.includes(req.user._id)) {
        return res.status(403).json({ error: 'Вы не являетесь участником этого чата' });
      }
    } else {
      // Для групповых чатов проверяем, что пользователь является создателем
      if (!chat.creator.equals(req.user._id)) {
        return res.status(403).json({ error: 'Вы не являетесь создателем этого чата' });
      }
    }
    
    // Сохраняем информацию о чате и участниках перед удалением
    const chatParticipants = [...chat.participants];
    const chatName = chat.name;
    const chatType = chat.type;
    const deletedBy = req.user._id;
    
    // Удаляем все сообщения чата
    await Message.deleteMany({ chat: chatId });
    
    // Удаляем сам чат
    await Chat.deleteOne({ _id: chatId });
    
    // Отправляем уведомление всем участникам чата через WebSocket
    chatParticipants.forEach(participantId => {
      // Проверяем, подключен ли пользователь через WebSocket
      if (req.app.locals.userSockets && 
          req.app.locals.userSockets[participantId.toString()]) {
        
        // Получаем ID сокета пользователя
        const socketId = req.app.locals.userSockets[participantId.toString()].id;
        
        // Отправляем событие удаления чата
        req.app.locals.io.to(socketId).emit('chat-deleted', {
          chatId,
          chatName,
          chatType,
          deletedBy: deletedBy.toString(),
          message: chatType === 'private' ? 'Личный чат был удален' : `Групповой чат "${chatName}" был удален`
        });
      }
    });
    
    res.json({ message: 'Чат успешно удален' });
  } catch (error) {
    console.error('Ошибка при удалении чата:', error);
    res.status(500).json({ error: 'Ошибка сервера при удалении чата' });
  }
};

// @desc    Поиск пользователей для добавления в чат
// @route   GET /api/chats/search-users
// @access  Private
const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Поисковый запрос должен содержать не менее 2 символов' });
    }
    
    // Ищем пользователей по имени или email
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ],
      _id: { $ne: req.user._id } // Исключаем текущего пользователя
    })
    .select('name email')
    .limit(10);
    
    res.json(users);
  } catch (error) {
    console.error('Ошибка поиска пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера при поиске пользователей' });
  }
};

// @desc    Получение списка чатов пользователя (для админа)
// @route   GET /api/admin/users/:userId/chats
// @access  Admin
const getAdminUserChats = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Проверяем, что текущий пользователь - администратор
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора.' });
    }
    
    // Находим все чаты, в которых пользователь является участником
    const chats = await Chat.find({ participants: userId })
      .populate('creator', 'name email avatar')
      .populate('participants', 'name email avatar')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name'
        }
      });
    
    res.json(chats);
  } catch (error) {
    console.error('Ошибка получения чатов пользователя (админ):', error);
    res.status(500).json({ error: 'Ошибка сервера при получении чатов пользователя' });
  }
};

// @desc    Получение сообщений чата (для админа)
// @route   GET /api/admin/chats/:chatId/messages
// @access  Admin
const getAdminChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    
    // Проверяем, что текущий пользователь - администратор
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора.' });
    }
    
    // Находим чат по ID
    const chat = await Chat.findById(chatId);
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }
    
    // Получаем сообщения чата
    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'name email avatar')
      .sort({ createdAt: 1 });
    
    res.json(messages);
  } catch (error) {
    console.error('Ошибка получения сообщений чата (админ):', error);
    res.status(500).json({ error: 'Ошибка сервера при получении сообщений чата' });
  }
};

export { 
  createChat, 
  getUserChats, 
  getChatById, 
  updateChat,
  addChatParticipants,
  removeChatParticipant,
  leaveChat,
  deleteChat,
  searchUsers,
  getAdminUserChats,
  getAdminChatMessages
};
