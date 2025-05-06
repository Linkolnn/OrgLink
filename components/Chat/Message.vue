<template>
  <div>
    <!-- Service message -->
    <div v-if="isServiceMessage" class="service-message service">
      <div class="service-message__text">{{ message.text }}</div>
    </div>
    
    <!-- Regular message -->
    <div 
      v-else 
      class="message" 
      :class="isOwnMessage ? 'own' : 'other'"
      @click.stop="showContextMenu($event)"
    >
      <!-- Аватарка пользователя (для сообщений от других пользователей в групповых чатах) -->
      <MessageAvatar 
        v-if="!isOwnMessage && isGroupChat" 
        :user-id="message.sender?._id" 
        :user-name="message.sender?.name" 
        :avatar-url="message.sender?.avatar"
        @profile-click="$emit('profile-click', $event)"
        class="message__avatar"
      />
      
      <div class="message__content-wrapper">
        <!-- Имя отправителя (для групповых чатов) -->
        <!-- Контент сообщения -->
        <div class="message__content">
          <!-- Кнопка меню для сообщения (только для своих сообщений) -->
          <div v-if="isOwnMessage" class="message__menu-btn" @click.stop="showContextMenu($event)">
            <i class="fas fa-ellipsis-v"></i>
          </div>
          
          <!-- Контекстное меню (только для своих сообщений) -->
          <ChatContextMenu 
            v-if="contextMenuVisible && isOwnMessage" 
            :is-visible="contextMenuVisible"
            :message="props.message"
            @edit="onEdit"
            @delete="onDelete"
            @close="hideContextMenu"
          />
          
          <div 
            v-if="!isOwnMessage && isGroupChat" 
            class="message__from"
          >
            {{ message.sender?.name }}
          </div>
          <!-- Текстовое сообщение -->
          <p v-if="message.media_type === 'none' && message.text" :class="['message__text', message.edited ? 'edited' : '']">
            {{ message.text }}
            <span class="message__time">
              <span v-if="message.edited && !isOwnMessage" class="message__edited">изм</span>
              {{ formatTime(message.createdAt || message.timestamp) }}
              <span v-if="message.edited && isOwnMessage" class="message__edited">изм</span>
            </span>
          </p>
          
          <!-- Изображение -->
          <div v-else-if="message.media_type === 'image'" class="image-container">
            <div v-if="!message.imageLoaded" class="image-loading">
              <div class="loading-spinner"></div>
            </div>
            <img 
              :src="message.file" 
              :class="['message-image', { 'loaded': message.imageLoaded }]" 
              alt="Изображение" 
              @load="$emit('image-loaded', message._id)"
            />
          </div>
          
          <!-- Видео -->
          <div v-else-if="message.media_type === 'video'" class="video-container">
            <video 
              :id="message._id" 
              class="video-message-player" 
              controls 
              :src="message.file"
              @play="$emit('video-play', message._id)"
            ></video>
          </div>
          
          <!-- Стикер -->
          <div v-else-if="message.media_type === 'sticker'" class="sticker-container">
            <img :src="message.file" alt="Sticker" class="message-sticker" />
          </div>
          
          <!-- Файл -->
          <div v-else-if="message.media_type === 'file'" class="file-container">
            <a :href="message.file" target="_blank" class="file-link">
              <i class="fas fa-file file-icon"></i>
              {{ message.file_name || 'Файл' }}
            </a>
          </div>
          
          <!-- Время отправки -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useContextMenuStore } from '@/stores/contextMenu';
import MessageAvatar from './MessageAvatar.vue';
import ContextMenu from './ContextMenu.vue';

const authStore = useAuthStore();
const contextMenuStore = useContextMenuStore();

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  isGroupChat: {
    type: Boolean,
    default: false
  },
  isMobile: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'context-menu', 
  'click', 
  'image-loaded',
  'edit',
  'delete',
  'video-play',
  'profile-click'
]);

// Проверка, является ли сообщение собственным
const isOwnMessage = computed(() => {
  return props.message.sender && authStore.user && props.message.sender._id === authStore.user._id;
});

// Проверка, является ли сообщение служебным
const isServiceMessage = computed(() => {
  // Проверяем тип сообщения
  if (props.message.type === 'service') {
    return true;
  }
  
  // Проверяем содержимое сообщения на наличие ключевых фраз, характерных для служебных сообщений
  const text = props.message.text || '';
  const servicePatterns = [
    /создал групповой чат/i,
    /покинул чат/i,
    /удалил из чата/i,
    /добавил в чат/i,
    /был удален из чата/i,
    /был добавлен в чат/i,
    /добавил в чат пользователей/i,
    /добавил в чат пользователя/i
  ];
  
  return servicePatterns.some(pattern => pattern.test(text));
});

// Форматирование времени сообщения
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Логика контекстного меню
// Используем вычисляемое свойство для определения видимости меню
const contextMenuVisible = computed(() => {
  return contextMenuStore.isMenuActive(props.message._id);
});

