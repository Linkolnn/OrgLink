<template>
  <div class="notification-control">
    <button 
      v-if="showButton" 
      @click.stop="toggleChatNotifications" 
      class="notification-btn"
      :class="{ 'notification-btn--enabled': !isMuted }"
      :title="buttonTitle"
    >
      <span class="notification-icon">
        <svg v-if="!isMuted" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          <path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path>
          <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path>
          <path d="M18 8a6 6 0 0 0-9.33-5"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      </span>
    </button>
  </div>
</template>

<script setup>
import { useChatStore } from '~/stores/chat';
const chatStore = useChatStore();

const props = defineProps({
  chatId: {
    type: String,
    required: true
  }
});

const { $notifications } = useNuxtApp();

// Состояние уведомлений
const notificationsSupported = ref(false);
const notificationPermission = ref('default');
const notificationsEnabled = computed(() => notificationPermission.value === 'granted');

// Состояние отключенных чатов
const mutedChats = ref({});
// Вычисляемое свойство для проверки, отключен ли текущий чат
const isMuted = computed(() => {
  return !!mutedChats.value[props.chatId];
});

// Функция для загрузки списка отключенных чатов
const loadMutedChats = () => {
  if (process.client) {
    try {
      const savedMutedChats = localStorage.getItem('mutedChatsObj');
      if (savedMutedChats) {
        mutedChats.value = JSON.parse(savedMutedChats);
      }
    } catch (error) {
      console.error('Ошибка при загрузке списка отключенных чатов:', error);
      mutedChats.value = {};
    }
  }
};

// Функция для отключения уведомлений для конкретного чата
const muteChat = (chatId) => {
  if (!chatId) return;
  
  // Добавляем чат в объект отключенных чатов
  mutedChats.value = { ...mutedChats.value, [chatId]: true };
  localStorage.setItem('mutedChatsObj', JSON.stringify(mutedChats.value));
  
  console.log('Чат добавлен в список отключенных:', chatId, mutedChats.value);
};

// Функция для включения уведомлений для конкретного чата
const unmuteChat = (chatId) => {
  if (!chatId) return;
  
  // Создаем новый объект без указанного чата
  const newMutedChats = { ...mutedChats.value };
  delete newMutedChats[chatId];
  mutedChats.value = newMutedChats;
  localStorage.setItem('mutedChatsObj', JSON.stringify(mutedChats.value));
  
  console.log('Чат удален из списка отключенных:', chatId, mutedChats.value);
};

// Вычисляемые свойства
const showButton = computed(() => notificationsSupported.value);
const buttonTitle = computed(() => {
  if (!notificationsSupported.value) return 'Уведомления не поддерживаются';
  if (!notificationsEnabled.value) return 'Уведомления заблокированы в браузере';
  
  return isMuted.value 
    ? 'Включить уведомления для этого чата' 
    : 'Отключить уведомления для этого чата';
});

// Метод для запроса разрешения на уведомления
const requestNotificationPermission = async () => {
  if (!$notifications || !notificationsSupported.value) {
    console.warn('[NotificationControl] Уведомления не поддерживаются в этом браузере');
    return false;
  }
  
  // Проверяем, работает ли сайт по HTTPS
  if (process.client && !window.isSecureContext) {
    console.warn('[NotificationControl] Уведомления требуют защищенного контекста (HTTPS)');
    return false;
  }
  
  // Проверяем, работает ли сайт на разрешенном домене
  if (process.client) {
    const isAllowedDomain = (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('railway.app')
    );
    
    if (!isAllowedDomain) {
      console.warn('[NotificationControl] Уведомления не работают на этом домене');
      return false;
    }
  }
  
  // Если разрешение уже получено, возвращаем true
  if (notificationPermission.value === 'granted') {
    console.log('[NotificationControl] Разрешение на уведомления уже получено');
    return true;
  }
  
  try {
    console.log('[NotificationControl] Запрашиваем разрешение на уведомления...');
    const granted = await $notifications.requestPermission();
    notificationPermission.value = $notifications.permission.value;
    console.log('[NotificationControl] Результат запроса разрешения:', granted);
    return granted;
  } catch (error) {
    console.error('[NotificationControl] Ошибка при запросе разрешения на уведомления:', error);
    return false;
  }
};

// Метод для проверки разрешения на уведомления
const checkNotificationPermission = async () => {
  if (!await requestNotificationPermission()) {
    return false;
  }
  return true;
};

// Метод для переключения уведомлений для конкретного чата
const toggleChatNotifications = async () => {
  // Сначала проверяем и запрашиваем разрешение, если нужно
  if (!await checkNotificationPermission()) {
    return;
  }
  
  const chatId = props.chatId;
  
  // Получаем название чата
  let chatName = 'Чат';
  
  // Получаем чат из хранилища
  const chat = chatStore.chats.find(c => c._id === chatId);
  if (chat) {
    chatName = chat.name || (
      chat.type === 'private' && chat.participants && chat.participants.length > 0 
        ? chat.participants.find(p => p._id !== chatStore.$auth?.user?._id)?.name || 'Приватный чат' 
        : 'Чат'
    );
  }
  
  // Если уведомления включены, то отключаем их, иначе включаем
  if (!isMuted.value) {
    muteChat(chatId);
    window.$showNotification(
      `Уведомления для чата «${chatName}» отключены`,
      'warning'
    );
  } else {
    unmuteChat(chatId);
    window.$showNotification(
      `Уведомления для чата «${chatName}» включены`,
      'success'
    );
  }
};

// Инициализация
onMounted(async () => {
  if ($notifications) {
    notificationsSupported.value = $notifications.supported;
    notificationPermission.value = $notifications.permission.value;
    
    // Загружаем список отключенных чатов
    loadMutedChats();
    
    // Следим за изменениями разрешения
    watch(() => $notifications.permission.value, (newValue) => {
      if (newValue !== undefined) {
        notificationPermission.value = newValue;
      }
    });
  }
});
</script>

<style lang="sass">
@import @variables

.notification-control
  display: inline-block
  
  .notification-btn
    background-color: rgba(#6c5ce7, 0.2)
    color: #6c5ce7
    border: none
    border-radius: 50%
    width: 36px
    height: 36px
    display: flex
    align-items: center
    justify-content: center
    cursor: pointer
    transition: all 0.3s ease
    
    &:hover
      background-color: rgba(#6c5ce7, 0.3)
    
    &--enabled
      background-color: $purple
      color: white
      
      &:hover
        background-color: darken(#6c5ce7, 10%)
    
    .notification-icon
      display: flex
      align-items: center
      justify-content: center
</style>
