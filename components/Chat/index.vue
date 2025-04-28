<template>
  <div class="chat-page">
    <!-- Если чат не выбран или данные еще не загружены -->
    <div v-if="!chatData || !chatData._id" class="no-chat-selected">
      Выберите чат, чтобы начать общение
    </div>
    
    <!-- Если чат выбран -->
    <div v-else class="chat-content">
      <!-- Шапка чата -->
      <div class="page_header">
        <!-- Кнопка переключения боковой панели для мобильных устройств -->
        <button class="toggle-sidebar-btn" @click="toggleSidebar">
          <i class="fas fa-bars"></i>
        </button>
        
        <div class="content">
          <div 
            class="content__img" 
            :style="chatData.avatar ? `background-image: url(${chatData.avatar})` : ''"
          >
            <div v-if="!chatData.avatar" class="initials">
              {{ getInitials(chatData.name) }}
            </div>
          </div>
          <div class="content__textblock">
            <div class="text bold">{{ chatData.name }}</div>
            <div class="text member">{{ chatData.participants?.length || 0 }} участник(ов)</div>
          </div>
        </div>
        
        <div class="chat-actions">
          <button class="action-btn" @click="showManageParticipantsModal = true">
            <i class="fas fa-users icon"></i>
          </button>
          <button class="action-btn" @click="showEditChatModal = true">
            <i class="fas fa-edit icon"></i>
          </button>
          <button class="action-btn" @click="debugWebSocket" title="Проверить WebSocket">
            <i class="fas fa-sync-alt icon"></i>
          </button>
        </div>
      </div>
      
      <!-- Контейнер сообщений -->
      <div class="messages_container" ref="messagesContainer" @scroll="checkIfAtBottom">
        <!-- Триггер для загрузки дополнительных сообщений -->
        <div v-if="loading" ref="loadingTrigger" class="loading-trigger"></div>
        
        <!-- Индикатор загрузки дополнительных сообщений -->
        <div v-if="chatStore.loadingMore" class="loading-indicator loading-more">
          <div class="spinner"></div>
          <span>Загрузка старых сообщений...</span>
        </div>
        
        <!-- Индикатор первичной загрузки -->
        <div v-if="chatStore.loading && !visibleMessages.length" class="loading-indicator initial-loading">
          <div class="spinner"></div>
          <span>Загрузка сообщений...</span>
        </div>
        
        <!-- Если сообщений нет -->
        <div v-if="!chatStore.loading && messages.length === 0" class="empty-chat">
          Нет сообщений. Начните общение!
        </div>
        
        <!-- Сообщения, сгруппированные по датам -->
        <div v-for="group in groupedMessages" :key="group.date">
          <!-- Заголовок с датой -->
          <div class="date-header">
            <span>{{ formatDate(group.date) }}</span>
          </div>
          
          <!-- Сообщения группы -->
          <div v-for="message in group.messages" :key="message._id" class="message_wrap">
            <!-- Service message -->
            <div v-if="message.type === 'service'" class="service_message">
              <div>{{ message.text }}</div>
              <div class="time">{{ formatTime(message.createdAt || message.timestamp) }}</div>
            </div>
            
            <!-- Regular message -->
            <div 
              v-else 
              class="message" 
              :class="isOwnMessage(message) ? 'own' : 'other'"
            >
              <!-- Имя отправителя (для групповых чатов) -->
              <div 
                v-if="!isOwnMessage(message) && chatData.participants?.length > 2" 
                class="message__from"
              >
                {{ message.sender?.name }}
              </div>
              
              <!-- Контент сообщения -->
              <div class="message__content">
                <!-- Имя отправителя (для групповых чатов) -->
                <div 
                  v-if="!isOwnMessage(message) && chatData.participants?.length > 2 && message.media_type !== 'none'" 
                  class="message__from"
                >
                  {{ message.sender?.name }}
                </div>
                
                <!-- Message content based on type -->
                <div v-if="message.media_type === 'none'" class="message__text">
                  <pre>{{ message.text }}</pre>
                </div>
                
                <div v-else-if="message.media_type === 'image'" class="image-container">
                  <img :src="message.file" alt="Image" class="message-image" />
                </div>
                
                <div v-else-if="message.media_type === 'video'" class="video-container">
                  <video 
                    :id="message._id" 
                    class="video-message-player" 
                    controls 
                    :src="message.file"
                  ></video>
                </div>
                
                <div v-else-if="message.media_type === 'sticker'" class="sticker-container">
                  <img :src="message.file" alt="Sticker" class="message-sticker" />
                </div>
                
                <div v-else-if="message.media_type === 'file'" class="file-container">
                  <a :href="message.file" target="_blank" class="file-link">
                    <i class="fas fa-file file-icon"></i>
                    {{ message.fileName || 'Файл' }}
                  </a>
                </div>
                
                <div class="message__time">
                  {{ formatTime(message.createdAt || message.timestamp) }}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Индикатор новых сообщений -->
        <div v-if="!isAtBottom && !chatStore.loadingMore && messages.length > 0" class="new-messages-indicator" @click="scrollToNewMessages">
          <div class="new-messages-text">Новые сообщения</div>
          <div class="new-messages-arrow"></div>
        </div>
      </div>
      
      <!-- Input area -->
      <div class="input_area" ref="inputArea">
        <div class="input_container" ref="inputContainer">
          <textarea 
            v-model="messageText" 
            class="inp inp--textarea message_input" 
            placeholder="Введите сообщение..." 
            @keydown.enter.exact.prevent="sendMessage"
            @keydown.shift.enter.prevent="addNewLine"
            @input="adjustTextareaHeight"
            ref="messageInput"
            rows="1"
          ></textarea>
          <div class="button_container">
            <button 
              type="button" 
              class="send_button"
              :disabled="!messageText.trim()"
              @click="sendMessage"
            >
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <ManageParticipantsModal v-if="showManageParticipantsModal" :is-open="showManageParticipantsModal" @close="showManageParticipantsModal = false" />
  <EditChatModal v-if="showEditChatModal" :is-open="showEditChatModal" :chat-data="chatData" :is-new-chat="false" @close="showEditChatModal = false" />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, inject } from 'vue';
