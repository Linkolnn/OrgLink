<template>
  <div class="chat-page">
    <!-- Если чат не выбран или данные еще не загружены -->
    <div v-if="!chatData || !chatData._id" class="no-chat-selected">
      Выберите чат, чтобы начать общение
    </div>
    
    <!-- Если чат выбран -->
    <div v-else class="chat-content">
      <!-- Шапка чата -->
      <div class="page_header" ref="pageHeader" @click="openChatSettings">
        <!-- Кнопка переключения боковой панели для мобильных устройств -->
        <button class="toggle-sidebar-btn" @click.stop="toggleSidebar">
          <IconBottomArrow class="toggle-sidebar-btn__icon" filled />
        </button>
        
        <div class="content">
          <div 
            class="content__img" 
            :style="chatData.avatar ? `background-image: url(${secureUrl(chatData.avatar)})` : ''"
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
        </div>
      </div>
      
      <!-- Контейнер сообщений -->
      <div class="messages_container" ref="messagesContainer" @scroll="checkIfAtBottom">        
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
            <Message 
              :message="message" 
              :is-group-chat="chatData.participants?.length > 2"
              :is-mobile="isMobile.value"
              @context-menu="showContextMenu"
              @click="handleMessageClick"
              @image-loaded="(messageId) => { 
                const msgIndex = chatStore.messages.findIndex(m => m._id === messageId);
                if (msgIndex !== -1) {
                  chatStore.messages[msgIndex].imageLoaded = true;
                }
              }"
              @video-play="handleVideoPlay"
              @profile-click="openUserProfile"
            />
          </div>
        </div>
        
        <!-- Индикатор новых сообщений -->
        <transition name="scroll-btn">
          <ChatNewMessagesButton 
            v-if="!isAtBottom && !chatStore.loadingMore && messages.length > 0" 
            @click="scrollToNewMessages" 
          />
        </transition>
      </div>
      
      <!-- Input area -->
      <div class="input_area" ref="inputArea">
        <!-- Индикатор редактирования сообщения -->
        <div v-if="isEditingMessage" class="editing-indicator">
          <div class="editing-text">
            <i class="fas fa-edit"></i> Редактирование: {{ originalMessageText.length > 30 ? originalMessageText.substring(0, 30) + '...' : originalMessageText }}
          </div>
          <button class="cancel-btn" @click="cancelEditingMessage">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="input_container" ref="inputContainer">
          <textarea 
            v-model="messageText" 
            class="inp inp--textarea message_input" 
            placeholder="Введите сообщение..." 
            @keydown.enter.exact.prevent="handleEnterKey"
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
  <ChatSettingsModal 
    v-if="showChatSettingsModal" 
    :is-open="showChatSettingsModal" 
    :chat-data="chatData" 
    :is-new-chat="false" 
    @close="showChatSettingsModal = false" 
    @saved="onChatUpdated" 
  />
  <ChatMessageContextMenu 
    v-if="contextMenuVisible" 
    :is-visible="contextMenuVisible"
    :position="contextMenuPosition" 
    :message="selectedMessage"
    @close="hideContextMenu"
    @edit="startEditingMessage"
    @delete="deleteMessage"
  />
</template>

<script setup>
import { useChatStore } from '~/stores/chat';
import { useAuthStore } from '~/stores/auth';
import { useNuxtApp } from '#app';
import Message from './Message.vue';
import { secureUrl } from '~/utils/secureUrl';

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

// Ссылки на элементы
const inputArea = ref(null);
const messageInput = ref(null);
const inputContainer = ref(null);
const pageHeader = ref(null);

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
  scrollToBottom(true);
  showNewMessageIndicator.value = false;
};

// Состояние загрузки
const loading = computed(() => chatStore.loading);

const showChatSettingsModal = ref(false);

// Обработка обновления чата после сохранения в модальном окне
const onChatUpdated = () => {
  if (chatData.value && chatData.value._id) {
    chatStore.setActiveChat(chatData.value._id);
  }
};

// Видимые сообщения (для бесконечной прокрутки)
const visibleMessages = ref([]);
const loadingTrigger = ref(null);
const observer = ref(null);
const messageText = ref('');

// Состояния для контекстного меню сообщений
const contextMenuVisible = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const selectedMessage = ref(null);

// Состояние редактирования сообщения
const isEditingMessage = ref(false);
const editingMessageText = ref('');
const originalMessageText = ref('');

