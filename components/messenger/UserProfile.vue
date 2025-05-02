<template>
  <div class="user-profile">
    <div class="user-profile__header">
      <h2 class="user-profile__title">{{ isOtherUser ? userData.name || 'Профиль пользователя' : 'Мой профиль' }}</h2>
      <button 
        v-if="!isOtherUser"
        class="user-profile__edit-btn" 
        @click="toggleEditMode" 
        :class="{ 'user-profile__edit-btn--active': isEditing }"
      >
        {{ isEditing ? 'Сохранить' : 'Изменить' }}
      </button>
      <button 
        v-else
        class="user-profile__message-btn" 
        @click="sendMessage"
      >
        Написать сообщение
      </button>
    </div>
    
    <div class="user-profile__avatar-container">
      <div 
        class="user-profile__avatar" 
        :style="avatarStyle"
      >
        <div v-if="!avatarUrl && !avatarFile" class="user-profile__initials">
          {{ getInitials(userData.name || '') }}
        </div>
      </div>
      <label v-if="isEditing" class="user-profile__avatar-upload">
        <input 
          type="file" 
          accept="image/*" 
          @change="handleAvatarChange" 
          class="user-profile__avatar-input"
        >
        <span class="user-profile__avatar-upload-text">Изменить фото</span>
      </label>
    </div>
    
    <div class="user-profile__fields">
      <div class="user-profile__field">
        <label class="user-profile__label">Имя</label>
        <input 
          v-if="isEditing" 
          v-model="formData.name" 
          class="user-profile__input"
          placeholder="Введите ваше имя"
        />
        <div 
          v-else 
          class="user-profile__text" 
          @click="copyToClipboard(userData.name)"
          :title="'Нажмите, чтобы скопировать: ' + userData.name"
        >
          {{ userData.name || 'Не указано' }}
        </div>
      </div>
      
      <div class="user-profile__field">
        <label class="user-profile__label">Email</label>
        <input 
          v-if="isEditing" 
          v-model="formData.email" 
          class="user-profile__input"
          placeholder="Введите ваш email"
          type="email"
        />
        <div 
          v-else 
          class="user-profile__text" 
          @click="copyToClipboard(userData.email)"
          :title="'Нажмите, чтобы скопировать: ' + userData.email"
        >
          {{ userData.email || 'Не указано' }}
        </div>
      </div>
      
      <div class="user-profile__field">
        <label class="user-profile__label">Телефон</label>
        <input 
          v-if="isEditing" 
          v-model="formData.number" 
          class="user-profile__input"
          placeholder="Введите ваш номер телефона"
          type="tel"
        />
        <div 
          v-else 
          class="user-profile__text" 
          @click="copyToClipboard(userData.number)"
          :title="'Нажмите, чтобы скопировать: ' + userData.number"
        >
          {{ userData.number || 'Не указано' }}
        </div>
      </div>
    </div>
    
    <div v-if="isEditing" class="user-profile__actions">
      <button class="user-profile__cancel-btn" @click="cancelEdit">Отмена</button>
      <button class="user-profile__save-btn" @click="saveProfile" :disabled="isSaving">
        {{ isSaving ? 'Сохранение...' : 'Сохранить' }}
      </button>
    </div>
    
    <div v-if="notification.show" class="user-profile__notification" :class="notification.type">
      {{ notification.message }}
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '~/stores/auth';
import { useChatStore } from '~/stores/chat';
import { useNuxtApp } from '#app';

