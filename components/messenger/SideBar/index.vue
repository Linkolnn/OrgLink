<template>
  <aside class="sidebar">
    <header class="sidebar__header">
      <div class="sidebar__actions">
        <MessengerSideBarMenu />
        <h3 class="sidebar__title">Чаты</h3>
      </div>
      <!-- Добавляем компонент поиска -->
      <MessengerSideBarSearch />
    </header>
    <div class="sidebar__content">
      <div v-if="chatStore.loading && !chatStore.chats.length" class="sidebar__loading">
        <div class="sidebar__spinner"></div>
        <p class="sidebar__message">Загрузка чатов...</p>
      </div>
      <div v-else-if="chatStore.chats.length === 0" class="sidebar__empty">
        <p class="sidebar__message">У вас пока нет чатов</p>
        <button class="sidebar__button sidebar__button--create" @click="createNewChat">Создать чат</button>
      </div>
      <div v-else ref="chatListRef" class="sidebar__chats">
        <MessengerSideBarChatCard
          v-for="chat in chats" 
          :key="chat._id" 
          :chat="chat"
          :is-active="chatStore.activeChat?._id === chat._id"
          @select="selectChat"
        />
      </div>
    </div>
    
    <!-- Модальное окно создания чата -->
    <ChatCreateModal
      v-if="showCreateChatModal"
      :is-open="showCreateChatModal"
      :is-new-chat="true"
      @close="showCreateChatModal = false"
      @saved="onChatCreated"
    />
    <MessengerSideBarBtnGroupCreate
      :is-connected="isConnected" 
      @create-chat="createNewChat" 
    />
  </aside>
</template>

<script setup>
import { useChatStore } from '~/stores/chat';

const chatStore = useChatStore();
// Флаг для отслеживания состояния WebSocket соединения
const isConnected = ref(false);

// Определяем, является ли устройство мобильным
const isMobile = ref(false);

// Проверяем размер экрана при монтировании
onMounted(() => {
isMobile.value = window.innerWidth <= 859;
window.addEventListener('resize', () => {
  isMobile.value = window.innerWidth <= 859;
});
});

// Состояние модального окна создания чата
const showCreateChatModal = ref(false);

// Интервал обновления списка чатов (в миллисекундах)
const CHAT_UPDATE_INTERVAL = 10000; // 10 секунд

// Интервал обновления
let chatUpdateInterval = null;

// Инициализируем поле lastUpdated в хранилище чатов, если оно не существует
if (chatStore.lastUpdated === undefined) {
chatStore.lastUpdated = new Date().getTime();
}

