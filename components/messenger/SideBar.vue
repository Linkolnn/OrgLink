<template>
    <aside class="sidebar">
      <header class="sidebar__header">
        <div class="sidebar__dropdown dropdown">
          <button class="dropdown__toggle" @click="toggleMenu">
            Меню
          </button>
          <div v-if="isMenuOpen" class="dropdown__menu">
            <NuxtLink to="/messenger" class="dropdown__item" @click="navigateTo('/messenger')">Мессенджер</NuxtLink>
            <NuxtLink v-if="authStore.isAdmin" to="/admin" class="dropdown__item" @click="navigateTo('/admin')">Админ панель</NuxtLink>
            <button @click="logout" class="dropdown__item dropdown__item--logout">Выйти</button>
          </div>
        </div>
        <div class="sidebar__actions">
          <h3 class="sidebar__title">Чаты</h3>
          <button class="sidebar__button sidebar__button--new" @click="createNewChat">
            <span>+</span>
          </button>
        </div>
      </header>
      <div class="sidebar__content">
        <div v-if="chatStore.loading && !chatStore.chats.length" class="sidebar__loading">
          <div class="sidebar__spinner"></div>
          <p class="sidebar__message">Загрузка чатов...</p>
        </div>
        <div v-else-if="chatStore.chats.length === 0" class="sidebar__empty">
          <p class="sidebar__message">У вас пока нет чатов</p>
          <button class="sidebar__button sidebar__button--create" @click="createNewChat">Создать чат</button>
        </div>
        <div v-else ref="chatListRef" class="sidebar__chats">
          <div 
            v-for="chat in chats" 
            :key="chat._id" 
            :data-chat-id="chat._id"
            class="chat-item"
            :class="{ 'chat-item--active': chatStore.activeChat?._id === chat._id }"
            @click="selectChat(chat._id)"
          >
            <div 
              class="chat-item__avatar"
              :style="chat.avatar ? { backgroundImage: `url(${chat.avatar})` } : {}"
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
              <div v-if="chat.unread" class="chat-item__badge">{{ chat.unread }}</div>
              <div v-if="chat.lastMessage?.timestamp" :id="`chat-time-${chat._id}`" class="chat-item__time">
                {{ chat.formattedTime }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Модальное окно создания чата -->
      <EditChatModal
        v-if="showCreateChatModal"
        :is-open="showCreateChatModal"
        :is-new-chat="true"
        @close="showCreateChatModal = false"
        @saved="onChatCreated"
      />
    </aside>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useNuxtApp } from '#app';
import { useAuthStore } from '~/stores/auth';
import { useChatStore } from '~/stores/chat';
import EditChatModal from '~/components/Chat/EditChatModal.vue';

const chatStore = useChatStore();
const authStore = useAuthStore();
const router = useRouter();

// Получаем функции для мобильного отображения
// Определяем, является ли устройство мобильным
const isMobile = ref(false);

// Проверяем размер экрана при монтировании
onMounted(() => {
  isMobile.value = window.innerWidth <= 859;
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth <= 859;
  });
});

// Состояние модального окна создания чата
const showCreateChatModal = ref(false);
const isMenuOpen = ref(false);

// Инициализация WebSocket слушателей при монтировании компонента
onMounted(() => {
  // Инициализируем слушатели WebSocket
  chatStore.initSocketListeners();
  
  // Загружаем список чатов, если он еще не загружен
  if (!chatStore.initialLoadComplete) {
    chatStore.fetchChats();
  }
});

// Следим за изменениями в списке чатов
// Используем computed с глубоким отслеживанием для обеспечения реактивности
const forceUpdate = ref(0);
const chats = computed(() => {
  // Формсируем принудительное обновление (не используется, но необходим для реактивности)
  const _ = forceUpdate.value;
  
  // Возвращаем обработанную копию чатов для обеспечения реактивности
  return [...chatStore.chats].map(chat => ({
    ...chat,
    _id: chat._id, // Для обновления списка чатов
    lastMessageText: chat.lastMessage?.text || 'Нет сообщений',
    formattedTime: chat.lastMessage?.timestamp ? formatTime(new Date(chat.lastMessage.timestamp)) : ''
  }));
});

// Следим за изменениями в списке чатов
watch(() => chatStore.chats, () => {
  // Принудительно обновляем компонент
  forceUpdate.value++;
}, { deep: true });

// Выбор чата
const selectChat = (chatId) => {
  chatStore.setActiveChat(chatId);
  
  // На мобильных устройствах переключаем на чат
  if (isMobile.value) {
    showChat();
  }
};

// Выход из аккаунта
const logout = async () => {
  await authStore.logout();
  router.push('/');
};

// Создание нового чата
const createNewChat = () => {
  showCreateChatModal.value = true;
};

