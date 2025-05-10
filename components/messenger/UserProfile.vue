<template>
  <div class="user-profile">
    <!-- Заголовок с именем пользователя и фиолетовой рамкой снизу -->
    <div class="user-profile__header">
      <h2 class="user-profile__title">{{ userData.name || 'Профиль пользователя' }}</h2>
    </div>
    
    <!-- Аватар и кнопки под ним -->
    <div class="user-profile__avatar-container">
      <!-- В режиме редактирования аватарка кликабельна -->
      <label v-if="isEditing" class="user-profile__avatar-clickable">
        <input 
          type="file" 
          accept="image/*" 
          @change="handleAvatarUpload" 
          class="user-profile__avatar-input"
        >
        <div 
          class="user-profile__avatar" 
          :style="avatarStyle"
        >
          <!-- Отладочная информация о URL аватара -->
          <pre v-if="false" style="font-size: 8px; position: absolute; top: 0; left: 0; background: rgba(0,0,0,0.5); color: white; padding: 2px; max-width: 100px; overflow: hidden; text-overflow: ellipsis;">{{ avatarUrl }}</pre>
          
          <!-- Отображаем инициалы, если нет аватара -->
          <div v-if="!avatarStyle.backgroundImage" class="user-profile__initials">
            {{ getInitials(userData.name || '') }}
          </div>
          
          <!-- Отладочная информация о времени обновления -->
          <div v-if="avatarStyle.backgroundImage" class="user-profile__debug-info">{{ new Date().toISOString().slice(11, 19) }}</div>
          
          <!-- Индикатор возможности изменения -->
          <div class="user-profile__avatar-overlay">
            <span class="user-profile__avatar-change-icon">Изменить</span>
          </div>
        </div>
      </label>
      
      <!-- В обычном режиме просто показываем аватарку -->
      <div 
        v-else
        class="user-profile__avatar" 
        :style="avatarStyle"
      >
        <!-- Отладочная информация о URL аватара -->
        <pre v-if="false" style="font-size: 8px; position: absolute; top: 0; left: 0; background: rgba(0,0,0,0.5); color: white; padding: 2px; max-width: 100px; overflow: hidden; text-overflow: ellipsis;">{{ avatarUrl }}</pre>
        
        <!-- Отображаем инициалы, если нет аватара -->
        <div v-if="!avatarStyle.backgroundImage" class="user-profile__initials">
          {{ getInitials(userData.name || '') }}
        </div>
        
        <!-- Отладочная информация о времени обновления -->
        <div v-if="avatarStyle.backgroundImage" class="user-profile__debug-info">{{ new Date().toISOString().slice(11, 19) }}</div>
      </div>
      
      <!-- Кнопка изменения аватара (только в режиме редактирования) -->
      <label v-if="isEditing" class="user-profile__avatar-upload">
        <input 
          type="file" 
          accept="image/*" 
          @change="handleAvatarUpload" 
          class="user-profile__avatar-input"
        >
        <span class="user-profile__avatar-upload-text">Изменить фото</span>
      </label>
      
      <!-- Кнопка отправки сообщения (только для профилей других пользователей) -->
      <div class="user-profile__actions" v-if="isOtherUser">
        <button 
          class="user-profile__message-btn" 
          @click="sendMessage"
        >
          Написать сообщение
        </button>
      </div>
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
    
    <!-- Кнопки действий для режима редактирования -->
    <div v-if="isEditing" class="user-profile__actions">
      <button class="user-profile__cancel-btn" @click="cancelEdit">Отмена</button>
      <button class="user-profile__save-btn" @click="saveProfile" :disabled="isSaving">
        {{ isSaving ? 'Сохранение...' : 'Сохранить' }}
      </button>
    </div>
    
    <!-- Кнопка Изменить для обычного режима просмотра -->
    <div v-if="!isEditing && !isOtherUser" class="user-profile__actions">
      <button class="user-profile__edit-btn" @click="toggleEditMode">Изменить</button>
    </div>
    
    <div v-if="notification.show" class="user-profile__notification" :class="notification.type">
      {{ notification.message }}
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useChatStore } from '~/stores/chat';
import { useNuxtApp } from '#app';
import { useRoute, useRouter } from 'vue-router';
import { secureUrl } from '~/utils/secureUrl';

