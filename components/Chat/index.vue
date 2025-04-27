<template>
  <div class="chat-page">
    <!-- Если чат не выбран -->
    <div v-if="!chatData._id" class="no-chat-selected">
      Выберите чат, чтобы начать общение
    </div>
    
    <!-- Если чат выбран -->
    <div v-else class="chat-content">
      <!-- Шапка чата -->
      <div class="page_header">
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
        </div>
      </div>
      
      <!-- Контейнер сообщений -->
      <div class="messages_container" ref="messagesContainer">
        <!-- Триггер для загрузки дополнительных сообщений -->
        <div v-if="loading" ref="loadingTrigger" class="loading-trigger"></div>
        
        <!-- Индикатор загрузки -->
        <div v-if="loading" class="loading-indicator">
          <div class="spinner"></div>
          Загрузка сообщений...
        </div>
        
        <!-- Если сообщений нет -->
        <div v-if="!loading && messages.length === 0" class="empty-chat">
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
      </div>
      
      <!-- Input area -->
      <div class="input_area" ref="inputArea">
        <div class="input_container" ref="inputContainer">
          <textarea 
            v-model="messageText" 
            class="message_input" 
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
  <ManageParticipantsModal v-if="showManageParticipantsModal" @close="showManageParticipantsModal = false" />
  <EditChatModal v-if="showEditChatModal" @close="showEditChatModal = false" />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useChatStore } from '~/stores/chat';
import { useAuthStore } from '~/stores/auth';
import ManageParticipantsModal from './ManageParticipantsModal.vue';
import EditChatModal from './EditChatModal.vue';

// Хранилища
const chatStore = useChatStore();
const authStore = useAuthStore();

// Данные чата и сообщений
const chatData = computed(() => chatStore.activeChat || {});
const messages = computed(() => chatStore.messages || []);

// Состояние загрузки
const loading = computed(() => chatStore.loading);

// Модальные окна
const showEditChatModal = ref(false);
const showManageParticipantsModal = ref(false);

// Видимые сообщения (для бесконечной прокрутки)
const visibleMessages = ref([]);
const loadingTrigger = ref(null);
const messagesContainer = ref(null);
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
  const groups = {};
  messages.value.forEach(message => {
    const date = new Date(message.createdAt || message.timestamp);
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
  
  if (!loadingTrigger.value) return;
  
  observer.value = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !loading.value && chatStore.hasMoreMessages) {
      loadMoreMessages();
    }
  });
  
  observer.value.observe(loadingTrigger.value);
};

// Загрузка дополнительных сообщений
const loadMoreMessages = async () => {
  if (!chatData.value._id || loading.value || !chatStore.hasMoreMessages) return;
  
  await chatStore.loadMoreMessages(chatData.value._id);
};

// Прокрутка к последнему сообщению
const scrollToBottom = () => {
  if (!messagesContainer.value) return;
  
  // Прокручиваем к нижней части контейнера
  messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
};

// Отправка сообщения
const sendMessage = async () => {
  if (!messageText.value.trim() || !chatData.value._id) return;
  
  try {
    await chatStore.sendMessage(chatData.value._id, {
      text: messageText.value,
      media_type: 'none'
    });
    
    messageText.value = '';
    // Сбрасываем высоту textarea
    if (messageInput.value) {
      messageInput.value.style.height = 'auto';
    }
    nextTick(() => {
      scrollToBottom();
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
  return message.sender?._id === authStore.user?._id;
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

// Жизненный цикл компонента
onMounted(() => {
  nextTick(() => {
    setupInfiniteScroll();
    scrollToBottom();
  });
  
  // Инициализация видимых сообщений
  visibleMessages.value = messages.value;
});

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect();
  }
});

// Следим за изменениями в сообщениях
watch(messages, (newMessages) => {
  visibleMessages.value = newMessages;
  nextTick(() => {
    scrollToBottom();
  });
}, { deep: true });

// Следим за изменением активного чата
watch(() => chatStore.activeChat, () => {
  nextTick(() => {
    setupInfiniteScroll();
    scrollToBottom();
  });
});

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
</script>

<style lang="sass" scoped>
@import '~/assets/styles/variables'

.chat-page
  height: 100vh
  width: 100%
  display: flex
  flex-direction: column
  background: $primary-bg
  position: relative
  
  .page_header
    padding: 15px
    background-color: $header-bg
    display: flex
    align-items: center
    justify-content: space-between
    border-bottom: 1px solid rgba(255, 255, 255, 0.1)
    height: 80px
    
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
    background-color: $primary-bg
  
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
    background-color: $primary-bg
    @include custom-scrollbar
    
    .loading-trigger
      height: 20px
      margin-bottom: 10px
    
    .loading-indicator
      text-align: center
      padding: 10px
      color: rgba(255, 255, 255, 0.5)
      
      .spinner
        display: inline-block
        width: 20px
        height: 20px
        border: 2px solid rgba(255, 255, 255, 0.3)
        border-radius: 50%
        border-top-color: $white
        animation: spin 1s linear infinite
    
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
        padding: 10px 15px
        border-radius: $radius 
        background-color: $header-bg
        color: $white
        resize: none
        max-height: 150px
        min-height: 44px
        overflow-y: auto
        @include custom-scrollbar
        
        &:focus
          outline: none
          border-color: $purple
      
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

@include mobile
  .chat-page
    .messages_container
      .message_wrap
        .message
          max-width: 90%
</style>