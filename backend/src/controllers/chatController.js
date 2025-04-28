import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { getFileUrl } from '../middleware/uploadMiddleware.js';

// @desc    Создание нового чата
// @route   POST /api/chats
// @access  Private
const createChat = async (req, res) => {
  try {
    const { name, participants, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Название чата обязательно' });
    }
    
    // Добавляем создателя чата в список участников
    let participantIds = [];
    
    // Если переданы участники, проверяем их существование
    if (participants && participants.length > 0) {
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
    
    // Создаем новый чат
    const chatData = {
      name,
      creator: req.user._id,
      participants: participantIds,
      isGroup: participantIds.length > 2,
      description: description || ''
    };
    
    // Если загружен аватар, добавляем его
    if (req.file) {
      chatData.avatar = getFileUrl(req.file.filename, 'chat-avatar');
    }
    
    const newChat = await Chat.create(chatData);
    
    // Создаем сервисное сообщение о создании чата
    await Message.create({
      chat: newChat._id,
      sender: req.user._id,
      text: `${req.user.name} создал(а) чат "${name}"`,
      type: 'service'
    });
    
    // Получаем полные данные чата с информацией об участниках
    const populatedChat = await Chat.findById(newChat._id)
      .populate('creator', 'name email')
      .populate('participants', 'name email')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name'
        }
      });
    
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
      .populate('creator', 'name email')
      .populate('participants', 'name email')
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
      .populate('creator', 'name email')
      .populate('participants', 'name email')
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
    
    // Проверяем, существует ли чат и является ли пользователь его создателем
    const chat = await Chat.findOne({
      _id: chatId,
      creator: req.user._id
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его создателем' });
    }
    
    // Обновляем данные чата
    if (name) chat.name = name;
    if (description !== undefined) chat.description = description;
    
    // Если загружен новый аватар, обновляем его
    if (req.file) {
      chat.avatar = getFileUrl(req.file.filename, 'chat-avatar');
    }
    
    await chat.save();
    
    // Создаем сервисное сообщение об обновлении чата
    await Message.create({
      chat: chatId,
      sender: req.user._id,
      text: `${req.user.name} обновил(а) информацию о чате`,
      type: 'service'
    });
    
    // Получаем обновленные данные чата
    const updatedChat = await Chat.findById(chatId)
      .populate('creator', 'name email')
      .populate('participants', 'name email')
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
    
    await Message.create({
      chat: chatId,
      sender: req.user._id,
      text: `${req.user.name} добавил(а) пользователей: ${userNames}`,
      type: 'service'
    });
    
    // Получаем обновленные данные чата
    const updatedChat = await Chat.findById(chatId)
      .populate('creator', 'name email')
      .populate('participants', 'name email')
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
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его создателем' });
    }
    
    // Проверяем, является ли удаляемый пользователь участником чата
    if (!chat.participants.some(p => p.toString() === userId)) {
      return res.status(400).json({ error: 'Пользователь не является участником чата' });
    }
    
    // Нельзя удалить создателя чата
    if (chat.creator.toString() === userId) {
      return res.status(400).json({ error: 'Нельзя удалить создателя чата' });
    }
    
    // Удаляем пользователя из списка участников
    chat.participants = chat.participants.filter(p => p.toString() !== userId);
    
    // Если в чате остался только 1 участник, удаляем чат
    if (chat.participants.length < 2) {
      await Chat.findByIdAndDelete(chatId);
      return res.json({ message: 'Чат удален, так как в нем остался только один участник' });
    }
    
    // Если в чате осталось 2 участника, это уже не групповой чат
    if (chat.participants.length === 2) {
      chat.isGroup = false;
    }
    
    await chat.save();
    
    // Создаем сервисное сообщение об удалении участника
    const removedUser = await User.findById(userId);
    
    await Message.create({
      chat: chatId,
      sender: req.user._id,
      text: `${req.user.name} удалил(а) пользователя ${removedUser ? removedUser.name : 'Unknown'}`,
      type: 'service'
    });
    
    // Получаем обновленные данные чата
    const updatedChat = await Chat.findById(chatId)
      .populate('creator', 'name email')
      .populate('participants', 'name email')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name'
        }
      });
    
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
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его участником' });
    }
    
    // Если пользователь является создателем чата, нужно передать права другому участнику
    if (chat.creator.toString() === req.user._id.toString()) {
      // Находим другого участника, которому можно передать права
      const newCreator = chat.participants.find(p => p.toString() !== req.user._id.toString());
      
      if (!newCreator) {
        // Если других участников нет, удаляем чат
        await Chat.findByIdAndDelete(chatId);
        return res.json({ message: 'Чат удален, так как вы были единственным участником' });
      }
      
      // Передаем права другому участнику
      chat.creator = newCreator;
    }
    
    // Удаляем пользователя из списка участников
    chat.participants = chat.participants.filter(p => p.toString() !== req.user._id.toString());
    
    // Если в чате остался только 1 участник, удаляем чат
    if (chat.participants.length < 2) {
      await Chat.findByIdAndDelete(chatId);
      return res.json({ message: 'Чат удален, так как в нем остался только один участник' });
    }
    
    // Если в чате осталось 2 участника, это уже не групповой чат
    if (chat.participants.length === 2) {
      chat.isGroup = false;
    }
    
    await chat.save();
    
    // Создаем сервисное сообщение о выходе из чата
    await Message.create({
      chat: chatId,
      sender: req.user._id,
      text: `${req.user.name} покинул(а) чат`,
      type: 'service'
    });
    
    res.json({ message: 'Вы успешно покинули чат' });
  } catch (error) {
    console.error('Ошибка выхода из чата:', error);
    res.status(500).json({ error: 'Ошибка сервера при выходе из чата' });
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

export { 
  createChat, 
  getUserChats, 
  getChatById, 
  updateChat,
  addChatParticipants,
  removeChatParticipant,
  leaveChat,
  searchUsers
};