// Скрыть контекстное меню
const hideContextMenu = () => {
  contextMenuStore.closeMenu();
  document.removeEventListener('click', hideContextMenu);
};


// Показать или скрыть контекстное меню
const showContextMenu = (event) => {
  event.preventDefault();
  event.stopPropagation();
  
  // Если меню уже открыто для этого сообщения, закрываем его
  if (contextMenuStore.isMenuActive(props.message._id)) {
    contextMenuStore.closeMenu();
    return;
  }
  
  // Иначе закрываем все другие меню и показываем текущее
  contextMenuStore.openMenu(props.message._id);
  
  // Добавляем обработчик для закрытия меню при клике вне его
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
  }, 100);
};

// Обработчики действий меню
const onEdit = (message) => {
  emit('edit', message || props.message);
  hideContextMenu();
};

const onDelete = (message) => {
  emit('delete', message || props.message);
  hideContextMenu();
};

</script>

<style lang="sass">
@import '@variables'

.service-message
  text-align: center;
  margin: 5px auto;
  padding: 5px;
  max-width: 100%
  width: max-content
  border-radius: 12px;
  background-color: darken($purple, 10%);
  color: $white;
  font-size: 14px;
  display: flex
  flex-direction: column;
  align-items: center;
  
  &__text
    font-weight: 500
    margin-bottom: 4px
  
  &__time
    font-size: 12px
    opacity: 0.7

.message
  display: flex
  margin-bottom: 10px
  width: max-content
  max-width: 70%
  min-width: 12%  // Увеличиваем общую максимальную ширину
  position: relative
  align-items: flex-end  // Выравниваем элементы по нижнему краю
  
  &__avatar
    margin-right: 8px  // Отступ между аватаркой и сообщением
    align-self: flex-end  // Выравниваем аватарку по верхнему краю сообщения
    margin-top: 4px
    
  &__content-wrapper
    display: flex
    flex-direction: column
    flex: 1  // Растягиваем контент на всю доступную ширину
  
  &.own
    align-self: flex-end
    margin-left: auto
    flex-direction: row-reverse  // Меняем направление для собственных сообщений
    
    .message__avatar
      margin-right: 0
      margin-left: 8px  // Отступ слева для собственных сообщений
    
    .message__content
      background-color: $purple
      border-radius: 15px 15px 0 15px
      
  &.other
    align-self: flex-start
    margin-right: auto
    max-width: 60%  
    
    .message__content-wrapper
      width: calc(100% - 44px)  
    
    .message__content
      background-color: $message-bg
      border-radius: 15px 15px 15px 0
  
  &__from
    font-size: 14px
    color: rgba(255, 255, 255, 0.8)
    margin-bottom: 2px
    font-weight: 500
  
  &__content
    padding: 10px 15px
    position: relative
    color: $white
    word-break: break-word
    
    .message__menu-btn
      position: absolute
      top: 5px
      right: 5px
      cursor: pointer
      color: rgba(255, 255, 255, 0.5)
      font-size: 14px
      opacity: 0
      transition: opacity 0.2s, color 0.2s
      z-index: 2
      
      &:hover
        color: $white
    
    .message__text
      margin-bottom: 5px
      white-space: pre-wrap
      padding-right: 35px  // Добавляем отступ справа для времени
      
      // Увеличиваем отступ для отредактированных сообщений
      &.edited
        padding-right: 60px
    
    .message__time
      font-size: 12px
      color: rgba(255, 255, 255, 0.7)
      position: absolute
      bottom: 10px
      right: 15px
      display: flex
      align-items: center
      gap: 4px
      
      .message__edited
        font-size: 12px
        font-style: italic

.image-container
  position: relative
  margin: 5px 0
  max-width: 300px
  
  .image-loading
    position: absolute
    top: 0
    left: 0
    width: 100%
    height: 100%
    display: flex
    align-items: center
    justify-content: center
    background-color: rgba(0, 0, 0, 0.2)
    z-index: 2
    border-radius: 8px
    
    .loading-spinner
      width: 30px
      height: 30px
      border: 3px solid rgba(255, 255, 255, 0.3)
      border-radius: 50%
      border-top-color: $purple
      animation: spin 1s ease-in-out infinite
      margin: 0 auto
      background-color: transparent
      will-change: transform // Оптимизация для анимации
    
  .message-image
    max-width: 100%
    border-radius: 8px
    opacity: 0.7
    transition: opacity 0.3s ease
    
    &.loaded
      opacity: 1

.video-container
  margin: 5px 0
  
  .video-message-player
    max-width: 300px
    border-radius: 8px
    background-color: #000
    will-change: transform // Оптимизация для анимации

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

@keyframes spin
  0%
    transform: rotate(0deg)
  100%
    transform: rotate(360deg)

@include mobile
  .message
    max-width: 85%
    
    &.other
      max-width: 70%  // Для мобильных устройств делаем сообщения от других пользователей шире

// Стили контекстного меню перемещены в компонент ContextMenu.vue
</style>