const props = defineProps({
  userData: {
    type: Object,
    default: () => ({})
  },
  isOtherUser: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['send-message']);

const authStore = useAuthStore();
const isEditing = ref(false);
const isSaving = ref(false);
const localUserData = ref({
  name: '',
  email: '',
  number: '',
  avatar: ''
});

// Используем данные из props, если они предоставлены, иначе используем локальные данные
const userData = computed(() => {
  if (props.isOtherUser && Object.keys(props.userData).length > 0) {
    return props.userData;
  }
  return localUserData.value;
});

const formData = reactive({
  name: '',
  email: '',
  number: ''
});

const avatarFile = ref(null);
const avatarUrl = ref('');
const notification = reactive({
  show: false,
  message: '',
  type: 'success'
});

// Вычисляемое свойство для стиля аватара
const avatarStyle = computed(() => {
  if (avatarFile.value) {
    return { backgroundImage: `url(${URL.createObjectURL(avatarFile.value)})` };
  } else if (avatarUrl.value) {
    return { backgroundImage: `url(${avatarUrl.value})` };
  }
  return {};
});

// Загрузка данных пользователя при монтировании компонента
onMounted(async () => {
  // Загружаем данные только если это профиль текущего пользователя
  if (!props.isOtherUser) {
    await fetchUserData();
  }
});

// Получение данных пользователя с сервера
async function fetchUserData() {
  try {
    const config = useRuntimeConfig();
    const response = await fetch(`${config.public.backendUrl}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    localUserData.value = {
      _id: data._id || '',
      name: data.name || '',
      email: data.email || '',
      number: data.number || '',
      avatar: data.avatar || ''
    };
    
    // Обновляем данные пользователя
    authStore.user = {
      ...authStore.user,
      name: data.name || authStore.user.name || '',
      number: data.number || authStore.user.number || '',
      avatar: data.avatar || authStore.user.avatar || ''
    };
  } catch (error) {
    console.error('Ошибка при получении данных пользователя:', error);
    showNotification('Не удалось загрузить данные профиля', 'error');
  }
}

// Переключение режима редактирования
function toggleEditMode() {
  if (props.isOtherUser) return; // Запрещаем редактирование профиля другого пользователя
  
  if (isEditing.value) {
    saveProfile();
  } else {
    startEditing();
  }
}

// Отправка сообщения пользователю
async function sendMessage() {
  if (props.isOtherUser && userData.value._id) {
    try {
      const userId = userData.value._id;
      const chatStore = useChatStore();
      
      console.log('UserProfile: Нажата кнопка Написать сообщение для пользователя:', userId);
      console.log('UserProfile: Данные пользователя:', userData.value);
      console.log('UserProfile: Текущие чаты:', chatStore.chats.length);
      
      // Проверяем, существует ли уже приватный чат с этим пользователем
      // Ищем только среди чатов с типом 'private'
      const existingChat = chatStore.chats.find(chat => {
        // Проверяем, что тип чата действительно 'private'
        if (chat.type !== 'private') return false;
        
        // Проверяем, что в чате есть нужный пользователь
        const hasTargetUser = chat.participants.some(p => p._id === userId);
        
        // Проверяем, что в чате ровно 2 участника (текущий пользователь и целевой)
        const hasTwoParticipants = chat.participants.length === 2;
        
        return hasTargetUser && hasTwoParticipants;
      });
      
      console.log('UserProfile: Существующий чат:', existingChat);
      
      let chatId;
      
      if (existingChat) {
        // Если чат существует, открываем его
        chatId = existingChat._id;
        console.log('UserProfile: Открываем существующий чат:', chatId);
      } else {
        // Создаем временный объект чата для предпросмотра
        console.log('UserProfile: Создаем временный чат для предпросмотра');
        
        // Создаем временный чат для предпросмотра
        const previewChat = {
          _id: 'preview_' + userId, // временный ID
          name: userData.value.name || 'Пользователь',
          type: 'private',
          isPreview: true, // флаг предпросмотра
          participants: [{ _id: userId, name: userData.value.name, avatar: userData.value.avatar }],
          messages: [],
          avatar: userData.value.avatar,
          unread: 0,
          lastMessage: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          previewUserId: userId // сохраняем ID пользователя для создания реального чата
        };
        
        // Добавляем превью-чат в массив чатов
        chatStore.chats.unshift(previewChat);
        
        // Сбрасываем предыдущий активный чат и его сообщения
        chatStore.messages = [];
        
        // Устанавливаем временный чат как активный
        chatStore.activeChat = previewChat;
        chatStore.isPreviewMode = true;
        chatId = previewChat._id;
        console.log('UserProfile: Установлен временный чат:', previewChat);
      }
      
      // Открываем чат
      openChat(chatId);
      
      // Также отправляем событие наверх для обратной совместимости
      emit('send-message', userId);
    } catch (error) {
      console.error('Ошибка при создании приватного чата:', error);
      showNotification('Не удалось создать чат', 'error');
    }
  }
}

// Открытие чата
function openChat(chatId) {
  const chatStore = useChatStore();
  
  // Устанавливаем активный чат
  chatStore.setActiveChat(chatId);
  
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
}

// Начало редактирования
function startEditing() {
  formData.name = userData.value.name || '';
  formData.email = userData.value.email || '';
  formData.number = userData.value.number || '';
  isEditing.value = true;
}

// Отмена редактирования
function cancelEdit() {
  isEditing.value = false;
  avatarFile.value = null;
}

// Сохранение профиля
async function saveProfile() {
  isSaving.value = true;
  
  try {
    console.log('Отправка данных профиля:', {
      name: formData.name,
      email: formData.email,
      number: formData.number,
      hasAvatar: !!avatarFile.value
    });
    
    const formDataToSend = new FormData();
    formDataToSend.append('name', formData.name);
    formDataToSend.append('email', formData.email);
    formDataToSend.append('number', formData.number);
    
    if (avatarFile.value) {
      formDataToSend.append('avatar', avatarFile.value);
    }
    
    // Отправляем запрос на обновление профиля на сервер
    try {
      // Используем новый endpoint для обновления профиля
      const response = await $fetch(`/api/users/update-profile`, {
        method: 'POST',
        body: formDataToSend,
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      });
      
      console.log('Ответ сервера:', response);
      
      // Обновляем данные пользователя
      const data = await response.json();
      localUserData.value = {
        _id: data._id || '',
        name: data.name || '',
        email: data.email || '',
        number: data.number || '',
        avatar: data.avatar || ''
      };
      
      if (response && response.avatar) {
        avatarUrl.value = response.avatar;
        userData.value.avatar = response.avatar;
      } else if (avatarFile.value) {
        // Если сервер не вернул аватар, но мы загрузили файл
        const tempUrl = URL.createObjectURL(avatarFile.value);
        avatarUrl.value = tempUrl;
        userData.value.avatar = tempUrl;
      }
      
      // Обновляем данные в авторизационном хранилище
      if (authStore.user) {
        authStore.user = {
          ...authStore.user,
          name: formData.name,
          email: formData.email,
          number: formData.number,
          avatar: userData.value.avatar
        };
      }
      
      isEditing.value = false;
      showNotification('Профиль успешно обновлен', 'success');
    } catch (apiError) {
      console.error('Ошибка при отправке данных на сервер:', apiError);
      
      // Пытаемся использовать альтернативный endpoint
      try {
        const jsonData = {
          name: formData.name,
          email: formData.email,
          number: formData.number
        };
        
        // Пытаемся отправить JSON данные вместо FormData
        const altResponse = await $fetch(`/api/auth/update-profile`, {
          method: 'PUT',
          body: jsonData,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authStore.token}`
          }
        });
        
        console.log('Ответ с альтернативного сервера:', altResponse);
        
        // Обновляем данные пользователя
        userData.value = {
          ...userData.value,
          name: formData.name,
          email: formData.email,
          number: formData.number
        };
        
        if (avatarFile.value) {
          const tempUrl = URL.createObjectURL(avatarFile.value);
          avatarUrl.value = tempUrl;
          userData.value.avatar = tempUrl;
        }
        
        // Обновляем данные в авторизационном хранилище
        if (authStore.user) {
          authStore.user = {
            ...authStore.user,
            name: formData.name,
            email: formData.email,
            number: formData.number,
            avatar: userData.value.avatar
          };
        }
        
        isEditing.value = false;
        showNotification('Профиль успешно обновлен', 'success');
      } catch (altError) {
        console.error('Ошибка при использовании альтернативного метода:', altError);
        
        // Временное решение: обновляем данные локально для демонстрации
        userData.value = {
          ...userData.value,
          name: formData.name,
          email: formData.email,
          number: formData.number
        };
        
        if (avatarFile.value) {
          const tempUrl = URL.createObjectURL(avatarFile.value);
          avatarUrl.value = tempUrl;
          userData.value.avatar = tempUrl;
        }
        
        // Обновляем данные в авторизационном хранилище
        if (authStore.user) {
          authStore.user = {
            ...authStore.user,
            name: formData.name,
            email: formData.email,
            number: formData.number,
            avatar: userData.value.avatar
          };
        }
        
        isEditing.value = false;
        showNotification('Профиль обновлен локально', 'success');
      }
    }
  } catch (error) {
    console.error('Ошибка при обновлении профиля:', error);
    showNotification('Не удалось обновить профиль', 'error');
  } finally {
    isSaving.value = false;
  }
}

