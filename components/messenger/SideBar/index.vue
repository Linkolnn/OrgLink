<template>
  <aside class="sidebar" :class="{ 'visible': isMobile }">
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
// Устанавливаем начальное значение true, чтобы боковая панель сразу показывалась
const isMobile = ref(true);

// Проверяем размер экрана при монтировании
onMounted(() => {
  // Проверяем размер экрана
  const checkMobile = () => {
    isMobile.value = window.innerWidth <= 859;
  };
  
  // Проверяем размер экрана при изменении размера окна
  window.addEventListener('resize', checkMobile);
  
  // Добавляем классы видимости напрямую к элементам DOM
  setTimeout(() => {
    // Добавляем класс visible к боковой панели
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.add('visible');
      console.log('[SideBar] Добавлен класс visible к .sidebar');
    }
    
    // Добавляем класс sidebar-visible к приложению
    const app = document.querySelector('.app');
    if (app) {
      app.classList.add('sidebar-visible');
      console.log('[SideBar] Добавлен класс sidebar-visible к .app');
    }
  }, 100);
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

// Запрашиваем разрешение на отправку уведомлений
const { $notifications } = useNuxtApp();
if ($notifications && $notifications.supported) {
  $notifications.requestPermission();
}

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
  // Обработка событий подключения и отключения
  $socket.on('connect', () => {
    console.log('SideBar: WebSocket подключен');
    isConnected.value = true;
    
    // При подключении обновляем список чатов
    chatStore.fetchChats();
  });

  $socket.on('disconnect', () => {
    console.log('SideBar: WebSocket отключен');
    isConnected.value = false;
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
    
    // Обновляем чат, если он есть в списке
    const chatIndex = chatStore.chats.findIndex(chat => chat._id === chatId);
    if (chatIndex !== -1) {
      // Принудительно обновляем компонент
      forceUpdate.value++;
    } else {
      // Если чат не найден, обновляем список чатов
      chatStore.fetchChats();
    }
  });

  // Обработка события удаления чата
  $socket.on('chat-deleted', (chatId) => {
    console.log('SideBar: Чат удален:', chatId);
    // Принудительно обновляем список чатов
    forceUpdate.value++;
  });

  // Обработка события создания нового чата
  $socket.on('new-chat', (chat) => {
    console.log('SideBar: Получен новый чат:', chat);
    // Принудительно обновляем список чатов
    forceUpdate.value++;
  });

  // Обработка события обновления чата (новое сообщение)
  $socket.on('chat-updated', ({ chatId, lastMessage }) => {
    console.log('SideBar: Получено обновление чата:', chatId, lastMessage);
    
    if (!chatId) {
      console.error('SideBar: Отсутствует ID чата в обновлении');
      return;
    }
    
    try {
      // Получаем информацию о текущем пользователе
      const { $auth, $notifications } = useNuxtApp();
      const currentUserId = $auth?.user?._id;
      
      // Проверяем, от текущего ли пользователя сообщение
      const senderIsCurrentUser = (
        (lastMessage.sender && typeof lastMessage.sender === 'object' && lastMessage.sender._id === currentUserId) ||
        (lastMessage.sender && typeof lastMessage.sender === 'string' && lastMessage.sender === currentUserId)
      );
      
      // Находим чат в списке
      const chatIndex = chatStore.chats.findIndex(c => c._id === chatId);
      
      if (chatIndex !== -1) {
        const currentChat = { ...chatStore.chats[chatIndex] };
        
        // Определяем, активен ли чат
        const isActiveChat = chatStore.activeChat && chatStore.activeChat._id === chatId;
        
        // Определяем, нужно ли увеличивать счетчик непрочитанных сообщений
        let unreadCount = currentChat.unread || 0;
        
        // Если сообщение не от текущего пользователя и чат не активен
        if (!senderIsCurrentUser && !isActiveChat) {
          unreadCount++;
          
          // Получаем имя отправителя (если доступно)
          let senderName = '';
          if (lastMessage.sender) {
            if (typeof lastMessage.sender === 'object') {
              senderName = lastMessage.sender.name || lastMessage.sender.username || '';
              
              // Если имя все еще не найдено, попробуем получить его из email
              if (!senderName && lastMessage.sender.email) {
                senderName = lastMessage.sender.email.split('@')[0];
              }
            } else if (typeof lastMessage.sender === 'string') {
              // Если sender - это строка (ID), попробуем найти пользователя в участниках чата
              const sender = currentChat.participants?.find(p => p._id === lastMessage.sender);
              if (sender) {
                senderName = sender.name || sender.username || '';
                
                // Если имя все еще не найдено, попробуем получить его из email
                if (!senderName && sender.email) {
                  senderName = sender.email.split('@')[0];
                }
              }
            }
          }
          
          // Получаем информацию о чате для уведомления
          let chatName = '';
          let otherParticipantName = '';
          
          if (currentChat.type === 'private') {
            // Для приватных чатов используем имя отправителя
            const otherParticipant = currentChat.participants?.find(p => p._id !== currentUserId);
            otherParticipantName = otherParticipant?.name || otherParticipant?.username || '';
            
            // Для приватных чатов в качестве названия чата используем имя отправителя
            chatName = senderName || otherParticipantName || 'Личный чат';
          } else {
            // Для групповых чатов используем название группы
            chatName = currentChat.name || 'Групповой чат';
          }
          
          // Текст сообщения
          const messageText = lastMessage.text || 'Новое сообщение';
          
          console.log('SideBar: Отправка уведомления о новом сообщении (chat-updated):', {
            chatName,
            senderName,
            messageText,
            chatId,
            isActiveChat
          });
          
          // Отправляем уведомление только если:
          // 1. Чат не активен (пользователь не просматривает его)
          // 2. Окно не в фокусе или документ не видим
          const windowNotFocused = !$notifications?.isWindowFocused?.value;
          const documentNotVisible = !$notifications?.isDocumentVisible?.value;
          
          if ($notifications && $notifications.supported && $notifications.permission.value === 'granted' && 
              (windowNotFocused || documentNotVisible)) {
            try {
              $notifications.sendMessageNotification({
                chatName,
                senderName,
                message: messageText,
                chatId,
                chatAvatar: currentChat.avatar,
                forceShow: false // Не показываем принудительно, только если окно не активно
              });
            } catch (error) {
              console.error('SideBar: Ошибка при отправке уведомления (chat-updated):', error);
            }
          }
        }
        
        // Обновляем чат в списке
        chatStore.chats[chatIndex] = {
          ...currentChat,
          lastMessage: {
            text: lastMessage.text || 'Медиа-сообщение',
            sender: lastMessage.sender,
            timestamp: lastMessage.timestamp || new Date().toISOString()
          },
          unread: unreadCount
        };
        
        // Перемещаем чат вверх списка, если есть новое сообщение
        if (lastMessage) {
          moveToTop(chatId);
        }
        
        // Обновляем список чатов (включает в себя обновление UI)
        chatStore.triggerChatListUpdate();
        
        // Принудительно обновляем компонент
        forceUpdate.value++;
      } else {
        // Если чат не найден в списке, обновляем список чатов
        chatStore.fetchChats();
      }
    } catch (error) {
      console.error('SideBar: Ошибка при обработке обновления чата:', error);
    }
  });

  // Обработчик события нового сообщения
  $socket.on('new-message', ({ message, chatId, chat }) => {
    console.log('SideBar: Получено новое сообщение через WebSocket:', message, 'для чата:', chatId);
    
    // Если chatId не передан, используем chat из сообщения
    if (!chatId && message && message.chat) {
      chatId = message.chat;
    }
    
    if (!chatId) {
      console.error('SideBar: Отсутствует ID чата в сообщении:', message);
      return;
    }
    
    try {
      // Получаем информацию о текущем пользователе
      const { $auth, $notifications } = useNuxtApp();
      const currentUserId = $auth?.user?._id;
      
      // Проверяем, от текущего ли пользователя сообщение
      const senderIsCurrentUser = (
        (message.sender && typeof message.sender === 'object' && message.sender._id === currentUserId) ||
        (message.sender && typeof message.sender === 'string' && message.sender === currentUserId)
      );
      
      // Находим чат в списке или используем переданный чат
      let currentChat = null;
      const chatIndex = chatStore.chats.findIndex(c => c._id === chatId);
      
      if (chatIndex !== -1) {
        currentChat = { ...chatStore.chats[chatIndex] };
      } else if (chat) {
        currentChat = chat;
      } else {
        console.error('SideBar: Не удалось найти чат:', chatId);
        return;
      }
      
      // Определяем, активен ли чат
      const isActiveChat = chatStore.activeChat && chatStore.activeChat._id === chatId;
      
      // Определяем, нужно ли увеличивать счетчик непрочитанных сообщений
      let unreadCount = currentChat.unread || 0;
      
      // Если сообщение не от текущего пользователя и чат не активен
      if (!senderIsCurrentUser && !isActiveChat) {
        unreadCount++;
        
        // Получаем имя отправителя
        let senderName = '';
        if (message.sender) {
          if (typeof message.sender === 'object') {
            senderName = message.sender.name || message.sender.username || '';
            
            // Если имя все еще не найдено, попробуем получить его из email
            if (!senderName && message.sender.email) {
              senderName = message.sender.email.split('@')[0];
            }
          } else if (typeof message.sender === 'string') {
            // Если sender - это строка (ID), попробуем найти пользователя в участниках чата
            const sender = currentChat.participants?.find(p => p._id === message.sender);
            if (sender) {
              senderName = sender.name || sender.username || '';
              
              // Если имя все еще не найдено, попробуем получить его из email
              if (!senderName && sender.email) {
                senderName = sender.email.split('@')[0];
              }
            }
          }
        }
        
        // Получаем название чата и имя собеседника
        let chatName = '';
        let otherParticipantName = '';
        if (currentChat.type === 'private') {
          // Для приватных чатов используем имя собеседника
          const otherParticipant = currentChat.participants?.find(p => p._id !== currentUserId);
          otherParticipantName = otherParticipant?.name || otherParticipant?.username || '';
          
          // Для приватных чатов в качестве названия чата используем имя отправителя
          chatName = senderName || otherParticipantName || 'Личный чат';
          
          console.log('Имя отправителя для уведомления в приватном чате:', senderName);
        } else {
          // Для групповых чатов используем название группы
          chatName = currentChat.name || 'Групповой чат';
        }
        
        // Текст сообщения
        const messageText = message.text || 'Медиа-сообщение';
        
        // Отправляем уведомление
        if ($notifications && $notifications.supported) {
          console.log('Проверка возможности отправки уведомления:', {
            permission: $notifications.permission.value,
            supported: $notifications.supported,
            isDocumentVisible: $notifications.isDocumentVisible?.value,
            isWindowFocused: $notifications.isWindowFocused?.value
          });
          
          if ($notifications.permission.value === 'granted') {
            console.log('SideBar: Отправка уведомления о новом сообщении:', {
              chatName,
              senderName,
              messageText,
              chatId,
              isActiveChat
            });
            
            // Отправляем уведомление только если:
            // 1. Чат не активен (пользователь не просматривает его)
            // 2. Окно не в фокусе или документ не видим
            const windowNotFocused = !$notifications?.isWindowFocused?.value;
            const documentNotVisible = !$notifications?.isDocumentVisible?.value;
            
            if (windowNotFocused || documentNotVisible) {
              try {
                $notifications.sendMessageNotification({
                  chatName,
                  senderName,
                  message: messageText,
                  chatId,
                  chatAvatar: currentChat.avatar,
                  forceShow: false // Не показываем принудительно, только если окно не активно
                });
              } catch (error) {
                console.error('SideBar: Ошибка при отправке уведомления:', error);
              }
            } else {
              console.log('SideBar: Уведомление не отправлено, т.к. окно активно и документ видим');
            }
          } else {
            console.warn('Нет разрешения на отправку уведомлений:', $notifications.permission.value);
          }
        }
      }
      
      // Создаем объект последнего сообщения
      const lastMessage = {
        ...message,
        text: message.text || 'Медиа-сообщение',
        timestamp: message.createdAt || new Date().toISOString()
      };
      
      // Обновляем чат в списке
      if (chatIndex !== -1) {
        // Если чат уже есть в списке, обновляем его
        chatStore.chats[chatIndex] = {
          ...currentChat,
          lastMessage,
          unread: unreadCount
        };
        
        // Перемещаем чат вверх списка
        moveToTop(chatId);
      } else if (chat) {
        // Если чата нет в списке, но он передан в событии, добавляем его
        chatStore.chats.unshift({
          ...chat,
          lastMessage,
          unread: unreadCount
        });
      }
      
      // Обновляем список чатов (включает в себя обновление UI)
      chatStore.triggerChatListUpdate();
      
      // Принудительно обновляем компонент
      forceUpdate.value++;
    } catch (error) {
      console.error('SideBar: Ошибка при обработке нового сообщения:', error);
    }
  });

  // Обработчик события обновления чата уже реализован выше
  
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

// Используем computed для обеспечения реактивности
const chats = computed(() => {
  // Проверяем, есть ли чаты в хранилище
  if (!chatStore.chats || chatStore.chats.length === 0) {
    return [];
  }
  
  // Создаем Set для отслеживания уникальных ID чатов
  const uniqueIds = new Set();
  
  // Фильтруем чаты, чтобы избежать дубликатов
  const uniqueChats = chatStore.chats.filter(chat => {
    if (!chat._id) return false;
    if (uniqueIds.has(chat._id)) return false;
    uniqueIds.add(chat._id);
    return true;
  });
  
  // Обрабатываем каждый чат для отображения в интерфейсе
  return uniqueChats.map(chat => {
    // Получаем имя отправителя последнего сообщения
    let senderName = '';
    if (chat.lastMessage?.sender) {
      if (typeof chat.lastMessage.sender === 'object') {
        senderName = chat.lastMessage.sender.name || chat.lastMessage.sender.username || '';
      }
    }
    
    // Формируем текст последнего сообщения с именем отправителя
    const messageText = chat.lastMessage?.text || 'Нет сообщений';
    const lastMessageText = senderName ? `${senderName}: ${messageText}` : messageText;
    
    // Убеждаемся, что счетчик непрочитанных сообщений есть число
    const unread = typeof chat.unread === 'number' ? chat.unread : 0;
    
    return {
      ...chat,
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
  console.log('[SideBar] Выбран чат:', chatId);
  chatStore.setActiveChat(chatId);
  navigateTo('/messenger');

  // На мобильных устройствах переключаем на чат
  // Проверяем ширину экрана напрямую, чтобы избежать проблем с реактивностью
  setTimeout(() => {
    const isMobileWidth = window.innerWidth <= 859;
    console.log('[SideBar] Ширина экрана:', window.innerWidth, 'Мобильная версия:', isMobileWidth);
    
    if (isMobileWidth) {
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
  console.log('[SideBar] Переключение на чат на мобильном устройстве');
  
  // Скрываем сайдбар на мобильных устройствах
  isMobile.value = false;
  
  // Напрямую манипулируем DOM для гарантированного скрытия сайдбара
  setTimeout(() => {
    try {
      // Удаляем класс visible у элемента .sidebar
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        sidebar.classList.remove('visible');
        sidebar.style.transform = 'translateX(-100%)';
        console.log('[SideBar] Удален класс visible у .sidebar и добавлен translateX(-100%)');
      }
      
      // Удаляем класс sidebar-visible у приложения
      const app = document.querySelector('.app');
      if (app) {
        app.classList.remove('sidebar-visible');
        console.log('[SideBar] Удален класс sidebar-visible у .app');
      }
      
      // Добавляем класс chat-visible к элементу .chat, если он есть
      const chat = document.querySelector('.chat');
      if (chat) {
        chat.classList.add('chat-visible');
        console.log('[SideBar] Добавлен класс chat-visible к .chat');
      }
    } catch (error) {
      console.error('[SideBar] Ошибка при манипуляции DOM:', error);
    }
  }, 50);
  
  // Используем плагин sidebar-manager, если он доступен
  try {
    const nuxtApp = useNuxtApp();
    if (nuxtApp.$toggleSidebar) {
      nuxtApp.$toggleSidebar(false);
      console.log('[SideBar] Вызван $toggleSidebar(false)');
    }
  } catch (error) {
    console.error('[SideBar] Ошибка при вызове $toggleSidebar:', error);
  }
};

// Функция для перемещения чата в начало списка
const moveToTop = (chatId) => {
  const chatIndex = chatStore.chats.findIndex(chat => chat._id === chatId);
  if (chatIndex > 0) { // Если чат не в начале списка
    const chat = chatStore.chats[chatIndex];
    chatStore.chats.splice(chatIndex, 1); // Удаляем чат из текущей позиции
    chatStore.chats.unshift(chat); // Добавляем в начало списка
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
    position: fixed
    left: 0
    top: 0
    z-index: 100
    width: 100%
    height: 100vh
    transform: translateX(-100%)
    background-color: $header-bg
    
    &.visible
      transform: translateX(0)
      display: block !important
  
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