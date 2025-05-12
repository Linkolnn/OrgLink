<template>
  <div class="chat-page" :class="{ 'ios-safari-chat': isIOSSafari }">
    <!-- Если чат выбран -->
    <Transition name="chat-fade" mode="out-in" :duration="{ leave: 2000 }">
      <div v-if="chatData && chatData._id" class="chat-content" key="chat-content">
      <!-- Шапка чата -->
      <div class="page_header" ref="pageHeader" @click="openChatSettings">
        <!-- Кнопка переключения боковой панели для мобильных устройств -->
        <button class="toggle-sidebar-btn" @click.stop="toggleSidebar($event)">
          <IconBottomArrow class="toggle-sidebar-btn__icon" filled />
        </button>
        
        <div class="content">
          <div 
            class="content__img" 
            :style="chatData.avatar ? `background-image: url(${secureUrl(chatData.avatar)})` : ''"
          >
            <div v-if="!chatData.avatar" class="initials">
              <template v-if="chatStore.isPrivateChat(chatData)">
                {{ getInitials(getOtherParticipantName(chatData)) }}
              </template>
              <template v-else>
                {{ getInitials(chatData.name) }}
              </template>
            </div>
          </div>
          <div class="content__textblock">
            <!-- Для личных чатов показываем имя собеседника, а не название чата -->
            <div class="text bold">
              <!-- Показываем индикатор предпросмотра, если мы в этом режиме -->
              <template v-if="chatStore.isPrivateChat(chatData)">
                {{ getOtherParticipantName(chatData) }}
              </template>
              <template v-else>
                {{ chatData.name }}
              </template>
            </div>
            <!-- Показываем количество участников только в групповых чатах -->
            <div v-if="chatStore.isGroupChat(chatData)" class="text member">{{ chatData.participants?.length || 0 }} участник(ов)</div>
          </div>
        </div>
        
        <div class="chat-actions">
          <UiNotificationControl v-if="chatData && chatData._id" :chatId="chatData._id" />
        </div>
      </div>
      
      <!-- Контейнер сообщений -->
      <div :class="['messages_container', isContextMenuOpen ? 'scroll-disabled' : '']" ref="messagesContainer" @scroll="checkIfAtBottom">
        
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
            <ChatMessage 
              :message="message" 
              :is-group-chat="chatStore.isGroupChat(chatData)"
              :is-mobile="isMobile.value"
              @edit="startEditingMessage"
              @delete="deleteMessage"
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
      <div class="chat-input-wrapper">
        <ChatInputArea 
          ref="inputArea"
          :chatId="chatData._id" 
          @message-sent="handleMessageSent" 
          @editing-started="handleEditingStarted" 
          @editing-cancelled="handleEditingCancelled" 
          @editing-saved="handleEditingSaved" 
        />
      </div>
    </div>
    </Transition>
        <!-- Если чат не выбран или данные еще не загружены -->
    <div v-if="!chatData || !chatData._id" class="no-chat-selected">
      Выберите чат, чтобы начать общение
    </div>
  </div>
  <ChatSettingsModal 
    v-if="showChatSettingsModal" 
    :is-open="showChatSettingsModal" 
    v-model:chat-data="chatData" 
    :is-new-chat="false" 
    @close="showChatSettingsModal = false" 
    @saved="onChatUpdated" 
  />
  <!-- Контекстное меню перемещено в компонент Message -->
</template>

<script setup>
  import { useChatStore } from '~/stores/chat';
import { useAuthStore } from '~/stores/auth';
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue';
import { secureUrl, safeFetch, handleApiResponse } from '~/utils/api';
// Nuxt.js автоматически регистрирует компоненты, поэтому импорт не нужен

// Хранилища
const chatStore = useChatStore();
const authStore = useAuthStore();

// Данные текущего чата
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

// Состояние контекстного меню
const isContextMenuOpen = ref(false);

// Определение iOS Safari
const isIOSSafari = ref(false);

