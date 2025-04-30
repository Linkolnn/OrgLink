import { defineStore } from 'pinia';
import { useRuntimeConfig } from '#imports';
import { useNuxtApp } from '#app';

export const useChatStore = defineStore('chat', {
  state: () => ({
    chats: [],
    activeChat: null,
    messages: [],
    loading: false,
    loadingMore: false,
    error: null,
    pagination: {
      limit: 15, // Уменьшаем начальный лимит для более быстрой загрузки
      total: 0,
      hasMore: false,
      nextCursor: null
    },
    socketConnected: false,
    socketListenersInitialized: false,
    initialLoadComplete: false, // Флаг для отслеживания первоначальной загрузки
    lastUpdated: Date.now(), // Временная метка последнего обновления для отслеживания изменений
  }),
  
  getters: {
    getActiveChat: (state) => state.activeChat,
    getChatMessages: (state) => state.messages,
    getChatById: (state) => (id) => state.chats.find(chat => chat.id === id),
    getTotalUnreadCount: (state) => state.chats.reduce((total, chat) => total + (chat.unread || 0), 0)
  },
  
  actions: {
    // Инициализация WebSocket слушателей
    initSocketListeners() {
      if (this.socketListenersInitialized) {
        console.log('WebSocket слушатели уже инициализированы');
        return;
      }
      
      const { $socket } = useNuxtApp();
      
      if (!$socket) {
        console.error('WebSocket не инициализирован');
        return;
      }
      
      console.log('Инициализация WebSocket слушателей...');
      
      // Удаляем существующие обработчики, чтобы избежать дублирования
      $socket.off('new-message');
      $socket.off('messages-read');
      $socket.off('new-chat');
      $socket.off('chat-updated');
      $socket.off('chat-deleted');
      
      // Слушаем новые сообщения
      $socket.on('new-message', ({ message, chatId }) => {
        console.log('WebSocket: Получено новое сообщение:', message, 'для чата:', chatId);
        
        try {
          // Создаем копию сообщения для добавления в список
          const messageCopy = JSON.parse(JSON.stringify(message));
          
          // Добавляем сообщение в список
          this.addNewMessage(messageCopy);
        } catch (error) {
          console.error('Ошибка при обработке нового сообщения:', error);
        }
      });
      
      // Слушаем прочтение сообщений
      $socket.on('messages-read', ({ chatId, userId }) => {
        console.log('WebSocket: Получено уведомление о прочтении сообщений в чате:', chatId);
        try {
          this.updateMessagesReadStatus(chatId, userId);
        } catch (error) {
          console.error('Ошибка при обработке прочтения сообщений:', error);
        }
      });
      
      // Слушаем создание новых чатов
      $socket.on('new-chat', (chat) => {
        console.log('WebSocket: Получено уведомление о новом чате:', chat);
        try {
          // Создаем копию чата для добавления в список
          const chatCopy = JSON.parse(JSON.stringify(chat));
          this.addNewChat(chatCopy);
          
          // Принудительно обновляем список чатов
          this.triggerChatListUpdate();
        } catch (error) {
          console.error('Ошибка при обработке нового чата:', error);
        }
      });
      
      // Слушаем обновление чатов
      $socket.on('chat-updated', (updatedChat) => {
        console.log('WebSocket: Получено уведомление об обновлении чата:', updatedChat);
        try {
          // Создаем копию чата для обновления в списке
          const chatCopy = JSON.parse(JSON.stringify(updatedChat));
          this.updateChatInList(chatCopy);
          
          // Принудительно обновляем список чатов
          this.triggerChatListUpdate();
        } catch (error) {
          console.error('Ошибка при обработке обновления чата:', error);
        }
      });
      
      // Слушаем удаление чатов
      $socket.on('chat-deleted', (chatId) => {
        console.log('WebSocket: Получено уведомление об удалении чата:', chatId);
        try {
          this.removeChatFromList(chatId);
          
          // Принудительно обновляем список чатов
          this.triggerChatListUpdate();
        } catch (error) {
          console.error('Ошибка при обработке удаления чата:', error);
        }
      });
      
      // Добавляем обработчик события подключения
      $socket.on('connect', () => {
        console.log('WebSocket: Успешное подключение к серверу');
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
          const senderIsCurrentUser = (
            (messageClone.sender && typeof messageClone.sender === 'object' && messageClone.sender._id === currentUserId) ||
            (messageClone.sender && typeof messageClone.sender === 'string' && messageClone.sender === currentUserId)
          );
          
          // Если сообщение не от текущего пользователя и чат не активен
          if (!senderIsCurrentUser && (!this.activeChat || this.activeChat._id !== currentChat._id)) {
            unreadCount++;
            console.log(`Увеличен счетчик непрочитанных сообщений для чата ${currentChat._id} до ${unreadCount}`);
          }
          
          // Обновляем чат на месте без перемещения
          const updatedChat = { 
            ...currentChat,
            lastMessage,
            unread: unreadCount
          };
          
          // Удаляем чат из текущей позиции
          this.chats.splice(chatIndex, 1);
          
          // Добавляем чат в начало списка
          this.chats.unshift(updatedChat);
          
          // Обновляем активный чат, если это тот же чат
          if (this.activeChat && this.activeChat._id === messageClone.chat) {
            this.activeChat = { ...this.activeChat, lastMessage };
          }
          
          // Отмечаем обновление списка чатов
          this.initialLoadComplete = true;
          
          // Обновляем временную метку для отслеживания изменений
          this.lastUpdated = Date.now();
          console.log('Обновлена временная метка lastUpdated');
          
          // Отправляем событие обновления чата для других клиентов
          const { $socket } = useNuxtApp();
          if ($socket && $socket.connected) {
            $socket.emit('client-chat-updated', { chatId: messageClone.chat });
          }
        } else {
          // Если чат не найден в списке, загружаем его с сервера
          console.log('Чат не найден в списке, загружаем информацию о чате');
          this.loadChatById(messageClone.chat);
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
          
          // Если это был активный чат, сбрасываем активный чат
          if (this.activeChat && this.activeChat._id === chatId) {
            this.activeChat = null;
            this.messages = [];
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
      
      // Обновляем lastMessage в активном чате, если это тот же чат
      if (this.activeChat && this.activeChat._id === chatId) {
        this.activeChat.lastMessage = {
          text: message.text || 'Медиа-сообщение',
          sender: message.sender._id,
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
          sender: message.sender._id,
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
        const response = await $fetch(`${config.public.backendUrl}/api/chats`, {
          credentials: 'include'
        });
        
        console.log('ChatStore: Список чатов получен, количество:', response.length);
        
        // Если это первая загрузка, просто устанавливаем список чатов
        if (!this.initialLoadComplete) {
          this.chats = JSON.parse(JSON.stringify(response));
          this.initialLoadComplete = true;
          console.log('ChatStore: Первая загрузка чатов завершена');
        } else {
          // Плавно обновляем список чатов
          const newChats = JSON.parse(JSON.stringify(response));
          
          // Для каждого чата из нового списка
          for (const newChat of newChats) {
            // Проверяем, есть ли чат в текущем списке
            const existingChatIndex = this.chats.findIndex(chat => chat._id === newChat._id);
            
            if (existingChatIndex !== -1) {
              // Если чат уже есть, обновляем его данные, сохраняя счетчик непрочитанных сообщений
              const existingChat = this.chats[existingChatIndex];
              
              // Сохраняем счетчик непрочитанных сообщений
              newChat.unread = existingChat.unread;
              
              // Проверяем, изменилось ли последнее сообщение
              const hasNewMessage = newChat.lastMessage && existingChat.lastMessage && 
                                   (newChat.lastMessage._id !== existingChat.lastMessage._id);
              
              // Если есть новое сообщение, перемещаем чат в начало списка
              if (hasNewMessage) {
                // Удаляем чат из текущей позиции
                this.chats.splice(existingChatIndex, 1);
                // Добавляем чат в начало списка
                this.chats.unshift(newChat);
                console.log('ChatStore: Чат перемещен в начало списка:', newChat.name);
              } else {
                // Просто обновляем данные чата на месте
                this.chats[existingChatIndex] = { ...newChat };
              }
            } else {
              // Если это новый чат, добавляем его в начало списка
              this.chats.unshift(newChat);
              console.log('ChatStore: Добавлен новый чат:', newChat.name);
            }
          }
          
          // Проверяем, есть ли чаты, которые были удалены
          const chatIdsToKeep = newChats.map(chat => chat._id);
          this.chats = this.chats.filter(chat => chatIdsToKeep.includes(chat._id));
        }
        
        // Инициализируем WebSocket слушатели
        this.initSocketListeners();
        
        // Отмечаем обновление списка чатов
        this.triggerChatListUpdate();
        
        // Обновляем временную метку для отслеживания изменений
        this.lastUpdated = Date.now();
        console.log('ChatStore: Обновлена временная метка lastUpdated');
        
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
        const response = await $fetch(`${config.public.backendUrl}/api/chats`, {
          method: 'POST',
          body: chatData,
          credentials: 'include'
        });
        
        // Добавляем новый чат в список и делаем его активным
        this.chats.unshift(response);
        this.setActiveChat(response._id);
        
        return response;
      } catch (error) {
        console.error('Ошибка при создании чата:', error);
        this.error = 'Не удалось создать чат';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Установка активного чата
    async setActiveChat(chatId) {
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
        
        const response = await $fetch(`${config.public.backendUrl}/api/chats/${chatId}/messages`, {
          credentials: 'include',
          params
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
    async updateChat(chatId, chatData) {
      this.loading = true;
      this.error = null;
      
      try {
        // Создаем FormData для отправки файлов
        const formData = new FormData();
        
        // Добавляем текстовые поля
        if (chatData.name) formData.append('name', chatData.name);
        if (chatData.description !== undefined) formData.append('description', chatData.description);
        
        // Добавляем аватар, если он есть
        if (chatData.avatar && chatData.avatar instanceof File) {
          formData.append('avatar', chatData.avatar);
        }
        
        const config = useRuntimeConfig();
        const response = await fetch(`${config.public.backendUrl}/api/chats/${chatId}`, {
          method: 'PUT',
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
        const response = await $fetch(`${config.public.backendUrl}/api/chats/search-users`, {
          params: { query },
          credentials: 'include'
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
    async sendMessage({ chatId, text }) {
      if (!chatId) return;
      
      try {
        const config = useRuntimeConfig();
        const response = await $fetch(`${config.public.backendUrl}/api/chats/${chatId}/messages`, {
          method: 'POST',
          body: { text, media_type: 'none' },
          credentials: 'include'
        });
        
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
    async updateMessage({ chatId, messageId, text }) {
      if (!chatId || !messageId) return;
      
      try {
        const config = useRuntimeConfig();
        const response = await $fetch(`${config.public.backendUrl}/api/chats/${chatId}/messages/${messageId}`, {
          method: 'PUT',
          body: { text },
          credentials: 'include'
        });
        
        // Обновляем сообщение в локальном списке
        const messageIndex = this.messages.findIndex(msg => msg._id === messageId);
        if (messageIndex !== -1) {
          const updatedMessage = { ...this.messages[messageIndex], text };
          this.messages.splice(messageIndex, 1, updatedMessage);
          
          // Если это последнее сообщение в чате, обновляем его в списке чатов
          const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
          if (chatIndex !== -1 && this.chats[chatIndex].lastMessage?._id === messageId) {
            const updatedChat = { 
              ...this.chats[chatIndex],
              lastMessage: { 
                ...this.chats[chatIndex].lastMessage,
                text 
              }
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
        await $fetch(`${config.public.backendUrl}/api/chats/${chatId}/messages/${messageId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        // Удаляем сообщение из локального списка
        this.messages = this.messages.filter(msg => msg._id !== messageId);
        
        // Если это было последнее сообщение в чате, обновляем список чатов
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1 && this.chats[chatIndex].lastMessage?._id === messageId) {
          // Находим новое последнее сообщение
          const newLastMessage = [...this.messages]
            .filter(msg => msg.chat === chatId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
          
          const updatedChat = { 
            ...this.chats[chatIndex],
            lastMessage: newLastMessage || null
          };
          
          this.chats.splice(chatIndex, 1, updatedChat);
          
          // Принудительно обновляем список чатов для обеспечения реактивности
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
        await $fetch(`${config.public.backendUrl}/api/chats/${chatId}/messages/read`, {
          method: 'POST',
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
    
    // Метод для плавного обновления списка чатов
    triggerChatListUpdate() {
      console.log('ChatStore: Плавное обновление списка чатов');
      
      // Отправляем событие обновления списка чатов
      const { $socket } = useNuxtApp();
      if ($socket) {
        $socket.emit('client-chat-list-updated');
      }
      
      // Добавляем специальное поле для отслеживания изменений
      this.lastUpdated = new Date().getTime();
      
      console.log('ChatStore: Список чатов обновлен, количество:', this.chats.length);
    }
  }
});