// Данные для управления воспроизведением видео
const playbackControlData = ref({
  isActive: false,
  username: '',
  speed: 1,
  videoId: null
});

// Группировка сообщений по датам
const groupedMessages = computed(() => {
  if (!messages.value || !Array.isArray(messages.value)) {
    return [];
  }
  
  const groups = {};
  messages.value.forEach(message => {
    if (!message) return;
    
    const timestamp = message.createdAt || message.timestamp;
    if (!timestamp) return;
    
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
  if (observer.value) {
    observer.value.disconnect();
  }
  
  observer.value = new IntersectionObserver(async (entries) => {
    const entry = entries[0];
    
    if (entry.isIntersecting && chatStore.pagination.hasMore && !chatStore.loadingMore) {
      chatStore.loadingMore = true;
      
      try {
        const oldestMessageId = chatStore.pagination.nextCursor;
        
        if (oldestMessageId) {
          await chatStore.loadMoreMessages(chatData.value._id, oldestMessageId);
          
          const { scrollHeight, scrollTop } = messagesContainer.value;
          const currentPosition = scrollHeight - scrollTop;
          
          await nextTick();
          
          if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight - currentPosition;
          }
        }
      } catch (error) {
        useNotification('Ошибка при загрузке старых сообщений', 'error');
      } finally {
        chatStore.loadingMore = false;
      }
    }
  }, { threshold: 0.1 });
  
  if (loadingTrigger.value) {
    observer.value.observe(loadingTrigger.value);
  }
};

// Загрузка дополнительных сообщений
const loadMoreMessages = async () => {
  if (chatStore.loadingMore || !chatData.value || !chatStore.pagination.hasMore) return;
  
  const container = messagesContainer.value;
  const scrollHeight = container.scrollHeight;
  const scrollTop = container.scrollTop;
  
  await chatStore.loadMoreMessages();
  
  nextTick(() => {
    if (container) {
      container.scrollTop = container.scrollHeight - scrollHeight + scrollTop;
    }
  });
};

// Прокрутка к последнему сообщению
const scrollToBottom = (smooth = false) => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTo({
      top: messagesContainer.value.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
};

// Отправка сообщения
const sendMessage = async () => {
  if (!messageText.value.trim()) return;
  
  if (isEditingMessage.value && selectedMessage.value) {
    await saveEditedMessage();
    return;
  }
  
  try {
    await chatStore.sendMessage({
      chatId: chatData.value._id,
      text: messageText.value.trim()
    });
    
    messageText.value = '';
    adjustTextareaHeight();
    
    nextTick(() => {
      scrollToBottom(true);
    });
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
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
  
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    video.playbackRate = speed;
  });
};

// Остановка видео
const stopVideo = () => {
  playbackControlData.value.isActive = false;
  
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    video.pause();
  });
};

// Проверка, является ли сообщение собственным
const isOwnMessage = (message) => {
  return message.sender && authStore.user && message.sender._id === authStore.user._id;
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
const onParticipantsUpdated = () => {};

const onChatLeft = () => {};

// Функции для управления контекстным меню сообщений
const showContextMenu = (event, message) => {
  event.preventDefault();
  contextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  };
  selectedMessage.value = message;
  contextMenuVisible.value = true;
};

const hideContextMenu = () => {
  contextMenuVisible.value = false;
};

// Функции для редактирования сообщений
const startEditingMessage = (message) => {
  if (!message || !isOwnMessage(message)) return;
  
  originalMessageText.value = message.text;
  editingMessageText.value = message.text;
  messageText.value = message.text;
  selectedMessage.value = message;
  isEditingMessage.value = true;
  
  nextTick(() => {
    if (messageInput.value) {
      messageInput.value.focus();
    }
  });
};

const cancelEditingMessage = () => {
  isEditingMessage.value = false;
  selectedMessage.value = null;
  messageText.value = '';
  editingMessageText.value = '';
  originalMessageText.value = '';
};

const saveEditedMessage = async () => {
  if (!selectedMessage.value || messageText.value.trim() === originalMessageText.value) {
    cancelEditingMessage();
    return;
  }
  
  try {
    await chatStore.updateMessage({
      messageId: selectedMessage.value._id,
      chatId: chatData.value._id,
      text: messageText.value.trim()
    });
    cancelEditingMessage();
  } catch (error) {
    console.error('Ошибка при обновлении сообщения:', error);
  }
};