// Инициализация WebSocket слушателей при монтировании компонента
onMounted(() => {
console.log('SideBar: Компонент монтирован');

// Инициализируем слушатели WebSocket
chatStore.initSocketListeners();

// Загружаем список чатов, если он еще не загружен
if (!chatStore.initialLoadComplete) {
  chatStore.fetchChats();
}

// Запускаем периодический опрос сервера для обновления списка чатов
chatUpdateInterval = setInterval(() => {
  console.log('SideBar: Периодическое обновление списка чатов');
  chatStore.fetchChats();
}, CHAT_UPDATE_INTERVAL);

// Получаем ссылку на Socket.IO
const { $socket, $socketConnect } = useNuxtApp();

if ($socket) {
  // Прямая подписка на события WebSocket для обновления списка чатов
  // Обработчик события нового сообщения
  $socket.on('new-message', ({ message }) => {
    console.log('SideBar: Получено новое сообщение через WebSocket:', message);
    
    // Проверяем, от текущего ли пользователя сообщение
    const { $auth } = useNuxtApp();
    const currentUserId = $auth?.user?._id;
    const senderIsCurrentUser = (
      (message.sender && typeof message.sender === 'object' && message.sender._id === currentUserId) ||
      (message.sender && typeof message.sender === 'string' && message.sender === currentUserId)
    );
    
    // Получаем имя отправителя
    let senderName = '';
    if (message.sender) {
      if (typeof message.sender === 'object') {
        senderName = message.sender.name || message.sender.username || '';
      }
    }
    
    // Формируем текст сообщения
    const messageText = message.text || 'Медиа-сообщение';
    const displayText = senderName ? `${senderName}: ${messageText}` : messageText;
    const timeFormatted = formatTime(new Date(message.createdAt || new Date()));
    
    try {
      // Находим чат в списке
      const chatId = message.chat;
      if (!chatId) {
        console.error('SideBar: Отсутствует ID чата в сообщении:', message);
        return;
      }
      
      const chatIndex = chatStore.chats.findIndex(c => c._id === chatId);
      console.log(`SideBar: Поиск чата ${chatId} в списке, индекс:`, chatIndex);
      
      if (chatIndex !== -1) {
        // Получаем текущий чат
        const chat = { ...chatStore.chats[chatIndex] };
        
        // Определяем, нужно ли увеличивать счетчик непрочитанных сообщений
        let unreadCount = chat.unread || 0;
        const isActiveChat = chatStore.activeChat && chatStore.activeChat._id === chatId;
        
        // Если сообщение не от текущего пользователя и чат не активен
        if (!senderIsCurrentUser && !isActiveChat) {
          unreadCount++;
          console.log(`SideBar: Увеличен счетчик непрочитанных сообщений для чата ${chatId} до ${unreadCount}`);
        }
        
        // Создаем объект последнего сообщения
        const lastMessage = {
          ...message,
          text: messageText,
          timestamp: message.createdAt || new Date().toISOString()
        };
        
        // Создаем обновленный чат
        const updatedChat = { 
          ...chat,
          lastMessage,
          unread: unreadCount
        };
        
        // Удаляем чат из текущей позиции
        chatStore.chats.splice(chatIndex, 1);
        
        // Добавляем чат в начало списка
        chatStore.chats.unshift(updatedChat);
        
        // Обновляем временную метку
        chatStore.lastUpdated = Date.now();
        forceUpdate.value++;
        
        console.log(`SideBar: Чат ${chatId} перемещен в начало списка, lastUpdated обновлен, forceUpdate увеличен`);
        
        // Обновляем активный чат, если это тот же чат
        if (isActiveChat) {
          chatStore.activeChat = { ...chatStore.activeChat, lastMessage };
        }
        
        // Немедленно обновляем DOM для отображения изменений в реальном времени
        // Используем микрозадачу для гарантии выполнения после обновления DOM
        setTimeout(() => {
          try {
            // Находим чат в DOM
            const chatItem = document.querySelector(`[data-chat-id="${chatId}"]`);
            if (!chatItem) {
              console.error(`SideBar: Не найден элемент чата с ID ${chatId} в DOM`);
              return;
            }
            
            console.log(`SideBar: Найден элемент чата в DOM:`, chatItem);
            
            // Обновляем текст сообщения
            const messageEl = chatItem.querySelector('.chat-item__message');
            if (messageEl) {
              // Проверяем, является ли сообщение служебным
              const isServiceMessage = message.type === 'service' || (
                message.text && [
                  /создал групповой чат/i,
                  /покинул чат/i,
                  /удалил из чата/i,
                  /добавил в чат/i,
                  /был удален из чата/i,
                  /был добавлен в чат/i,
                  /добавил в чат пользователей/i,
                  /добавил в чат пользователя/i
                ].some(pattern => pattern.test(message.text))
              );
              
              // Если это служебное сообщение, добавляем класс и обновляем содержимое
              if (isServiceMessage) {
                messageEl.classList.add('chat-item__message--service');
                
                // Проверяем, есть ли спан для служебного сообщения
                let serviceSpan = messageEl.querySelector('span:first-child');
                if (!serviceSpan) {
                  // Если нет, создаем новую структуру
                  messageEl.innerHTML = `<span>${message.text}</span>`;
                } else {
                  // Если есть, обновляем текст
                  serviceSpan.textContent = message.text;
                }
              } else {
                messageEl.classList.remove('chat-item__message--service');
                
                // Проверяем, есть ли спан для обычного сообщения
                let normalSpan = messageEl.querySelector('span:last-child');
                if (!normalSpan) {
                  // Если нет, создаем новую структуру
                  messageEl.innerHTML = `<span>${displayText}</span>`;
                } else {
                  // Если есть, обновляем текст
                  normalSpan.textContent = displayText;
                }
              }
              
              console.log(`SideBar: Обновлен текст сообщения в DOM:`, isServiceMessage ? message.text : displayText);
            }
            
            // Обновляем время
            const timeEl = chatItem.querySelector('.chat-item__time');
            if (timeEl) {
              timeEl.textContent = timeFormatted;
              console.log(`SideBar: Обновлено время в DOM:`, timeFormatted);
            }
            
            // Обновляем счетчик непрочитанных сообщений
            if (unreadCount > 0) {
              const metaEl = chatItem.querySelector('.chat-item__meta');
              if (!metaEl) {
                console.error(`SideBar: Не найден элемент .chat-item__meta в чате ${chatId}`);
                return;
              }
              
              let badgeEl = chatItem.querySelector('.chat-item__badge');
              
              if (!badgeEl) {
                // Создаем новый элемент счетчика
                badgeEl = document.createElement('div');
                badgeEl.className = 'chat-item__badge';
                metaEl.insertBefore(badgeEl, metaEl.firstChild);
                console.log(`SideBar: Создан новый элемент счетчика для чата ${chatId}`);
              }
              
              badgeEl.textContent = unreadCount;
              badgeEl.style.display = 'flex';
              console.log(`SideBar: Обновлен счетчик непрочитанных сообщений в DOM для чата ${chatId}: ${unreadCount}`);
            }
            
            // Перемещаем чат в начало списка
            const chatList = chatListRef.value;
            if (chatList && chatList.firstChild && chatList.firstChild !== chatItem) {
              chatList.insertBefore(chatItem, chatList.firstChild);
              console.log(`SideBar: Чат ${chatId} перемещен в начало списка в DOM`);
            }
          } catch (error) {
            console.error('SideBar: Ошибка при обновлении DOM:', error);
          }
        }, 50); // Небольшая задержка для гарантии обновления DOM
      } else {
        // Если чат не найден, добавляем сообщение в хранилище и обновляем список чатов
        console.log(`SideBar: Чат ${chatId} не найден в списке, обновляем список чатов`);
        chatStore.addNewMessage(message);
        chatStore.fetchChats();
      }
    } catch (error) {
      console.error('SideBar: Ошибка при обработке нового сообщения:', error);
      
      // В случае ошибки пытаемся обновить список чатов
      try {
        chatStore.addNewMessage(message);
        forceUpdate.value++;
      } catch (innerError) {
        console.error('SideBar: Ошибка при попытке восстановления после ошибки:', innerError);
      }
    }
    
    // Дополнительный код для обработки сообщений в активном чате
    if (chatStore.activeChat && chatStore.activeChat._id === message.chat) {
      // Если сообщение пришло в активный чат, обновляем активный чат
      chatStore.activeChat.lastMessage = {
        ...message,
        text: message.text || 'Медиа-сообщение',
        timestamp: message.createdAt || new Date().toISOString()
      };
      
      // Отмечаем сообщения как прочитанные
      chatStore.readMessages(message.chat);
    }
    
    // Принудительно обновляем список чатов
    forceUpdate.value++;
  });
  
  $socket.on('new-chat', (chat) => {
    console.log('SideBar: Получен новый чат:', chat);
    // Принудительно обновляем список чатов
    forceUpdate.value++;
  });
  
  $socket.on('chat-updated', (chat) => {
    console.log('SideBar: Чат обновлен:', chat);
    
    // Находим чат в списке
    const chatIndex = chatStore.chats.findIndex(c => c._id === chat._id);
    if (chatIndex !== -1) {
      // Сохраняем текущий счетчик непрочитанных сообщений
      const currentUnread = chatStore.chats[chatIndex].unread || 0;
      const updatedChat = { ...chat, unread: currentUnread };
      
      // Удаляем чат из текущей позиции
      chatStore.chats.splice(chatIndex, 1);
      
      // Добавляем чат в начало списка
      chatStore.chats.unshift(updatedChat);
      
      // Обновляем временную метку
      chatStore.lastUpdated = Date.now();
      
      // Немедленно обновляем DOM
      setTimeout(() => {
        const chatItem = document.querySelector(`[data-chat-id="${chat._id}"]`);
        if (chatItem) {
          // Перемещаем чат в начало списка
          const chatList = chatListRef.value;
          if (chatList && chatList.firstChild !== chatItem) {
            chatList.insertBefore(chatItem, chatList.firstChild);
            console.log(`SideBar: Чат ${chat._id} перемещен в начало списка в DOM при обновлении`);
          }
          
          // Обновляем счетчик непрочитанных сообщений
          if (currentUnread > 0) {
            let badgeEl = chatItem.querySelector('.chat-item__badge');
            const metaEl = chatItem.querySelector('.chat-item__meta');
            
            if (!badgeEl && metaEl) {
              badgeEl = document.createElement('div');
              badgeEl.className = 'chat-item__badge';
              metaEl.insertBefore(badgeEl, metaEl.firstChild);
            }
            
            if (badgeEl) {
              badgeEl.textContent = currentUnread;
              badgeEl.style.display = 'flex';
            }
          }
        }
      }, 0);
    } else {
      // Если чат не найден, принудительно обновляем список чатов
      forceUpdate.value++;
    }
  });
  
  $socket.on('chat-deleted', (chatId) => {
    console.log('SideBar: Чат удален:', chatId);
    // Принудительно обновляем список чатов
    forceUpdate.value++;
  });
  
  // Обработка событий подключения и отключения
  $socket.on('connect', () => {
    console.log('SideBar: WebSocket подключен');
    isConnected.value = true;
    
    // При подключении обновляем список чатов
    chatStore.fetchChats();
  });
  
  // Обработка события обновления списка чатов от других клиентов
  $socket.on('client-chat-list-updated', () => {
    console.log('SideBar: Получено событие обновления списка чатов от другого клиента');
    // Принудительно обновляем список чатов
    forceUpdate.value++;
  });
  
  // Обработка события обновления конкретного чата
  $socket.on('client-chat-updated', ({ chatId }) => {
    console.log('SideBar: Получено событие обновления чата:', chatId);
    
    // Находим чат в списке
    const chat = chatStore.chats.find(c => c._id === chatId);
    
    if (chat && chat.lastMessage) {
      // Обновляем элементы в DOM
      setTimeout(() => {
        const messageEl = document.getElementById(`chat-message-${chatId}`);
        const timeEl = document.getElementById(`chat-time-${chatId}`);
        
        if (messageEl) {
          messageEl.textContent = chat.lastMessage.text || 'Медиа-сообщение';
          console.log('SideBar: Обновлен текст сообщения в DOM:', chat.lastMessage.text);
        }
        
        if (timeEl && chat.lastMessage.timestamp) {
          const formattedTime = formatTime(new Date(chat.lastMessage.timestamp));
          timeEl.textContent = formattedTime;
          console.log('SideBar: Обновлено время в DOM:', formattedTime);
        }
        
        // Перемещаем чат в начало списка
        const chatItem = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (chatItem && chatListRef.value) {
          chatListRef.value.insertBefore(chatItem, chatListRef.value.firstChild);
          console.log('SideBar: Чат перемещен в начало списка');
        }
      }, 100);
    }
    
    // Принудительно обновляем список чатов
    forceUpdate.value++;
  });
  
  $socket.on('disconnect', () => {
    console.log('SideBar: WebSocket отключен');
    isConnected.value = false;
  });
  
  $socket.on('reconnect', () => {
    console.log('SideBar: WebSocket переподключен');
    isConnected.value = true;
    
    // При переподключении обновляем список чатов
    chatStore.fetchChats();
  });
  
  // Проверяем текущее состояние соединения
  isConnected.value = $socket.connected;
  console.log('SideBar: Текущее состояние соединения:', isConnected.value);
  
  if (!$socket.connected && $socketConnect) {
    console.log('SideBar: Попытка подключения WebSocket');
    $socketConnect();
  }
}
});