import { useChatStore } from '~/stores/chat';
import { useAuthStore } from '~/stores/auth';
import ManageParticipantsModal from './ManageParticipantsModal.vue';
import EditChatModal from './EditChatModal.vue';

// Хранилища
const chatStore = useChatStore();
const authStore = useAuthStore();

// Данные чата и сообщений
const chatData = computed(() => {
  return chatStore.activeChat;
});

const messages = computed(() => {
  return chatStore.messages;
});

// Состояние прокрутки чата
const isAtBottom = ref(true);
const messagesContainer = ref(null);
const showNewMessageIndicator = ref(false);

// Функция для проверки, находится ли пользователь внизу чата
const checkIfAtBottom = () => {
  if (!messagesContainer.value) return true;
  
  const container = messagesContainer.value;
  const scrollPosition = container.scrollTop + container.clientHeight;
  const scrollHeight = container.scrollHeight;
  
  // Считаем, что пользователь внизу, если он находится в пределах 100px от нижней границы
  isAtBottom.value = scrollHeight - scrollPosition < 100;
  
  // Если пользователь прокрутил вниз до конца, скрываем индикатор новых сообщений
  if (isAtBottom.value) {
    showNewMessageIndicator.value = false;
  }
  
  return isAtBottom.value;
};

// Функция для прокрутки к новым сообщениям
const scrollToNewMessages = () => {
  scrollToBottom();
  showNewMessageIndicator.value = false;
};

// Состояние загрузки
const loading = computed(() => chatStore.loading);

// Модальные окна
const showEditChatModal = ref(false);
const showManageParticipantsModal = ref(false);

// Видимые сообщения (для бесконечной прокрутки)
const visibleMessages = ref([]);
const loadingTrigger = ref(null);
const observer = ref(null);
const messageText = ref('');

// Данные для управления воспроизведением видео
const playbackControlData = ref({
  isActive: false,
  username: '',
  speed: 1,
  videoId: null
});

// Группировка сообщений по датам
const groupedMessages = computed(() => {
  // Проверяем, что сообщения существуют
  if (!messages.value || !Array.isArray(messages.value)) {
    return [];
  }
  
  const groups = {};
  messages.value.forEach(message => {
    if (!message) return; // Пропускаем недействительные сообщения
    
    // Безопасно получаем дату
    const timestamp = message.createdAt || message.timestamp;
    if (!timestamp) return; // Пропускаем сообщения без времени
    
    const date = new Date(timestamp);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (!groups[key]) {
      groups[key] = {
        date: key,
        messages: []
      };
    }
    groups[key].messages.push(message);
  });
  return Object.values(groups);
});