// Функция для определения iOS устройств и Safari
const detectIOSDevice = () => {
  if (process.client) {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    
    isIOSSafari.value = isIOS && isSafari;
    console.log('Определение устройства в чате:', { isIOS, isSafari, isIOSSafari: isIOSSafari.value });
    
    if (isIOSSafari.value) {
      // Добавляем класс к body для глобальных стилей
      document.body.classList.add('ios-safari-body');
      
      // Устанавливаем CSS-переменную для использования в стилях
      document.documentElement.style.setProperty('--safari-bottom-padding', '44px');
    }
  }
};

// Импортируем хранилище контекстного меню
import { useContextMenuStore } from '@/stores/contextMenu';

// Состояние контекстного меню теперь управляется в компоненте ContextMenu.vue

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
// Контекстное меню перемещено в компонент Message
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

// При монтировании компонента
onMounted(() => {
  // Определяем, является ли устройство iOS с Safari
  if (process.client) {
    detectIOSDevice();
  }
  
  // Добавляем обработчик события прокрутки
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('scroll', handleScroll);
  }
});

// Обработчики событий от компонента ChatInputArea
// Обработчик отправки сообщения
const handleMessageSent = async ({ chatId, text, files, audio }) => {
  console.log('[Chat] Сообщение отправлено:', { chatId, text, files, audio });
  
  try {
    // Проверяем, является ли чат превью-чатом
    const isPreviewChat = chatId.startsWith('preview_');
    
    if (isPreviewChat && chatStore.isPreviewMode) {
      console.log('[Chat] Отправка сообщения в режиме предпросмотра');
      
      // Создаем реальный чат и отправляем сообщение
      console.log('[Chat] Создаем реальный чат из предпросмотра с сообщением:', text);
      
      // Вызываем метод sendMessageInPreviewMode, который создает чат и отправляет сообщение
      const newChat = await chatStore.sendMessageInPreviewMode(text, files);
      console.log('[Chat] Чат создан и сообщение отправлено:', newChat);
      
      // Обновляем данные чата в компоненте через хранилище
      if (newChat) {
        // Вместо прямого присваивания используем метод setActiveChat
        chatStore.setActiveChat(newChat._id);
        
        // Прокручиваем вниз для отображения нового сообщения
        nextTick(() => {
          scrollToBottom(true);
        });
      }
    } else {
      // Обычная отправка сообщения в существующий чат
      await chatStore.sendMessage({
        chatId,
        text,
        files
      });

      console.log('[Chat] Сообщение успешно отправлено');
      
      // Прокручиваем чат вниз
      nextTick(() => {
        scrollToBottom(true);
      });
    }
  } catch (error) {
    console.error('[Chat] Ошибка при отправке сообщения:', error);
  }
};

// Обработчик начала редактирования сообщения
const handleEditingStarted = ({ message, originalText }) => {
  console.log('[Chat] Начато редактирование сообщения:', message);
  selectedMessage.value = message;
  isEditingMessage.value = true;
  originalMessageText.value = originalText;
};

// Обработчик отмены редактирования сообщения
const handleEditingCancelled = () => {
  console.log('[Chat] Редактирование сообщения отменено');
  selectedMessage.value = null;
  isEditingMessage.value = false;
  originalMessageText.value = '';
};

// Обработчик сохранения отредактированного сообщения
const handleEditingSaved = ({ messageId, newText }) => {
  console.log('[Chat] Сохранено отредактированное сообщение:', { messageId, newText });
  selectedMessage.value = null;
  isEditingMessage.value = false;
  originalMessageText.value = '';
};

// Функция для редактирования сообщений
const handleEditMessage = async () => {
  if (!messageText.value.trim()) return;
  
  if (isEditingMessage.value && selectedMessage.value) {
    await saveEditedMessage();
    return;
  }
};
  