// Очищаем интервал при размонтировании компонента
onBeforeUnmount(() => {
console.log('SideBar: Компонент размонтируется');

// Очищаем интервал обновления списка чатов
if (chatUpdateInterval) {
  clearInterval(chatUpdateInterval);
  chatUpdateInterval = null;
}
});

// Используем ref для принудительного обновления компонента
const forceUpdate = ref(0);

// Следим за изменениями в списке чатов
// Используем computed для обеспечения реактивности
const chats = computed(() => {
// Отслеживаем изменения в lastUpdated и forceUpdate
const lastUpdated = chatStore.lastUpdated;
const updateTrigger = forceUpdate.value;
console.log('SideBar: Вычисление списка чатов, lastUpdated:', lastUpdated, 'forceUpdate:', updateTrigger);

// Проверяем, есть ли чаты в хранилище
if (!chatStore.chats || chatStore.chats.length === 0) {
  return [];
}

// Создаем копию списка чатов для обработки
const chatsCopy = JSON.parse(JSON.stringify(chatStore.chats));

// Обрабатываем каждый чат для отображения в интерфейсе
return chatsCopy.map(chat => {
  // Получаем имя отправителя последнего сообщения
  let senderName = '';
  if (chat.lastMessage?.sender) {
    if (typeof chat.lastMessage.sender === 'object') {
      senderName = chat.lastMessage.sender.name || chat.lastMessage.sender.username || '';
    } else if (chat.members) {
      // Если отправитель указан как ID, пытаемся найти его в списке участников
      const member = chat.members.find(m => m._id === chat.lastMessage.sender);
      if (member) {
        senderName = member.name || member.username || '';
      }
    }
  }
  
  // Формируем текст последнего сообщения с именем отправителя
  const messageText = chat.lastMessage?.text || 'Нет сообщений';
  const lastMessageText = senderName ? `${senderName}: ${messageText}` : messageText;
  
  // Убеждаемся, что счетчик непрочитанных сообщений есть число
  const unread = typeof chat.unread === 'number' ? chat.unread : 0;
  
  // Делаем лог для отладки
  if (unread > 0) {
    console.log(`Чат ${chat._id} имеет ${unread} непрочитанных сообщений`);
  }
  
  return {
    ...chat,
    _id: chat._id,
    lastMessageText,
    unread,
    formattedTime: chat.lastMessage?.timestamp ? formatTime(new Date(chat.lastMessage.timestamp)) : ''
  };
});
});

