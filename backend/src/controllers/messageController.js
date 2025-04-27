import Message from '../models/Message.js';
import Chat from '../models/Chat.js';

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
      .populate('sender', 'name email');
    
    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error);
    res.status(500).json({ error: 'Ошибка сервера при отправке сообщения' });
  }
};

// @desc    Получение сообщений чата
// @route   GET /api/chats/:chatId/messages
// @access  Private
const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // Проверяем, существует ли чат и является ли пользователь его участником
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его участником' });
    }
    
    // Получаем сообщения с пагинацией (от новых к старым)
    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    // Отмечаем сообщения как прочитанные
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: req.user._id },
        read_by: { $ne: req.user._id }
      },
      {
        $addToSet: { read_by: req.user._id }
      }
    );
    
    // Получаем общее количество сообщений для пагинации
    const totalMessages = await Message.countDocuments({ chat: chatId });
    
    res.json({
      messages: messages.reverse(), // Возвращаем в хронологическом порядке (от старых к новым)
      pagination: {
        total: totalMessages,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalMessages / limit)
      }
    });
  } catch (error) {
    console.error('Ошибка получения сообщений:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении сообщений' });
  }
};

// @desc    Отметка сообщений как прочитанных
// @route   PUT /api/chats/:chatId/messages/read
// @access  Private
const markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    
    // Проверяем, существует ли чат и является ли пользователь его участником
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден или вы не являетесь его участником' });
    }
    
    // Отмечаем все сообщения в чате как прочитанные для данного пользователя
    const result = await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: req.user._id }, // Исключаем собственные сообщения
        read_by: { $ne: req.user._id } // Исключаем уже прочитанные
      },
      {
        $addToSet: { read_by: req.user._id }
      }
    );
    
    res.json({
      success: true,
      markedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Ошибка отметки сообщений как прочитанных:', error);
    res.status(500).json({ error: 'Ошибка сервера при отметке сообщений' });
  }
};

export { sendMessage, getChatMessages, markMessagesAsRead };
