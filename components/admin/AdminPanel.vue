<template>
  <div class="admin-panel">
    <div class="admin-panel__header">
      <!-- Кнопка переключения боковой панели для мобильных устройств -->
      <button class="toggle-sidebar-btn" @click="toggleSidebar">
        <IconBottomArrow class="toggle-sidebar-btn__icon" filled />
      </button>
      <h2 class="admin-panel__title">Административная панель</h2>
    </div>
    
    <div class="admin-panel__content">
      <!-- Управление пользователями -->
      <div class="admin-panel__section">
        <div class="admin-panel__user-management">
          <AdminUserManagement @user-selected="selectUser" />
        </div>
      </div>
      
      <!-- Просмотр чатов пользователя -->
      <div v-if="selectedUser" class="admin-panel__section">
        <h2 class="admin-panel__section-title">
          Чаты пользователя: {{ selectedUser.name }}
        </h2>
        <div class="admin-panel__user-chats">
          <div v-if="userChats.length === 0" class="admin-panel__no-chats">
            У пользователя нет активных чатов
          </div>
          <div v-else class="admin-panel__chats-list">
            <div 
              v-for="chat in userChats" 
              :key="chat._id" 
              class="admin-panel__chat-card"
              :class="{ 'admin-panel__chat-card--active': selectedChat && selectedChat._id === chat._id }"
              @click="selectChat(chat)"
            >
              <div class="admin-panel__chat-avatar">
                <div v-if="getChatAvatar(chat)" class="admin-panel__chat-avatar-img" :style="{ backgroundImage: `url(${getChatAvatar(chat)})` }"></div>
                <div v-else class="admin-panel__chat-avatar-placeholder">
                  {{ getChatInitials(chat) }}
                </div>
              </div>
              <div class="admin-panel__chat-info">
                <div class="admin-panel__chat-name">{{ getChatName(chat) }}</div>
                <div class="admin-panel__chat-type">{{ chat.type === 'private' ? 'Приватный' : 'Групповой' }}</div>
                <div class="admin-panel__chat-participants">
                  Участников: {{ chat.participants.length }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Просмотр сообщений чата -->
      <div v-if="selectedChat" class="admin-panel__section">
        <h2 class="admin-panel__section-title">
          Сообщения чата: {{ getChatName(selectedChat) }}
        </h2>
        <div class="admin-panel__chat-messages">
          <div v-if="chatMessages.length === 0" class="admin-panel__no-messages">
            В этом чате нет сообщений
          </div>
          <div v-else class="admin-panel__messages-list">
            <div 
              v-for="message in chatMessages" 
              :key="message._id" 
              class="admin-panel__message"
              :class="{ 
                'admin-panel__message--own': message.sender._id === selectedUser._id,
                'admin-panel__message--service': message.type === 'service'
              }"
            >
              <div v-if="message.type !== 'service'" class="admin-panel__message-avatar">
                <div 
                  v-if="message.sender.avatar" 
                  class="admin-panel__message-avatar-img" 
                  :style="{ backgroundImage: `url(${message.sender.avatar})` }"
                ></div>
                <div v-else class="admin-panel__message-avatar-placeholder">
                  {{ getInitials(message.sender.name) }}
                </div>
              </div>
              <div class="admin-panel__message-content">
                <div v-if="message.type !== 'service'" class="admin-panel__message-sender">
                  {{ message.sender.name }}
                </div>
                <div class="admin-panel__message-text">{{ message.text }}</div>
                <div class="admin-panel__message-time">
                  {{ formatDate(message.createdAt) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import AdminUserManagement from './AdminUserManagement.vue';
import { useRuntimeConfig } from '#app';

const config = useRuntimeConfig();

// Состояние компонента
const selectedUser = ref(null);
const userChats = ref([]);
const selectedChat = ref(null);
const chatMessages = ref([]);

// Выбор пользователя
const selectUser = (user) => {
  selectedUser.value = user;
  selectedChat.value = null;
  chatMessages.value = [];
  loadUserChats(user._id);
  
  // Скрываем боковую панель на мобильных устройствах
  if (process.client && window.innerWidth <= 859) {
    const nuxtApp = useNuxtApp();
    if (nuxtApp.$toggleSidebar) {
      nuxtApp.$toggleSidebar(false);
    }
  }
};

// Загрузка чатов пользователя
const loadUserChats = async (userId) => {
  try {
    const response = await $fetch(`${config.public.backendUrl}/api/admin/users/${userId}/chats`, {
      credentials: 'include',
    });
    userChats.value = response;
  } catch (error) {
    console.error('Ошибка загрузки чатов пользователя:', error);
    userChats.value = [];
  }
};

// Выбор чата
const selectChat = async (chat) => {
  selectedChat.value = chat;
  
  // Загрузка сообщений чата
  await loadChatMessages(chat._id);
};

// Загрузка сообщений чата
const loadChatMessages = async (chatId) => {
  try {
    const response = await $fetch(`${config.public.backendUrl}/api/admin/chats/${chatId}/messages`, {
      credentials: 'include',
    });
    console.log('Полученные сообщения чата:', response);
    
    // Проверяем структуру сообщений
    if (response && response.length > 0) {
      const sampleMessage = response[0];
      console.log('Пример сообщения:', {
        id: sampleMessage._id,
        text: sampleMessage.text,
        type: sampleMessage.type,
        sender: sampleMessage.sender,
        createdAt: sampleMessage.createdAt
      });
    }
    
    chatMessages.value = response;
  } catch (error) {
    console.error('Ошибка загрузки сообщений чата:', error);
    chatMessages.value = [];
  }
};

// Получение имени чата
const getChatName = (chat) => {
  if (!chat) return '';
  
  // Для приватных чатов отображаем имя собеседника
  if (chat.type === 'private') {
    const otherParticipant = chat.participants.find(p => p._id !== selectedUser.value._id);
    return otherParticipant ? otherParticipant.name : 'Неизвестный пользователь';
  }
  
  // Для групповых чатов отображаем название чата
  return chat.name || 'Групповой чат';
};

// Получение аватара чата
const getChatAvatar = (chat) => {
  if (!chat) return null;
  
  // Для приватных чатов отображаем аватар собеседника
  if (chat.type === 'private') {
    const otherParticipant = chat.participants.find(p => p._id !== selectedUser.value._id);
    return otherParticipant ? otherParticipant.avatar : null;
  }
  
  // Для групповых чатов можно добавить логику отображения аватара группы
  return null;
};

// Получение инициалов для чата
const getChatInitials = (chat) => {
  const name = getChatName(chat);
  return getInitials(name);
};

// Получение инициалов из имени
const getInitials = (name) => {
  if (!name) return '?';
  
  const parts = name.split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
};

// Функция для переключения боковой панели на мобильных устройствах
const toggleSidebar = () => {
  // Получаем доступ к плагину управления боковой панелью
  const nuxtApp = useNuxtApp();
  const { $toggleSidebar } = nuxtApp;
  
  if ($toggleSidebar) {
    // Если плагин доступен, используем его
    $toggleSidebar(true); // Явно указываем, что нужно показать боковую панель
    console.log('[AdminPanel] Вызван $toggleSidebar(true)');
  } else if (nuxtApp && nuxtApp.$sidebarVisible !== undefined) {
    // Запасной вариант - используем старый метод
    nuxtApp.$sidebarVisible.value = true; // Явно устанавливаем в true
    console.log('[AdminPanel] Установлено nuxtApp.$sidebarVisible.value = true');
  } else {
    // Если ничего не доступно, используем прямое изменение DOM
    const app = document.querySelector('.app');
    if (app) {
      app.classList.add('sidebar-visible'); // Используем add вместо toggle
      console.log('[AdminPanel] Добавлен класс sidebar-visible напрямую');
    }
  }
  
  // Также напрямую добавляем класс видимости к самому компоненту SideBar
  const sideBar = document.querySelector('.sidebar');
  if (sideBar) {
    sideBar.classList.add('visible');
    console.log('[AdminPanel] Добавлен класс visible к .sidebar');
  }
};

// Форматирование даты
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
</script>

<style lang="sass">
@import '~/assets/styles/variables'

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

  // Показываем кнопку только на мобильных устройствах
  @media (max-width: 859px)
    display: flex
    align-items: center
    justify-content: center

.admin-panel
  width: 100%
  color: $white
  
  &__header
    display: flex
    align-items: center
    padding: 15px
    background-color: $header-bg
    border-bottom: 1px solid rgba(255, 255, 255, 0.1)
    margin-bottom: 20px
    
  &__section
    margin-bottom: 30px
    
  &__section-title
    font-size: 18px
    font-weight: 500
    margin-bottom: 15px
    
    &--main
      margin-bottom: 0
    
  &__title
    color: $white
    font-size: 20px
    font-weight: 500
    margin: 0 0 0 10px
    
  &__section-title
    color: $white
    font-size: 18px
    margin: 0 0 20px 0
    
  &__content
    display: flex
    flex-direction: column
    padding: 0 20px 20px
    
  &__user-management
    margin-bottom: 20px
    
  &__user-chats
    margin-top: 15px
    
  &__no-chats,
  &__no-messages
    color: rgba(255, 255, 255, 0.5)
    text-align: center
    padding: 20px
    
  &__chats-list
    display: flex
    flex-direction: column
    gap: 10px
    max-height: 300px
    overflow-y: auto
    @include custom-scrollbar
    
  &__chat-card
    display: flex
    align-items: center
    gap: 15px
    padding: 10px
    border-radius: $radius
    background-color: rgba(255, 255, 255, 0.05)
    cursor: pointer
    transition: background-color $transition-speed $transition-function
    
    &:hover
      background-color: rgba(255, 255, 255, 0.1)
      
    &--active
      background-color: rgba($purple, 0.2)
      border-left: 3px solid $purple
      
  &__chat-avatar
    width: 40px
    height: 40px
    border-radius: 50%
    overflow: hidden
    display: flex
    align-items: center
    justify-content: center
    background-color: $purple
    
  &__chat-avatar-img
    width: 100%
    height: 100%
    background-size: cover
    background-position: center
    
  &__chat-avatar-placeholder
    color: $white
    font-weight: bold
    
  &__chat-info
    flex: 1
    
  &__chat-name
    font-weight: 500
    margin-bottom: 3px
    
  &__chat-type,
  &__chat-participants
    font-size: 12px
    color: rgba(255, 255, 255, 0.7)
    
  &__chat-messages
    margin-top: 15px
    
  &__messages-list
    display: flex
    flex-direction: column
    gap: 15px
    max-height: 400px
    overflow-y: auto
    @include custom-scrollbar
    padding: 10px
    
  &__message
    display: flex
    gap: 10px
    max-width: 80%
    align-items: flex-start
    
    &--own
      align-self: flex-end
      flex-direction: row-reverse
      
      .admin-panel__message-content
        background-color: rgba($purple, 0.2)
        border-radius: $radius 0 $radius $radius
        
    &--service
      align-self: center
      max-width: 90%
      
      .admin-panel__message-content
        background-color: rgba(255, 255, 255, 0.1)
        border-radius: $radius
        text-align: center
        font-style: italic
        
  &__message-avatar
    width: 36px
    height: 36px
    min-width: 36px
    border-radius: 50%
    overflow: hidden
    display: flex
    align-items: center
    justify-content: center
    background-color: $purple
    flex-shrink: 0
    
  &__message-avatar-img
    width: 100%
    height: 100%
    background-size: cover
    background-position: center
    
  &__message-avatar-placeholder
    color: $white
    font-weight: bold
    font-size: 14px
    
  &__message-content
    background-color: rgba(255, 255, 255, 0.1)
    padding: 10px 15px
    border-radius: 0 $radius $radius $radius
    position: relative
    
  &__message-sender
    font-weight: 500
    font-size: 13px
    margin-bottom: 5px
    color: rgba(255, 255, 255, 0.8)
    
  &__message-text
    word-break: break-word
    
  &__message-time
    font-size: 11px
    color: rgba(255, 255, 255, 0.5)
    text-align: right
    margin-top: 5px

// Адаптивность для мобильных устройств
@include mobile
  .admin-panel
    &__message
      max-width: 90%
</style>