// Функция для отправки сообщений теперь реализована в handleMessageSent

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
  const hasSender = Boolean(message?.sender);
  const hasUser = Boolean(authStore.user);
  const senderId = message?.sender?._id;
  const userId = authStore.user?._id;
  const isOwn = hasSender && hasUser && senderId === userId;
  
  console.log('Проверка isOwnMessage:', {
    hasSender,
    hasUser,
    senderId,
    userId,
    isOwn
  });
  
  // Временно всегда возвращаем true для отладки
  return true;
  
  // Оригинальная проверка
  // return isOwn;
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

// Контекстное меню перемещено в компонент Message

// Функции для редактирования сообщений
const startEditingMessage = (message) => {
  console.log('Вызвана функция startEditingMessage в Chat/index.vue', message);
  console.log('Детали сообщения в Chat/index.vue:', {
    id: message?._id,
    text: message?.text,
    sender: message?.sender?._id,
    'authStore.user._id': authStore.user?._id,
    'isOwnMessage': message && isOwnMessage(message)
  });
  
  try {
    // Проверка на существование сообщения
    if (!message) {
      console.error('Невозможно редактировать: сообщение не передано');
      return;
    }
    
    // Проверка на собственное сообщение
    if (!isOwnMessage(message)) {
      console.error('Невозможно редактировать: это не ваше сообщение');
      return;
    }
    
    console.log('Начинаем редактирование сообщения в Chat/index.vue');
    
    // Вызываем функцию в InputArea
    if (inputArea.value && typeof inputArea.value.startEditingMessage === 'function') {
      console.log('Вызываем startEditingMessage в InputArea');
      inputArea.value.startEditingMessage(message);
    } else {
      console.error('Не найдена функция startEditingMessage в InputArea');
      
      // Если не найдена функция в InputArea, устанавливаем режим редактирования напрямую
      originalMessageText.value = message.text;
      editingMessageText.value = message.text;
      messageText.value = message.text;
      selectedMessage.value = message;
      isEditingMessage.value = true;
      
      console.log('Режим редактирования активирован напрямую:', {
        isEditingMessage: isEditingMessage.value,
        selectedMessage: selectedMessage.value?._id,
        messageText: messageText.value
      });
    }
  } catch (error) {
    console.error('Ошибка в функции startEditingMessage:', error);
  }
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
  console.log('Вызвана функция deleteMessage в Chat/index.vue', message);
  console.log('Детали сообщения для удаления в Chat/index.vue:', {
    id: message?._id,
    text: message?.text,
    sender: message?.sender?._id,
    'authStore.user._id': authStore.user?._id,
    'isOwnMessage': message && isOwnMessage(message)
  });
  
  try {
    // Проверка на существование сообщения
    if (!message) {
      console.error('Невозможно удалить: сообщение не передано');
      return;
    }
    
    // Проверка на собственное сообщение
    if (!isOwnMessage(message)) {
      console.error('Невозможно удалить: это не ваше сообщение');
      return;
    }
    
    console.log('Начинаем удаление сообщения в Chat/index.vue');
    
    // Вызываем API для удаления сообщения
    await chatStore.deleteMessage({
      messageId: message._id,
      chatId: chatData.value._id
    });
    
    console.log('Сообщение успешно удалено:', message._id);
  } catch (error) {
    console.error('Ошибка при удалении сообщения:', error);
  }
};

// Обработка клика на сообщении
const handleMessageClick = (event, message) => {
  // Показываем контекстное меню при клике на любом устройстве
  showContextMenu(event, message);
};