// Настройка бесконечной прокрутки
const setupInfiniteScroll = () => {
  // Отключаем предыдущий observer, если он существует
  if (observer.value) {
    observer.value.disconnect();
  }
  
  // Создаем новый Intersection Observer для бесконечной прокрутки
  observer.value = new IntersectionObserver(async (entries) => {
    const entry = entries[0];
    
    // Если триггер виден и есть еще сообщения для загрузки
    if (entry.isIntersecting && chatStore.pagination.hasMore && !chatStore.loadingMore) {
      chatStore.loadingMore = true;
      
      try {
        // Получаем ID самого старого сообщения
        const oldestMessageId = chatStore.pagination.nextCursor;
        
        if (oldestMessageId) {
          // Загружаем более старые сообщения
          await chatStore.loadMoreMessages(chatData.value._id, oldestMessageId);
          
          // Сохраняем текущую позицию прокрутки
          const { scrollHeight, scrollTop } = messagesContainer.value;
          const currentPosition = scrollHeight - scrollTop;
          
          // Ждем обновления DOM
          await nextTick();
          
          // Восстанавливаем позицию прокрутки относительно нового содержимого
          if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight - currentPosition;
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке старых сообщений:', error);
      } finally {
        chatStore.loadingMore = false;
      }
    }
  }, { threshold: 0.1 });
  
  // Начинаем наблюдение за триггером загрузки
  if (loadingTrigger.value) {
    observer.value.observe(loadingTrigger.value);
  }
};

// Загрузка дополнительных сообщений
const loadMoreMessages = async () => {
  if (chatStore.loadingMore || !chatData.value || !chatStore.pagination.hasMore) return;
  
  // Запоминаем позицию прокрутки перед загрузкой
  const container = messagesContainer.value;
  const scrollHeight = container.scrollHeight;
  const scrollTop = container.scrollTop;
  
  await chatStore.loadMoreMessages();
  
  // Восстанавливаем позицию прокрутки после загрузки
  nextTick(() => {
    if (container) {
      container.scrollTop = container.scrollHeight - scrollHeight + scrollTop;
    }
  });
};

// Прокрутка к последнему сообщению
const scrollToBottom = () => {
  if (messagesContainer.value) {
    // Используем плавную прокрутку для лучшего UX
    messagesContainer.value.scrollTo({
      top: messagesContainer.value.scrollHeight,
      behavior: 'auto' // Используем 'auto' вместо 'smooth' для производительности
    });
  }
};

// Отправка сообщения
const sendMessage = async () => {
  if (!messageText.value.trim()) return;
  
  try {
    const trimmedMessage = messageText.value.trim();
    
    // Очищаем поле ввода
    messageText.value = '';
    adjustTextareaHeight();
    
    const config = useRuntimeConfig();
    
    // Получаем токен из хранилища аутентификации
    const token = authStore.token;
    
    // Отправляем сообщение на сервер с правильным URL бэкенда и токеном
    const response = await $fetch(`${config.public.backendUrl}/api/chats/${chatData.value._id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : undefined
      },
      body: {
        text: trimmedMessage,
        media_type: 'none'
      },
      credentials: 'include' // Включаем передачу cookie
    });
    
    console.log('Сообщение успешно отправлено:', response);
    
    // Прокручиваем чат вниз после отправки сообщения
    nextTick(() => {
      scrollToBottom();
    });
    
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    // Показываем уведомление об ошибке
    alert('Не удалось отправить сообщение. Попробуйте еще раз.');
  }
};

// Форматирование даты сообщения
const formatDate = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date >= today) {
    return 'Сегодня';
  } else if (date >= yesterday) {
    return 'Вчера';
  } else {
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    });
  }
};

// Форматирование времени сообщения
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Форматирование даты заголовка
const formatDateHeader = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month, day);
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.getFullYear() === today.getFullYear() && 
      date.getMonth() === today.getMonth() && 
      date.getDate() === today.getDate()) {
    return 'Сегодня';
  } else if (date.getFullYear() === yesterday.getFullYear() && 
             date.getMonth() === yesterday.getMonth() && 
             date.getDate() === yesterday.getDate()) {
    return 'Вчера';
  } else {
    const monthNames = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    return `${day} ${monthNames[month]}`;
  }
};

// Проверка, нужно ли показывать заголовок с датой
const shouldShowDateHeader = (message, index) => {
  if (index === 0) return true;
  
  const currentDate = new Date(message.timestamp);
  const previousDate = new Date(visibleMessages.value[index - 1].timestamp);
  
  return (
    currentDate.getDate() !== previousDate.getDate() ||
    currentDate.getMonth() !== previousDate.getMonth() ||
    currentDate.getFullYear() !== previousDate.getFullYear()
  );
};

// Обработка воспроизведения видео
const handleVideoPlay = (messageId) => {
  const message = messages.value.find(m => m._id === messageId);
  if (!message) return;
  
  playbackControlData.value = {
    isActive: true,
    username: message.sender?.name || 'Пользователь',
    speed: 1,
    videoId: messageId
  };
};

// Изменение скорости воспроизведения
const changePlaybackSpeed = (speed) => {
  playbackControlData.value.speed = speed;
  
  // Найти все видео и установить скорость
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    video.playbackRate = speed;
  });
};

// Остановка видео
const stopVideo = () => {
  playbackControlData.value.isActive = false;
  
  // Найти все видео и остановить их
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    video.pause();
  });
};

// Проверка, является ли сообщение собственным
const isOwnMessage = (message) => {
  // Проверяем ID отправителя
  const senderIdMatch = message.sender?._id === authStore.user?._id;
  
  // Проверяем email отправителя как дополнительный идентификатор
  const emailMatch = message.sender?.email === authStore.user?.email;
  
  // Если совпадает ID или email, считаем сообщение своим
  return senderIdMatch || emailMatch;
};

// Получение инициалов из имени
const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};

// Обработчики событий модальных окон
const onChatUpdated = () => {
  // Обновление уже произошло в хранилище
};

const onParticipantsUpdated = () => {
  // Обновление уже произошло в хранилище
};

const onChatLeft = () => {
  // Обработка выхода из чата (чат уже удален из хранилища)
};

// Получаем функцию и состояние переключения боковой панели из app.vue
const toggleSidebar = inject('toggleSidebar');
const sidebarVisible = inject('sidebarVisible');
const isMobile = inject('isMobile');
const showChat = inject('showChat');
const showSidebar = inject('showSidebar');

// Функция для выбора чата на мобильных устройствах
const selectChatMobile = () => {
  if (isMobile.value) {
    showChat();
  }
};

// Определяем checkMobile в глобальной области видимости компонента
const checkMobile = () => {
  if (isMobile && typeof isMobile.value !== 'undefined') {
    isMobile.value = window.innerWidth <= 859;
  }
};

// Жизненный цикл компонента
onMounted(() => {
  // Проверяем размер экрана при загрузке
  checkMobile();
  window.addEventListener('resize', checkMobile);
  
  // Добавляем небольшую задержку перед инициализацией компонента
  setTimeout(() => {
    // Инициализируем видимые сообщения с пустым массивом, если сообщения еще не загружены
    visibleMessages.value = Array.isArray(messages.value) ? messages.value : [];
    
    // Инициализируем WebSocket слушатели для реального времени
    setupWebSocketListeners();
  }, 100);
  
  // Инициализируем бесконечную прокрутку
  setupInfiniteScroll();
});

// Настройка WebSocket слушателей
const setupWebSocketListeners = () => {
  // Получаем доступ к WebSocket
  const { $socket, $socketConnect } = useNuxtApp();
  
  // Убедимся, что WebSocket подключен
  if ($socket && !$socket.connected) {
    $socketConnect();
  }
  
  if ($socket) {
    // Удаляем существующие обработчики, чтобы избежать дублирования
    $socket.off('connect');
    $socket.off('new-message');
    $socket.off('messages-read');
    
    // Подписываемся на события WebSocket
    $socket.on('connect', () => {
      console.log('WebSocket подключен');
      
      // Если есть активный чат, подключаемся к его комнате
      if (chatData.value && chatData.value._id) {
        const { $socketJoinChat } = useNuxtApp();
        $socketJoinChat(chatData.value._id);
        console.log('Подключились к комнате чата:', chatData.value._id);
      }
    });
    
    // Слушаем новые сообщения
    $socket.on('new-message', ({ message, chatId }) => {
      console.log('Получено новое сообщение через WebSocket:', message);
      
      // Если сообщение для текущего чата, добавляем его в список
      if (chatData.value && chatData.value._id === chatId) {
        // Добавляем новое сообщение в конец списка
        chatStore.messages.push(message);
        
        // Прокручиваем к новому сообщению, если пользователь находится внизу чата
        if (isAtBottom.value) {
          nextTick(() => {
            scrollToBottom();
          });
        } else {
          // Показываем индикатор нового сообщения
          showNewMessageIndicator.value = true;
        }
        
        // Если сообщение не от текущего пользователя, отмечаем его как прочитанное
        if (message.sender._id !== authStore.user._id) {
          chatStore.markMessagesAsRead(chatId);
        }
      }
    });
    
    // Слушаем прочтение сообщений
    $socket.on('messages-read', ({ chatId, userId }) => {
      console.log('Сообщения отмечены как прочитанные:', { chatId, userId });
      
      // Обновляем статус прочтения сообщений в текущем чате
      if (chatData.value && chatData.value._id === chatId) {
        chatStore.updateMessagesReadStatus(chatId, userId);
      }
    });
  }
};

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect();
  }
  
  // Отписываемся от WebSocket событий при уничтожении компонента
  const { $socket } = useNuxtApp();
  if ($socket) {
    $socket.off('connect');
    $socket.off('new-message');
    $socket.off('messages-read');
  }
  
  // Удаляем обработчик изменения размера окна
  window.removeEventListener('resize', checkMobile);
});

// Следим за изменением активного чата
watch(() => chatStore.activeChat, (newChat, oldChat) => {
  // Если был активен другой чат, покидаем его комнату
  if (oldChat && oldChat._id) {
    const { $socketLeaveChat } = useNuxtApp();
    $socketLeaveChat(oldChat._id);
  }
  
  // Если выбран новый чат, подключаемся к его комнате
  if (newChat && newChat._id) {
    const { $socketJoinChat } = useNuxtApp();
    $socketJoinChat(newChat._id);
    
    // Обновляем WebSocket слушатели
    setupWebSocketListeners();
  }
  
  nextTick(() => {
    setupInfiniteScroll();
    scrollToBottom();
    
    // На мобильных устройствах скрываем sidebar при выборе чата
    if (isMobile.value) {
      selectChatMobile();
    }
  });
});

// Следим за изменениями в сообщениях
watch(messages, (newMessages) => {
  if (Array.isArray(newMessages)) {
    visibleMessages.value = newMessages;
    // Используем requestAnimationFrame для оптимизации производительности
    requestAnimationFrame(() => {
      nextTick(() => {
        scrollToBottom();
      });
    });
  }
}, { deep: true });

// Добавление новой строки при нажатии Shift+Enter
const messageInput = ref(null);
const inputContainer = ref(null);
const inputArea = ref(null);
const addNewLine = () => {
  messageText.value += '\n';
  nextTick(() => {
    adjustTextareaHeight();
  });
};

// Автоматическая адаптация высоты textarea при вводе
const adjustTextareaHeight = () => {
  if (!messageInput.value || !messagesContainer.value || !inputArea.value) return;
  
  // Сначала сбрасываем высоту, чтобы получить правильный scrollHeight
  messageInput.value.style.height = 'auto';
  
  // Ограничиваем максимальную высоту
  const maxHeight = 150;
  const minHeight = 44; // Минимальная высота равна высоте кнопки
  const scrollHeight = messageInput.value.scrollHeight;
  
  // Устанавливаем новую высоту, но не больше максимальной и не меньше минимальной
  const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
  messageInput.value.style.height = newHeight + 'px';
  
  // Если текста много, включаем скролл
  messageInput.value.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  
  // Обновляем высоту контейнера ввода и корректируем высоту контейнера сообщений
  // Базовая высота textarea - 44px (минимальная высота)
  const heightDifference = newHeight - minHeight;
  
  if (heightDifference > 0) {
    // Обновляем высоту области ввода
    const baseInputAreaHeight = 80; // Высота с учетом padding
    inputArea.value.style.height = `${baseInputAreaHeight + heightDifference}px`;
    
    // Корректируем высоту контейнера сообщений
    messagesContainer.value.style.height = `calc(100% - ${baseInputAreaHeight + heightDifference}px - 80px)`;
  } else {
    // Возвращаем стандартные значения
    inputArea.value.style.height = '80px';
    messagesContainer.value.style.height = 'calc(100% - 160px)'; // 80px header + 80px input
  }
};

// Функция отладки WebSocket
const debugWebSocket = () => {
  const { $socket, $socketConnect } = useNuxtApp();
  
  if (!$socket) {
    console.error('WebSocket не инициализирован');
    alert('WebSocket не инициализирован');
    return;
  }
  
  console.log('Статус WebSocket соединения:', $socket.connected ? 'Подключен' : 'Отключен');
  alert(`WebSocket: ${$socket.connected ? 'Подключен' : 'Отключен'}`);
  
  if (!$socket.connected) {
    console.log('Попытка переподключения WebSocket...');
    $socketConnect();
    
    setTimeout(() => {
      console.log('Новый статус WebSocket:', $socket.connected ? 'Подключен' : 'Отключен');
      alert(`WebSocket: ${$socket.connected ? 'Подключен' : 'Отключен'}`);
      
      if ($socket.connected && chatData.value && chatData.value._id) {
        const { $socketJoinChat } = useNuxtApp();
        $socketJoinChat(chatData.value._id);
        console.log('Переподключились к комнате чата:', chatData.value._id);
        alert(`Переподключились к чату: ${chatData.value.name}`);
      }
    }, 1000);
  } else if (chatData.value && chatData.value._id) {
    // Проверяем подключение к комнате чата
    const { $socketJoinChat } = useNuxtApp();
    $socketJoinChat(chatData.value._id);
    console.log('Переподключились к комнате чата:', chatData.value._id);
    alert(`Переподключились к чату: ${chatData.value.name}`);
  }
};
</script>

<style lang="sass" scoped>
@import '~/assets/styles/variables'

.chat-page
  height: 100vh
  width: 100%
  display: flex
  flex-direction: column
  position: relative
  
  .page_header
    padding: 10px 20px
    background-color: $header-bg
    display: flex
    align-items: center
    justify-content: space-between
    border-bottom: 1px solid rgba(255, 255, 255, 0.1)
    
    // Кнопка переключения боковой панели
    .toggle-sidebar-btn
      display: none
      background: transparent
      border: none
      color: $white
      font-size: 20px
      cursor: pointer
      padding: 5px 10px
      margin-right: 10px
      transition: all 0.2s ease
      
      &:hover
        color: rgba(255, 255, 255, 0.8)
      
      @include tablet
        display: block
    
    .content
      display: flex
      align-items: center
      
      &__img
        width: 50px
        height: 50px
        border-radius: 50%
        margin-right: 10px
        background-color: $purple
        background-size: cover
        background-position: center
        display: flex
        align-items: center
        justify-content: center
        
        .initials
          font-size: 18px
          font-weight: bold
          color: $white
        
      &__textblock
        display: flex
        flex-direction: column
        
        .text
          color: $white
          
          &.bold
            font-weight: bold
            font-size: 16px
          
          &.member
            font-size: 12px
            color: rgba(255, 255, 255, 0.7)
    
    .chat-actions
      margin-left: auto
      display: flex
      gap: 10px
      
      .action-btn
        background-color: rgba(255, 255, 255, 0.1)
        color: $white
        border: none
        border-radius: 50%
        width: 36px
        height: 36px
        display: flex
        align-items: center
        justify-content: center
        cursor: pointer
        
        &:hover
          background-color: rgba(255, 255, 255, 0.2)
        
        .icon
          font-size: 18px
  
  .no-chat-selected
    flex: 1
    display: flex
    align-items: center
    justify-content: center
    color: rgba(255, 255, 255, 0.5)
    font-size: 18px
  
  .chat-content
    display: flex
    flex-direction: column
    height: 100%
  
  .messages_container
    flex: 1
    overflow-y: auto
    padding: 20px
    display: flex
    flex-direction: column
    max-width: 700px;
    width: 100%;
    align-self: center;
    @include custom-scrollbar
    
    .loading-trigger
      height: 20px
      margin-bottom: 10px
    
    .loading-indicator 
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px;
      color: $white;
      
      &.loading-more 
        margin-bottom: 10px;
        opacity: 0.7;
      
      
      &.initial-loading 
        height: 100px;
        margin: auto;
      
      
      .spinner 
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: $white;
        animation: spin 1s ease-in-out infinite;
        margin-right: 10px
        will-change: transform; // Оптимизация для анимации
      
    
    
    .empty-chat
      text-align: center
      padding: 30px
      color: rgba(255, 255, 255, 0.5)
    
    .date-header
      text-align: center
      margin: 15px 0
      
      span
        background-color: rgba(255, 255, 255, 0.1)
        color: $white
        padding: 5px 10px
        border-radius: 10px
        font-size: 12px
    
    .service_message
      text-align: center
      margin: 10px 0
      color: rgba(255, 255, 255, 0.7)
      font-size: 12px
      
      .time
        margin-top: 5px
        font-size: 10px
        opacity: 0.7
    
    .message_wrap
      margin-bottom: 10px
      width: 100%
      display: flex
      flex-direction: column
      
      .message
        display: flex
        flex-direction: column
        max-width: 70%
        margin-bottom: 5px
        
        &.own
          align-self: flex-end
          
          .message__content
            background-color: $purple
            border-radius: 15px 15px 0 15px
            margin-left: auto
        
        &.other
          align-self: flex-start
          
          .message__content
            background-color: $header-bg
            border-radius: 15px 15px 15px 0
        
        &__content
          padding: 10px 15px
          color: $white
          word-break: break-word
        
        &__from
          color: rgba(255, 255, 255, 0.8)
          font-weight: bold
          margin-bottom: 5px
          font-size: 14px
        
        &__text
          color: $white
          
          pre
            font-family: inherit
            margin: 0
            white-space: pre-wrap
            word-break: break-word
        
        &__time
          text-align: right
          font-size: 10px
          color: rgba(255, 255, 255, 0.6)
          margin-top: 5px
        
        .video-container, .image-container
          margin: 5px 0
          
          .video-message-player, .message-image
            max-width: 100%
            border-radius: 8px
            max-height: 300px
        
        .sticker-container
          .message-sticker
            max-width: 120px
            max-height: 120px
        
        .file-container
          margin: 5px 0
          
          .file-link
            display: flex
            align-items: center
            color: $white
            text-decoration: none
            background-color: rgba(255, 255, 255, 0.1)
            padding: 8px 12px
            border-radius: 8px
            
            &:hover
              background-color: rgba(255, 255, 255, 0.2)
            
            .file-icon
              margin-right: 8px
              font-size: 16px
  
  .input_area
    align-self: center
    max-width: 700px
    width: 100%
    // background-color: $header-bg
    padding: 15px
    
    .input_container
      display: flex
      align-items: flex-end
      gap: 10px
      position: relative
      
      .message_input
        flex: 1
        // Дополнительные стили, основные уже в классе inp--textarea
      
      .button_container
        width: 44px
        height: 44px
        
        .send_button
          background-color: $purple
          color: $white
          border: none
          border-radius: 50%
          width: 44px
          height: 44px
          display: flex
          align-items: center
          justify-content: center
          cursor: pointer
          
          &:hover
            background-color: darken($purple, 10%)
          
          &:disabled
            opacity: 0.5
            cursor: not-allowed
          
          i
            font-size: 18px
  
  .new-messages-indicator
    position: absolute
    bottom: 60px
    left: 50%
    transform: translateX(-50%)
    background-color: $purple
    color: $white
    padding: 10px 15px
    border-radius: 10px
    cursor: pointer
    animation: bounce 1s ease-in-out infinite
    
    .new-messages-text
      font-size: 14px
      font-weight: bold
    
    .new-messages-arrow
      width: 0
      height: 0
      border-style: solid
      border-width: 0 10px 10px 10px
      border-color: transparent transparent $purple transparent
      position: absolute
      bottom: -10px
      left: 50%
      transform: translateX(-50%)
  
@keyframes spin
  0%
    transform: rotate(0deg)
  100%
    transform: rotate(360deg)

@keyframes bounce
  0%
    transform: translateY(0)
  50%
    transform: translateY(-10px)
  100%
    transform: translateY(0)

@include mobile
  .chat-page
    .messages_container
      .message_wrap
        .message
          max-width: 90%
</style>