const deleteMessage = async (message) => {
  if (!message || !isOwnMessage(message)) return;
  
  try {
    await chatStore.deleteMessage({
      messageId: message._id,
      chatId: chatData.value._id
    });
  } catch (error) {
    console.error('Ошибка при удалении сообщения:', error);
  }
};

// Обработка клика на сообщении
const handleMessageClick = (event, message) => {
  if (isMobile.value) {
    showContextMenu(event, message);
  }
};

// Функция для переключения боковой панели на мобильных устройствах
const toggleSidebar = () => {
  const nuxtApp = useNuxtApp();
  if (nuxtApp && nuxtApp.$sidebarVisible !== undefined) {
    nuxtApp.$sidebarVisible.value = !nuxtApp.$sidebarVisible.value;
  } else {
    const app = document.querySelector('.app');
    if (app) {
      app.classList.toggle('sidebar-visible');
    }
  }
};

// Получаем доступ к глобальному состоянию
const nuxtApp = useNuxtApp();
const sidebarVisible = ref(false);
const isMobile = ref(false);

// Универсальная функция для адаптации высоты контейнеров и textarea
const adjustContainerHeight = (adjustTextarea = false) => {
  // Проверяем наличие chatData
  if (!chatData.value || !chatData.value._id) {
    console.log('Chat data not available, skipping adjustContainerHeight');
    return;
  }
  
  // Проверяем наличие всех необходимых ref
  if (!inputArea.value || !messagesContainer.value || !pageHeader.value || 
      (adjustTextarea && !messageInput.value)) {
    console.warn('Missing refs:', {
      inputArea: inputArea.value,
      messagesContainer: messagesContainer.value,
      pageHeader: pageHeader.value,
      messageInput: adjustTextarea ? messageInput.value : 'not required'
    });
    return;
  }

  // Если нужно адаптировать textarea (для ввода текста)
  if (adjustTextarea && messageInput.value) {
    // Важно: сначала полностью сбрасываем высоту
    messageInput.value.style.height = 'auto';
    
    // Определяем минимальную и максимальную высоту
    const maxHeight = 150;
    const minHeight = 44; // Минимальная высота равна высоте кнопки
    
    // Получаем актуальную высоту контента
    const scrollHeight = messageInput.value.scrollHeight;

    // Всегда вычисляем высоту в зависимости от содержимого
    // Это позволит корректно обрабатывать как добавление, так и удаление переносов строк
    const newHeight = Math.min(maxHeight, Math.max(minHeight, scrollHeight));
    messageInput.value.style.height = `${newHeight}px`;

  }

  // Получаем высоту .input_area после возможного изменения textarea
  const inputAreaHeight = inputArea.value.offsetHeight;

  // Получаем высоту .page_header
  const headerHeight = pageHeader.value.offsetHeight || 60; // Фоллбэк на 60px
  
  // Выбираем значение vh в зависимости от типа устройства
  // Для десктопа используем 99vh, для мобильных - 90vh
  const viewportHeight = isMobile.value ? '90vh' : '99vh';
  console.log(`Using ${viewportHeight} for device type: ${isMobile.value ? 'mobile' : 'desktop'}`);

  // Обновляем max-height для .messages_container
  messagesContainer.value.style.maxHeight = `calc(${viewportHeight} - ${headerHeight}px - ${inputAreaHeight}px)`;
};

// Алиас для обратной совместимости
const adjustTextareaHeight = () => adjustContainerHeight(true);

// Функция для показа боковой панели
const showSidebar = () => {
  if (nuxtApp.$sidebarVisible) {
    nuxtApp.$sidebarVisible.value = true;
  } else {
    const app = document.querySelector('.app');
    if (app) {
      app.classList.add('sidebar-visible');
    }
  }
};

