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
      <div v-if="!chat.avatar" class="chat-item__initials">{{ getInitials(chat.name) }}</div>
    </div>
    <div class="chat-item__info">
      <div class="chat-item__name">{{ chat.name }}</div>
      <div :id="`chat-message-${chat._id}`" class="chat-item__message">
        {{ chat.lastMessageText }}
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
</script>

<style lang="sass" scoped>
@import '~/assets/styles/variables'

// Элемент чата
.chat-item
  display: flex
  align-items: center
  padding: 12px
  border-radius: $scrollbar-radius
  cursor: pointer
  transition: background-color $transition-speed $transition-function
  
  &:hover
    background-color: rgba($white, 0.05)
  
  &--active
    background-color: rgba($white, 0.1)
  
  &__avatar
    width: 42px
    height: 42px
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
