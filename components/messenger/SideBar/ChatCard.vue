<template>
  <div 
    :data-chat-id="currentChat._id"
    :data-last-message="getLastMessageText"
    class="chat-item"
    :class="{ 'chat-item--active': isActive }"
    @click="$emit('select', currentChat._id)"
  >
    <div 
      class="chat-item__avatar"
      :style="currentChat.avatar ? { backgroundImage: `url(${secureUrl(currentChat.avatar)})` } : {}"
    >
      <div v-if="!currentChat.avatar" class="chat-item__initials">
        <template v-if="isPrivateChat(currentChat)">
          {{ getInitials(getOtherParticipantName(currentChat)) }}
        </template>
        <template v-else>
          {{ getInitials(currentChat.name) }}
        </template>
      </div>
    </div>
    <div class="chat-item__info">
      <div class="chat-item__name">
        <template v-if="isPrivateChat(currentChat)">
          {{ getOtherParticipantName(currentChat) }}
        </template>
        <template v-else>
          {{ currentChat.name }}
        </template>
      </div>
      <div :id="`chat-message-${currentChat._id}`" class="chat-item__message" :class="{ 'chat-item__message--service': isServiceMessage }">
        <span v-if="isServiceMessage && currentChat.lastMessage">{{ currentChat.lastMessage.text }}</span>
        <span v-else>
          <!-- Для групповых чатов показываем имя отправителя -->
          <template v-if="!isPrivateChat(currentChat) && currentChat.lastMessage && currentChat.lastMessage.sender && !isSelfMessage && senderName">
            <span class="chat-item__sender">{{ senderName }}:</span> 
          </template>
          {{ formattedLastMessage }}
          <span v-if="isMessageEdited" class="chat-item__edited">изм</span>
        </span>
      </div>
    </div>
    <div class="chat-item__meta">
      <div v-if="currentChat.unread && currentChat.unread > 0" class="chat-item__badge">{{ currentChat.unread }}</div>
      <div :id="`chat-time-${currentChat._id}`" class="chat-item__time">
        {{ currentChat.formattedTime }}
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

// Отслеживаем обновления в хранилище чата
const chatListUpdateTrigger = computed(() => chatStore.chatListUpdateTrigger);

// Получаем актуальные данные о чате из хранилища
const currentChat = computed(() => {
  // Принудительно вычисляем при изменении триггера
  const trigger = chatListUpdateTrigger.value;
  
  // Находим чат в хранилище по ID
  const chatFromStore = chatStore.chats.find(c => c._id === props.chat._id);
  
  // Если чат найден в хранилище, используем его, иначе используем переданный через пропсы
  return chatFromStore || props.chat;
});

// Проверяем, было ли последнее сообщение отредактировано
const isMessageEdited = computed(() => {
  const chat = currentChat.value;
  
  // Проверяем разные источники информации о редактировании
  
  // 1. Проверяем поле edited в объекте lastMessage
  if (chat.lastMessage && typeof chat.lastMessage === 'object' && chat.lastMessage.edited) {
    return true;
  }
  
  // 2. Проверяем поле edited в вложенном объекте lastMessage.lastMessage
  if (chat.lastMessage && chat.lastMessage.lastMessage && chat.lastMessage.lastMessage.edited) {
    return true;
  }
  
  return false;
});

// Проверяем, является ли последнее сообщение служебным
const isServiceMessage = computed(() => {
  const lastMessage = currentChat.value.lastMessage;
  if (!lastMessage) return false;
  
  // Если тип сообщения 'service', то это служебное сообщение
  if (lastMessage.type === 'service') return true;
  
  // Также проверяем текст на соответствие шаблонам служебных сообщений
  const text = lastMessage.text || '';
  const servicePatterns = [
    /^\S+ создал\(а\) группу$/,
    /^\S+ добавил\(а\) \S+$/,
    /^\S+ покинул\(а\) группу$/,
    /^\S+ изменил\(а\) название группы на .+$/,
    /^\S+ изменил\(а\) аватар группы$/
  ];
  
  return servicePatterns.some(pattern => pattern.test(text));
});

// Извлекаем текст последнего сообщения для сохранения в атрибуте
const getLastMessageText = computed(() => {
  const chat = currentChat.value;
  
  // Проверяем все возможные источники текста
  if (chat.lastMessage && chat.lastMessage.text) {
    return chat.lastMessage.text;
  } else if (chat.lastMessageText) {
    return chat.lastMessageText;
  }
  
  // Если это медиа-сообщение
  if (chat.lastMessage && chat.lastMessage.media_type && chat.lastMessage.media_type !== 'none') {
    const mediaTypes = {
      'image': 'Фотография',
      'video': 'Видео',
      'video_message': 'Видеосообщение',
      'sticker': 'Стикер',
      'file': 'Файл'
    };
    return mediaTypes[chat.lastMessage.media_type] || 'Медиа-сообщение';
  }
  
  return '';
});