const props = defineProps({
  userData: {
    type: Object,
    default: () => ({})
  },
  userId: {
    type: String,
    default: ''
  },
  isOtherUser: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['send-message', 'close']);

const authStore = useAuthStore();
const isEditing = ref(false);
const isSaving = ref(false);
const localUserData = ref({
  name: '',
  email: '',
  number: '',
  avatar: ''
});

// Данные пользователя
const userDataFromServer = ref({});
const isLoading = ref(false);
const loadError = ref('');

// Загрузка данных пользователя по ID
const loadUserData = async () => {
  // Если это профиль текущего пользователя, используем данные из авторизации
  if (!props.userId && !props.isOtherUser) {
    return;
  }
  
  // Если данные уже предоставлены в props
  if (props.userData && Object.keys(props.userData).length > 0) {
    userDataFromServer.value = props.userData;
    console.log('UserProfile: Используем данные из props:', props.userData);
    return;
  }
  
  // Здесь можно добавить загрузку данных с сервера, если будет создан соответствующий API на сервере
  // Пока просто используем то, что есть
  console.log('UserProfile: Нет данных пользователя в props, используем минимальные данные');
  
  // Создаем минимальный объект с данными пользователя
  userDataFromServer.value = {
    _id: props.userId,
    name: 'Пользователь',
    avatar: ''
  };
};

// Загружаем данные пользователя при монтировании компонента
onMounted(() => {
  loadUserData();
});

// Используем данные из props, если они предоставлены, иначе используем локальные данные
const userData = computed(() => {
  return {
    _id: localUserData.value._id || props.userData?._id || '',
    name: localUserData.value.name || props.userData?.name || '',
    email: localUserData.value.email || props.userData?.email || '',
    number: localUserData.value.number || props.userData?.number || '',
    avatar: localUserData.value.avatar || props.userData?.avatar || ''
  };
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

// Создаем реактивную переменную для хранения временного URL файла
const tempFileUrl = ref(null);

// Следим за изменениями в avatarFile и создаем временный URL
watch(avatarFile, (newFile) => {
  // Освобождаем предыдущий URL, если он был
  if (tempFileUrl.value) {
    URL.revokeObjectURL(tempFileUrl.value);
    tempFileUrl.value = null;
  }
  
  // Создаем новый URL для файла, если он есть
  if (newFile) {
    tempFileUrl.value = URL.createObjectURL(newFile);
    console.log('Создан новый временный URL:', tempFileUrl.value);
  }
});

// Освобождаем временный URL при уничтожении компонента
onBeforeUnmount(() => {
  if (tempFileUrl.value) {
    URL.revokeObjectURL(tempFileUrl.value);
    tempFileUrl.value = null;
  }
});

// Вычисляемое свойство для стиля аватара
const avatarStyle = computed(() => {
  // Добавляем отладочную информацию
  console.log('Значение avatarUrl:', avatarUrl.value);
  console.log('Значение tempFileUrl:', tempFileUrl.value);
  console.log('Значение userData.avatar:', userData.value?.avatar);
  console.log('Значение localUserData.avatar:', localUserData.value?.avatar);
  console.log('Значение authStore.user.avatar:', authStore.user?.avatar);
  
  let url = null;
  
  // Приоритет источников URL аватара:
  if (tempFileUrl.value) {
    // 1. Временный URL для загруженного файла
    url = tempFileUrl.value;
    console.log('Используем временный URL файла:', url);
  } else if (avatarUrl.value) {
    // 2. URL аватара из переменной avatarUrl
    url = secureUrl(avatarUrl.value);
    console.log('Обработанный URL аватара:', url);
  } else if (localUserData.value && localUserData.value.avatar) {
    // 3. Аватар из локальных данных пользователя
    url = secureUrl(localUserData.value.avatar);
    console.log('Используем аватар из локальных данных пользователя:', url);
  } else if (userData.value && userData.value.avatar) {
    // 4. Аватар из вычисляемого свойства userData
    url = secureUrl(userData.value.avatar);
    console.log('Используем аватар из данных пользователя:', url);
  } else if (authStore.user && authStore.user.avatar) {
    // 5. Аватар из хранилища аутентификации
    url = secureUrl(authStore.user.avatar);
    console.log('Используем аватар из хранилища аутентификации:', url);
  }
  
  // Если есть URL, формируем стиль с фоновым изображением
  if (url) {
    // Добавляем случайный параметр для предотвращения кэширования (только для URL с сервера, не для blob URL)
    if (!url.startsWith('blob:')) {
      const cacheBuster = `?t=${Date.now()}`;
      url = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}${cacheBuster}`;
    }
    return { backgroundImage: `url("${url}")` };
  }
  
  // Иначе возвращаем пустой объект стилей
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
    console.log('Получены данные пользователя:', data);
    
    // Если есть аватар, устанавливаем его URL
    if (data.avatar) {
      avatarUrl.value = data.avatar;
      console.log('Установлен URL аватара:', avatarUrl.value);
    }
    
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
    
    // Не обновляем userData, так как это вычисляемое свойство
    // Вместо этого обновляем localUserData, которое используется в вычисляемом свойстве userData
    console.log('Обновлены локальные данные пользователя');
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
  if (props.isOtherUser) {
    try {
      const userId = props.userId || userData.value._id;
      if (!userId) {
        console.error('UserProfile: ID пользователя не найден');
        return;
      }
      
      const chatStore = useChatStore();
      console.log('UserProfile: Нажата кнопка Написать сообщение для пользователя:', userId);
      
      // Проверяем, существует ли уже приватный чат с этим пользователем
      const existingChat = chatStore.chats.find(chat => {
        // Проверяем, что тип чата действительно 'private'
        if (chat.type !== 'private') return false;
        
        // Проверяем, что в чате есть нужный пользователь
        const hasTargetUser = chat.participants.some(p => {
          return typeof p === 'object' ? p._id === userId : p === userId;
        });
        
        // Проверяем, что в чате ровно 2 участника (текущий пользователь и целевой)
        const hasTwoParticipants = chat.participants.length === 2;
        
        return hasTargetUser && hasTwoParticipants;
      });
      
      // Сбрасываем текущее состояние чата, чтобы избежать визуальных багов
      chatStore.resetActiveChat();
      
      // Если чат существует, открываем его
      if (existingChat) {
        await chatStore.setActiveChat(existingChat._id);
        navigateTo('/messenger');
      } else {
        // Иначе создаем предпросмотр приватного чата
        // Чат будет создан только после отправки первого сообщения
        chatStore.setPreviewChat(userData.value);
        navigateTo('/messenger');
      }
      
      // Закрываем модальное окно
      emit('close');
    } catch (error) {
      console.error('UserProfile: Ошибка при отправке сообщения:', error);
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
    
    // Создаем FormData для отправки файла
    const formDataToSend = new FormData();
    formDataToSend.append('name', formData.name);
    formDataToSend.append('email', formData.email);
    formDataToSend.append('number', formData.number);
    
    // Добавляем файл аватара, если он есть
    if (avatarFile.value) {
      console.log('Добавляем файл аватара в FormData:', avatarFile.value.name);
      formDataToSend.append('avatar', avatarFile.value);
    }
    
    // Отправляем запрос на обновление профиля на сервер
    try {
      // Используем правильный endpoint для обновления профиля
      const config = useRuntimeConfig();
      
      // Выбираем URL в зависимости от окружения
      let backendUrl = config.public.backendUrl;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        backendUrl = config.public.localBackendUrl || 'http://localhost:5000';
      }
      
      console.log('Отправляем данные на:', `${backendUrl}/api/auth/update-profile`);
      
      // Отправляем запрос на сервер
      const response = await fetch(`${backendUrl}/api/auth/update-profile`, {
        method: 'POST',
        body: formDataToSend,
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      });
      
      // Проверяем успешность запроса
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
      }
      
      // Парсим ответ
      const data = await response.json();
      console.log('Ответ сервера:', data);
      
      // Проверяем, что аватар есть в ответе
      if (data && data.avatar) {
        console.log('Аватар получен от сервера:', data.avatar);
        
        // Освобождаем временный URL, если он был
        if (tempFileUrl.value) {
          URL.revokeObjectURL(tempFileUrl.value);
          tempFileUrl.value = null;
        }
        
        // Используем secureUrl для корректной обработки URL
        const secureAvatarUrl = secureUrl(data.avatar);
        // Добавляем случайный параметр для предотвращения кэширования
        const avatarWithCache = `${secureAvatarUrl}${secureAvatarUrl.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;
        console.log('Обработанный URL аватара:', avatarWithCache);
        
        // Устанавливаем URL аватара
        avatarUrl.value = avatarWithCache;
        avatarFile.value = null; // Сбрасываем файл после успешной загрузки
        
        // Обновляем аватар в хранилище авторизации
        if (authStore.user) {
          authStore.user.avatar = avatarWithCache;
        }
      } else {
        console.warn('Аватар отсутствует в ответе сервера');
      }
      
      // Обновляем локальные данные пользователя
      localUserData.value = {
        _id: data._id || localUserData.value._id || '',
        name: data.name || localUserData.value.name || '',
        email: data.email || localUserData.value.email || '',
        number: data.number || localUserData.value.number || '',
        avatar: data.avatar || avatarUrl.value || localUserData.value.avatar || ''
      };
      
      console.log('Обновлены локальные данные пользователя:', localUserData.value);
      
      // Обновляем данные в хранилище авторизации
      if (authStore.user) {
        authStore.user = {
          ...authStore.user,
          name: data.name || authStore.user.name,
          email: data.email || authStore.user.email,
          number: data.number || authStore.user.number,
          avatar: avatarUrl.value
        };
        
        // Загружаем полные данные пользователя с сервера
        console.log('Загружаем полные данные пользователя с сервера...');
        await authStore.loadUserProfile();
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
        const config = useRuntimeConfig();
        const altResponse = await $fetch(`${config.public.backendUrl}/api/auth/update-profile`, {
          method: 'POST', // Используем POST вместо PUT, так как маршрут ожидает POST
          body: jsonData,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authStore.token}`
          }
        });
        
        console.log('Ответ с альтернативного сервера:', altResponse);
        
        // Обновляем данные пользователя
        // Не обновляем userData напрямую, так как это вычисляемое свойство
        localUserData.value = {
          ...localUserData.value,
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

// Обработчик загрузки файла аватара
function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Проверка типа файла
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showNotification('Недопустимый тип файла. Разрешены только JPEG, PNG, GIF и WebP', 'error');
    return;
  }
  
  // Проверка размера файла (5 МБ максимум)
  const maxSize = 5 * 1024 * 1024; // 5 МБ в байтах
  if (file.size > maxSize) {
    showNotification('Файл слишком большой. Максимальный размер: 5 МБ', 'error');
    return;
  }
  
  // Устанавливаем файл для загрузки
  avatarFile.value = file;
  
  // Не создаем временный URL здесь, так как это делается в watch функции
  // tempFileUrl будет автоматически создан в watch функции
  
  // Отображаем уведомление об успешной загрузке
  showNotification('Файл аватара выбран. Нажмите Сохранить, чтобы применить изменения.', 'info');
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

// Используем глобальный метод $showNotification через useNuxtApp
const nuxtApp = useNuxtApp();
const showNotification = (message, type = 'info') => {
  if (window.$showNotification) {
    window.$showNotification(message, type);
  } else if (nuxtApp.$notify) {
    nuxtApp.$notify(message, type);
  } else {
    console.log(`${type}: ${message}`);
  }
}
</script>

<style lang="sass">
@import '@variables'

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
    justify-content: center
    align-items: center
    margin-bottom: 20px
    padding-bottom: 15px
    border-bottom: 2px solid $purple
    position: relative
  
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
    background-size: cover
    background-position: center
    margin: 0 auto 10px
    position: relative
    display: flex
    align-items: center
    justify-content: center
    background-color: $purple
    color: $white
    font-size: 36px
    font-weight: bold
    overflow: hidden
  
  &__avatar-clickable
    cursor: pointer
    display: block
    position: relative
    
    .user-profile__avatar-overlay
      position: absolute
      top: 0
      left: 0
      right: 0
      bottom: 0
      background-color: rgba(0, 0, 0, 0.5)
      border-radius: 50%
      display: flex
      align-items: center
      justify-content: center
      opacity: 0
      transition: opacity 0.3s ease
    
    &:hover .user-profile__avatar-overlay
      opacity: 1
    
    .user-profile__avatar-change-icon
      color: white
      font-size: 14px
      font-weight: bold
  
  &__avatar-input
    display: none
  
  &__debug-info
    position: absolute
    bottom: 0
    left: 0
    right: 0
    background-color: rgba(0, 0, 0, 0.5)
    color: white
    font-size: 10px
    padding: 2px
    text-align: center
  
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
      
  &__avatar-upload-text
    color: $purple
    font-size: 14px
    margin-top: 5px
  
  &__actions
    display: flex
    justify-content: center
    margin-top: 15px
    gap: 10px
  
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
    border-radius: $radius
    cursor: pointer
    border: 1px solid $primary-bg
    transition: background-color $transition-speed $transition-function
    
    &:hover
      background-color: rgba($white, 0.1)
      border: 1px solid $purple
  
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
    height: max-content
    position: fixed
    bottom: 20px
    right: 20px
    padding: 10px 15px
    border-radius: $scrollbar-radius
    color: $white
    font-size: 14px
    z-index: 100
    animation: fadeIn 0.3s, fadeOut 0.3s 2.7s
    
    // Стили для мобильных устройств
    @include tablet
      bottom: auto
      top: 20px
      right: 20px
      transform: translateX(-50%) translateY(-100px)
    
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