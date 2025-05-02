import { defineStore } from 'pinia';
import { useRuntimeConfig } from '#imports';
import { useNuxtApp } from '#app';
import { safeFetch } from '~/utils/safeFetch';
import { useCookie } from '#imports';
import { useAuthStore } from '~/stores/auth';

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
          console.log(`Чат ${messageClone.chat} перемещен в начало списка, lastUpdated обновлен`);
          
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
        
        // Определяем, используется ли Safari или iOS
        const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        // Получаем токен из cookie
        const tokenCookie = useCookie('token');
        const clientTokenCookie = useCookie('client_token');
        const token = tokenCookie.value || clientTokenCookie.value;
        
        console.log('ChatStore: Загрузка чатов', { isSafari, isIOS, hasToken: !!token });
        
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
          participants: chatData.participants || [],
          initialMessage: chatData.initialMessage || ''
        };
        
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
          
          // Находим превью-чат в списке чатов
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
          
          // Создаем реальный чат, если это первое сообщение
          if (previewChat.messages.length === 0) {
            console.log('[WebSocket] Создание реального чата из превью');
            
            // Получаем ID пользователя из превью-чата
            const userId = previewChat.previewUserId;
            
            if (!userId) {
              throw new Error('ID пользователя не найден в превью-чате');
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
          
          response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              chatId, 
              text, 
              token 
            })
          }).then(res => res.json()).catch(err => {
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
              body: JSON.stringify({ text, media_type: 'none' })
            }).then(res => res.json());
          });
        } else {
          // Для других браузеров используем safeFetch
          response = await safeFetch(`${config.public.backendUrl}/api/chats/${chatId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : undefined
            },
            body: JSON.stringify({ text, media_type: 'none' }),
            credentials: 'include'
          }).then(res => res.json());
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