// Функция для выбора чата на мобильных устройствах
const selectChatMobile = () => {
  if (isMobile.value) {
    const nuxtApp = useNuxtApp();
    if (nuxtApp.$sidebarVisible) {
      nuxtApp.$sidebarVisible.value = false;
    }
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
  if (nuxtApp.$sidebarVisible) {
    sidebarVisible.value = nuxtApp.$sidebarVisible.value;
    watch(() => nuxtApp.$sidebarVisible.value, (newValue) => {
      sidebarVisible.value = newValue;
    });
  }
  
  checkMobile();
  window.addEventListener('resize', checkMobile);
  
  setupInfiniteScroll();
  
  visibleMessages.value = Array.isArray(messages.value) ? messages.value : [];
  
  const { $socket, $socketConnect } = useNuxtApp();
  
  if ($socket && !$socket.connected) {
    $socketConnect();
    setTimeout(() => {
      setupWebSocketListeners();
      if (chatData.value && chatData.value._id) {
        const { $socketJoinChat } = useNuxtApp();
        $socketJoinChat(chatData.value._id);
      }
    }, 500);
  } else {
    setupWebSocketListeners();
    if (chatData.value && chatData.value._id) {
      const { $socketJoinChat } = useNuxtApp();
      $socketJoinChat(chatData.value._id);
    }
  }
});

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect();
  }
  
  const { $socket } = useNuxtApp();
  if ($socket) {
    $socket.off('connect');
    $socket.off('new-message');
    $socket.off('messages-read');
    
    if (chatData.value && chatData.value._id) {
      const { $socketLeaveChat } = useNuxtApp();
      $socketLeaveChat(chatData.value._id);
    }
  }
  
  window.removeEventListener('resize', checkMobile);
});

// Следим за изменением активного чата
watch(() => chatStore.activeChat, (newChat, oldChat) => {
  if (oldChat && oldChat._id) {
    const { $socketLeaveChat } = useNuxtApp();
    $socketLeaveChat(oldChat._id);
  }
  
  if (newChat && newChat._id) {
    const { $socketJoinChat } = useNuxtApp();
    $socketJoinChat(newChat._id);
    setupWebSocketListeners();
    setTimeout(() => {
      adjustContainerHeight();
    }, 100);
  }
  
  nextTick(() => {
    setupInfiniteScroll();
    scrollToBottom(true);
    if (isMobile.value) {
      selectChatMobile();
    }
  });
});

// Следим за изменениями в сообщениях
watch(messages, (newMessages) => {
  if (Array.isArray(newMessages)) {
    visibleMessages.value = newMessages;
    requestAnimationFrame(() => {
      nextTick(() => {
        scrollToBottom(true);
      });
    });
  }
}, { deep: true });

// Обработка нажатия клавиши Enter
const handleEnterKey = () => {
  if (isMobile.value) {
    addNewLine();
  } else {
    sendMessage();
  }
};

// Добавление новой строки при нажатии Shift+Enter
const addNewLine = () => {
  messageText.value += '\n';
  nextTick(() => {
    adjustTextareaHeight();
  });
};

// Функция отладки WebSocket
const debugWebSocket = () => {
  const { $socket, $socketConnect } = useNuxtApp();
  if (!$socket) return;
  
  if (!$socket.connected) {
    $socket.off('connect');
    $socket.off('new-message');
    $socket.off('messages-read');
    $socket.off('joined-chat');
    
    $socket.io.opts.transports = ['polling', 'websocket'];
    $socketConnect();
    
    setTimeout(() => {
      setupWebSocketListeners();
      if (chatData.value && chatData.value._id) {
        const { $socketJoinChat } = useNuxtApp();
        $socketJoinChat(chatData.value._id);
      }
    }, 1000);
  } else if (chatData.value && chatData.value._id) {
    const { $socketJoinChat } = useNuxtApp();
    $socketJoinChat(chatData.value._id);
    setupWebSocketListeners();
    chatStore.fetchMessages(chatData.value._id);
  }
};