// Функция для переключения боковой панели на мобильных устройствах
const toggleSidebar = (event) => {
  // Предотвращаем всплытие события, если оно передано
  if (event) {
    event.stopPropagation();
  }
  
  // Сохраняем ссылку на текущий активный чат для последующего сброса
  const currentActiveChat = chatStore.activeChat;
  
  // СНАЧАЛА СБРАСЫВАЕМ АКТИВНЫЙ ЧАТ
  if (chatStore.activeChat && currentActiveChat && chatStore.activeChat._id === currentActiveChat._id) {
    // Сохраняем ID чата для уведомлений
    chatStore.inactiveChatId = currentActiveChat._id;
    
    // Напрямую сбрасываем активный чат
    chatStore.activeChat = null;
    console.log('[Chat] Сброшен активный чат');
    
    // Обновляем список чатов
    chatStore.chatListUpdateTrigger++;
  }
  
  // Добавляем небольшую задержку перед показом боковой панели
  setTimeout(() => {
    // ЗАТЕМ ПОКАЗЫВАЕМ БОКОВУЮ ПАНЕЛЬ
    const nuxtApp = useNuxtApp();
    const { $toggleSidebar } = nuxtApp;
    
    if ($toggleSidebar) {
      // Если плагин доступен, используем его
      $toggleSidebar(true); // Явно указываем, что нужно показать боковую панель
      console.log('[Chat] Вызван $toggleSidebar(true)');
    } else if (nuxtApp && nuxtApp.$sidebarVisible !== undefined) {
      // Запасной вариант - используем старый метод
      nuxtApp.$sidebarVisible.value = true; // Явно устанавливаем в true
      console.log('[Chat] Установлено nuxtApp.$sidebarVisible.value = true');
    } else {
      // Если ничего не доступно, используем прямое изменение DOM
      const app = document.querySelector('.app');
      if (app) {
        app.classList.add('sidebar-visible'); // Используем add вместо toggle
        console.log('[Chat] Добавлен класс sidebar-visible напрямую');
      }
    }
    
    // Также напрямую добавляем класс видимости к самому компоненту SideBar
    const sideBar = document.querySelector('.messenger-sidebar');
    if (sideBar) {
      sideBar.classList.add('visible');
      console.log('[Chat] Добавлен класс visible к .messenger-sidebar');
    }
  }, 150); // Небольшая задержка перед показом боковой панели
};

