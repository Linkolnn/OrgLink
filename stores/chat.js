import { defineStore } from 'pinia';
import { useRuntimeConfig } from '#imports';

export const useChatStore = defineStore('chat', {
  state: () => ({
    chats: [],
    activeChat: null,
    messages: [],
    loading: false,
    error: null,
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      pages: 0
    }
  }),
  
  getters: {
    getActiveChat: (state) => state.activeChat,
    getChatMessages: (state) => state.messages,
    getChatById: (state) => (id) => state.chats.find(chat => chat.id === id),
    getTotalUnreadCount: (state) => state.chats.reduce((total, chat) => total + (chat.unread || 0), 0)
  },
  
  actions: {
    // Загрузка списка чатов
    async fetchChats() {
      this.loading = true;
      this.error = null;
      
      try {
        const config = useRuntimeConfig();
        const response = await $fetch(`${config.public.backendUrl}/api/chats`, {
          credentials: 'include'
        });
        
        this.chats = response;
      } catch (error) {
        console.error('Ошибка при загрузке чатов:', error);
        this.error = 'Не удалось загрузить список чатов';
      } finally {
        this.loading = false;
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
      if (this.activeChat?._id === chatId) return;
      
      this.loading = true;
      this.error = null;
      this.messages = [];
      this.pagination = {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
      };
      
      try {
        const config = useRuntimeConfig();
        
        // Получаем информацию о чате
        const chatResponse = await $fetch(`${config.public.backendUrl}/api/chats/${chatId}`, {
          credentials: 'include'
        });
        
        this.activeChat = chatResponse;
        
        // Обновляем чат в списке чатов
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          this.chats[chatIndex] = { ...this.chats[chatIndex], ...chatResponse };
        }
        
        // Загружаем сообщения чата
        await this.fetchMessages(chatId);
        
        // Отмечаем сообщения как прочитанные
        await this.markMessagesAsRead(chatId);
      } catch (error) {
        console.error('Ошибка при установке активного чата:', error);
        this.error = 'Не удалось загрузить информацию о чате';
        this.activeChat = null;
      } finally {
        this.loading = false;
      }
    },
    
    // Загрузка сообщений чата
    async fetchMessages(chatId, page = 1) {
      if (!chatId) return;
      
      this.loading = true;
      
      try {
        const config = useRuntimeConfig();
        
        const response = await $fetch(`${config.public.backendUrl}/api/chats/${chatId}/messages`, {
          params: {
            page,
            limit: this.pagination.limit
          },
          credentials: 'include'
        });
        
        // Если это первая страница, заменяем сообщения
        // Иначе добавляем в начало списка (так как сообщения приходят от новых к старым)
        if (page === 1) {
          this.messages = response.messages;
        } else {
          this.messages = [...response.messages, ...this.messages];
        }
        
        this.pagination = response.pagination;
      } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
        this.error = 'Не удалось загрузить сообщения';
      } finally {
        this.loading = false;
      }
    },
    
    // Загрузка предыдущих сообщений (для бесконечной прокрутки)
    async loadMoreMessages() {
      if (!this.activeChat || this.pagination.page >= this.pagination.pages) return;
      
      await this.fetchMessages(this.activeChat._id, this.pagination.page + 1);
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
        
        const response = await fetch(`/api/chats/${chatId}`, {
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
          this.chats[chatIndex] = { ...this.chats[chatIndex], ...updatedChat };
        }
        
        if (this.activeChat?._id === chatId) {
          this.activeChat = updatedChat;
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
        const response = await fetch(`/api/chats/search-users?query=${encodeURIComponent(query)}`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        return await response.json();
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
        const response = await fetch(`/api/chats/${chatId}/participants`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ participants }),
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const updatedChat = await response.json();
        
        // Обновляем чат в списке и активный чат
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          this.chats[chatIndex] = { ...this.chats[chatIndex], ...updatedChat };
        }
        
        if (this.activeChat?._id === chatId) {
          this.activeChat = updatedChat;
        }
        
        return updatedChat;
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
        const response = await fetch(`/api/chats/${chatId}/participants/${userId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Если чат был удален
        if (result.message && result.message.includes('удален')) {
          // Удаляем чат из списка
          this.chats = this.chats.filter(chat => chat._id !== chatId);
          
          // Если это был активный чат, сбрасываем его
          if (this.activeChat?._id === chatId) {
            this.activeChat = null;
            this.messages = [];
          }
          
          return { deleted: true, message: result.message };
        }
        
        // Обновляем чат в списке и активный чат
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          this.chats[chatIndex] = { ...this.chats[chatIndex], ...result };
        }
        
        if (this.activeChat?._id === chatId) {
          this.activeChat = result;
        }
        
        return result;
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
        const response = await fetch(`/api/chats/${chatId}/leave`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Удаляем чат из списка
        this.chats = this.chats.filter(chat => chat._id !== chatId);
        
        // Если это был активный чат, сбрасываем его
        if (this.activeChat?._id === chatId) {
          this.activeChat = null;
          this.messages = [];
        }
        
        return result;
      } catch (error) {
        console.error('Ошибка при выходе из чата:', error);
        this.error = 'Не удалось выйти из чата';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Отправка сообщения
    async sendMessage(chatId, messageData) {
      try {
        const config = useRuntimeConfig();
        
        const response = await $fetch(`${config.public.backendUrl}/api/chats/${chatId}/messages`, {
          method: 'POST',
          body: messageData,
          credentials: 'include'
        });
        
        // Проверяем, не дублируется ли сообщение
        const isDuplicate = this.messages.some(msg => msg._id === response._id);
        if (!isDuplicate) {
          // Добавляем сообщение в конец списка
          this.messages.push(response);
        }
        
        // Обновляем последнее сообщение в чате
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          this.chats[chatIndex].lastMessage = {
            text: messageData.text || 'Медиа-сообщение',
            sender: response.sender,
            timestamp: new Date()
          };
          
          // Перемещаем чат в начало списка
          const chat = this.chats.splice(chatIndex, 1)[0];
          this.chats.unshift(chat);
        }
        
        return response;
      } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        throw error;
      }
    },
    
    // Отметка сообщений как прочитанных
    async markMessagesAsRead(chatId) {
      try {
        const config = useRuntimeConfig();
        
        const response = await $fetch(`${config.public.backendUrl}/api/chats/${chatId}/messages/read`, {
          method: 'PUT',
          credentials: 'include'
        });
        
        // Обнуляем счетчик непрочитанных сообщений в чате
        const chatIndex = this.chats.findIndex(chat => chat._id === chatId);
        if (chatIndex !== -1) {
          this.chats[chatIndex].unread = 0;
        }
        
        return response;
      } catch (error) {
        console.error('Ошибка при отметке сообщений как прочитанных:', error);
      }
    }
  }
});