// Форматируем текст последнего сообщения для отображения
const formattedLastMessage = computed(() => {
  // Сохраняем ссылку на чат в локальной переменной для удобства
  const chat = currentChat.value;
  
  // Добавляем расширенное логирование для отладки
  console.log(`Формируем текст для чата ${chat._id}:`, {
    hasLastMessage: !!chat.lastMessage,
    lastMessageText: chat.lastMessageText,
    lastMessageObj: chat.lastMessage ? {
      text: chat.lastMessage.text,
      type: chat.lastMessage.type,
      media_type: chat.lastMessage.media_type
    } : null,
    isPreview: chat.isPreview,
    trigger: chatListUpdateTrigger.value
  });
  
  // Если чат в режиме предпросмотра
  if (chat.isPreview) {
    return 'Напишите сообщение, чтобы создать чат';
  }
  
  // Приоритет 1: Используем поле lastMessageText, если оно есть
  if (chat.lastMessageText) {
    console.log(`Используем поле lastMessageText: ${chat.lastMessageText}`);
    
    // Сохраняем текст в хранилище чата
    chatStore.lastMessageTextCache[chat._id] = chat.lastMessageText;
    
    return chat.lastMessageText;
  }
  
  // Приоритет 2: Проверяем наличие объекта lastMessage с текстом
  if (chat.lastMessage && typeof chat.lastMessage === 'object') {
    // Если есть текст в последнем сообщении
    if (chat.lastMessage.text) {
      console.log(`Используем текст из объекта lastMessage: ${chat.lastMessage.text}`);
      
      // Сохраняем текст в хранилище чата
      chatStore.lastMessageTextCache[chat._id] = chat.lastMessage.text;
      
      return chat.lastMessage.text;
    } 
    // Если это медиа-сообщение
    else if (chat.lastMessage.media_type && chat.lastMessage.media_type !== 'none') {
      const mediaTypes = {
        'image': 'Фотография',
        'video': 'Видео',
        'video_message': 'Видеосообщение',
        'sticker': 'Стикер',
        'file': 'Файл'
      };
      const mediaText = mediaTypes[chat.lastMessage.media_type] || 'Медиа-сообщение';
      console.log(`Используем медиа-тип из объекта lastMessage: ${mediaText}`);
      
      // Сохраняем текст в хранилище чата
      chatStore.lastMessageTextCache[chat._id] = mediaText;
      
      return mediaText;
    }
  }
  
  // Приоритет 3: Проверяем наличие текста в кэше
  if (chatStore.lastMessageTextCache[chat._id]) {
    const cachedText = chatStore.lastMessageTextCache[chat._id];
    console.log(`Используем текст из кэша: ${cachedText}`);
    return cachedText;
  }
  
  // Приоритет 4: Проверяем наличие сохраненного текста в атрибуте data-last-message
  const chatElement = document.querySelector(`[data-chat-id="${chat._id}"]`);
  if (chatElement && chatElement.getAttribute('data-last-message')) {
    const savedText = chatElement.getAttribute('data-last-message');
    console.log(`Используем сохраненный текст из атрибута: ${savedText}`);
    
    // Сохраняем текст в хранилище чата
    chatStore.lastMessageTextCache[chat._id] = savedText;
    
    return savedText;
  }
  
  // Если ничего не нашли, возвращаем дефолтное значение
  console.log(`Не найдено ни одного источника текста последнего сообщения`);
  return 'Нет сообщений';
  
  // Если нет никаких сообщений
  return 'Нет сообщений';
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

// Получение имени отправителя
function getSenderName(sender) {
  // Если отправитель - объект с полем name
  if (sender && typeof sender === 'object' && sender.name) {
    return sender.name;
  }
  
  // Если отправитель - ID пользователя
  if (sender && typeof sender === 'string') {
    // Проверяем, есть ли этот пользователь в списке участников чата
    const participant = props.chat.participants?.find(p => p._id === sender);
    if (participant && participant.name) {
      return participant.name;
    }
    return 'Пользователь';
  }
  
  return 'Пользователь';
}

// Проверка, является ли сообщение отправлено текущим пользователем
const isSelfMessage = computed(() => {
  if (!currentChat.value.lastMessage || !currentChat.value.lastMessage.sender) return false;
  
  // Проверяем, является ли отправитель текущим пользователем
  if (typeof currentChat.value.lastMessage.sender === 'object') {
    return currentChat.value.lastMessage.sender._id === authStore.user?._id;
  } else if (typeof currentChat.value.lastMessage.sender === 'string') {
    return currentChat.value.lastMessage.sender === authStore.user?._id;
  }
  
  return false;
});

// Вычисляемое свойство для имени отправителя
const senderName = computed(() => {
  if (!currentChat.value.lastMessage || !currentChat.value.lastMessage.sender) return '';
  
  const sender = currentChat.value.lastMessage.sender;
  
  // Если отправитель - объект с полем name
  if (typeof sender === 'object' && sender.name) {
    return sender.name;
  }
  
  // Если отправитель - ID пользователя
  if (typeof sender === 'string') {
    // Проверяем, есть ли этот пользователь в списке участников чата
    const participant = currentChat.value.participants?.find(p => p._id === sender);
    if (participant && participant.name) {
      return participant.name;
    }
  }
  
  return 'Пользователь';
});
</script>

<style lang="sass">
@import '@variables'

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
  
  &__sender
    font-weight: 600
    margin-right: 4px
    
  &__edited
    font-size: 12px
    font-style: italic
    margin-left: 4px
    color: rgba($white, 0.7)
  
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
    border-radius: 50%
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