// Следим за изменениями в списке чатов
watch(() => chatStore.lastUpdated, (newValue, oldValue) => {
console.log(`SideBar: Обнаружено обновление списка чатов: ${oldValue} -> ${newValue}`);

// Принудительно обновляем компонент
forceUpdate.value++;
});

// Выбор чата
const selectChat = (chatId) => {
  chatStore.setActiveChat(chatId);
  navigateTo('/messenger');

// На мобильных устройствах переключаем на чат
  setTimeout(() => {
        if (isMobile.value) {
        showChat();
      }
  }, 150);
};

// Создание нового чата
const createNewChat = () => {
showCreateChatModal.value = true;
};

// Обработка создания чата
const onChatCreated = (chat) => {
showCreateChatModal.value = false;
// Чат уже добавлен в хранилище и установлен как активный
};

// Функция для показа чата на мобильных устройствах
const showChat = () => {
const nuxtApp = useNuxtApp();
if (nuxtApp.$sidebarVisible) {
  nuxtApp.$sidebarVisible.value = false;
}
};

// Добавляем слушатель для принудительного обновления компонента при получении новых сообщений
const chatListRef = ref(null);

onMounted(() => {
const { $socket } = useNuxtApp();

// Слушаем новые сообщения в сокете
if ($socket) {
  // Удаляем существующий слушатель, чтобы избежать дублирования
  $socket.off('new-message');
  
  $socket.on('new-message', ({ message, chatId }) => {
    // Принудительно обновляем компонент
    forceUpdate.value++;
    
    // Обновляем DOM элементы для нового сообщения
    setTimeout(() => {
      // Находим чат в списке
      const chatIndex = chatStore.chats.findIndex(chat => chat._id === chatId);
      
      if (chatIndex !== -1) {
        const chat = chatStore.chats[chatIndex];
        const messageText = message.text || 'Медиа-сообщение';
        const timeFormatted = formatTime(new Date(message.createdAt || new Date()));
        
        // Обновляем текст сообщения и время
        const messageEl = document.getElementById(`chat-message-${chatId}`);
        const timeEl = document.getElementById(`chat-time-${chatId}`);
        
        if (messageEl) {
          messageEl.textContent = messageText;
        }
        
        if (timeEl) {
          timeEl.textContent = timeFormatted;
        }
        
        // Перемещаем чат в начало списка
        const chatItem = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (chatItem && chatListRef.value) {
          chatListRef.value.insertBefore(chatItem, chatListRef.value.firstChild);
        }
      }
    }, 100);
  });
}
});

