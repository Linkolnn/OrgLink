<template>
  <div 
    class="message-avatar" 
    @click="openUserProfile"
    :style="avatarUrl ? `background-image: url(${secureUrl(avatarUrl)})` : ''"
  >
    <div v-if="!avatarUrl" class="initials">
      {{ getInitials(userName) }}
    </div>
  </div>
</template>

<script setup>
import { secureUrl } from '~/utils/secureUrl';

const props = defineProps({
  userId: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    default: ''
  },
  avatarUrl: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['profile-click']);

// Получение инициалов из имени
const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};

// Открытие профиля пользователя
const openUserProfile = () => {
  emit('profile-click', props.userId);
};
</script>

<style lang="sass" scoped>
@import '@variables'

.message-avatar
  width: 36px
  height: 36px
  border-radius: 50%
  background-color: $purple
  background-size: cover
  background-position: center
  cursor: pointer
  display: flex
  align-self: flex-end
  align-items: center
  justify-content: center
  margin-right: 8px
  flex-shrink: 0
  
  .initials
    color: $white
    font-size: 14px
    font-weight: 500
</style>
