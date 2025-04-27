<template>
  <ClientOnly>
    <aside class="sidebar">
      <header class="sidebar-header">
        <div class="dropdown">
          <button class="dropdown-toggle" @click="toggleMenu">
            Меню
          </button>
          <div v-if="isMenuOpen" class="dropdown-menu">
            <NuxtLink to="/messenger" class="menu-item" @click="toggleMenu">Мессенджер</NuxtLink>
            <NuxtLink v-if="authStore.isAdmin" to="/admin" class="menu-item" @click="toggleMenu">Админ панель</NuxtLink>
            <button @click="logout" class="menu-item logout-button">Выйти</button>
          </div>
        </div>
        <div class="header-actions">
          <h3>Чаты</h3>
          <button class="new-chat-btn" @click="createNewChat">
            <span>+</span>
          </button>
        </div>
      </header>
      <div class="chats-list">
        <div v-if="chatStore.loading && !chatStore.chats.length" class="chats-loading">
          <div class="spinner"></div>
          <p>Загрузка чатов...</p>
        </div>
        <div v-else-if="chatStore.chats.length === 0" class="no-chats">
          <p>У вас пока нет чатов</p>
          <button class="create-chat-btn" @click="createNewChat">Создать чат</button>
        </div>
        <div v-else class="chat-items">
          <div 
            v-for="chat in chatStore.chats" 
            :key="chat._id" 
            class="chat-item"
            :class="{ 'active': chatStore.activeChat?._id === chat._id }"
            @click="selectChat(chat._id)"
          >
            <div 
              class="chat-avatar"
              :style="chat.avatar ? { backgroundImage: `url(${chat.avatar})` } : {}"
            >
              <div v-if="!chat.avatar" class="initials">{{ getInitials(chat.name) }}</div>
            </div>
            <div class="chat-info">
              <div class="chat-name">{{ chat.name }}</div>
              <div class="chat-last-message">
                {{ chat.lastMessage?.text || 'Нет сообщений' }}
              </div>
            </div>
            <div class="chat-meta">
              <div v-if="chat.unread" class="unread-badge">{{ chat.unread }}</div>
              <div v-if="chat.lastMessage?.timestamp" class="last-time">
                {{ formatTime(new Date(chat.lastMessage.timestamp)) }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Модальное окно создания чата -->
      <EditChatModal
        :is-open="showNewChatModal"
        :chat="{}"
        @close="showNewChatModal = false"
        @saved="onChatCreated"
      />
    </aside>
  </ClientOnly>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useChatStore } from '~/stores/chat';
import { useRouter } from 'vue-router';
import EditChatModal from '~/components/Chat/EditChatModal.vue';

const authStore = useAuthStore();
const chatStore = useChatStore();
const router = useRouter();

const isMenuOpen = ref(false);
const showNewChatModal = ref(false);
const newChat = ref({
  name: '',
  participants: []
});

// Загрузка чатов при монтировании компонента
onMounted(async () => {
  await chatStore.fetchChats();
});

// Переключение меню
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

// Выход из аккаунта
const logout = async () => {
  await authStore.logout();
  router.push('/');
};

// Выбор чата
const selectChat = async (chatId) => {
  await chatStore.setActiveChat(chatId);
};

// Создание нового чата
const createNewChat = () => {
  showNewChatModal.value = true;
};

