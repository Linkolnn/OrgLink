<template>
  <div 
    :data-chat-id="chat._id"
    class="chat-item"
    :class="{ 'chat-item--active': isActive }"
    @click="$emit('select', chat._id)"
  >
    <div 
      class="chat-item__avatar"
      :style="chat.avatar ? { backgroundImage: `url(${secureUrl(chat.avatar)})` } : {}"
    >
      <div v-if="!chat.avatar" class="chat-item__initials">
        <template v-if="isPrivateChat(chat)">
          {{ getInitials(getOtherParticipantName(chat)) }}
        </template>
        <template v-else>
          {{ getInitials(chat.name) }}
        </template>
      </div>
    </div>
    <div class="chat-item__info">
      <div class="chat-item__name">
        <template v-if="isPrivateChat(chat)">
          {{ getOtherParticipantName(chat) }}
        </template>
        <template v-else>
          {{ chat.name }}
        </template>
      </div>
      <div :id="`chat-message-${chat._id}`" class="chat-item__message" :class="{ 'chat-item__message--service': isServiceMessage }">
        <span v-if="isServiceMessage && chat.lastMessage">{{ chat.lastMessage.text }}</span>
        <span v-else>{{ formattedLastMessage }}</span>
      </div>
    </div>
    <div class="chat-item__meta">
      <div v-if="chat.unread && chat.unread > 0" class="chat-item__badge">{{ chat.unread }}</div>
      <div :id="`chat-time-${chat._id}`" class="chat-item__time">
        {{ chat.formattedTime }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { secureUrl } from '~/utils/secureUrl';
import { useChatStore } from '~/stores/chat';
import { useAuthStore } from '~/stores/auth';
import { computed } from 'vue';

const chatStore = useChatStore();
const authStore = useAuthStore();

const props = defineProps({
  chat: {
    type: Object,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  }
});

defineEmits(['select']);

// Проверяем, является ли последнее сообщение служебным
const isServiceMessage = computed(() => {
  const lastMessage = props.chat.lastMessage;
  if (!lastMessage) return false;
  
  // Проверяем тип сообщения
  if (lastMessage.type === 'service') {
    return true;
  }
  
  // Проверяем содержимое сообщения на наличие ключевых фраз, характерных для служебных сообщений
  const text = lastMessage.text || '';
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

// Форматируем текст последнего сообщения
const formattedLastMessage = computed(() => {
  // Если чат в режиме предпросмотра
  if (props.chat.isPreview) {
    return 'Напишите сообщение, чтобы создать чат';
  }
  
  // Если есть lastMessage, используем его текст
  if (props.chat.lastMessage && props.chat.lastMessage.text) {
    return props.chat.lastMessage.text;
  }
  
  // Иначе используем lastMessageText, если он есть
  return props.chat.lastMessageText || '';
});

// Получение инициалов из имени
function getInitials(name) {
  if (!name) return '';
  
  // Разбиваем имя на слова
  const words = name.trim().split(/\s+/);
  
  if (words.length === 1) {
    // Если одно слово, берем первые две буквы
    return words[0].substring(0, 2).toUpperCase();
  } else {
    // Если несколько слов, берем первые буквы первых двух слов
    return (words[0][0] + words[1][0]).toUpperCase();
  }
}

// Проверка, является ли чат приватным
function isPrivateChat(chat) {
  return chatStore.isPrivateChat(chat);
}

// Получение имени собеседника в личном чате
function getOtherParticipantName(chat) {
  if (!chat || !chat.participants || chat.participants.length === 0) {
    return chat.name || 'Чат';
  }
  
  // Получаем ID текущего пользователя
  const currentUserId = authStore.user?._id;
  
  // Находим собеседника (не текущего пользователя)
  const otherParticipant = chat.participants.find(p => p._id !== currentUserId);
  
  // Возвращаем имя собеседника или название чата, если собеседник не найден
  return otherParticipant?.name || chat.name || 'Чат';
}
</script>

<style lang="sass" scoped>
@import '~/assets/styles/variables'

// Элемент чата
.chat-item
  display: flex
  align-items: center
  padding: 10px 15px
  border-radius: $scrollbar-radius
  cursor: pointer
  transition: background-color $transition-speed $transition-function
  
  &:hover
    background-color: rgba($white, 0.01)
  
  &--active
    background-color: rgba($white, 0.01)
  
  &__avatar
    width: 55px
    height: 55px
    border-radius: 50%
    background-color: $purple
    display: flex
    align-items: center
    justify-content: center
    margin-right: 12px
    background-size: cover
    background-position: center
    flex-shrink: 0
  
  &__initials
    font-weight: 600
    color: $white
    font-size: 16px
  
  &__info
    flex: 1
    min-width: 0
    overflow: hidden
  
  &__name
    font-weight: 600
    margin-bottom: 4px
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
    font-size: 15px
  
  &__message
    font-size: 13px
    color: rgba($white, 0.7)
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
    
    &--service
      color: $purple
      font-style: italic
      font-weight: 500
  
  &__meta
    display: flex
    flex-direction: column
    align-items: flex-end
    gap: 6px
    margin-left: 8px
    flex-shrink: 0
  
  &__badge
    background-color: $purple
    color: $white
    border-radius: 50px
    min-width: 20px
    height: 20px
    display: flex
    align-items: center
    justify-content: center
    font-size: 12px
    padding: 0 5px
  
  &__time
    font-size: 11px
    color: rgba($white, 0.6)
</style>