// Форматирование времени
const formatTime = (date) => {
if (!date) return '';

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

if (date >= today) {
  // Сегодня - показываем только время
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
} else if (date >= yesterday) {
  // Вчера
  return 'Вчера';
} else {
  // Другие дни - показываем дату
  return date.toLocaleDateString([], { day: 'numeric', month: 'numeric' });
}
};
</script>

<style lang="sass">
@import '@variables'

// Стили для адаптивного дизайна
.sidebar
  position: relative
  width: $sidebar-width
  height: 100vh
  background: $header-bg
  color: $white
  display: flex
  flex-direction: column
  transition: transform $transition-speed $transition-function
  border-right: 1px solid rgba($white, 0.1)
  @include custom-scrollbar
  
  @include tablet
    position: absolute
    left: 0
    top: 0
    z-index: 5
    width: 100%
    transform: translateX(-100%)
    
    &.visible
      transform: translateX(0)
  
  &__header
    padding: 15px
    display: flex
    flex-direction: column
    position: relative
    justify-content: space-between
    gap: 10px

    .search
      flex: 1

  &__actions
    display: flex
    flex-direction: row
    gap: 20px
    padding-left: 5px
    
  
  &__content
    flex: 1
    display: flex
    flex-direction: column
    padding: 0px
  
  &__empty, &__loading
    display: flex
    flex-direction: column
    align-items: center
    justify-content: center
    height: 100%
    color: rgba($white, 0.7)
  
  &__spinner
    width: 30px
    height: 30px
    border: 3px solid rgba($white, 0.1)
    border-radius: 50%
    border-top-color: $white
    animation: spin 1s ease-in-out infinite
    margin-bottom: 12px
  
  &__chats
    display: flex
    flex-direction: column
    gap: 6px
    max-height: calc(100vh - 80px) // Высота с учетом высоты заголовка
    overflow-y: auto
    padding-right: 5px
    @include custom-scrollbar

    // Специальные стили для мобильных устройств
    @include mobile
      // max-height: calc(100vh - 100px)
      padding-bottom: 100px // Добавляем отступ снизу для кнопки создания чата

    // Специальные стили для режима PWA
    @media (display-mode: standalone), (display-mode: fullscreen)
      padding-bottom: 15px
      // max-height: calc(100vh - 60px) // В режиме PWA нет адресной строки

    &__button
      &--create
        margin-top: 12px
        background-color: $purple
        color: $white
        padding: 8px 16px
        border-radius: $scrollbar-radius
        font-size: 14px
        border: none
        cursor: pointer

        &:hover
          background-color: darken($purple, 10%)