// Обработка создания чата
const onChatCreated = (chat) => {
  showNewChatModal.value = false;
  // Чат уже добавлен в хранилище и установлен как активный
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

// Форматирование времени
const formatTime = (date) => {
  if (!date) return '';
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date >= today) {
    // Сегодня - показываем только время
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (date >= yesterday) {
    // Вчера
    return 'Вчера';
  } else {
    // Другие дни - показываем дату
    return date.toLocaleDateString([], { day: 'numeric', month: 'numeric' });
  }
};
</script>

<style lang="sass" scoped>
@import '~/assets/styles/variables'

.sidebar
  max-width: 300px
  height: 100vh
  background-color: $header-bg
  color: $white
  display: flex
  flex-direction: column
  border-right: 1px solid rgba(255, 255, 255, 0.1)

  &-header
    padding: 15px
    border-bottom: 1px solid rgba(255, 255, 255, 0.1)
    position: relative
    
    .header-actions
      display: flex
      justify-content: space-between
      align-items: center
      margin-top: 10px
      
      h3
        margin: 0
        font-size: 18px
    
    .new-chat-btn
      background-color: $purple
      color: white
      border: none
      width: 28px
      height: 28px
      border-radius: 50%
      display: flex
      align-items: center
      justify-content: center
      cursor: pointer
      font-size: 18px
      
      &:hover
        background-color: darken($purple, 10%)

  .dropdown
    position: relative
    
    &-toggle
      background-color: transparent
      color: $white
      border: none
      cursor: pointer
      padding: 5px 0
      font-size: 14px
      
      &:hover
        text-decoration: underline
    
    &-menu
      position: absolute
      top: 100%
      left: 0
      background-color: $header-bg
      border: 1px solid rgba(255, 255, 255, 0.1)
      border-radius: 4px
      z-index: 10
      min-width: 150px
      
      .menu-item
        display: block
        padding: 10px 15px
        color: $white
        text-decoration: none
        cursor: pointer
        border: none
        background: none
        width: 100%
        text-align: left
        font-size: 14px
        
        &:hover
          background-color: rgba(255, 255, 255, 0.1)
      
      .logout-button
        color: #ff6b6b

.chats-list
  flex: 1
  min-width: 250px
  overflow-y: auto
  padding: 10px
  
  .chats-loading, .no-chats
    display: flex
    flex-direction: column
    align-items: center
    justify-content: center
    height: 100px
    color: rgba(255, 255, 255, 0.7)
    
    .spinner
      width: 30px
      height: 30px
      border: 3px solid rgba(255, 255, 255, 0.3)
      border-radius: 50%
      border-top-color: $white
      animation: spin 1s ease-in-out infinite
      margin-bottom: 10px
    
    .create-chat-btn
      margin-top: 10px
      background-color: $purple
      color: white
      border: none
      padding: 8px 15px
      border-radius: 4px
      cursor: pointer
      
      &:hover
        background-color: darken($purple, 10%)
  
  .chat-items
    display: flex
    flex-direction: column
    gap: 5px
    
    .chat-item
      display: flex
      align-items: center
      padding: 10px
      border-radius: 8px
      cursor: pointer
      transition: background-color 0.2s
      
      &:hover
        background-color: rgba(255, 255, 255, 0.05)
      
      &.active
        background-color: rgba(255, 255, 255, 0.1)
      
      .chat-avatar
        width: 40px
        height: 40px
        border-radius: 50%
        background-color: $purple
        display: flex
        align-items: center
        justify-content: center
        margin-right: 10px
        background-size: cover
        background-position: center
        
        .initials
          font-weight: bold
          color: $white
      
      .chat-info
        flex: 1
        min-width: 0
        
        .chat-name
          font-weight: bold
          margin-bottom: 2px
          white-space: nowrap
          overflow: hidden
          text-overflow: ellipsis
        
        .chat-last-message
          font-size: 12px
          color: rgba(255, 255, 255, 0.7)
          white-space: nowrap
          overflow: hidden
          text-overflow: ellipsis
      
      .chat-meta
        display: flex
        flex-direction: column
        align-items: flex-end
        gap: 5px
        
        .unread-badge
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
        
        .last-time
          font-size: 11px
          color: rgba(255, 255, 255, 0.6)

// Модальное окно
.modal-overlay
  position: fixed
  top: 0
  left: 0
  right: 0
  bottom: 0
  background-color: rgba(0, 0, 0, 0.5)
  display: flex
  align-items: center
  justify-content: center
  z-index: 100
  
  .modal-content
    background-color: $header-bg
    border-radius: 8px
    padding: 20px
    width: 90%
    max-width: 400px
    
    h3
      margin-top: 0
      margin-bottom: 20px
      color: $white
    
    .form-group
      margin-bottom: 15px
      
      label
        display: block
        margin-bottom: 5px
        color: $white
      
      input
        width: 100%
        padding: 10px
        border-radius: 4px
        border: 1px solid rgba(255, 255, 255, 0.2)
        background-color: rgba(255, 255, 255, 0.1)
        color: $white
        
        &:focus
          outline: none
          border-color: $purple
    
    .form-actions
      display: flex
      justify-content: flex-end
      gap: 10px
      
      button
        padding: 8px 15px
        border-radius: 4px
        cursor: pointer
        border: none
        
        &.cancel-btn
          background-color: transparent
          color: $white
          border: 1px solid rgba(255, 255, 255, 0.2)
          
          &:hover
            background-color: rgba(255, 255, 255, 0.1)
        
        &.submit-btn
          background-color: $purple
          color: $white
          
          &:hover
            background-color: darken($purple, 10%)
          
          &:disabled
            opacity: 0.7
            cursor: not-allowed

@keyframes spin
  0%
    transform: rotate(0deg)
  100%
    transform: rotate(360deg)

@include mobile
  .sidebar
    width: 100%
    height: auto
    min-height: 100vh
</style>