// Обработка создания чата
const onChatCreated = (chat) => {
  showCreateChatModal.value = false;
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

// Переключение меню
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

// Плавная навигация между страницами
const navigateTo = (path) => {
  // Закрываем меню
  toggleMenu();
  
  // Получаем доступ к глобальному состоянию
  const nuxtApp = useNuxtApp();
  
  // Если мы на мобильном устройстве, скрываем боковую панель
  if (window.innerWidth <= 859) {
    if (nuxtApp.$sidebarVisible) {
      nuxtApp.$sidebarVisible.value = false;
    }
  }
  
  // Переходим на новую страницу
  router.push(path);
};

// Функция для показа чата на мобильных устройствах
const showChat = () => {
  const nuxtApp = useNuxtApp();
  if (nuxtApp.$sidebarVisible) {
    nuxtApp.$sidebarVisible.value = false;
  }
};

// Добавляем слушатель для принудительного обновления компонента при получении новых сообщений
const chatListRef = ref(null);

onMounted(() => {
  const { $socket } = useNuxtApp();
  
  // Слушаем новые сообщения в сокете
  if ($socket) {
    // Удаляем существующий слушатель, чтобы избежать дублирования
    $socket.off('new-message');
    
    $socket.on('new-message', ({ message, chatId }) => {
      // Принудительно обновляем компонент
      forceUpdate.value++;
      
      // Обновляем DOM элементы для нового сообщения
      setTimeout(() => {
        // Находим чат в списке
        const chatIndex = chatStore.chats.findIndex(chat => chat._id === chatId);
        
        if (chatIndex !== -1) {
          const chat = chatStore.chats[chatIndex];
          const messageText = message.text || 'Медиа-сообщение';
          const timeFormatted = formatTime(new Date(message.createdAt || new Date()));
          
          // Обновляем текст сообщения и время
          const messageEl = document.getElementById(`chat-message-${chatId}`);
          const timeEl = document.getElementById(`chat-time-${chatId}`);
          
          if (messageEl) {
            messageEl.textContent = messageText;
          }
          
          if (timeEl) {
            timeEl.textContent = timeFormatted;
          }
          
          // Перемещаем чат в начало списка
          const chatItem = document.querySelector(`[data-chat-id="${chatId}"]`);
          if (chatItem && chatListRef.value) {
            chatListRef.value.insertBefore(chatItem, chatListRef.value.firstChild);
          }
        }
      }, 100);
    });
  }
});
</script>

<style lang="sass" scoped>
@import '~/assets/styles/variables'

// Стили для адаптивного дизайна

.sidebar
  width: $sidebar-width
  height: 100vh
  background: $header-bg
  color: $white
  display: flex
  flex-direction: column
  transition: transform $transition-speed $transition-function
  border-right: 1px solid rgba($white, 0.1)
  @include custom-scrollbar
  
  @include tablet
    position: absolute
    left: 0
    top: 0
    z-index: 5
    width: 100%
    transform: translateX(-100%)
    
    &.visible
      transform: translateX(0)

  &__header
    padding: 16px
    border-bottom: 1px solid rgba($white, 0.1)
    position: relative
  
  &__actions
    display: flex
    justify-content: space-between
    align-items: center
    margin-top: 12px
  
  &__title
    margin: 0
    font-size: 18px
    font-weight: 600
  
  &__button
    border: none
    cursor: pointer
    transition: background-color $transition-speed $transition-function
    
    &--new
      background-color: $purple
      color: $white
      width: 28px
      height: 28px
      border-radius: 50%
      display: flex
      align-items: center
      justify-content: center
      font-size: 18px
      
      &:hover
        background-color: darken($purple, 10%)
    
    &--create
      margin-top: 12px
      background-color: $purple
      color: $white
      padding: 8px 16px
      border-radius: $scrollbar-radius
      font-size: 14px
      
      &:hover
        background-color: darken($purple, 10%)
  
  &__content
    flex: 1
    min-width: 250px
    overflow-y: auto
    padding: 12px
    @include custom-scrollbar
  
  &__loading, &__empty
    display: flex
    flex-direction: column
    align-items: center
    justify-content: center
    height: 120px
    color: rgba($white, 0.7)
  
  &__spinner
    width: 32px
    height: 32px
    border: 3px solid rgba($white, 0.3)
    border-radius: 50%
    border-top-color: $white
    animation: spin 1s ease-in-out infinite
    margin-bottom: 12px
  
  &__message
    text-align: center
    margin: 0
    font-size: 14px
  
  &__chats
    display: flex
    flex-direction: column
    gap: 6px

// Дропдаун
.dropdown
  position: relative
  
  &__toggle
    background-color: transparent
    color: $white
    border: none
    cursor: pointer
    padding: 6px 0
    font-size: 14px
    
    &:hover
      text-decoration: underline
  
  &__menu
    position: absolute
    top: 100%
    left: 0
    background-color: $header-bg
    border: 1px solid rgba($white, 0.1)
    border-radius: $scrollbar-radius
    z-index: 10
    min-width: 160px
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2)
  
  &__item
    display: block
    padding: 10px 16px
    color: $white
    text-decoration: none
    cursor: pointer
    border: none
    background: none
    width: 100%
    text-align: left
    font-size: 14px
    transition: background-color $transition-speed $transition-function
    
    &:hover
      background-color: rgba($white, 0.1)
    
    &--logout
      color: #ff6b6b

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

// Анимация для спиннера
@keyframes spin
  0%
    transform: rotate(0deg)
  100%
    transform: rotate(360deg)

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