// Анимация для спиннера
@keyframes spin
  0%
    transform: rotate(0deg)
  100%
    transform: rotate(360deg)
  
@include mobile
  .sidebar
    width: 100%
    height: auto
    min-height: 100vh

// Модальное окно
  .modal-overlay
    position: fixed
    top: 0
    left: 0
    right: 0
    bottom: 0
    background-color: rgba(0, 0, 0, 0.5)
    display: flex
    align-items: center
    justify-content: center
    z-index: 100

    .modal-content
      background-color: $header-bg
      border-radius: 8px
      padding: 20px
      width: 90%
      max-width: 400px

      h3
        margin-top: 0
        margin-bottom: 20px
        color: $white

      .form-group
        margin-bottom: 15px

        label
          display: block
          margin-bottom: 5px
          color: $white

        input
          width: 100%
          padding: 10px
          border-radius: 4px
          border: 1px solid rgba(255, 255, 255, 0.2)
          background-color: rgba(255, 255, 255, 0.1)
          color: $white

          &:focus
            outline: none
            border-color: $purple

      .form-actions
        display: flex
        justify-content: flex-end
        gap: 10px

        button
          padding: 8px 15px
          border-radius: 4px
          cursor: pointer
          border: none

          &.cancel-btn
            background-color: transparent
            color: $white
            border: 1px solid rgba(255, 255, 255, 0.2)

            &:hover
              background-color: rgba(255, 255, 255, 0.1)

          &.submit-btn
            background-color: $purple
            color: $white

            &:hover
              background-color: darken($purple, 10%)

            &:disabled
              opacity: 0.7
              cursor: not-allowed

@keyframes spin
  0%
    transform: rotate(0deg)
  100%
    transform: rotate(360deg)

</style>