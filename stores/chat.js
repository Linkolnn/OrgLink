import { defineStore } from 'pinia';
import { nextTick } from 'vue';
import { useRuntimeConfig } from '#imports';
import { useNuxtApp } from '#app';
import { safeFetch, handleApiResponse } from '~/utils/api';
import { useCookie } from '#imports';
import { useAuthStore } from '~/stores/auth';

export const useChatStore = defineStore('chat', {
  state: () => ({
    chats: [],
    activeChat: null,
    // Флаг, указывающий, что сброс activeChat не должен влиять на выезжание messenger
    ignoreActiveChatForSidebar: false,
    // ID чата, который отмечен как неактивный для уведомлений
    inactiveChatId: null,
    // Кэш текстов последних сообщений для каждого чата (используется временно до перезагрузки страницы)
    lastMessageTextCache: {},
    messages: [],
    messagesPage: 1,
    messagesHasMore: false,
    messagesLoading: false,
    messagesError: null,
    loading: false,
    error: null,
    chatListUpdateTrigger: 0,
    searchResults: [],
    searchLoading: false,
    searchError: null,
    // Состояние для предпросмотра приватного чата
    previewChat: null,
    isPreviewMode: false,
    socketConnected: false,
    socketListenersInitialized: false,
    initialLoadComplete: false, // Флаг для отслеживания первоначальной загрузки
    lastUpdated: Date.now(), // Временная метка последнего обновления для отслеживания изменений
    mutedChats: [], // Список ID чатов, для которых отключены уведомления
    pagination: {
      limit: 15, // Уменьшаем начальный лимит для более быстрой загрузки
      total: 0,
      hasMore: false,
      nextCursor: null
    },
  }),
  
  getters: {
    getActiveChat: (state) => state.activeChat,
    getChatMessages: (state) => state.messages,
    getChatById: (state) => (id) => state.chats.find(chat => chat.id === id),
    getTotalUnreadCount: (state) => state.chats.reduce((total, chat) => total + (chat.unread || 0), 0)
  },
  
  actions: {
    // Создание предпросмотра приватного чата
    setPreviewChat(userData) {
      console.log('ChatStore: Создание предпросмотра приватного чата', userData);
      
      // Сбрасываем текущий активный чат, но не показываем сайдбар
      this.activeChat = null;
      this.messages = [];
      
      // Создаем временный объект чата для предпросмотра
      const authStore = useAuthStore();
      
      this.previewChat = {
        _id: 'preview_' + Date.now(),
        name: userData.name,
        type: 'private',
        participants: [
          { ...authStore.user },
          { ...userData }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPreview: true // Метка, что это предпросмотр
      };
      
      // Устанавливаем режим предпросмотра
      this.isPreviewMode = true;
      
      // Устанавливаем предпросмотр как активный чат
      this.activeChat = this.previewChat;
      
      return this.previewChat;
    },
    
    // Отправка сообщения в режиме предпросмотра (создает реальный чат)
    async sendMessageInPreviewMode(text, files = []) {
      console.log('ChatStore: sendMessageInPreviewMode вызван с параметрами:', { 
        text, 
        files,
        hasFiles: Array.isArray(files) && files.length > 0,
        filesType: Array.isArray(files) ? typeof files[0] : 'нет файлов'
      });
      
      if (!this.isPreviewMode || !this.previewChat) {
        console.error('ChatStore: Попытка отправить сообщение в предпросмотре, но режим предпросмотра не активен');
        return null;
      }
      
      // Убедимся, что files всегда массив
      const normalizedFiles = Array.isArray(files) ? files : [];
      
      // Проверяем, что есть текст или файлы
      if ((!text || text.trim() === '') && normalizedFiles.length === 0) {
        console.error('ChatStore: Нельзя отправить пустое сообщение без файлов');
        return null;
      }
      
      try {
        // Получаем ID пользователя, с которым создаем чат
        const otherUser = this.previewChat.participants.find(p => {
          const authStore = useAuthStore();
          return p._id !== authStore.user._id;
        });
        
        if (!otherUser) {
          console.error('ChatStore: Не удалось найти второго участника в предпросмотре');
          return null;
        }
        
        const authStore = useAuthStore();
        const currentUser = authStore.user;
        
        // Определяем тип медиа на основе файлов
        let media_type = 'none';
        if (normalizedFiles && normalizedFiles.length > 0) {
          const firstFile = normalizedFiles[0];
          if (firstFile && firstFile.type && firstFile.type.startsWith('image/')) {
            media_type = 'image';
          } else if (firstFile && firstFile.type && firstFile.type.startsWith('video/')) {
            media_type = 'video';
          } else if (firstFile) {
            media_type = 'file';
          }
        }
        
        // Создаем временное сообщение для отображения в интерфейсе
        const tempMessage = {
          _id: `temp_${Date.now()}`,
          text: text || '',
          sender: {
            _id: currentUser._id,
            name: currentUser.name,
            avatar: currentUser.avatar
          },
          createdAt: new Date().toISOString(),
          read_by: [currentUser._id],
          media_type: media_type,
          files: normalizedFiles,
          isTemp: true // Метка, что это временное сообщение
        };
        
        // Если есть файлы, добавляем их во временное сообщение
        if (media_type === 'image' && normalizedFiles.length > 0 && normalizedFiles[0]) {
          tempMessage.file = normalizedFiles[0].url || normalizedFiles[0].file_url;
          tempMessage.file_name = normalizedFiles[0].name || normalizedFiles[0].file_name;
        }
        
        // Создаем реальный чат с первым сообщением
        const chatData = {
          name: otherUser.name,
          participants: [otherUser._id],
          type: 'private',
          // Для приватных чатов передаем initialMessage, чтобы оно стало первым сообщением в чате
          initialMessage: text || '',
          setActive: true
        };
        
        // Если есть файлы, добавляем их в запрос
        if (normalizedFiles.length > 0) {
          // Подготавливаем файлы для отправки на сервер
          chatData.files = normalizedFiles.map(file => ({
            file_url: file?.file_url || file?.url || '',
            file_name: file?.file_name || file?.name || 'File',
            mime_type: file?.mime_type || file?.type || 'application/octet-stream',
            media_type: file?.media_type || 
                      (file?.type && file.type.startsWith('image/') ? 'image' : 
                      file?.type && file.type.startsWith('video/') ? 'video' : 'file')
          }));
        }
        
        console.log('ChatStore: Создаем чат из режима предпросмотра', chatData);
        
        // Создаем реальный чат
        const newChat = await this.createChat(chatData);
        
        // Проверяем, что чат был успешно создан
        if (!newChat) {
          console.error('ChatStore: Ошибка при создании чата');
          return null;
        }
        
        console.log('ChatStore: Чат успешно создан', newChat);
        
        // Сбрасываем режим предпросмотра после успешного создания чата
        this.isPreviewMode = false;
        this.previewChat = null;
        
        // Загружаем сообщения для нового чата
        await this.fetchMessages(newChat._id);
        
        // Устанавливаем новый чат как активный
        this.setActiveChat(newChat._id);
        
        // Обновляем список чатов
        this.triggerChatListUpdate();
        
        console.log('ChatStore: Чат создан и активирован', newChat);
        
        // Возвращаем созданный чат
        return newChat;
      } catch (error) {
        console.error('ChatStore: Ошибка при отправке сообщения в режиме предпросмотра:', error);
        throw error;
      }
    },
    
    // Инициализация WebSocket слушателей
    initSocketListeners() {
      console.log('ChatStore: Инициализация WebSocket слушателей');
      
      // Загружаем список отключенных чатов
      this.loadMutedChats();
      
      // Проверяем, были ли уже инициализированы слушатели
      if (this.socketListenersInitialized) {
        console.log('ChatStore: WebSocket слушатели уже инициализированы');
        return;
      }
      
      const { $socket } = useNuxtApp();
      
      if (!$socket) {
        console.error('WebSocket не инициализирован');
        return;
      }
      
      console.log('Инициализация WebSocket слушателей...');
      
      // Удаляем существующие обработчики, чтобы избежать дублирования
      $socket.off('newMessage');
      $socket.off('messageUpdated');
      $socket.off('messageDeleted');
      $socket.off('messageRead');
      $socket.off('newChat');
      $socket.off('chatUpdated');
      $socket.off('chatDeleted');
      $socket.off('participantLeft');
      $socket.off('participantRemoved');
      
      // Добавляем обработчик нового сообщения (новый формат)
      $socket.on('newMessage', (data) => {
        console.log('WebSocket: Получено новое сообщение (newMessage):', data);
        
        // Проверяем формат данных
        let messageToAdd;
        
        if (data.message) {
          // Если сообщение приходит в формате { message, chatId, chat, sender }
          console.log('WebSocket: Сообщение в объекте data.message');
          messageToAdd = data.message;
          
          // Добавляем информацию о чате, если ее нет
          if (!messageToAdd.chat && data.chatId) {
            messageToAdd.chat = data.chatId;
          }
        } else {
          // Если сообщение приходит напрямую
          console.log('WebSocket: Сообщение напрямую в data');
          messageToAdd = data;
        }
        
        console.log('WebSocket: Сообщение для добавления:', messageToAdd);
        this.addNewMessage(messageToAdd);
      });
      
      // Добавляем обработчик нового сообщения (старый формат)
      $socket.on('new-message', ({ message, chatId }) => {
        console.log('WebSocket: Получено новое сообщение (new-message):', message, 'для чата:', chatId);
        
        // Если сообщение не содержит поле chat, добавляем его
        if (!message.chat && chatId) {
          message.chat = chatId;
        }
        
        this.addNewMessage(message);
      });
      
      // Добавляем обработчик обновления сообщения
      $socket.on('messageUpdated', ({ chatId, messageId, message }) => {
        console.log('WebSocket: Сообщение обновлено:', { chatId, messageId, message });
        
        // Обновляем сообщение в локальном списке
        const messageIndex = this.messages.findIndex(msg => msg._id === messageId);
        if (messageIndex !== -1) {
          const updatedMessage = { 
            ...this.messages[messageIndex], 
            ...message,
            edited: true
          };
          
          // Создаем новый массив для гарантии реактивности
          const newMessages = [...this.messages];
          newMessages.splice(messageIndex, 1, updatedMessage);
          
          // Обновляем массив сообщений
          this.messages = newMessages;
          console.log('WebSocket: Сообщение обновлено в хранилище:', updatedMessage);
          
          // Если это последнее сообщение в чате, обновляем его в списке чатов
          const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
          if (chatIndex !== -1 && this.chats[chatIndex].lastMessage?._id === messageId) {
            const updatedChat = { 
              ...this.chats[chatIndex],
              lastMessage: {
                ...this.chats[chatIndex].lastMessage,
                ...message,
                edited: true
              }
            };
            
            // Создаем новый массив чатов для гарантии реактивности
            const newChats = [...this.chats];
            newChats.splice(chatIndex, 1, updatedChat);
            this.chats = newChats;
            
            // Принудительно обновляем список чатов для обеспечения реактивности
            this.triggerChatListUpdate();
          }
          
          // Обновляем lastUpdated для триггера реактивности
          this.lastUpdated = Date.now();
        }
      });
      
      // Добавляем обработчик удаления сообщения
      $socket.on('messageDeleted', ({ chatId, messageId }) => {
        console.log('WebSocket: Сообщение удалено:', { chatId, messageId });
        
        // Проверяем, есть ли сообщение в списке
        const messageExists = this.messages.some(msg => msg._id === messageId);
        
        if (messageExists) {
          console.log('WebSocket: Сообщение найдено в списке, удаляем');
          
          // Создаем новый массив без удаленного сообщения
          const newMessages = this.messages.filter(msg => msg._id !== messageId);
          
          // Обновляем массив сообщений
          this.messages = newMessages;
          console.log('WebSocket: Сообщение удалено из хранилища, осталось:', newMessages.length);
          
          // Обновляем lastUpdated для триггера реактивности
          this.lastUpdated = Date.now();
        }
        
        // Запрашиваем актуальную информацию о чате с сервера
        this.loadChatById(chatId).then(updatedChat => {
          console.log('WebSocket: Получена актуальная информация о чате:', updatedChat);
          
          // Обновляем чат в списке чатов
          const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
          if (chatIndex !== -1) {
            // Создаем новый массив чатов для гарантии реактивности
            const newChats = [...this.chats];
            newChats.splice(chatIndex, 1, updatedChat);
            this.chats = newChats;
          }
          
          // Принудительно обновляем список чатов
          this.triggerChatListUpdate();
        }).catch(error => {
          console.error('WebSocket: Ошибка при загрузке информации о чате:', error);
        });
      });
      
      // Добавляем обработчик прочтения сообщения
      $socket.on('messageRead', ({ chatId, userId }) => {
        console.log('WebSocket: Сообщения прочитаны:', { chatId, userId });
        this.updateMessagesReadStatus(chatId, userId);
        
        // Обновляем счетчик непрочитанных сообщений
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          // Если текущий пользователь прочитал сообщения, обнуляем счетчик
          const authStore = useAuthStore();
          if (authStore.user && authStore.user._id === userId) {
            const updatedChat = { ...this.chats[chatIndex], unread: 0 };
            this.chats.splice(chatIndex, 1, updatedChat);
            
            // Принудительно обновляем список чатов
            this.triggerChatListUpdate();
          }
        }
      });
      
      // Добавляем обработчик нового чата
      $socket.on('newChat', (chat) => {
        console.log('WebSocket: Получен новый чат:', chat);
        this.addNewChat(chat);
      });
      
      // Добавляем обработчик обновления чата
      $socket.on('chatUpdated', (data) => {
        console.log('WebSocket: Чат обновлен:', data);
        
        // Проверяем формат данных
        if (!data.chatId) {
          console.error('WebSocket: Неверный формат данных для chatUpdated:', data);
          return;
        }
        
        // Проверяем, является ли обновление результатом редактирования последнего сообщения
        console.log('WebSocket: Проверка флага isLastMessage:', {
          chatId: data.chatId,
          isLastMessage: data.isLastMessage,
          hasLastMessage: !!data.lastMessage
        });
        
        // Находим чат в списке
        const chatIndex = this.chats.findIndex(chat => chat._id === data.chatId);
        
        // Если получен полный объект чата
        if (data.chat) {
          if (chatIndex !== -1) {
            // Обновляем существующий чат
            console.log('WebSocket: Обновляем существующий чат:', data.chatId);
            
            // Сохраняем локальные свойства, которые не приходят с сервера
            console.log('WebSocket: Получены данные для обновления чата:', {
              chatId: data.chatId,
              hasLastMessageInChat: !!data.chat.lastMessage,
              hasExplicitLastMessage: !!data.lastMessage
            });
            
            // Проверяем наличие поля lastMessageText в приходящих данных
            console.log('WebSocket: Проверка поля lastMessageText в приходящих данных:', {
              chatId: data.chatId,
              hasLastMessageText: 'lastMessageText' in data,
              lastMessageTextValue: data.lastMessageText,
              hasLastMessageTextInChat: data.chat && 'lastMessageText' in data.chat,
              chatLastMessageTextValue: data.chat ? data.chat.lastMessageText : undefined,
              hasLastMessageObj: data.chat && data.chat.lastMessageObj,
              lastMessageObjText: data.chat && data.chat.lastMessageObj ? data.chat.lastMessageObj.text : undefined
            });
            
            // Создаем объект обновленного чата
            const updatedChat = {
              ...this.chats[chatIndex],
              ...data.chat
            };
            
            // Добавляем поле lastMessageText, если оно есть в данных
            if (data.lastMessageText) {
              console.log(`WebSocket: Устанавливаем lastMessageText из данных: ${data.lastMessageText}`);
              updatedChat.lastMessageText = data.lastMessageText;
            } else if (data.chat && data.chat.lastMessageText) {
              console.log(`WebSocket: Устанавливаем lastMessageText из чата: ${data.chat.lastMessageText}`);
              updatedChat.lastMessageText = data.chat.lastMessageText;
            } else if (data.chat && data.chat.lastMessageObj && data.chat.lastMessageObj.text) {
              console.log(`WebSocket: Устанавливаем lastMessageText из lastMessageObj: ${data.chat.lastMessageObj.text}`);
              updatedChat.lastMessageText = data.chat.lastMessageObj.text;
            }
            
            // Если это редактирование последнего сообщения, устанавливаем флаг edited
            if (data.isLastMessage === true) {
              console.log(`WebSocket: Устанавливаем флаг edited для последнего сообщения в чате ${data.chatId}`);
              
              // Устанавливаем флаг edited в объекте lastMessage
              if (updatedChat.lastMessage && typeof updatedChat.lastMessage === 'object') {
                updatedChat.lastMessage.edited = true;
              }
            }
            
            // Используем явно переданное последнее сообщение, если оно есть
            if (data.lastMessage) {
              console.log('WebSocket: Используем явно переданное последнее сообщение:', {
                id: data.lastMessage._id,
                text: data.lastMessage.text,
                hasText: !!data.lastMessage.text
              });
              // Создаем копию объекта сообщения
              const lastMessageCopy = { ...data.lastMessage };
              
              // Проверяем наличие поля text
              if (!('text' in lastMessageCopy) || lastMessageCopy.text === undefined) {
                console.log('WebSocket: Поле text отсутствует в объекте последнего сообщения, устанавливаем его вручную');
                // Если поле text отсутствует, устанавливаем его вручную
                lastMessageCopy.text = '';
                
                // Проверяем, есть ли текст в кэше
                if (this.lastMessageTextCache[data.chatId]) {
                  console.log(`WebSocket: Используем текст из кэша для чата ${data.chatId}: ${this.lastMessageTextCache[data.chatId]}`);
                  lastMessageCopy.text = this.lastMessageTextCache[data.chatId];
                }
              } else {
                // Если текст есть, сохраняем его в кэш
                console.log(`WebSocket: Сохраняем текст в кэш для чата ${data.chatId}: ${lastMessageCopy.text}`);
                this.lastMessageTextCache[data.chatId] = lastMessageCopy.text;
              }
              
              // Проверяем, что поле text теперь существует
              console.log('WebSocket: Проверка поля text после обработки:', {
                hasText: 'text' in lastMessageCopy,
                textValue: lastMessageCopy.text,
                cachedText: this.lastMessageTextCache[data.chatId] || null
              });
              
              // Устанавливаем обработанный объект последнего сообщения
              updatedChat.lastMessage = lastMessageCopy;
              
              // Добавляем текст последнего сообщения как отдельное поле для удобства
              updatedChat.lastMessageText = lastMessageCopy.text;
            } else if (data.chat.lastMessage) {
              console.log('WebSocket: Используем последнее сообщение из чата:', {
                id: data.chat.lastMessage._id,
                text: data.chat.lastMessage.text,
                hasText: !!data.chat.lastMessage.text
              });
              // Создаем копию объекта сообщения
              const lastMessageCopy = { ...data.chat.lastMessage };
              
              // Проверяем наличие поля text
              if (!('text' in lastMessageCopy) || lastMessageCopy.text === undefined) {
                console.log('WebSocket: Поле text отсутствует в объекте последнего сообщения из чата, устанавливаем его вручную');
                // Если поле text отсутствует, устанавливаем его вручную
                lastMessageCopy.text = '';
                
                // Проверяем, есть ли текст в кэше
                if (this.lastMessageTextCache[data.chatId]) {
                  console.log(`WebSocket: Используем текст из кэша для чата ${data.chatId}: ${this.lastMessageTextCache[data.chatId]}`);
                  lastMessageCopy.text = this.lastMessageTextCache[data.chatId];
                }
              } else {
                // Если текст есть, сохраняем его в кэш
                console.log(`WebSocket: Сохраняем текст из чата в кэш для чата ${data.chatId}: ${lastMessageCopy.text}`);
                this.lastMessageTextCache[data.chatId] = lastMessageCopy.text;
              }
              
              // Проверяем, что поле text теперь существует
              console.log('WebSocket: Проверка поля text из чата после обработки:', {
                hasText: 'text' in lastMessageCopy,
                textValue: lastMessageCopy.text,
                cachedText: this.lastMessageTextCache[data.chatId] || null
              });
              
              // Устанавливаем обработанный объект последнего сообщения
              updatedChat.lastMessage = lastMessageCopy;
              
              // Добавляем текст последнего сообщения как отдельное поле для удобства
              updatedChat.lastMessageText = lastMessageCopy.text;
            } else {
              updatedChat.lastMessage = null;
            }
            
            // Проверяем, что последнее сообщение корректно установлено
            console.log('WebSocket: Проверка последнего сообщения перед обновлением чата:', {
              hasLastMessage: !!updatedChat.lastMessage,
              text: updatedChat.lastMessage ? updatedChat.lastMessage.text : null
            });
            
            this.chats.splice(chatIndex, 1, updatedChat);
            
            // Если это активный чат, обновляем его данные
            if (this.activeChat && this.activeChat._id === data.chatId) {
              console.log('WebSocket: Обновляем активный чат:', data.chatId);
              
              // Создаем обновленный активный чат
              const updatedActiveChat = {
                ...this.activeChat,
                ...data.chat
              };
              
              // Используем явно переданное последнее сообщение, если оно есть
              if (data.lastMessage) {
                console.log('WebSocket: Используем явно переданное последнее сообщение для активного чата:', {
                  id: data.lastMessage._id,
                  text: data.lastMessage.text,
                  hasText: !!data.lastMessage.text
                });
                // Создаем копию объекта сообщения
                const lastMessageCopy = { ...data.lastMessage };
                
                // Проверяем наличие поля text
                if (!('text' in lastMessageCopy) || lastMessageCopy.text === undefined) {
                  console.log('WebSocket: Поле text отсутствует в объекте последнего сообщения активного чата, устанавливаем его вручную');
                  // Если поле text отсутствует, устанавливаем его вручную
                  lastMessageCopy.text = '';
                  
                  // Проверяем, есть ли текст в кэше
                  if (this.lastMessageTextCache[data.chatId]) {
                    console.log(`WebSocket: Используем текст из кэша для активного чата ${data.chatId}: ${this.lastMessageTextCache[data.chatId]}`);
                    lastMessageCopy.text = this.lastMessageTextCache[data.chatId];
                  }
                } else {
                  // Если текст есть, сохраняем его в кэш
                  console.log(`WebSocket: Сохраняем текст в кэш для активного чата ${data.chatId}: ${lastMessageCopy.text}`);
                  this.lastMessageTextCache[data.chatId] = lastMessageCopy.text;
                }
                
                // Проверяем, что поле text теперь существует
                console.log('WebSocket: Проверка поля text активного чата после обработки:', {
                  hasText: 'text' in lastMessageCopy,
                  textValue: lastMessageCopy.text,
                  cachedText: this.lastMessageTextCache[data.chatId] || null
                });
                
                // Устанавливаем обработанный объект последнего сообщения
                updatedActiveChat.lastMessage = lastMessageCopy;
                
                // Добавляем текст последнего сообщения как отдельное поле для удобства
                updatedActiveChat.lastMessageText = lastMessageCopy.text;
              } else if (data.chat.lastMessage) {
                console.log('WebSocket: Используем последнее сообщение из чата для активного чата:', {
                  id: data.chat.lastMessage._id,
                  text: data.chat.lastMessage.text,
                  hasText: !!data.chat.lastMessage.text
                });
                // Создаем копию объекта сообщения
                const lastMessageCopy = { ...data.chat.lastMessage };
                
                // Проверяем наличие поля text
                if (!('text' in lastMessageCopy) || lastMessageCopy.text === undefined) {
                  console.log('WebSocket: Поле text отсутствует в объекте последнего сообщения из чата для активного чата, устанавливаем его вручную');
                  // Если поле text отсутствует, устанавливаем его вручную
                  lastMessageCopy.text = '';
                  
                  // Проверяем, есть ли текст в кэше
                  if (this.lastMessageTextCache[data.chatId]) {
                    console.log(`WebSocket: Используем текст из кэша для активного чата из чата ${data.chatId}: ${this.lastMessageTextCache[data.chatId]}`);
                    lastMessageCopy.text = this.lastMessageTextCache[data.chatId];
                  }
                } else {
                  // Если текст есть, сохраняем его в кэш
                  console.log(`WebSocket: Сохраняем текст в кэш для активного чата из чата ${data.chatId}: ${lastMessageCopy.text}`);
                  this.lastMessageTextCache[data.chatId] = lastMessageCopy.text;
                }
                
                // Проверяем, что поле text теперь существует
                console.log('WebSocket: Проверка поля text из чата для активного чата после обработки:', {
                  hasText: 'text' in lastMessageCopy,
                  textValue: lastMessageCopy.text,
                  cachedText: this.lastMessageTextCache[data.chatId] || null
                });
                
                // Устанавливаем обработанный объект последнего сообщения
                updatedActiveChat.lastMessage = lastMessageCopy;
                
                // Добавляем текст последнего сообщения как отдельное поле для удобства
                updatedActiveChat.lastMessageText = lastMessageCopy.text;
              } else {
                updatedActiveChat.lastMessage = null;
              }
              
              // Проверяем, что последнее сообщение корректно установлено
              console.log('WebSocket: Проверка последнего сообщения перед обновлением активного чата:', {
                hasLastMessage: !!updatedActiveChat.lastMessage,
                text: updatedActiveChat.lastMessage ? updatedActiveChat.lastMessage.text : null
              });
              
              this.activeChat = updatedActiveChat;
            }
            
            // Увеличиваем триггер обновления списка чатов
            this.chatListUpdateTrigger++;
            console.log('Обновлен триггер списка чатов:', this.chatListUpdateTrigger);
          } else {
            // Если чат не найден, добавляем его в список
            console.log('WebSocket: Добавляем новый чат:', data.chat);
            
            // Создаем объект нового чата
            const newChat = { ...data.chat };
            
            // Используем явно переданное последнее сообщение, если оно есть
            if (data.lastMessage) {
              console.log('WebSocket: Используем явно переданное последнее сообщение для нового чата:', {
                id: data.lastMessage._id,
                text: data.lastMessage.text,
                hasText: !!data.lastMessage.text
              });
              newChat.lastMessage = {
                ...data.lastMessage,
                // Гарантируем, что поле text существует
                text: data.lastMessage.text || ''
              };
            } else if (data.chat.lastMessage) {
              console.log('WebSocket: Используем последнее сообщение из чата для нового чата:', {
                id: data.chat.lastMessage._id,
                text: data.chat.lastMessage.text,
                hasText: !!data.chat.lastMessage.text
              });
              newChat.lastMessage = {
                ...data.chat.lastMessage,
                // Гарантируем, что поле text существует
                text: data.chat.lastMessage.text || ''
              };
            }
            
            // Проверяем, что последнее сообщение корректно установлено
            console.log('WebSocket: Проверка последнего сообщения перед добавлением нового чата:', {
              hasLastMessage: !!newChat.lastMessage,
              text: newChat.lastMessage ? newChat.lastMessage.text : null
            });
            
            this.chats.push(newChat);
            
            // Сортируем чаты по времени последнего сообщения
            this.sortChatsByLastMessage();
            
            // Увеличиваем триггер обновления списка чатов
            this.chatListUpdateTrigger++;
            console.log('Обновлен триггер списка чатов (новый чат):', this.chatListUpdateTrigger);
          }
          
          // Принудительно обновляем список чатов
          this.triggerChatListUpdate();
        } 
        // Если получено только последнее сообщение (старый формат)
        else if (chatIndex !== -1 && data.lastMessage) {
          console.log('WebSocket: Обновляем только последнее сообщение в чате:', data.chatId);
          
          const updatedChat = { 
            ...this.chats[chatIndex],
            lastMessage: data.lastMessage
          };
          
          this.chats.splice(chatIndex, 1, updatedChat);
          
          // Если это активный чат, обновляем его данные
          if (this.activeChat && this.activeChat._id === data.chatId) {
            this.activeChat = { ...this.activeChat, lastMessage: data.lastMessage };
          }
          
          // Принудительно обновляем список чатов
          this.triggerChatListUpdate();
        } else {
          console.log('WebSocket: Чат не найден или нет данных для обновления:', data);
        }
      });
      
      // Добавляем обработчик удаления чата
      $socket.on('chatDeleted', ({ chatId, chatName, chatType, deletedBy, message }) => {
        console.log('WebSocket: Чат удален:', { chatId, chatName, chatType, deletedBy, message });
        
        // Удаляем чат из списка
        this.removeChatFromList(chatId);
        
        // Показываем уведомление
        this.showChatDeletedNotification(message);
      });
      
      // Добавляем обработчик события выхода пользователя из чата
      $socket.on('participantLeft', ({ chatId, userId, userName, message }) => {
        console.log('WebSocket: Пользователь покинул чат:', { chatId, userId, userName, message });
        
        // Удаляем чат из списка для пользователя, который покинул чат
        const authStore = useAuthStore();
        if (authStore.user && authStore.user._id === userId) {
          this.removeChatFromList(chatId);
          
          // Показываем уведомление
          if (window.$showNotification) {
            window.$showNotification(message, 'info');
          }
        }
      });
      
      // Добавляем обработчик события удаления пользователя из чата
      $socket.on('participantRemoved', ({ chatId, chatName, removedBy, removedByName, message }) => {
        console.log('WebSocket: Пользователь удален из чата:', { chatId, chatName, removedBy, removedByName, message });
        
        // Сохраняем ссылку на $showSidebar до удаления чата
        const { $showSidebar } = useNuxtApp();
        
        // Удаляем чат из списка для удаленного пользователя
        // Это вызовет resetActiveChat(), который вызовет showSidebarOnMobile()
        this.removeChatFromList(chatId);
        
        // Дополнительно пытаемся показать боковую панель напрямую
        // Для случаев, когда showSidebarOnMobile() не сработал
        if ($showSidebar) {
          console.log('ChatStore: Дополнительно показываем SideBar напрямую через $showSidebar');
          $showSidebar();
        }
        
        // Показываем уведомление после показа боковой панели
        setTimeout(() => {
          if (window.$showNotification) {
            window.$showNotification(message, 'info');
          } else {
            console.log('Глобальный метод $showNotification недоступен, используем запасной вариант');
            
            // Запасной вариант - просто выводим в консоль
            console.log(`Уведомление: Чат удален - ${message}`);
          }
        }, 50); // Добавляем небольшую задержку для гарантии показа боковой панели
      });
      
      // Добавляем обработчик события подключения
      $socket.on('connect', () => {
        console.log('WebSocket: Подключение к серверу установлено');
        this.socketConnected = true;
        
        // При подключении обновляем список чатов
        if (this.initialLoadComplete) {
          this.fetchChats();
        }
      });
      
      // Добавляем обработчик события отключения
      $socket.on('disconnect', () => {
        console.log('WebSocket: Отключение от сервера');
        this.socketConnected = false;
      });
      
      console.log('WebSocket слушатели успешно инициализированы');
      this.socketListenersInitialized = true;
    },
    
    // Добавление нового сообщения (через WebSocket)
    addNewMessage(message) {
      console.log('Добавление нового сообщения:', message);
      
      // Проверяем, что сообщение не дублируется
      const isDuplicate = this.messages.some(msg => msg._id === message._id);
      if (isDuplicate) {
        console.log('Сообщение уже существует в списке:', message._id);
        return;
      }
      
      try {
        // Создаем глубокую копию сообщения
        const messageClone = JSON.parse(JSON.stringify(message));
        
        // Добавляем сообщение в массив сообщений
        this.messages.push(messageClone);
        
        // Проверяем, от текущего ли пользователя сообщение
        const { $auth } = useNuxtApp();
        const currentUserId = $auth?.user?._id;
        const senderIsCurrentUser = (
          (messageClone.sender && typeof messageClone.sender === 'object' && messageClone.sender._id === currentUserId) ||
          (messageClone.sender && typeof messageClone.sender === 'string' && messageClone.sender === currentUserId)
        );
        console.log('Сообщение добавлено в массив, текущий размер:', this.messages.length);
        
        // Находим чат в списке
        const chatIndex = this.chats.findIndex(chat => chat._id === messageClone.chat);
        console.log('Индекс чата в списке:', chatIndex);
        
        if (chatIndex !== -1) {
          // Получаем текущий чат
          const currentChat = this.chats[chatIndex];
          
          // Создаем объект последнего сообщения
          const lastMessage = {
            ...messageClone,
            timestamp: messageClone.createdAt || new Date().toISOString(),
            text: messageClone.text || 'Медиа-сообщение'
          };
          
          // Проверяем, от текущего ли пользователя сообщение
          const { $auth } = useNuxtApp();
          const currentUserId = $auth?.user?._id;
          
          // Увеличиваем счетчик непрочитанных сообщений, если сообщение не от текущего пользователя
          let unreadCount = currentChat.unread || 0;
          
          // Если сообщение не от текущего пользователя и чат не активен
          if (!senderIsCurrentUser && (!this.activeChat || this.activeChat._id !== currentChat._id)) {
            unreadCount++;
            console.log(`Увеличен счетчик непрочитанных сообщений для чата ${currentChat._id} до ${unreadCount}`);
          }
          
          // Создаем обновленный чат
          const updatedChat = { 
            ...currentChat,
            lastMessage,
            unread: unreadCount
          };
          
          // Удаляем чат из текущей позиции
          this.chats.splice(chatIndex, 1);
          
          // Добавляем чат в начало списка
          this.chats.unshift(updatedChat);
          
          // Обновляем временную метку для отслеживания изменений
          this.lastUpdated = Date.now();
          console.log(`Чат ${chatId} перемещен в начало списка, lastUpdated обновлен`);
          
          // Обновляем активный чат, если это тот же чат
          if (isActiveChat) {
            console.log('Обновляем активный чат с новым сообщением');
            this.activeChat = { ...this.activeChat, lastMessage };
            
            // Используем nextTick для прокрутки чата вниз после рендеринга
            nextTick(() => {
              const chatContainer = document.querySelector('.chat__messages');
              if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
              }
            });
          }
          
          // Отмечаем обновление списка чатов
          this.initialLoadComplete = true;
          
          // Отправляем событие обновления чата для других клиентов
          const { $socket } = useNuxtApp();
          if ($socket && $socket.connected) {
            // Проверяем, является ли messageClone.chat объектом или строкой
            const chatId = typeof messageClone.chat === 'object' ? messageClone.chat._id : messageClone.chat;
            $socket.emit('client-chat-updated', { chatId });
          }
        } else {
          // Если чат не найден в списке, загружаем его с сервера
          console.log('Чат не найден в списке, загружаем информацию о чате');
          // Проверяем, является ли messageClone.chat объектом или строкой
          const chatId = typeof messageClone.chat === 'object' ? messageClone.chat._id : messageClone.chat;
          this.loadChatById(chatId);
        }
      } catch (error) {
        console.error('Ошибка при добавлении нового сообщения:', error);
      }
    },
    
    // Обновление статуса прочтения сообщений
    updateMessagesReadStatus(chatId, userId) {
      // Обновляем статус прочтения для всех сообщений в указанном чате
      if (this.activeChat && this.activeChat._id === chatId) {
        this.messages.forEach(message => {
          if (!message.read_by.includes(userId)) {
            message.read_by.push(userId);
          }
        });
      }
    },
    
    // Добавление нового чата в список (через WebSocket)
    addNewChat(chat) {
      console.log('Добавление нового чата:', chat);
      
      try {
        // Создаем копию чата, чтобы избежать проблем с реактивностью
        const chatClone = JSON.parse(JSON.stringify(chat));
        
        // Проверяем, нет ли уже такого чата в списке
        const existingChatIndex = this.chats.findIndex(c => c._id === chatClone._id);
        
        if (existingChatIndex === -1) {
          // Добавляем новый чат в начало списка
          this.chats.unshift(chatClone);
          console.log('Новый чат добавлен в список:', chatClone.name);
        } else {
          // Обновляем существующий чат
          this.chats[existingChatIndex] = { ...this.chats[existingChatIndex], ...chatClone };
          console.log('Существующий чат обновлен:', chatClone.name);
        }
        
        // Применяем принудительное обновление списка чатов
        this.triggerChatListUpdate();
      } catch (error) {
        console.error('Ошибка при добавлении нового чата:', error);
      }
    },
    
    // Обновление чата в списке (через WebSocket)
    updateChatInList(updatedChat) {
      console.log('Обновление чата в списке:', updatedChat);
      
      try {
        // Создаем копию чата, чтобы избежать проблем с реактивностью
        const chatClone = JSON.parse(JSON.stringify(updatedChat));
        
        const chatIndex = this.chats.findIndex(c => c._id === chatClone._id);
        console.log('Индекс чата для обновления:', chatIndex);
        
        if (chatIndex !== -1) {
          // Удаляем чат из текущей позиции
          this.chats.splice(chatIndex, 1);
          
          // Добавляем обновленный чат в начало списка
          this.chats.unshift({ ...chatClone });
          
          // Если это активный чат, обновляем и его
          if (this.activeChat && this.activeChat._id === chatClone._id) {
            this.activeChat = { ...this.activeChat, ...chatClone };
          }
          
          console.log('Чат обновлен в списке:', chatClone.name);
        } else {
          // Если чат не найден, добавляем его как новый
          this.chats.unshift(chatClone);
          console.log('Чат не найден, добавлен как новый:', chatClone.name);
        }
        
        // Применяем принудительное обновление списка чатов
        this.triggerChatListUpdate();
      } catch (error) {
        console.error('Ошибка при обновлении чата:', error);
      }
    },
    
    // Удаление чата из списка (через WebSocket)
    removeChatFromList(chatId) {
      console.log('Удаление чата из списка:', chatId);
      
      try {
        const chatIndex = this.chats.findIndex(c => c._id === chatId);
        console.log('Индекс чата для удаления:', chatIndex);
        
        if (chatIndex !== -1) {
          // Сохраняем имя чата для лога
          const chatName = this.chats[chatIndex].name;
          
          // Удаляем чат из списка
          this.chats.splice(chatIndex, 1);
          
          // Если это был активный чат, сбрасываем активный чат и все связанные данные
          if (this.activeChat && this.activeChat._id === chatId) {
            this.resetActiveChat();
          }
          
          console.log('Чат удален из списка:', chatName);
          
          // Применяем принудительное обновление списка чатов
          this.triggerChatListUpdate();
        }
      } catch (error) {
        console.error('Ошибка при удалении чата:', error);
      }
    },
    
    // Обновление последнего сообщения в списке чатов
    updateLastMessage(chatId, message) {
      if (!chatId || !message) return;
      
      console.log('ChatStore: Обновление последнего сообщения для чата:', chatId, message);
      
      // Сохраняем полную информацию об отправителе
      const senderInfo = message.sender && typeof message.sender === 'object' 
        ? { ...message.sender } // Копируем объект отправителя
        : message.sender; // Или просто ID, если это строка
      
      // Обновляем lastMessage в активном чате, если это тот же чат
      if (this.activeChat && this.activeChat._id === chatId) {
        this.activeChat.lastMessage = {
          text: message.text || 'Медиа-сообщение',
          sender: senderInfo, // Сохраняем полную информацию
          timestamp: message.createdAt || new Date()
        };
      }
      
      // Обновляем lastMessage в списке чатов
      const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
      if (chatIndex !== -1) {
        // Создаем новый объект чата с обновленным lastMessage
        const updatedChat = { ...this.chats[chatIndex] };
        updatedChat.lastMessage = {
          text: message.text || 'Медиа-сообщение',
          sender: senderInfo, // Сохраняем полную информацию
          timestamp: message.createdAt || new Date()
        };
        
        // Удаляем старый чат из списка
        this.chats.splice(chatIndex, 1);
        
        // Добавляем обновленный чат в начало списка
        this.chats.unshift(updatedChat);
      }
    },
    
    // Загрузка списка чатов
    async fetchChats() {
      if (this.loading) return;
      
      this.loading = true;
      this.error = null;
      
      try {
        console.log('ChatStore: Загрузка списка чатов...');
        const config = useRuntimeConfig();
        
        // Определяем, используется ли Safari или iOS
        const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        console.log('ChatStore: Загрузка чатов', { isSafari, isIOS });
        
        // Получаем токен из cookie
        const tokenCookie = useCookie('token');
        const clientTokenCookie = useCookie('client_token');
        const token = tokenCookie.value || clientTokenCookie.value;
        
        // Используем safeFetch для совместимости с Safari/iOS
        const response = await safeFetch(`${config.public.backendUrl}/api/chats`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Authorization': token ? `Bearer ${token}` : undefined
          }
        }).then(res => res.json()).catch(err => {
          console.error('ChatStore: Ошибка при загрузке чатов:', err);
          
          // Если получили 401, пробуем запрос с токеном в URL
          if (err.status === 401 && token) {
            console.log('ChatStore: Пробуем запрос с токеном в URL');
            return fetch(`${config.public.backendUrl}/api/chats?token=${token}`).then(res => res.json());
          }
          throw err;
        });
        
        console.log('ChatStore: Список чатов получен, количество:', response.length);
        
        // Сохраняем превью-чаты перед обновлением списка
        const previewChats = this.chats.filter(chat => chat.isPreview === true);
        console.log('ChatStore: Сохранено превью-чатов:', previewChats.length);
        
        // Если это первая загрузка, просто устанавливаем список чатов
        if (!this.initialLoadComplete) {
          this.chats = JSON.parse(JSON.stringify(response));
          
          // Добавляем сохраненные превью-чаты обратно в список
          if (previewChats.length > 0) {
            this.chats = [...previewChats, ...this.chats];
            console.log('ChatStore: Превью-чаты добавлены обратно в список');
          }
          
          this.initialLoadComplete = true;
          console.log('ChatStore: Первая загрузка чатов завершена');
        } else {
          // Плавно обновляем список чатов
          const newChats = JSON.parse(JSON.stringify(response));
          
          // Фильтруем текущие чаты, оставляя только не-превью
          const currentChats = this.chats.filter(chat => !chat.isPreview);
          
          // Для каждого чата из нового списка
          for (const newChat of newChats) {
            // Проверяем, есть ли чат в текущем списке
            const existingChatIndex = currentChats.findIndex(chat => chat._id === newChat._id);
            
            if (existingChatIndex !== -1) {
              // Если чат уже есть, обновляем его данные, сохраняя счетчик непрочитанных сообщений
              const existingChat = currentChats[existingChatIndex];
              
              // Сохраняем счетчик непрочитанных сообщений
              newChat.unread = existingChat.unread;
              
              // Проверяем, изменилось ли последнее сообщение
              const hasNewMessage = newChat.lastMessage && existingChat.lastMessage && 
                                   (newChat.lastMessage._id !== existingChat.lastMessage._id);
              
              // Если есть новое сообщение, перемещаем чат в начало списка
              if (hasNewMessage) {
                // Удаляем чат из текущей позиции
                currentChats.splice(existingChatIndex, 1);
                // Добавляем чат в начало списка
                currentChats.unshift(newChat);
                console.log('ChatStore: Чат перемещен в начало списка:', newChat.name);
              } else {
                // Просто обновляем данные чата на месте
                currentChats[existingChatIndex] = { ...newChat };
              }
            } else {
              // Если это новый чат, добавляем его в начало списка
              currentChats.unshift(newChat);
              console.log('ChatStore: Добавлен новый чат:', newChat.name);
            }
          }
          
          // Обновляем список чатов, добавляя превью-чаты в начало
          this.chats = [...previewChats, ...currentChats];
          console.log('ChatStore: Список чатов обновлен с сохранением превью-чатов');
        }
        
        // Инициализируем WebSocket слушатели
        this.initSocketListeners();
        
        // Отмечаем обновление списка чатов
        this.triggerChatListUpdate();
        
        // Проверяем, что lastUpdated существует
        if (this.lastUpdated === undefined) {
          this.lastUpdated = Date.now();
        } else {
          // Обновляем временную метку для отслеживания изменений
          this.lastUpdated = Date.now();
        }
        console.log('ChatStore: Обновлена временная метка lastUpdated:', this.lastUpdated);
        
        return response;
      } catch (error) {
        console.error('Ошибка при загрузке чатов:', error);
        this.error = 'Не удалось загрузить список чатов';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Загрузка информации о чате по ID
    async loadChatById(chatId) {
      console.log('Загрузка информации о чате по ID:', chatId);
      
      try {
        const config = useRuntimeConfig();
        const chat = await $fetch(`${config.public.backendUrl}/api/chats/${chatId}`, {
          credentials: 'include'
        });
        
        console.log('Получена информация о чате:', chat);
        
        // Проверяем, нет ли уже такого чата в списке
        const existingChatIndex = this.chats.findIndex(c => c._id === chat._id);
        
        if (existingChatIndex === -1) {
          // Добавляем новый чат в начало списка
          this.chats.unshift(chat);
          console.log('Чат добавлен в список:', chat.name);
        } else {
          // Обновляем существующий чат
          this.chats[existingChatIndex] = { ...this.chats[existingChatIndex], ...chat };
          console.log('Существующий чат обновлен:', chat.name);
        }
        
        // Применяем принудительное обновление списка чатов
        this.triggerChatListUpdate();
        
        return chat;
      } catch (error) {
        console.error('Ошибка при загрузке информации о чате:', error);
        return null;
      }
    },
    
    // Создание нового чата
    async createChat(chatData) {
      this.loading = true;
      this.error = null;
      
      try {
        const config = useRuntimeConfig();
        
        // Получаем токен из cookie
        const tokenCookie = useCookie('token');
        const clientTokenCookie = useCookie('client_token');
        const token = tokenCookie.value || clientTokenCookie.value;
        
        // Определяем, используется ли Safari или iOS
        const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        console.log('ChatStore: Создание чата', { isSafari, isIOS, hasToken: !!token, chatData });
        
        // Форматируем данные для API
        const apiData = {
          name: chatData.name || '',
          type: chatData.type || 'group',
          description: chatData.description || '',
          participants: chatData.participants || []
        };
        
        // Добавляем initialMessage для всех типов чатов
        if (chatData.initialMessage) {
          apiData.initialMessage = chatData.initialMessage;
        }
        
        // Добавляем файлы, если они есть
        if (chatData.files && chatData.files.length > 0) {
          apiData.files = chatData.files;
        }
        
        console.log('ChatStore: Отформатированные данные для API:', apiData);
        
        // Используем safeFetch для совместимости с Safari/iOS
        const response = await safeFetch(`${config.public.backendUrl}/api/chats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : undefined
          },
          body: JSON.stringify(apiData),
          credentials: 'include'
        }).then(res => {
          if (!res.ok) {
            console.error('ChatStore: Ошибка при создании чата. Статус:', res.status);
            return res.text().then(text => {
              try {
                return JSON.parse(text);
              } catch (e) {
                console.error('ChatStore: Ответ сервера не является JSON:', text);
                throw new Error(`Ошибка при создании чата: ${res.status} ${text}`);
              }
            });
          }
          return res.json();
        }).catch(err => {
          console.error('ChatStore: Ошибка при создании чата:', err);
          
          // Если получили 401, пробуем запрос с токеном в URL
          if (err.status === 401 && token) {
            console.log('ChatStore: Пробуем запрос с токеном в URL');
            return fetch(`${config.public.backendUrl}/api/chats?token=${token}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(apiData)
            }).then(res => {
              if (!res.ok) {
                console.error('ChatStore: Ошибка при создании чата (повторная попытка). Статус:', res.status);
                return res.text().then(text => {
                  try {
                    return JSON.parse(text);
                  } catch (e) {
                    console.error('ChatStore: Ответ сервера не является JSON:', text);
                    throw new Error(`Ошибка при создании чата: ${res.status} ${text}`);
                  }
                });
              }
              return res.json();
            });
          }
          throw err;
        });
        
        if (response.error) {
          console.error('ChatStore: Ошибка при создании чата:', response.error);
          this.error = response.error;
          this.loading = false;
          throw new Error(response.error);
        }
        
        console.log('ChatStore: Чат успешно создан:', response);
        
        // Проверяем, есть ли сообщения в ответе от сервера
        if (response.messages && response.messages.length > 0) {
          console.log('ChatStore: В ответе от сервера есть сообщения:', response.messages.length);
          
          // Сохраняем сообщения в чате
          response.messages = response.messages.map(msg => ({
            ...msg,
            // Преобразуем sender из строки в объект, если это необходимо
            sender: typeof msg.sender === 'string' ? { _id: msg.sender } : msg.sender
          }));
          
          // Устанавливаем последнее сообщение, если его нет
          if (!response.lastMessage && response.messages.length > 0) {
            const lastMsg = response.messages[response.messages.length - 1];
            response.lastMessage = {
              text: lastMsg.text,
              sender: lastMsg.sender,
              createdAt: lastMsg.createdAt
            };
            console.log('ChatStore: Установлено последнее сообщение из массива сообщений');
          }
        } else {
          // Инициализируем массив сообщений, если его нет
          response.messages = [];
        }
        
        // Добавляем новый чат в начало списка
        this.chats.unshift(response);
        
        // Устанавливаем новый чат как активный, если это требуется
        if (chatData.setActive) {
          this.activeChat = response;
        }
        
        this.loading = false;
        
        // Применяем принудительное обновление списка чатов
        this.triggerChatListUpdate();
        
        return response;
      } catch (error) {
        console.error('ChatStore: Ошибка при создании чата:', error);
        this.error = error.message || 'Ошибка при создании чата';
        this.loading = false;
        throw error;
      }
    },
    
    // Установка активного чата
    async setActiveChat(chatId) {
      // Сбрасываем все поля, связанные с виртуальным и мягким сбросом
      this.virtualActiveChat = null;
      this.softResetChat = null;
      this.inactiveChatId = null;
      
      if (!chatId) {
        // Если чат был активен, покидаем его комнату в WebSocket
        if (this.activeChat) {
          const { $socketLeaveChat } = useNuxtApp();
          $socketLeaveChat(this.activeChat._id);
        }
        
        this.activeChat = null;
        this.messages = [];
        return;
      }
      
      // Если уже выбран этот чат, ничего не делаем
      if (this.activeChat && this.activeChat._id === chatId) return;
      
      // Если был активен другой чат, покидаем его комнату
      if (this.activeChat) {
        const { $socketLeaveChat } = useNuxtApp();
        $socketLeaveChat(this.activeChat._id);
      }
      
      this.loading = true;
      this.error = null;
      
      // Проверяем, есть ли чат в списке чатов
      const existingChat = this.chats.find(chat => chat._id === chatId);
      if (existingChat) {
        // Если чат уже есть в списке, устанавливаем его как активный
        // без дополнительного запроса к серверу
        this.activeChat = existingChat;
      }
      
      try {
        // Запускаем параллельные запросы для получения данных чата и сообщений
        const config = useRuntimeConfig();
        
        // Запускаем запросы параллельно
        const [chatResponse] = await Promise.all([
          // Получаем данные чата только если его нет в списке
          !existingChat ? $fetch(`${config.public.backendUrl}/api/chats/${chatId}`, {
            credentials: 'include'
          }) : Promise.resolve(existingChat),
          
          // Сбрасываем пагинацию и загружаем сообщения
          // (этот запрос выполняется в любом случае)
          (async () => {
            this.pagination.nextCursor = null;
            this.messages = [];
            await this.fetchMessages(chatId);
          })()
        ]);
        
        // Обновляем данные чата, если получили новые
        if (!existingChat) {
          this.activeChat = chatResponse;
        }
        
        // Обнуляем счетчик непрочитанных сообщений в локальном состоянии
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          // Обновляем счетчик непрочитанных сообщений
          const updatedChat = { ...this.chats[chatIndex], unread: 0 };
          
          // Обновляем чат в списке
          this.chats.splice(chatIndex, 1, updatedChat);
          
          // Обновляем временную метку для отслеживания изменений
          this.lastUpdated = Date.now();
          
          console.log(`Обнулен счетчик непрочитанных сообщений для чата ${chatId}`);
        }
        
        // Отмечаем сообщения как прочитанные и подключаемся к WebSocket
        // (выполняем эти операции параллельно)
        Promise.all([
          this.markMessagesAsRead(chatId),
          (async () => {
            // Подключаемся к комнате чата через WebSocket
            const { $socketJoinChat } = useNuxtApp();
            $socketJoinChat(chatId);
          })()
        ]).catch(error => {
          console.error('Ошибка при выполнении дополнительных операций:', error);
        });
      } catch (error) {
        console.error('Ошибка при загрузке чата:', error);
        this.error = 'Не удалось загрузить чат';
      } finally {
        this.loading = false;
      }
    },
    
    // Загрузка сообщений чата
    async fetchMessages(chatId) {
      if (!chatId) return;
      
      this.loading = true;
      this.initialLoadComplete = false;
      
      try {
        const config = useRuntimeConfig();
        const params = {
          limit: this.pagination.limit
        };
        
        // Получаем токен из cookie
        const tokenCookie = useCookie('token');
        const clientTokenCookie = useCookie('client_token');
        const token = tokenCookie.value || clientTokenCookie.value;
        
        // Определяем, используется ли Safari или iOS
        const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        console.log('ChatStore: Загрузка сообщений', { chatId, isSafari, isIOS, hasToken: !!token });
        
        // Формируем URL с параметрами
        let url = `${config.public.backendUrl}/api/chats/${chatId}/messages`;
        if (params.limit) {
          url += `?limit=${params.limit}`;
        }
        
        // Используем safeFetch для совместимости с Safari/iOS
        const response = await safeFetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Authorization': token ? `Bearer ${token}` : undefined
          }
        }).then(res => res.json()).catch(err => {
          console.error('ChatStore: Ошибка при загрузке сообщений:', err);
          
          // Если получили 401, пробуем запрос с токеном в URL
          if (err.status === 401 && token) {
            console.log('ChatStore: Пробуем запрос сообщений с токеном в URL');
            const urlWithToken = url.includes('?') 
              ? `${url}&token=${token}` 
              : `${url}?token=${token}`;
            return fetch(urlWithToken).then(res => res.json());
          }
          throw err;
        });
        
        // Устанавливаем сообщения
        this.messages = response.messages;
        
        // Обновляем информацию о пагинации
        this.pagination = response.pagination;
        
        // Если есть еще сообщения, запускаем фоновую загрузку следующей порции
        if (this.pagination.hasMore && !this.loadingMore) {
          this.loadMoreMessagesInBackground();
        }
        
        this.initialLoadComplete = true;
        return response.messages;
      } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
        this.error = 'Не удалось загрузить сообщения';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Фоновая загрузка дополнительных сообщений
    async loadMoreMessagesInBackground() {
      if (!this.activeChat || !this.pagination.hasMore || this.loadingMore) return;
      
      // Не показываем индикатор загрузки для фоновой загрузки
      this.loadingMore = true;
      
      try {
        // Получаем ID самого старого сообщения
        const oldestMessageId = this.pagination.nextCursor;
        
        if (oldestMessageId) {
          const config = useRuntimeConfig();
          const params = {
            limit: 30, // Загружаем больше сообщений в фоне
            before_id: oldestMessageId
          };
          
          const response = await $fetch(`${config.public.backendUrl}/api/chats/${this.activeChat._id}/messages`, {
            credentials: 'include',
            params
          });
          
          // Добавляем старые сообщения в начало списка
          if (response.messages.length > 0) {
            this.messages = [...response.messages, ...this.messages];
          }
          
          // Обновляем информацию о пагинации
          this.pagination = response.pagination;
        }
      } catch (error) {
        console.error('Ошибка при фоновой загрузке сообщений:', error);
      } finally {
        this.loadingMore = false;
      }
    },
    
    // Загрузка дополнительных сообщений (по запросу пользователя)
    async loadMoreMessages(chatId, beforeId) {
      if (!chatId || !beforeId || this.loadingMore) return;
      
      this.loadingMore = true;
      
      try {
        const config = useRuntimeConfig();
        const params = {
          limit: 20,
          before_id: beforeId
        };
        
        const response = await $fetch(`${config.public.backendUrl}/api/chats/${chatId}/messages`, {
          credentials: 'include',
          params
        });
        
        // Добавляем старые сообщения в начало списка
        if (response.messages.length > 0) {
          this.messages = [...response.messages, ...this.messages];
        }
        
        // Обновляем информацию о пагинации
        this.pagination = response.pagination;
        
        return response.messages;
      } catch (error) {
        console.error('Ошибка при загрузке дополнительных сообщений:', error);
        throw error;
      } finally {
        this.loadingMore = false;
      }
    },
    
    // Редактирование чата
    async updateChat(chatId, chatData, avatarData = null) {
      this.loading = true;
      this.error = null;
      
      try {
        // Создаем FormData для отправки файлов
        const formData = new FormData();
        
        // Добавляем текстовые поля
        if (chatData.name) formData.append('name', chatData.name);
        if (chatData.description !== undefined) formData.append('description', chatData.description);
        
        // Добавляем аватар, если он есть в chatData
        if (chatData.avatar) {
          if (chatData.avatar instanceof File) {
            formData.append('avatar', chatData.avatar);
          } else if (typeof chatData.avatar === 'string' && chatData.avatar.startsWith('data:')) {
            // Конвертируем base64 в Blob
            try {
              const response = await fetch(chatData.avatar);
              const blob = await response.blob();
              formData.append('avatar', blob, 'avatar.jpg');
            } catch (error) {
              console.error('Ошибка при конвертации base64 в Blob:', error);
            }
          }
        }
        // Если аватар передан как отдельный параметр
        else if (avatarData) {
          if (avatarData instanceof File) {
            formData.append('avatar', avatarData);
          } else if (typeof avatarData === 'string' && avatarData.startsWith('data:')) {
            // Конвертируем base64 в Blob
            try {
              const response = await fetch(avatarData);
              const blob = await response.blob();
              formData.append('avatar', blob, 'avatar.jpg');
            } catch (error) {
              console.error('Ошибка при конвертации base64 в Blob:', error);
            }
          }
        }
        
        // Получаем токен из cookie
        const tokenCookie = useCookie('token');
        const clientTokenCookie = useCookie('client_token');
        const token = tokenCookie.value || clientTokenCookie.value;
        
        const config = useRuntimeConfig();
        const response = await fetch(`${config.public.backendUrl}/api/chats/${chatId}`, {
          method: 'PUT',
          headers: {
            'Authorization': token ? `Bearer ${token}` : undefined
          },
          body: formData,
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const updatedChat = await response.json();
        
        // Обновляем чат в списке и активный чат
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          this.chats.splice(chatIndex, 1, { ...this.chats[chatIndex], ...updatedChat });
        }
        
        if (this.activeChat?._id === chatId) {
          this.activeChat = { ...this.activeChat, ...updatedChat };
        }
        
        return updatedChat;
      } catch (error) {
        console.error('Ошибка при обновлении чата:', error);
        this.error = 'Не удалось обновить чат';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Поиск пользователей для добавления в чат
    async searchUsers(query) {
      if (!query || query.length < 2) {
        return [];
      }
      
      try {
        const config = useRuntimeConfig();
        
        // Получаем токен из cookie
        const tokenCookie = useCookie('token');
        const clientTokenCookie = useCookie('client_token');
        const token = tokenCookie.value || clientTokenCookie.value;
        
        // Определяем, используется ли Safari или iOS
        const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        console.log('ChatStore: Поиск пользователей', { query, isSafari, isIOS, hasToken: !!token });
        
        // Используем safeFetch для совместимости с Safari/iOS
        const url = `${config.public.backendUrl}/api/chats/search-users?query=${encodeURIComponent(query)}`;
        const response = await safeFetch(url, {
          method: 'GET',
          headers: {
            'Authorization': token ? `Bearer ${token}` : undefined
          },
          credentials: 'include'
        }).then(res => res.json()).catch(err => {
          console.error('ChatStore: Ошибка при поиске пользователей:', err);
          throw err;
        });
        
        return response;
      } catch (error) {
        console.error('Ошибка при поиске пользователей:', error);
        return [];
      }
    },
    
    // Добавление участников в чат
    async addChatParticipants(chatId, participants) {
      this.loading = true;
      this.error = null;
      
      try {
        const config = useRuntimeConfig();
        const response = await $fetch(`${config.public.backendUrl}/api/chats/${chatId}/participants`, {
          method: 'PUT',
          body: { participants },
          credentials: 'include'
        });
        
        // Обновляем данные чата
        if (this.activeChat && this.activeChat._id === chatId) {
          this.activeChat = response;
        }
        
        // Обновляем чат в списке
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          this.chats.splice(chatIndex, 1, response);
        }
        
        return response;
      } catch (error) {
        console.error('Ошибка при добавлении участников:', error);
        this.error = 'Не удалось добавить участников';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Удаление участника из чата
    async removeChatParticipant(chatId, userId) {
      this.loading = true;
      this.error = null;
      
      try {
        // Проверяем, является ли удаляемый участник текущим пользователем
        const authStore = useAuthStore();
        const isCurrentUser = authStore.user && authStore.user._id === userId;
        
        // Если это текущий пользователь, используем метод leaveChat
        if (isCurrentUser) {
          return await this.leaveChat(chatId);
        }
        
        // Иначе удаляем другого участника (только администратор может это сделать)
        const config = useRuntimeConfig();
        const response = await $fetch(`${config.public.backendUrl}/api/chats/${chatId}/participants/${userId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        // Обновляем данные чата
        if (this.activeChat && this.activeChat._id === chatId) {
          this.activeChat = response;
        }
        
        // Обновляем чат в списке
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          this.chats.splice(chatIndex, 1, response);
        }
        
        // Применяем принудительное обновление списка чатов
        this.triggerChatListUpdate();
        
        return response;
      } catch (error) {
        console.error('Ошибка при удалении участника:', error);
        this.error = 'Не удалось удалить участника';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Выход из чата
    async leaveChat(chatId) {
      this.loading = true;
      this.error = null;
      
      try {
        const config = useRuntimeConfig();
        await $fetch(`${config.public.backendUrl}/api/chats/${chatId}/leave`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        // Удаляем чат из списка для текущего пользователя
        this.chats = this.chats.filter(chat => chat._id !== chatId);
        
        // Если это был активный чат, сбрасываем его
        if (this.activeChat && this.activeChat._id === chatId) {
          this.activeChat = null;
          this.messages = [];
        }
        
        return { success: true };
      } catch (error) {
        console.error('Ошибка при выходе из чата:', error);
        this.error = 'Не удалось выйти из чата';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Удаление чата
    async deleteChat(chatId) {
      this.loading = true;
      this.error = null;
      
      try {
        const config = useRuntimeConfig();
        await $fetch(`${config.public.backendUrl}/api/chats/${chatId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        // Удаляем чат из списка
        this.chats = this.chats.filter(chat => chat._id !== chatId);
        
        // Если это был активный чат, сбрасываем его
        if (this.activeChat && this.activeChat._id === chatId) {
          this.activeChat = null;
          this.messages = [];
        }
        
        return { success: true };
      } catch (error) {
        console.error('Ошибка при удалении чата:', error);
        this.error = 'Не удалось удалить чат';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Отправка сообщения
    async sendMessage({ chatId, text, files = [] }) {
      if (!chatId) return;
      
      // Нормализуем массив файлов
      const normalizedFiles = Array.isArray(files) ? files : [];
      
      console.log('[WebSocket] Проверка данных сообщения:', { 
        text, 
        hasText: !!text && text.trim() !== '', 
        files: normalizedFiles,
        hasFiles: normalizedFiles.length > 0
      });
      
      // Проверка на аудиофайлы
      const hasAudioFiles = normalizedFiles.some(file => 
        file.media_type === 'audio' || 
        file.type === 'audio' || 
        (file.mime_type && file.mime_type.startsWith('audio/'))
      );
      
      // Если есть аудиофайлы, считаем их как медиа
      const hasMedia = normalizedFiles.length > 0 || hasAudioFiles;
      
      // Проверяем, что есть текст или файлы
      if ((!text || text.trim() === '') && !hasMedia) {
          console.error('[WebSocket] Ошибка: Сообщение должно содержать текст или медиа');
          throw new Error('Сообщение должно содержать текст или медиа');
      }
      
      try {
        const config = useRuntimeConfig();
        
        // Получаем токен из cookie
        const tokenCookie = useCookie('token');
        const clientTokenCookie = useCookie('client_token');
        const token = tokenCookie.value || clientTokenCookie.value;
        
        // Определяем, используется ли Safari или iOS
        const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        console.log('[WebSocket] Отправка сообщения в чат:', chatId, { isSafari, isIOS, hasToken: !!token });
        
        // Проверяем, является ли чат превью-чатом
        const isPreviewChat = chatId.startsWith('preview_');
        
        // Если это превью-чат, обрабатываем локально
        if (isPreviewChat) {
          console.log('[WebSocket] Обработка сообщения для превью-чата');
          
          // Вместо поиска в списке чатов, используем превью-чат из хранилища
          if (this.previewChat && this.isPreviewMode) {
            console.log('[WebSocket] Используем превью-чат из хранилища:', this.previewChat);
            
            // Вместо отправки сообщения в превью-чат, создаем реальный чат
            console.log('[WebSocket] Создаем реальный чат из превью-чата с сообщением:', text);
            
            // Вызываем метод sendMessageInPreviewMode, который создает реальный чат и отправляет сообщение
            const newChat = await this.sendMessageInPreviewMode(text, normalizedFiles);
            
            if (newChat) {
              console.log('[WebSocket] Чат успешно создан из превью-чата:', newChat);
              return newChat; // Возвращаем созданный чат
            }
            
            console.error('[WebSocket] Ошибка при создании чата из превью-чата');
            return null;
          }
          
          // Если нет превью-чата в хранилище, пробуем найти его в списке чатов
          const previewChat = this.chats.find(chat => chat._id === chatId);
          
          if (!previewChat) {
            console.error('[WebSocket] Превью-чат не найден:', chatId);
            console.log('[WebSocket] Список доступных чатов:', this.chats.map(c => ({ id: c._id, name: c.name, type: c.type })));
            
            // Если чат не найден в списке, но установлен как активный, используем его
            if (this.activeChat && this.activeChat._id === chatId) {
              console.log('[WebSocket] Используем активный чат как превью-чат');
              
              // Добавляем активный чат в список чатов, если его там нет
              if (!this.chats.some(c => c._id === chatId)) {
                console.log('[WebSocket] Добавляем активный чат в список чатов');
                this.chats.unshift(this.activeChat);
              }
              
              // Получаем authStore
              const authStore = useAuthStore();
              
              if (!authStore || !authStore.user) {
                console.error('[WebSocket] Ошибка: authStore или authStore.user не определены');
                throw new Error('Ошибка аутентификации: пользователь не определен');
              }
              
              // Используем активный чат как превью-чат
              const newMessage = {
                _id: 'temp_' + Date.now(),
                text,
                sender: { _id: authStore.user._id, name: authStore.user.name },
                timestamp: new Date().toISOString(),
                chat: chatId,
                media_type: 'none',
                isLocal: true
              };
              
              // Добавляем сообщение в список сообщений
              this.messages.push(newMessage);
              
              // Обновляем последнее сообщение в чате
              this.activeChat.lastMessage = newMessage;
              this.activeChat.updatedAt = new Date().toISOString();
              
              return newMessage;
            }
            
            throw new Error('Превью-чат не найден');
          }
          
          // Получаем authStore
          const authStore = useAuthStore();
          
          if (!authStore || !authStore.user) {
            console.error('[WebSocket] Ошибка: authStore или authStore.user не определены');
            throw new Error('Ошибка аутентификации: пользователь не определен');
          }
          
          // Создаем локальное сообщение
          const newMessage = {
            _id: 'temp_' + Date.now(),
            text,
            sender: { _id: authStore.user._id, name: authStore.user.name },
            timestamp: new Date().toISOString(),
            chat: chatId,
            media_type: 'none',
            isLocal: true
          };
          
          // Добавляем сообщение в список сообщений
          this.messages.push(newMessage);
          
          // Обновляем последнее сообщение в чате
          previewChat.lastMessage = newMessage;
          previewChat.updatedAt = new Date().toISOString();
          
          // Всегда создаем реальный чат из превью-чата при отправке сообщения
          if (true) {
            console.log('[WebSocket] Создание реального чата из превью');
            
            // Получаем ID пользователя из превью-чата
            let userId = previewChat.previewUserId;
            
            console.log('[WebSocket] ID пользователя из превью-чата:', userId);
            
            // Если ID пользователя не найден, пытаемся получить его из списка участников
            if (!userId && previewChat.participants && previewChat.participants.length > 1) {
              const authStore = useAuthStore();
              const otherUser = previewChat.participants.find(p => {
                return p._id !== authStore.user._id;
              });
              if (otherUser) {
                userId = otherUser._id;
                console.log('[WebSocket] Получен ID пользователя из списка участников:', userId);
              }
            }
            
            // Если ID пользователя все еще не найден, пытаемся получить его из ID чата
            if (!userId && chatId.startsWith('preview_')) {
              userId = chatId.replace('preview_', '');
              console.log('[WebSocket] Получен ID пользователя из ID чата:', userId);
            }
            
            if (!userId) {
              console.error('[WebSocket] Не удалось получить ID пользователя для создания чата');
              return newMessage;
            }
            
            try {
              // Создаем реальный чат с правильным форматом данных
              console.log('[WebSocket] Отправка запроса на создание чата с пользователем:', userId);
              
              const realChat = await this.createChat({
                name: previewChat.name, // Имя чата (имя пользователя)
                type: 'private', // Явно указываем тип 'private'
                participants: [userId], // ID пользователя, с которым создается чат
                initialMessage: text, // Первое сообщение
                description: '' // Пустое описание для приватного чата
              });
              
              // Заменяем превью-чат на реальный в списке чатов
              const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
              if (chatIndex !== -1) {
                this.chats.splice(chatIndex, 1);
              }
              
              // Устанавливаем новый чат как активный
              this.setActiveChat(realChat._id);
              
              return realChat;
            } catch (error) {
              console.error('[WebSocket] Ошибка при создании реального чата:', error);
              // Возвращаем локальное сообщение, если не удалось создать реальный чат
              return newMessage;
            }
          }
          
          return newMessage;
        }
        
        // Для обычных чатов используем стандартную логику
        let response;
        
        if (isSafari || isIOS) {
          // Для Safari/iOS используем специальный прокси для отправки сообщений
          console.log('[WebSocket] Используем прокси для отправки сообщения на iOS');
          
          // Используем локальный прокси для обхода ограничений CORS и аутентификации
          const proxyUrl = '/api/chat-message-proxy';
          
          // Определяем тип медиа для отправки через прокси
          let proxyMediaType = 'none';
          let processedFiles = [];
          
          if (normalizedFiles && normalizedFiles.length > 0) {
            // Определяем тип медиа на основе первого файла
            const firstFile = normalizedFiles[0];
            if (firstFile && firstFile.type && firstFile.type.startsWith('image/')) {
              proxyMediaType = 'image';
            } else if (firstFile && firstFile.type && firstFile.type.startsWith('video/')) {
              proxyMediaType = 'video';
            } else if ((firstFile && firstFile.type && firstFile.type.startsWith('audio/')) || 
                       (firstFile && firstFile.name && (
                         firstFile.name.startsWith('voice_message_') || 
                         firstFile.name.endsWith('.mp3') || 
                         firstFile.name.endsWith('.wav') || 
                         firstFile.name.endsWith('.ogg') || 
                         firstFile.name.endsWith('.webm')
                       ))) {
              proxyMediaType = 'audio';
            } else if (firstFile) {
              proxyMediaType = 'file';
            }
            
            // Преобразуем файлы в формат для отправки
            processedFiles = normalizedFiles.map(file => {
              // Проверяем, является ли файл аудио
              const isAudio = 
                (file.type && file.type.startsWith('audio/')) ||
                (file.name && (
                  file.name.startsWith('voice_message_') || 
                  file.name.endsWith('.mp3') || 
                  file.name.endsWith('.wav') || 
                  file.name.endsWith('.ogg') || 
                  file.name.endsWith('.webm')
                ));
              
              return {
                file_url: file.file_url || file.url || '',
                file_name: file.file_name || file.name || 'File',
                mime_type: file.mime_type || file.type || 'application/octet-stream',
                media_type: file.media_type || 
                          (file.type && file.type.startsWith('image/') ? 'image' : 
                          file.type && file.type.startsWith('video/') ? 'video' : 
                          isAudio ? 'audio' : 'file')
              };
            });
          }
          
          response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              chatId, 
              text, 
              token,
              media_type: proxyMediaType,
              files: processedFiles,
              sender: {
                _id: useAuthStore()?.user?._id,
                name: useAuthStore()?.user?.name
              }
            })
          }).then(async (res) => {
            try {
              if (!res.ok) {
                const errorText = await res.text();
                console.error('[WebSocket] Ошибка при использовании прокси:', errorText);
                throw new Error(`Ошибка ${res.status}: ${errorText}`);
              }
              
              // Получаем текст ответа
              const responseText = await res.text();
              
              try {
                // Проверяем, что ответ похож на JSON
                if (responseText && responseText.trim() && 
                   (responseText.trim().startsWith('{') || responseText.trim().startsWith('['))) {
                  return JSON.parse(responseText);
                } else {
                  console.warn('[WebSocket] Прокси вернул не JSON:', responseText.substring(0, 100));
                  throw new Error('Некорректный формат ответа');
                }
              } catch (parseErr) {
                console.error('[WebSocket] Ошибка парсинга ответа:', parseErr);
                throw parseErr;
              }
            } catch (e) {
              console.error('[WebSocket] Ошибка при обработке ответа:', e);
              throw e;
            }
          }).catch(err => {
            console.error('[WebSocket] Ошибка при использовании прокси:', err);
            
            // Если прокси не сработал, пробуем прямой запрос с токеном в URL
            let url = `${config.public.backendUrl}/api/chats/${chatId}/messages`;
            if (token) {
              url += `?token=${token}`;
            }
            
            return fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : undefined
              },
              body: JSON.stringify({ 
                text, 
                media_type: proxyMediaType, 
                files: processedFiles 
              })
            }).then(res => res.json());
          });
        } else {
          // Для других браузеров используем safeFetch
          console.log('[WebSocket] Отправка сообщения в чат:', chatId, { text, files });
          
          // Если текст пустой, устанавливаем пустую строку
          if (!text || text.trim() === '') {
            text = '';
          }
          
          // Определяем тип медиа на основе файлов
          let media_type = 'none';
          let processedFiles = [];
          
          if (files && files.length > 0) {
            // Проверяем, что у файлов есть необходимые поля
            const validFiles = files.filter(file => {
              // Проверяем наличие URL или file_url
              return file && (file.url || file.file_url);
            });
            
            if (validFiles.length > 0) {
              // Определяем тип медиа на основе первого файла
              const firstFile = validFiles[0];
              if (firstFile.type && firstFile.type.startsWith('image/')) {
                media_type = 'image';
              } else if (firstFile.type && firstFile.type.startsWith('video/')) {
                media_type = 'video';
              } else if ((firstFile.type && firstFile.type.startsWith('audio/')) || 
                         (firstFile.name && (
                           firstFile.name.startsWith('voice_message_') || 
                           firstFile.name.endsWith('.mp3') || 
                           firstFile.name.endsWith('.wav') || 
                           firstFile.name.endsWith('.ogg') || 
                           firstFile.name.endsWith('.webm')
                         ))) {
                media_type = 'audio';
              } else {
                media_type = 'file';
              }
              
              // Преобразуем файлы в формат, ожидаемый сервером
              processedFiles = validFiles.map(file => {
                // Проверяем, является ли файл аудио
                const isAudio = 
                  (file.type && file.type.startsWith('audio/')) ||
                  (file.name && (
                    file.name.startsWith('voice_message_') || 
                    file.name.endsWith('.mp3') || 
                    file.name.endsWith('.wav') || 
                    file.name.endsWith('.ogg') || 
                    file.name.endsWith('.webm')
                  ));
                
                return {
                  file_url: file.file_url || file.url,
                  file_name: file.file_name || file.name || 'File',
                  mime_type: file.mime_type || file.type || 'application/octet-stream',
                  media_type: file.media_type || 
                            (file.type && file.type.startsWith('image/') ? 'image' : 
                            file.type && file.type.startsWith('video/') ? 'video' : 
                            isAudio ? 'audio' : 'file'),
                  thumbnail: file.thumbnail || null
                };
              });
            }
          }
          
          try {
            response = await safeFetch(`${config.public.backendUrl}/api/chats/${chatId}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : undefined
              },
              body: JSON.stringify({ 
                text, 
                media_type: media_type,
                files: processedFiles
              }),
              credentials: 'include'
            }).then(async (res) => {
              if (!res.ok) {
                const errorText = await res.text();
                console.error('[WebSocket] Ошибка при отправке сообщения:', res.status, errorText);
                throw new Error(`Ошибка ${res.status}: ${errorText}`);
              }
              return res.json();
            });
          } catch (error) {
            console.error('[WebSocket] Ошибка при отправке сообщения:', error);
            throw error;
          }
        }
        
        // Сообщение будет добавлено через WebSocket, но на случай если что-то пойдет не так,
        // добавляем его и здесь (WebSocket обработчик проигнорирует дубликат)
        const messageExists = this.messages.some(msg => msg._id === response._id);
        if (!messageExists) {
          this.messages.push(response);
        }
        
        return response;
      } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        throw error;
      }
    },
    
    // Обновление сообщения
    async updateMessage({ chatId, messageId, text, files }) {
      if (!chatId || !messageId) return;
      
      try {
        const config = useRuntimeConfig();
        // Импортируем функцию safeFetch из наших утилит
        const { safeFetch, handleApiResponse } = await import('~/utils/api');
        
        // Подготавливаем данные для запроса
        const requestBody = { edited: true };
        
        // Добавляем текст, если он есть
        if (text !== undefined) {
          requestBody.text = text;
        }
        
        // Добавляем файлы, если они есть
        if (files && files.length > 0) {
          // Определяем тип медиа на основе первого файла
          let media_type = 'none';
          const firstFile = files[0];
          
          if (firstFile.type && firstFile.type.startsWith('image/')) {
            media_type = 'image';
          } else if (firstFile.type && firstFile.type.startsWith('video/')) {
            media_type = 'video';
          } else {
            media_type = 'file';
          }
          
          requestBody.media_type = media_type;
          requestBody.files = files.map(file => ({
            file_url: file.file_url || file.url,
            file_name: file.file_name || file.name || 'File',
            mime_type: file.mime_type || file.type || 'application/octet-stream',
            media_type: file.media_type || 
                      (file.type && file.type.startsWith('image/') ? 'image' : 
                      file.type && file.type.startsWith('video/') ? 'video' : 'file')
          }));
        }
        
        // Используем safeFetch вместо $fetch для совместимости с Safari/iOS
        const response = await safeFetch(`${config.public.backendUrl}/api/chats/${chatId}/messages/${messageId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }).then(res => handleApiResponse(res, 'Ошибка при обновлении сообщения'));
        
        // Обновляем сообщение в локальном списке
        const messageIndex = this.messages.findIndex(msg => msg._id === messageId);
        if (messageIndex !== -1) {
          // Сохраняем все поля из существующего сообщения, которых нет в ответе сервера
          const updatedMessage = { 
            ...this.messages[messageIndex], 
            ...response.message,
            edited: true // Гарантируем, что поле edited установлено
          };
          this.messages.splice(messageIndex, 1, updatedMessage);
          
          // Если это последнее сообщение в чате, обновляем его в списке чатов
          const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
          if (chatIndex !== -1 && this.chats[chatIndex].lastMessage?._id === messageId) {
            // Создаем полное обновленное сообщение для lastMessage
            const updatedLastMessage = {
              ...this.chats[chatIndex].lastMessage,
              ...response.message,
              edited: true // Гарантируем, что поле edited установлено
            };
            
            const updatedChat = { 
              ...this.chats[chatIndex],
              lastMessage: updatedLastMessage
            };
            
            this.chats.splice(chatIndex, 1, updatedChat);
            
            // Принудительно обновляем список чатов для обеспечения реактивности
            this.triggerChatListUpdate();
          }
        }
        
        return response;
      } catch (error) {
        console.error('Ошибка при обновлении сообщения:', error);
        throw error;
      }
    },
    
    // Удаление сообщения
    async deleteMessage({ chatId, messageId }) {
      if (!chatId || !messageId) return;
      
      try {
        const config = useRuntimeConfig();
        
        // Получаем токен из cookie
        const tokenCookie = useCookie('token');
        const clientTokenCookie = useCookie('client_token');
        const token = tokenCookie.value || clientTokenCookie.value;
        
        // Определяем, используется ли Safari или iOS
        const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        console.log('ChatStore: Удаление сообщения', { chatId, messageId, isSafari, isIOS, hasToken: !!token });
        
        // Используем safeFetch для совместимости с Safari/iOS
        await safeFetch(`${config.public.backendUrl}/api/chats/${chatId}/messages/${messageId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': token ? `Bearer ${token}` : undefined
          },
          credentials: 'include'
        });
        
        // Удаляем сообщение из локального списка
        this.messages = this.messages.filter(msg => msg._id !== messageId);
        
        // Если это было последнее сообщение в чате, обновляем список чатов
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1 && this.chats[chatIndex].lastMessage?._id === messageId) {
          // Находим новое последнее сообщение
          const newLastMessage = this.messages
            .filter(msg => msg.chat === chatId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
          
          const updatedChat = {
            ...this.chats[chatIndex],
            lastMessage: newLastMessage || null
          };
          
          this.chats.splice(chatIndex, 1, updatedChat);
          
          // Принудительно обновляем список чатов
          this.triggerChatListUpdate();
        }
        
        return { success: true };
      } catch (error) {
        console.error('Ошибка при удалении сообщения:', error);
        throw error;
      }
    },
    
    // Отметка сообщений как прочитанных
    async markMessagesAsRead(chatId) {
      if (!chatId) return;
      
      try {
        const config = useRuntimeConfig();
        
        // Получаем токен из cookie
        const tokenCookie = useCookie('token');
        const clientTokenCookie = useCookie('client_token');
        const token = tokenCookie.value || clientTokenCookie.value;
        
        // Определяем, используется ли Safari или iOS
        const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        console.log('ChatStore: Отметка сообщений как прочитанных', { chatId, isSafari, isIOS, hasToken: !!token });
        
        // Используем safeFetch для совместимости с Safari/iOS
        await safeFetch(`${config.public.backendUrl}/api/chats/${chatId}/messages/read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : undefined
          },
          credentials: 'include'
        });
        
        // Обновляем счетчик непрочитанных сообщений в списке чатов
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          const updatedChat = { ...this.chats[chatIndex], unread: 0 };
          this.chats.splice(chatIndex, 1, updatedChat);
        }
      } catch (error) {
        console.error('Ошибка при отметке сообщений как прочитанных:', error);
      }
    },
    
    // Определение типа чата (для совместимости со старыми данными)
    getChatType(chat) {
      // Если чат не определен, возвращаем 'group' по умолчанию
      if (!chat) return 'group';
      
      // Если есть поле type, используем его
      if (chat.type) {
        return chat.type;
      }
      
      // Если есть поле isGroup, используем его
      if (typeof chat.isGroup !== 'undefined') {
        return chat.isGroup ? 'group' : 'private';
      }
      
      // Если нет ни type, ни isGroup, определяем тип на основе количества участников
      if (chat.participants && Array.isArray(chat.participants)) {
        // Если в чате больше 2 участников, то это групповой чат
        return chat.participants.length > 2 ? 'group' : 'private';
      }
      
      // По умолчанию считаем чат групповым
      return 'group';
    },
    
    // Проверка, является ли чат приватным
    isPrivateChat(chat) {
      return this.getChatType(chat) === 'private';
    },
    
    // Проверка, является ли чат групповым
    isGroupChat(chat) {
      return this.getChatType(chat) === 'group';
    },
    
    // Метод для плавного обновления списка чатов
    triggerChatListUpdate() {
      console.log('Вызван метод triggerChatListUpdate');
      
      // Сортируем чаты по времени последнего сообщения
      this.sortChatsByLastMessage();
      
      // Обновляем триггер для перерисовки списка
      this.chatListUpdateTrigger++;
      console.log('Обновлен триггер списка чатов:', this.chatListUpdateTrigger);
      
      // Добавляем специальное поле для отслеживания изменений
      this.lastUpdated = Date.now();
    },
    
    // Метод для отключения уведомлений для конкретного чата
    muteChat(chatId) {
      if (!chatId) return;
      
      // Проверяем, что чат еще не в списке отключенных
      if (!this.mutedChats.includes(chatId)) {
        this.mutedChats.push(chatId);
        
        // Сохраняем список в localStorage
        if (process.client) {
          localStorage.setItem('mutedChats', JSON.stringify(this.mutedChats));
        }
      }
    },
    
    // Метод для включения уведомлений для конкретного чата
    unmuteChat(chatId) {
      if (!chatId) return;
      
      // Удаляем чат из списка отключенных
      this.mutedChats = this.mutedChats.filter(id => id !== chatId);
      
      // Сохраняем список в localStorage
      if (process.client) {
        localStorage.setItem('mutedChats', JSON.stringify(this.mutedChats));
      }
    },
    
    // Метод для загрузки списка отключенных чатов из localStorage
    loadMutedChats() {
      if (process.client) {
        const savedMutedChats = localStorage.getItem('mutedChats');
        if (savedMutedChats) {
          try {
            this.mutedChats = JSON.parse(savedMutedChats);
          } catch (error) {
            console.error('Ошибка при загрузке списка отключенных чатов:', error);
            this.mutedChats = [];
          }
        }
      }
    },
    
    // Метод для проверки, отключены ли уведомления для чата
    isChatMuted(chatId) {
      return this.mutedChats.includes(chatId);
    },
    
    // Сортировка чатов по времени последнего сообщения
    sortChatsByLastMessage() {
      console.log('ChatStore: Сортировка чатов по времени последнего сообщения');
      
      // Сортируем чаты по времени последнего сообщения (от новых к старым)
      this.chats.sort((a, b) => {
        // Получаем временные метки последних сообщений
        // Используем разные поля для времени в порядке приоритета
        const getTimestamp = (chat) => {
          if (chat.lastMessage) {
            if (chat.lastMessage.createdAt) {
              return new Date(chat.lastMessage.createdAt).getTime();
            }
            if (chat.lastMessage.timestamp) {
              return new Date(chat.lastMessage.timestamp).getTime();
            }
          }
          if (chat.updatedAt) {
            return new Date(chat.updatedAt).getTime();
          }
          return 0;
        };
        
        const timestampA = getTimestamp(a);
        const timestampB = getTimestamp(b);
        
        // Сортируем по убыванию (от новых к старым)
        return timestampB - timestampA;
      });
      
      // Обновляем триггер для перерисовки списка
      this.chatListUpdateTrigger++;
    },
    
    // Сброс активного чата и связанных данных
    resetActiveChat() {
      console.log('ChatStore: Сброс активного чата');
      this.activeChat = null;
      this.messages = [];
      this.messagesLoading = false;
      this.messagesError = null;
      this.messagesPage = 1;
      this.messagesHasMore = false;
      
      // Сбрасываем также режим предпросмотра, если он был активен
      this.isPreviewMode = false;
      this.previewChat = null;
      
      // Сбрасываем поле неактивного чата
      this.inactiveChatId = null;
    },
    

    
    // Отметить чат как неактивный для уведомлений, но не сбрасывать полностью
    markChatAsInactive() {
      if (this.activeChat) {
        console.log('ChatStore: Отметка чата как неактивного для уведомлений:', this.activeChat._id);
        // Сохраняем ID чата в специальном поле, чтобы знать, что он неактивен для уведомлений
        this.inactiveChatId = this.activeChat._id;
      }
    },
    
    // Показываем SideBar на мобильных устройствах
    showSidebarOnMobile() {
      // Проверяем, что мы на мобильном устройстве (ширина экрана <= 859px)
      const isMobile = window.innerWidth <= 859;
      
      if (isMobile) {
        console.log('ChatStore: Показываем SideBar на мобильном устройстве');
        
        // Получаем доступ к глобальному состоянию SideBar
        const { $sidebarVisible } = useNuxtApp();
        
        // Если доступно, показываем SideBar
        if ($sidebarVisible) {
          $sidebarVisible.value = true;
        }
      }
    },
    
    // Показ уведомления об удалении чата
    showChatDeletedNotification(message) {
      console.log('ChatStore: Показ уведомления об удалении чата:', message);
      
      // Сначала показываем боковую панель, чтобы она появилась сразу
      this.showSidebarOnMobile();
      
      // Затем показываем уведомление
      // Используем глобальный метод для показа уведомлений
      setTimeout(() => {
        if (window.$showNotification) {
          window.$showNotification(message, 'info');
        } else {
          console.log('Глобальный метод $showNotification недоступен, используем запасной вариант');
          
          // Запасной вариант - просто выводим в консоль
          console.log(`Уведомление: Чат удален - ${message}`);
        }
      }, 50); // Добавляем небольшую задержку для гарантии показа боковой панели
    }
  }
});
