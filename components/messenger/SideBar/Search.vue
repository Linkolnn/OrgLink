<template>
  <article class="search">
    <div class="search__input-wrapper">
      <input 
        type="text" 
        v-model="searchQuery" 
        class="inp search__input" 
        placeholder="Поиск пользователей и чатов"
        @input="handleSearch"
      />
      <button v-if="searchQuery" @click="clearSearch" class="search__clear-btn">×</button>
      <div class="search__icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
    </div>
    
    <div v-if="isSearching" class="search__loading">
      <div class="search__spinner"></div>
      <p>Поиск...</p>
    </div>
    
    <div v-else-if="searchQuery && searchResults.length === 0 && !isSearching" class="search__no-results">
      <p>Ничего не найдено</p>
    </div>
    
    <div v-else-if="searchResults.length > 0" class="search__results">
      <div class="search__section" v-if="users.length > 0">
        <h3 class="search__section-title">Пользователи</h3>
        <div 
          v-for="user in users" 
          :key="user._id" 
          class="search__result-item search__user-item"
          @click="showUserProfile(user)"
        >
          <div class="search__avatar" :style="getAvatarStyle(user)">
            <div v-if="!user.avatar" class="search__initials">
              {{ getInitials(user.name) }}
            </div>
          </div>
          <div class="search__user-info">
            <div class="search__user-name">{{ user.name }}</div>
            <div class="search__user-email">{{ user.email }}</div>
          </div>
        </div>
      </div>
      
      <div class="search__section" v-if="chats.length > 0">
        <h3 class="search__section-title">Чаты</h3>
        <div 
          v-for="chat in chats" 
          :key="chat._id" 
          class="search__result-item search__chat-item"
          @click="selectChat(chat)"
        >
          <div class="search__avatar" :style="getAvatarStyle(chat)">
            <div v-if="!chat.avatar" class="search__initials">
              {{ getInitials(chat.name) }}
            </div>
          </div>
          <div class="search__chat-info">
            <div class="search__chat-name">{{ chat.name }}</div>
            <div class="search__chat-message" v-if="chat.lastMessage">
              {{ formatLastMessage(chat.lastMessage) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>
  
  <!-- Модальное окно профиля пользователя -->
  <div v-if="isProfileModalOpen" class="profile-modal-overlay" @click.self="closeUserProfile">
    <div class="profile-modal-content">
      <button class="profile-modal-close" @click="closeUserProfile">×</button>
      <MessengerUserProfile 
        :user-data="selectedUser" 
        :is-other-user="true"
        @send-message="createPrivateChat"
        @close="closeUserProfile"
      />
    </div>
  </div>
</template>

<script setup>
import { useChatStore } from '~/stores/chat';

const chatStore = useChatStore();

const searchQuery = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
const searchTimeout = ref(null);
const isProfileModalOpen = ref(false);
const selectedUser = ref(null);

// Разделяем результаты поиска на пользователей и чаты
const users = computed(() => {
  return searchResults.value.filter(result => result.type === 'user');
});

const chats = computed(() => {
  return searchResults.value.filter(result => result.type === 'chat');
});

// Функция для поиска с задержкой
const handleSearch = () => {
  // Очищаем предыдущий таймаут
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
  
  // Если запрос пустой, очищаем результаты
  if (!searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = [];
    return;
  }
  
  // Устанавливаем задержку для поиска (300мс)
  searchTimeout.value = setTimeout(async () => {
    await performSearch();
  }, 300);
};

// Выполнение поиска
const performSearch = async () => {
  if (!searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = [];
    return;
  }
  
  isSearching.value = true;
  try {
    // Поиск пользователей
    const users = await chatStore.searchUsers(searchQuery.value);
    
    // Поиск в существующих чатах (локальный поиск)
    const matchingChats = chatStore.chats.filter(chat => 
      chat.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
    
    // Объединяем результаты
    const formattedUsers = users.map(user => ({
      ...user,
      type: 'user'
    }));
    
    const formattedChats = matchingChats.map(chat => ({
      ...chat,
      type: 'chat'
    }));
    
    searchResults.value = [...formattedUsers, ...formattedChats];
  } catch (error) {
    console.error('Ошибка при поиске:', error);
  } finally {
    isSearching.value = false;
  }
};

// Очистка поиска
const clearSearch = () => {
  searchQuery.value = '';
  searchResults.value = [];
};

// Получение стиля аватара
const getAvatarStyle = (item) => {
  if (item.avatar) {
    return { backgroundImage: `url(${item.avatar})` };
  }
  return {};
};

// Получение инициалов из имени
const getInitials = (name) => {
  if (!name) return '';
  
  const parts = name.split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
};

// Форматирование последнего сообщения
const formatLastMessage = (lastMessage) => {
  if (!lastMessage) return '';
  
  const maxLength = 30;
  let text = lastMessage.text || 'Медиа-сообщение';
  
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...';
  }
  
  return text;
};

// Показать профиль пользователя
const showUserProfile = (user) => {
  selectedUser.value = user;
  isProfileModalOpen.value = true;
  clearSearch(); // Очищаем поле поиска при выборе пользователя
};

// Закрыть профиль пользователя
const closeUserProfile = () => {
  isProfileModalOpen.value = false;
  selectedUser.value = null;
};

// Выбор чата
const selectChat = (chat) => {
  // Устанавливаем активный чат
  chatStore.setActiveChat(chat._id);
  clearSearch();
  
  // Переходим на страницу чата
  navigateTo('/messenger');
  
  // На мобильных устройствах переключаем на чат
  setTimeout(() => {
    if (window.innerWidth <= 859) {
      // Скрываем боковую панель
      const nuxtApp = useNuxtApp();
      if (nuxtApp.$sidebarVisible) {
        nuxtApp.$sidebarVisible.value = false;
      }
      
      // Дополнительно скрываем сайдбар через CSS-класс
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        sidebar.classList.remove('visible');
      }
      
      // Показываем чат
      const chatElement = document.querySelector('.chat');
      if (chatElement) {
        chatElement.classList.add('visible');
      }
    }
  }, 150); // Задержка для гарантии завершения перехода
};

// Обработчик события send-message от UserProfile
const createPrivateChat = (userId) => {
  // Закрываем модальное окно профиля
  closeUserProfile();
  
  // Логика создания и открытия чата реализована в компоненте UserProfile
  console.log('Обработано событие send-message от UserProfile для пользователя:', userId);
};

// Очищаем поиск при размонтировании компонента
onBeforeUnmount(() => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
});
</script>

