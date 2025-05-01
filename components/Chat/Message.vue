<template>
  <div>
    <!-- Service message -->
    <div v-if="message.type === 'service'" class="service_message">
      <div>{{ message.text }}</div>
      <div class="time">{{ formatTime(message.createdAt || message.timestamp) }}</div>
    </div>
    
    <!-- Regular message -->
    <div 
      v-else 
      class="message" 
      :class="isOwnMessage ? 'own' : 'other'"
      @contextmenu.prevent="$emit('context-menu', $event, message)"
      @click="handleMessageClick($event)"
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
          <div 
            v-if="!isOwnMessage && isGroupChat" 
            class="message__from"
          >
            {{ message.sender?.name }}
          </div>
          <!-- Текстовое сообщение -->
          <div v-if="message.media_type === 'none' && message.text" class="message__text">
            {{ message.text }}
          </div>
          
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
          <div class="message__time">
            {{ formatTime(message.createdAt || message.timestamp) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import MessageAvatar from './MessageAvatar.vue';

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
  'video-play',
  'profile-click'
]);

const authStore = useAuthStore();

// Проверка, является ли сообщение собственным
const isOwnMessage = computed(() => {
  return props.message.sender && authStore.user && props.message.sender._id === authStore.user._id;
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

// Обработка клика на сообщении
const handleMessageClick = (event) => {
  if (props.isMobile) {
    emit('context-menu', event, props.message);
  }
  emit('click', event, props.message);
};
</script>

<style lang="sass">
@import '@variables'

.service_message
  text-align: center
  margin: 10px 0
  color: rgba(255, 255, 255, 0.7)
  font-size: 14px
  
  .time
    font-size: 12px
    margin-top: 2px
    opacity: 0.7

.message
  display: flex
  margin-bottom: 10px
  max-width: 75%  // Увеличиваем общую максимальную ширину
  position: relative
  align-items: flex-end  // Выравниваем элементы по нижнему краю
  
  &__avatar
    margin-right: 8px  // Отступ между аватаркой и сообщением
    align-self: flex-start  // Выравниваем аватарку по верхнему краю сообщения
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
    
    .message__text
      margin-bottom: 5px
      white-space: pre-wrap
      padding-right: 40px  // Добавляем отступ справа для времени
    
    .message__time
      font-size: 12px
      color: rgba(255, 255, 255, 0.7)
      position: absolute
      bottom: 10px
      right: 15px

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
</style>