// Настройка WebSocket слушателей
const setupWebSocketListeners = () => {
  const { $socket, $socketConnect, $socketJoinChat } = useNuxtApp();
  if (!$socket) return;
  
  if (!$socket.connected) {
    $socketConnect();
  } else if (chatData.value && chatData.value._id) {
    $socketJoinChat(chatData.value._id);
  }
  
  $socket.off('connect');
  $socket.off('new-message');
  $socket.off('messages-read');
  $socket.off('joined-chat');
  
  $socket.on('connect', () => {
    if (chatData.value && chatData.value._id) {
      $socketJoinChat(chatData.value._id);
    }
  });
  
  $socket.on('joined-chat', ({ chatId, success }) => {});
  
  $socket.on('new-message', ({ message, chatId }) => {
    if (chatData.value && chatData.value._id === chatId) {
      const isDuplicate = chatStore.messages.some(m => m._id === message._id);
      if (isDuplicate) return;
      
      if (message.media_type === 'image' && message.file) {
        message.imageLoaded = false;
        chatStore.messages.push({...message});
        
        const img = new Image();
        img.onload = () => {
          const msgIndex = chatStore.messages.findIndex(m => m._id === message._id);
          if (msgIndex !== -1) {
            chatStore.messages[msgIndex].imageLoaded = true;
          }
          if (isAtBottom.value) {
            nextTick(() => {
              scrollToBottom(true);
            });
          } else {
            showNewMessageIndicator.value = true;
          }
        };
        img.onerror = () => {
          const msgIndex = chatStore.messages.findIndex(m => m._id === message._id);
          if (msgIndex !== -1) {
            chatStore.messages[msgIndex].imageLoaded = true;
          }
          if (isAtBottom.value) {
            nextTick(() => {
              scrollToBottom(true);
            });
          } else {
            showNewMessageIndicator.value = true;
          }
        };
        img.src = message.file;
      } else {
        chatStore.messages.push({...message});
        if (isAtBottom.value) {
          nextTick(() => {
            scrollToBottom(true);
          });
        } else {
          showNewMessageIndicator.value = true;
        }
      }
      
      if (message.sender && message.sender._id !== authStore.user._id) {
        chatStore.markMessagesAsRead(chatId);
      }
    }
  });
  
  $socket.on('messages-read', ({ chatId, userId }) => {
    if (chatData.value && chatData.value._id === chatId) {
      chatStore.updateMessagesReadStatus(chatId, userId);
    }
  });
};

// Открытие настроек чата
const openChatSettings = () => {
  showChatSettingsModal.value = true;
};

// Открытие профиля пользователя
const openUserProfile = (userId) => {
  if (!userId) return;
  console.log('Открытие профиля пользователя:', userId);
  // Здесь будет код для открытия профиля пользователя
  // Например, переход на страницу профиля
  // navigateTo(`/profile/${userId}`);
};
</script>

<style lang="sass">
@import '@variables'

.chat-page
  height: 100vh
  width: 100%
  display: flex
  flex-direction: column
  position: relative
  
  .page_header
    padding: 10px 
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

      &__icon
        transform: rotate(90deg)
      
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
    width: 100%
    overflow: hidden
  
  .messages_container
    flex: 1 1 auto
    overflow-y: auto
    padding: 0px 20px
    display: flex
    width: 100%
    flex-direction: column
    position: relative
    z-index: 1
    @include custom-scrollbar
    >*
      max-width: 700px;
      width: 100%;
      align-self: center;
    
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
        width: 20px
        height: 20px
        border: 2px solid rgba(255, 255, 255, 0.3)
        border-radius: 50%
        border-top-color: $white
        animation: spin 1s ease-in-out infinite
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
        width: max-content
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
  
  .input_area
    align-self: center
    max-width: 700px
    width: 100%
    padding: 5px 10px
    flex: 0 0 auto
    position: relative
    z-index: 2
    
    .editing-indicator
      display: flex
      align-items: center
      justify-content: space-between
      padding: 5px 10px
      background-color: rgba(255, 255, 255, 0.1)
      border-radius: 10px
      margin-bottom: 10px
      
      .editing-text
        color: $white
        font-size: 14px
        
        i
          margin-right: 5px
      
      .cancel-btn
        background-color: transparent
        border: none
        color: $white
        font-size: 16px
        cursor: pointer
        
        &:hover
          color: rgba(255, 255, 255, 0.8)
    
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

  
@keyframes spin
  0%
    transform: rotate(0deg)
  100%
    transform: rotate(360deg)


.scroll-btn-enter-active, .scroll-btn-leave-active
  transition: opacity 0.5s ease, transform 0.5s ease

.scroll-btn-enter-from, .scroll-btn-leave-to
  opacity: 0
  transform: translateY(20px)


@include mobile
  .chat-page
    display: flex
    flex-direction: column
    height: 100vh
    overflow: hidden
    
    .chat-content
      display: flex
      flex-direction: column
      height: 100%
      width: 100%
      overflow: hidden
      
    .page_header
      flex: 0 0 auto
      
    .messages_container
      flex: 1 1 auto
      overflow-y: auto
      position: relative
      z-index: 1
      min-height: 0 // Предотвращает переполнение
      
    .input_area
      flex: 0 0 auto
      width: 100%
      position: relative
      
    .message_wrap
      .message
        max-width: 90%

// Стили изображений перенесены в компонент Message
</style>