// Предотвращаем появление SideBar при фокусе на поле ввода
const preventSidebarOnFocus = (event) => {
  event.stopPropagation();
  
  // Убедимся, что SideBar скрыт на мобильных устройствах
  if (isMobile.value) {
    const nuxtApp = useNuxtApp();
    if (nuxtApp && nuxtApp.$sidebarVisible !== undefined && nuxtApp.$sidebarVisible.value) {
      nuxtApp.$sidebarVisible.value = false;
      console.log('[Chat] Скрываем SideBar при фокусе на поле ввода');
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
  if (!inputArea.value || !messagesContainer.value || !pageHeader.value) {
    console.warn('Missing refs:', {
      inputArea: inputArea.value,
      messagesContainer: messagesContainer.value,
      pageHeader: pageHeader.value
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
  // Теперь inputArea это компонент Vue, поэтому нужно получить его DOM-элемент
  const inputAreaHeight = inputArea.value.$el ? inputArea.value.$el.offsetHeight : 0;

  // Получаем высоту .page_header
  const headerHeight = pageHeader.value.offsetHeight || 60; // Фоллбэк на 60px
  
  // Определяем, запущено ли приложение в режиме PWA или в полноэкранном режиме
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                window.matchMedia('(display-mode: fullscreen)').matches || 
                window.navigator.standalone === true; // Для iOS
  
  // Выбираем значение vh в зависимости от типа устройства и режима приложения
  let viewportHeight;
  
  if (isMobile.value) {
    // Для мобильных устройств
    viewportHeight = isPWA ? '99vh' : '90vh'; // Если PWA, то используем 99vh, иначе 90vh
  } else {
    // Для десктопа
    viewportHeight = '99vh';
  }
  
  console.log(`[Chat] Using ${viewportHeight} for device type: ${isMobile.value ? 'mobile' : 'desktop'}, PWA mode: ${isPWA}`);

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

// Проверяем ширину экрана и режим приложения при загрузке и при изменении размера окна
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
  adjustContainerHeight();
};

// Отслеживаем изменения режима отображения (PWA или браузер)
const setupDisplayModeListener = () => {
  const displayModeMediaQuery = window.matchMedia('(display-mode: standalone)');
  const fullscreenModeMediaQuery = window.matchMedia('(display-mode: fullscreen)');
  
  // Обработчик изменения режима отображения
  const handleDisplayModeChange = () => {
    console.log('[Chat] Display mode changed, adjusting container height');
    adjustContainerHeight();
  };
  
  // Добавляем слушатели для обоих режимов
  displayModeMediaQuery.addEventListener('change', handleDisplayModeChange);
  fullscreenModeMediaQuery.addEventListener('change', handleDisplayModeChange);
  
  // Возвращаем функцию для удаления слушателей
  return () => {
    displayModeMediaQuery.removeEventListener('change', handleDisplayModeChange);
    fullscreenModeMediaQuery.removeEventListener('change', handleDisplayModeChange);
  };
};

// Жизненный цикл компонента
onMounted(() => {
  console.log('[Chat] Монтирование компонента');
  
  const nuxtApp = useNuxtApp();
  if (nuxtApp && nuxtApp.$sidebarVisible !== undefined) {
    nuxtApp.$sidebarVisible.value = false;
    sidebarVisible.value = false;
    
    // Синхронизация с глобальным состоянием
    watch(nuxtApp.$sidebarVisible, (newValue) => {
      sidebarVisible.value = newValue;
    });
  }
  
  checkMobile();
  window.addEventListener('resize', checkMobile);
  
  // Настраиваем отслеживание режима отображения (PWA или браузер)
  const removeDisplayModeListener = setupDisplayModeListener();
  
  setupInfiniteScroll();
  
  visibleMessages.value = Array.isArray(messages.value) ? messages.value : [];
  console.log('[Chat] Начальное количество сообщений:', visibleMessages.value.length);
  
  const { $socket, $socketConnect } = useNuxtApp();
  console.log('[WebSocket] Статус при монтировании:', $socket?.connected);
  
  if ($socket && !$socket.connected) {
    console.log('[WebSocket] Подключение при монтировании...');
    $socketConnect();
    setTimeout(() => {
      console.log('[WebSocket] Настройка слушателей после подключения');
      setupWebSocketListeners();
    }, 1000);
  } else {
    console.log('[WebSocket] Настройка слушателей при монтировании');
    setupWebSocketListeners();
  }
  
  if (chatData.value && chatData.value._id) {
    const { $socketJoinChat } = useNuxtApp();
    $socketJoinChat(chatData.value._id);
  }
  
  // Сохраняем функцию удаления слушателя для использования при размонтировании
  onUnmounted(() => {
    removeDisplayModeListener();
    window.removeEventListener('resize', checkMobile);
    
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
  });
});

// Следим за изменением активного чата
watch(() => chatStore.activeChat, (newChat, oldChat) => {
  console.log('[Chat] Изменение активного чата:', newChat?._id);
  
  if (oldChat && oldChat._id) {
    console.log('[WebSocket] Покидаем чат:', oldChat._id);
    const { $socketLeaveChat } = useNuxtApp();
    $socketLeaveChat(oldChat._id);
  }
  
  if (newChat && newChat._id) {
    console.log('[WebSocket] Присоединяемся к чату:', newChat._id);
    const { $socketJoinChat } = useNuxtApp();
    $socketJoinChat(newChat._id);
    console.log('[WebSocket] Переустановка слушателей для нового чата');
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

// Обработка обновления сообщений
watch(messages, (newMessages) => {
  console.log('[Chat] Обновление сообщений, количество:', newMessages?.length);
  
  if (Array.isArray(newMessages)) {
    visibleMessages.value = newMessages;
    console.log('[Chat] Обновлены видимые сообщения, количество:', visibleMessages.value.length);
    
    requestAnimationFrame(() => {
      nextTick(() => {
        console.log('[Chat] Прокрутка вниз после обновления сообщений');
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
  if (!$socket) {
    console.error('[WebSocket] Socket не доступен');
    return;
  }
  
  console.log('[WebSocket] Настройка слушателей, статус подключения:', $socket.connected);
  
  if (!$socket.connected) {
    console.log('[WebSocket] Попытка подключения...');
    $socketConnect();
  } else if (chatData.value && chatData.value._id) {
    console.log('[WebSocket] Подключение к чату:', chatData.value._id);
    $socketJoinChat(chatData.value._id);
  }
  
  $socket.off('connect');
  $socket.off('new-message');
  $socket.off('messages-read');
  $socket.off('joined-chat');
  
  $socket.on('connect', () => {
    console.log('[WebSocket] Соединение установлено');
    if (chatData.value && chatData.value._id) {
      console.log('[WebSocket] Присоединение к чату после подключения:', chatData.value._id);
      $socketJoinChat(chatData.value._id);
    }
  });
  
  $socket.on('joined-chat', ({ chatId, success }) => {
    console.log('[WebSocket] Присоединился к чату:', chatId, 'Успешно:', success);
  });
  
  $socket.on('new-message', ({ message, chatId }) => {
    console.log('[WebSocket] Получено новое сообщение:', message, 'для чата:', chatId);
    console.log('[WebSocket] Текущий активный чат:', chatData.value?._id);
    
    if (chatData.value && chatData.value._id === chatId) {
      console.log('[WebSocket] Сообщение для текущего чата');
      
      // Проверяем, не является ли сообщение дубликатом
      const isDuplicate = chatStore.messages.some(m => m._id === message._id);
      if (isDuplicate) {
        console.log('[WebSocket] Дубликат сообщения, пропускаем:', message._id);
        return;
      }
      
      console.log('[WebSocket] Добавление нового сообщения в хранилище, тип:', message.type || message.media_type);
      
      // Проверяем, является ли сообщение служебным
      if (message.type === 'service') {
        console.log('[WebSocket] Обработка служебного сообщения');
        
        try {
          // Важно: создаем новый массив для реактивности
          const newMessages = [...chatStore.messages, {...message}];
          console.log('[WebSocket] Обновление хранилища сообщений, количество:', newMessages.length);
          chatStore.messages = newMessages;
          
          // Прокручиваем к новому сообщению, если пользователь находится внизу чата
          if (isAtBottom.value) {
            console.log('[WebSocket] Прокрутка вниз');
            nextTick(() => {
              scrollToBottom(true);
            });
          } else {
            console.log('[WebSocket] Показ индикатора новых сообщений');
            showNewMessageIndicator.value = true;
          }
        } catch (error) {
          console.error('[WebSocket] Ошибка при обработке служебного сообщения:', error);
        }
      }
      // Обработка изображений
      else if (message.media_type === 'image' && message.file) {
        console.log('[WebSocket] Обработка изображения');
        
        // Устанавливаем флаг, что изображение еще не загружено
        message.imageLoaded = false;
        
        try {
          // Важно: создаем новый массив для реактивности
          const newMessages = [...chatStore.messages, {...message}];
          console.log('[WebSocket] Обновление хранилища сообщений, количество:', newMessages.length);
          chatStore.messages = newMessages;
          
          // Загружаем изображение
          const img = new Image();
          img.onload = () => {
            console.log('[WebSocket] Изображение загружено:', message._id);
            const msgIndex = chatStore.messages.findIndex(m => m._id === message._id);
            
            if (msgIndex !== -1) {
              // Создаем новый массив с обновленным сообщением для реактивности
              const updatedMessages = [...chatStore.messages];
              updatedMessages[msgIndex] = {...updatedMessages[msgIndex], imageLoaded: true};
              console.log('[WebSocket] Обновление статуса изображения');
              chatStore.messages = updatedMessages;
            }
            
            // Прокручиваем к новому сообщению, если пользователь находится внизу чата
            if (isAtBottom.value) {
              console.log('[WebSocket] Прокрутка вниз после загрузки изображения');
              nextTick(() => {
                scrollToBottom(true);
              });
            } else {
              console.log('[WebSocket] Показ индикатора новых сообщений');
              showNewMessageIndicator.value = true;
            }
          };
          
          img.onerror = (err) => {
            console.error('[WebSocket] Ошибка загрузки изображения:', err);
            const msgIndex = chatStore.messages.findIndex(m => m._id === message._id);
            
            if (msgIndex !== -1) {
              // Создаем новый массив с обновленным сообщением для реактивности
              const updatedMessages = [...chatStore.messages];
              updatedMessages[msgIndex] = {...updatedMessages[msgIndex], imageLoaded: true};
              chatStore.messages = updatedMessages;
            }
            
            // Прокручиваем к новому сообщению, если пользователь находится внизу чата
            if (isAtBottom.value) {
              nextTick(() => {
                scrollToBottom(true);
              });
            } else {
              showNewMessageIndicator.value = true;
            }
          };
          
          img.src = message.file;
        } catch (error) {
          console.error('[WebSocket] Ошибка при обработке изображения:', error);
        }
      } else {
        console.log('[WebSocket] Обработка обычного сообщения');
        
        try {
          // Важно: создаем новый массив для реактивности
          const newMessages = [...chatStore.messages, {...message}];
          console.log('[WebSocket] Обновление хранилища сообщений, количество:', newMessages.length);
          chatStore.messages = newMessages;
          
          // Обновляем groupedMessages для отображения
          console.log('[WebSocket] Текущие сгруппированные сообщения:', groupedMessages.value.length);
          
          // Прокручиваем к новому сообщению, если пользователь находится внизу чата
          if (isAtBottom.value) {
            console.log('[WebSocket] Прокрутка вниз');
            nextTick(() => {
              scrollToBottom(true);
            });
          } else {
            console.log('[WebSocket] Показ индикатора новых сообщений');
            showNewMessageIndicator.value = true;
          }
        } catch (error) {
          console.error('[WebSocket] Ошибка при обработке сообщения:', error);
        }
      }
      
      if (message.sender && message.sender._id !== authStore.user._id) {
        chatStore.markMessagesAsRead(chatId);
      }
    }
  });
  
  $socket.on('messages-read', ({ chatId, userId }) => {
    console.log('[WebSocket] Сообщения прочитаны в чате:', chatId, 'пользователем:', userId);
    if (chatData.value && chatData.value._id === chatId) {
      chatStore.updateMessagesReadStatus(chatId, userId);
    }
  });
  
  // Обработчик обновления сообщения
  $socket.on('messageUpdated', ({ message, chatId }) => {
    console.log('[WebSocket] Получено обновленное сообщение:', message, 'для чата:', chatId);
    
    if (chatData.value && chatData.value._id === chatId) {
      // Находим индекс сообщения в массиве
      const messageIndex = chatStore.messages.findIndex(m => m._id === message._id);
      
      if (messageIndex !== -1) {
        // Создаем новый массив для реактивности
        const updatedMessages = [...chatStore.messages];
        // Обновляем сообщение, сохраняя свойства, которые могут отсутствовать в обновленном сообщении
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          ...message,
          // Сохраняем статус загрузки изображения, если он был
          imageLoaded: updatedMessages[messageIndex].imageLoaded || false
        };
        
        console.log('[WebSocket] Обновление сообщения в хранилище');
        chatStore.messages = updatedMessages;
      }
    }
  });
  
  // Обработчик удаления сообщения
  $socket.on('messageDeleted', ({ chatId, messageId }) => {
    console.log('[WebSocket] Получено уведомление об удалении сообщения:', messageId, 'из чата:', chatId);
    
    if (chatData.value && chatData.value._id === chatId) {
      // Фильтруем сообщения, исключая удаленное
      const filteredMessages = chatStore.messages.filter(m => m._id !== messageId);
      
      if (filteredMessages.length !== chatStore.messages.length) {
        console.log('[WebSocket] Удаление сообщения из хранилища');
        chatStore.messages = filteredMessages;
      }
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

// Проверяем, находимся ли в режиме предпросмотра
const isPreviewMode = computed(() => {
  return chatStore.isPreviewMode;
});

// Получение имени собеседника в личном чате
const getOtherParticipantName = (chat) => {
  if (!chat || !chat.participants || chat.participants.length === 0) {
    return chat.name || 'Чат';
  }
  
  // Получаем ID текущего пользователя
  const currentUserId = authStore.user?._id;
  
  // Находим собеседника (не текущего пользователя)
  const otherParticipant = chat.participants.find(p => p._id !== currentUserId);
  
  // Возвращаем имя собеседника или название чата, если собеседник не найден
  return otherParticipant?.name || chat.name || 'Чат';
};
</script>
<style lang="sass" scoped>
@import '~/assets/styles/variables.sass'
// Анимация для плавного исчезновения чата
.chat-fade-enter-active
  transition: opacity 0.5s ease

.chat-fade-leave-active
  transition: opacity 2s ease

.chat-fade-enter-from,
.chat-fade-leave-to
  opacity: 0

.chat-page 
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
  overflow: hidden;
  // background-color: $chat-bg;

  display: flex
  align-items: center
  justify-content: space-between
  border-bottom: 1px solid rgba(255, 255, 255, 0.1)
  
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
    align-items: center
    flex-direction: column
    z-index: 1
    @include custom-scrollbar
    >*
      max-width: 700px
      width: 100%
      
  .chat-input-wrapper
    width: 100%
    padding: 10px 0px
    max-width: 700px
    align-self: center
    @include custom-scrollbar
    >*
      max-width: 700px;
      width: 100%;
      align-self: center;
    
    .loading-trigger
      height: 20px
      margin-bottom: 10px
    
  // Стили для индикаторов загрузки перемещены на уровень выше
    
  // Стили для пустого чата перемещены на уровень выше
    
  .loading-indicator
    display: flex
    align-items: center
    justify-content: center
    padding: 10px
    color: $white
    
    &.loading-more
      margin-bottom: 10px
      opacity: 0.7
    
    &.initial-loading
      position: absolute
      top: 50%
      left: 50%
      transform: translate(-50%, -50%)
      height: 100px
      margin: auto
    
    .spinner
      width: 20px
      height: 20px
      border: 2px solid rgba(255, 255, 255, 0.3)
      border-radius: 50%
      border-top-color: $white
      animation: spin 1s ease-in-out infinite
      margin-right: 10px
      will-change: transform // Оптимизация для анимации
  
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
    
    // Стили для служебных сообщений перенесены в компонент Message.vue
    
    .message_wrap
      margin-bottom: 10px
      width: 100%
      display: flex
      flex-direction: column
      
      .message
        display: flex
        width: max-content
        max-width: 70%
        min-width: 12%
        margin-bottom: 5px
        
        &.own
          align-self: flex-end
          
          .message__content
            background-color: $purple
            border-radius: 15px 15px 0 15px
        
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
    flex: 0 0 auto
    position: relative
    
    .editing-indicator
      display: flex
      align-items: center
      justify-content: space-between
      padding: 5px 10px
      background-color: rgba(255, 255, 255, 0.1)
      border-radius: $radius
      margin-bottom: 10px
      
      .editing-text
        color: $white
        font-size: 14px
        
        i
          margin-right: 5px
      
      .cancel-btn
        border-radius: 50%
        background-color: $purple
        color: $white
        font-size: 20px
        padding: 0px 10px 5px
        cursor: pointer
        transition: color 0.2s
        
        &:hover
          color: darken($purple, 10%)
    
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

@include tablet
  .input_area
    padding: 5px 14px


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
      z-index: 1
      min-height: 0 // Предотвращает переполнение

    .message_wrap
      .message
        max-width: 90%

// Стили изображений перенесены в компонент Message
</style>