<style lang="sass">
@import '@variables'

.search
  &__input-wrapper
    position: relative
  
  &__input
    width: 100%
    padding: 10px 30px 10px 35px
    border-radius: $scrollbar-radius
    border: 1px solid rgba($white, 0.2)
    background-color: rgba($white, 0.1)
    color: $white
    font-size: 16px
    text-indent: 20px
    
    &:focus
      outline: none
      border-color: $purple

    &::placeholder
      text-indent: 20px
  
  &__icon
    position: absolute
    left: 10px
    top: 50%
    transform: translateY(-50%)
    color: rgba($white, 0.6)
  
  &__clear-btn
    position: absolute
    right: 0px
    top: 50%
    padding: 0px 10px
    transform: translateY(-55%)
    background: none
    border: none
    color: rgba($white, 0.6)
    font-size: 28px
    cursor: pointer
    
    &:hover
      color: $white
  
  &__loading, &__no-results
    display: flex
    flex-direction: column
    align-items: center
    justify-content: center
    padding: 20px
    color: rgba($white, 0.7)
  
  &__spinner
    width: 20px
    height: 20px
    border: 2px solid rgba($white, 0.1)
    border-radius: 50%
    border-top-color: $white
    animation: spin 1s ease-in-out infinite
    margin-bottom: 10px
  
  &__results
    max-height: 400px
    overflow-y: auto
    @include custom-scrollbar
  
  &__section
    margin-bottom: 15px
    
    &:last-child
      margin-bottom: 0
  
  &__section-title
    font-size: 14px
    font-weight: 600
    color: rgba($white, 0.8)
    margin: 0 0 8px 0
    padding-bottom: 5px
    border-bottom: 1px solid rgba($white, 0.1)
  
  &__result-item
    display: flex
    align-items: center
    padding: 8px
    border-radius: $scrollbar-radius
    cursor: pointer
    transition: background-color $transition-speed $transition-function
    
    &:hover
      background-color: rgba($white, 0.1)
  
  &__avatar
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
  
  &__initials
    font-size: 16px
    font-weight: 600
    color: $white
  
  &__user-info, &__chat-info
    flex: 1
    overflow: hidden
  
  &__user-name, &__chat-name
    font-weight: 500
    color: $white
    margin-bottom: 2px
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
  
  &__user-email, &__chat-message
    font-size: 12px
    color: rgba($white, 0.7)
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis

// Анимация для спиннера
@keyframes spin
  0%
    transform: rotate(0deg)
  100%
    transform: rotate(360deg)

// Модальное окно профиля
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
  z-index: 100

.profile-modal-content
  background-color: $header-bg
  border-radius: 8px
  padding: 20px
  width: 90%
  max-width: 500px
  max-height: 90vh
  overflow-y: auto
  position: relative
  @include custom-scrollbar

.profile-modal-close
  position: absolute
  top: 10px
  right: 10px
  background: none
  border: none
  color: rgba($white, 0.7)
  font-size: 24px
  cursor: pointer
  z-index: 1
  
  &:hover
    color: $white
</style>
