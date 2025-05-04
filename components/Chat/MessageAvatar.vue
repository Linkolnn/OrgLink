<template>
  <div>
    <div 
      class="message-avatar" 
      @click="showUserProfile = true"
      :style="avatarUrl ? `background-image: url(${secureUrl(avatarUrl)})` : ''"
    >
      <div v-if="!avatarUrl" class="initials">
        {{ getInitials(userName) }}
      </div>
    </div>
    
    <!-- Модальное окно профиля пользователя -->
    <div v-if="showUserProfile" class="profile-modal-overlay" @click="showUserProfile = false">
      <div class="profile-modal-content" @click.stop>
        <button class="profile-modal-close" @click="showUserProfile = false">&times;</button>
        <MessengerUserProfile 
          :user-id="props.userId" 
          :is-other-user="true" 
          :user-data="{
            _id: props.userId,
            name: props.userName,
            avatar: props.avatarUrl
          }" 
          @close="showUserProfile = false"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
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

// Состояние модального окна профиля
const showUserProfile = ref(false);

// Получение инициалов из имени
const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
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
    font-weight: 600

// Стили для модального окна профиля
.profile-modal-overlay
  position: fixed
  top: 0
  left: 0
  right: 0
  bottom: 0
  background-color: rgba(0, 0, 0, 0.5)
  display: flex
  align-items: center
  justify-content: center
  z-index: 1000

.profile-modal-content
  position: relative
  max-width: 90%
  max-height: 90vh
  overflow-y: auto
  max-width: 500px;
  border-radius: $scrollbar-radius
  
.profile-modal-close
  position: absolute
  top: 10px
  right: 10px
  background: none
  border: none
  color: $white
  font-size: 24px
  cursor: pointer
  z-index: 1001
  width: 30px
  height: 30px
  display: flex
  align-items: center
  justify-content: center
  border-radius: 50%

  &:hover
    background-color: $purple
</style>