// Обработка изменения аватара
function handleAvatarChange(event) {
  const file = event.target.files[0];
  if (file) {
    avatarFile.value = file;
  }
}

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

// Копирование текста в буфер обмена
function copyToClipboard(text) {
  if (!text) return;
  
  navigator.clipboard.writeText(text)
    .then(() => {
      showNotification('Скопировано в буфер обмена', 'success');
    })
    .catch(err => {
      console.error('Ошибка при копировании:', err);
      showNotification('Не удалось скопировать текст', 'error');
    });
}

// Показать уведомление
function showNotification(message, type = 'success') {
  notification.message = message;
  notification.type = type;
  notification.show = true;
  
  // Скрыть уведомление через 3 секунды
  setTimeout(() => {
    notification.show = false;
  }, 3000);
}
</script>

<style lang="sass" scoped>
@import '~/assets/styles/variables'

.user-profile
  background-color: $header-bg
  color: $white
  border-radius: $scrollbar-radius
  padding: 20px
  width: 100%
  max-width: 500px
  margin: 0 auto
  
  &__header
    display: flex
    justify-content: space-between
    align-items: center
    margin-bottom: 20px
  
  &__title
    font-size: 20px
    font-weight: 600
    margin: 0
  
  &__edit-btn, &__message-btn
    background-color: transparent
    color: $purple
    border: 1px solid $purple
    border-radius: $scrollbar-radius
    padding: 6px 12px
    font-size: 14px
    cursor: pointer
    transition: all $transition-speed $transition-function
    
    &:hover
      background-color: rgba($purple, 0.1)
    
    &--active
      background-color: $purple
      color: $white
      
      &:hover
        background-color: darken($purple, 10%)
        
  &__message-btn
    background-color: $purple
    color: $white
    
    &:hover
      background-color: darken($purple, 10%)
  
  &__avatar-container
    display: flex
    flex-direction: column
    align-items: center
    margin-bottom: 20px
  
  &__avatar
    width: 100px
    height: 100px
    border-radius: 50%
    background-color: $purple
    display: flex
    align-items: center
    justify-content: center
    margin-bottom: 10px
    background-size: cover
    background-position: center
  
  &__initials
    font-size: 36px
    font-weight: 600
    color: $white
  
  &__avatar-upload
    cursor: pointer
    color: $purple
    font-size: 14px
    
    &:hover
      text-decoration: underline
  
  &__avatar-input
    display: none
  
  &__fields
    display: flex
    flex-direction: column
    gap: 15px
    margin-bottom: 20px
  
  &__field
    display: flex
    flex-direction: column
  
  &__label
    font-size: 14px
    margin-bottom: 5px
    color: rgba($white, 0.7)
  
  &__input
    background-color: rgba($white, 0.1)
    border: 1px solid rgba($white, 0.2)
    border-radius: $scrollbar-radius
    padding: 10px
    color: $white
    font-size: 16px
    transition: border-color $transition-speed $transition-function
    
    &:focus
      outline: none
      border-color: $purple
  
  &__text
    padding: 10px
    background-color: rgba($white, 0.05)
    border-radius: $scrollbar-radius
    cursor: pointer
    transition: background-color $transition-speed $transition-function
    
    &:hover
      background-color: rgba($white, 0.1)
  
  &__actions
    display: flex
    justify-content: flex-end
    gap: 10px
  
  &__cancel-btn
    background-color: transparent
    color: $white
    border: 1px solid rgba($white, 0.2)
    border-radius: $scrollbar-radius
    padding: 8px 16px
    cursor: pointer
    transition: background-color $transition-speed $transition-function
    
    &:hover
      background-color: rgba($white, 0.1)
  
  &__save-btn
    background-color: $purple
    color: $white
    border: none
    border-radius: $scrollbar-radius
    padding: 8px 16px
    cursor: pointer
    transition: background-color $transition-speed $transition-function
    
    &:hover
      background-color: darken($purple, 10%)
    
    &:disabled
      opacity: 0.5
      cursor: not-allowed
  
  &__notification
    position: fixed
    bottom: 20px
    right: 20px
    padding: 10px 15px
    border-radius: $scrollbar-radius
    color: $white
    font-size: 14px
    z-index: 100
    animation: fadeIn 0.3s, fadeOut 0.3s 2.7s
    
    &.success
      background-color: #4caf50
    
    &.error
      background-color: #f44336

@keyframes fadeIn
  from
    opacity: 0
    transform: translateY(10px)
  to
    opacity: 1
    transform: translateY(0)

@keyframes fadeOut
  from
    opacity: 1
    transform: translateY(0)
  to
    opacity: 0
    transform: translateY(10px)

@include mobile
  .user-profile
    padding: 15px
    
    &__avatar
      width: 80px
      height: 80px
      
    &__initials
      font-size: 28px
</style>