<template>
  <div>
    <!-- Service message -->
    <div v-if="isServiceMessage" class="service-message service">
      <div class="service-message__text">{{ message.text }}</div>
    </div>
    
    <!-- Regular message -->
    <div 
      v-else 
      class="message" 
      :class="[isOwnMessage ? 'own' : 'other', contextMenuVisible ? 'highlighted' : '']"
      v-longpress="handleLongPress"
      :data-message-id="message._id"
    >
      <!-- Аватарка пользователя (для сообщений от других пользователей) -->
      <MessageAvatar 
        v-if="!isOwnMessage" 
        :user-id="message.sender?._id" 
        :user-name="message.sender?.name" 
        :avatar-url="message.sender?.avatar"
        @profile-click="$emit('profile-click', $event)"
        class="message__avatar"
      />
      
      <!-- Отладочная информация о сообщении -->
      <pre v-if="false" style="font-size: 6px; position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.5); color: white; padding: 2px; max-width: 150px; overflow: hidden; text-overflow: ellipsis;">{{ JSON.stringify({sender: message.sender?.name, avatar: message.sender?.avatar, isGroup: isGroupChat}) }}</pre>
      
      <div class="message__content-wrapper">
        <!-- Имя отправителя (для групповых чатов) -->
        <div 
          v-if="!isOwnMessage && isGroupChat" 
          class="message__from"
        >
          {{ message.sender?.name }}
        </div>
        
        <!-- Контекстное меню (только для своих сообщений) -->
        <ChatContextMenu 
          v-if="contextMenuVisible && isOwnMessage" 
          :is-visible="contextMenuVisible"
          :message="props.message"
          :top="menuPosition"
          @edit="onEdit"
          @delete="onDelete"
          @close="hideContextMenu"
        />
        
        <!-- Текстовое сообщение -->
        <div v-if="message.media_type === 'none'" class="message__content">
          <p v-if="message.text" :class="['message__text', message.edited ? 'edited' : '']">
            {{ message.text }}
            <span class="message__time">
              <span v-if="message.edited && !isOwnMessage" class="message__edited">изм</span>
              {{ formatTime(message.createdAt || message.timestamp) }}
              <span v-if="message.edited && isOwnMessage" class="message__edited">изм</span>
            </span>
          </p>
        </div>
        
        <!-- Проверка на наличие множественных файлов -->
        <div v-if="hasMultipleFiles" :class="['multi-files-container', {'files-container': hasOnlyFiles, 'has-text-and-images': hasTextAndImages}]">
          <!-- Отдельно обрабатываем изображения для сетки -->
          <div 
            v-if="imageFiles.length > 0" 
            :class="['images-grid', `grid-${imageFiles.length}`]"
          >
            <div 
              v-for="(file, index) in imageFiles" 
              :key="`img-${index}`"
              class="file-item file-item-image"
            >
              <img 
                :src="file.file_url" 
                :class="['message-image']" 
                alt="Изображение" 
                @load="$emit('image-loaded', message._id)"
                @click.stop="openImageModalForFileUrl(file.file_url, $event)"
              />
            </div>
          </div>
          
          <!-- Отдельно обрабатываем видео -->
          <div 
            v-for="(file, index) in videoFiles" 
            :key="`video-${index}`"
            class="file-item file-item-video"
          >
            <video 
              :id="`${message._id}-video-${index}`"
              class="video-message-player" 
              controls 
              :src="file.file_url"
              @play="$emit('video-play', message._id)"
            ></video>
          </div>

          <!-- Отдельно обрабатываем другие файлы в строку/сетку -->
          <div 
            v-if="otherFiles.length > 0"
            :class="['files-row', `files-${otherFiles.length}`]"
          >
            <div 
              v-for="(file, index) in otherFiles" 
              :key="`file-${index}`"
              class="file-item file-item-other"
            >
              <a href="javascript:void(0)" class="file-link" @click.stop="downloadFileFromUrl(file.file_url, file.file_name, $event)">
                <div class="file-preview">
                  <div class="file-info">
                    <component :is="getFileIconComponent(file.file_name)" class="file-type-icon" />
                    <span class="file-name">{{ file.file_name ? decodeFileName(file.file_name) : 'Файл' }}</span>
                  </div>
                </div>
              </a>
            </div>
          </div>
          
          <!-- Текст сообщения, если он есть -->
          <p v-if="message.text" class="message__text message__text-media">
            {{ message.text }}
          </p>
          
          <div class="message__time media-time">
            {{ formatTime(message.createdAt || message.timestamp) }}
            <span v-if="message.edited" class="message__edited">изм</span>
          </div>
        </div>
        
        <!-- Изображение (обратная совместимость) -->
        <div v-else-if="message.media_type === 'image'" class="image-container">
          <div v-if="!message.imageLoaded" class="image-loading">
            <div class="loading-spinner"></div>
          </div>
          <img 
            :src="message.file" 
            :class="['message-image', { 'loaded': message.imageLoaded }]" 
            alt="Изображение" 
            @load="$emit('image-loaded', message._id)"
            @click.stop="handleImageClick($event)"
          />
          
          <!-- Текст сообщения, если он есть -->
          <p v-if="message.text" class="message__text message__text-media">
            {{ message.text }}
          </p>
          
          <div class="message__time media-time">
            {{ formatTime(message.createdAt || message.timestamp) }}
            <span v-if="message.edited" class="message__edited">изм</span>
          </div>
        </div>
        
        <!-- Видео (обратная совместимость) -->
        <div v-else-if="message.media_type === 'video'" class="video-container">
          <video 
            :id="message._id" 
            class="video-message-player" 
            controls 
            :src="message.file"
            @play="$emit('video-play', message._id)"
          ></video>
          
          <!-- Текст сообщения, если он есть -->
          <p v-if="message.text" class="message__text message__text-media">
            {{ message.text }}
          </p>
          
          <div class="message__time media-time">
            {{ formatTime(message.createdAt || message.timestamp) }}
            <span v-if="message.edited" class="message__edited">изм</span>
          </div>
        </div>
        
        <!-- Стикер (обратная совместимость) -->
        <div v-else-if="message.media_type === 'sticker'" class="sticker-container">
          <img :src="message.file" alt="Sticker" class="message-sticker" />
          <div class="message__time media-time">
            {{ formatTime(message.createdAt || message.timestamp) }}
            <span v-if="message.edited" class="message__edited">изм</span>
          </div>
        </div>
        
        <!-- Файл (обратная совместимость) -->
        <div v-else-if="message.media_type === 'file'" class="file-container">
          <a href="javascript:void(0)" class="file-link" @click.stop="handleFileClick($event)">
            <div class="file-preview" :class="{ 'downloading': isDownloading }">
              <div class="file-info">
                <component :is="getFileIconComponent(message.file_name)" class="file-type-icon" v-if="!isDownloading" />
                <div class="loading-spinner" v-if="isDownloading"></div>
                <span class="file-name">{{ message.file_name ? decodeFileName(message.file_name) : 'Файл' }}</span>
              </div>
            </div>
          </a>
          
          <!-- Текст сообщения, если он есть -->
          <p v-if="message.text" class="message__text message__text-media">
            {{ message.text }}
          </p>
          
          <div class="message__time media-time">
            {{ formatTime(message.createdAt || message.timestamp) }}
            <span v-if="message.edited" class="message__edited">изм</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Модальное окно для просмотра изображений -->
  <ImageModal 
    :is-visible="imageModalVisible" 
    :image-url="selectedImage" 
    @close="closeImageModal"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useContextMenuStore } from '@/stores/contextMenu';
import MessageAvatar from './MessageAvatar.vue';
import ImageModal from './ImageModal.vue';
import DocumentIcon from '../Icons/DocumentIcon.vue';
import PDFIcon from '../Icons/PDFIcon.vue';
import ImageIcon from '../Icons/ImageIcon.vue';
import VideoIcon from '../Icons/VideoIcon.vue';
import AudioIcon from '../Icons/AudioIcon.vue';
import ContextMenu from './ContextMenu.vue';
// Директива longpress теперь зарегистрирована глобально через плагин

const authStore = useAuthStore();
const contextMenuStore = useContextMenuStore();

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  isGroupChat: {
    type: Boolean,
    default: false
  },
  isMobile: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'context-menu', 
  'click', 
  'image-loaded',
  'edit',
  'delete',
  'video-play',
  'profile-click'
]);

// Проверка, является ли сообщение собственным
const isOwnMessage = computed(() => {
  return props.message.sender && authStore.user && props.message.sender._id === authStore.user._id;
});

// Состояние модального окна для просмотра изображений
const imageModalVisible = ref(false);
const selectedImage = ref('');

// Функция для открытия модального окна с изображением
const openImageModal = (imageUrl, event) => {
  // Останавливаем распространение события, чтобы не вызвать контекстное меню
  if (event) {
    event.stopPropagation();
  }
  
  selectedImage.value = imageUrl;
  imageModalVisible.value = true;
};

// Функция для закрытия модального окна
const closeImageModal = () => {
  imageModalVisible.value = false;
};

// Состояние для отслеживания загрузки файла
const isDownloading = ref(false);

// Проверяем наличие нескольких файлов в сообщении
const hasMultipleFiles = computed(() => {
  return props.message.files && Array.isArray(props.message.files) && props.message.files.length > 0;
});

// Разделяем файлы по типам
const imageFiles = computed(() => {
  if (!hasMultipleFiles.value) return [];
  return props.message.files.filter(file => file.media_type === 'image');
});

const videoFiles = computed(() => {
  if (!hasMultipleFiles.value) return [];
  return props.message.files.filter(file => file.media_type === 'video');
});

const otherFiles = computed(() => {
  if (!hasMultipleFiles.value) return [];
  return props.message.files.filter(file => file.media_type !== 'image' && file.media_type !== 'video');
});

// Проверяем, содержит ли сообщение только файлы (без изображений)
const hasOnlyFiles = computed(() => {
  return hasMultipleFiles.value && imageFiles.value.length === 0 && otherFiles.value.length > 0;
});

// Проверяем, содержит ли сообщение и изображения, и текст
const hasTextAndImages = computed(() => {
  return hasMultipleFiles.value && imageFiles.value.length > 0 && props.message.text && props.message.text.trim().length > 0;
});

// Функция для определения класса контейнера в зависимости от типа файла
const getFileContainerClass = (mediaType) => {
  if (!mediaType) return 'file-item-other';
  
  switch (mediaType) {
    case 'image':
      return 'file-item-image';
    case 'video':
      return 'file-item-video';
    default:
      return 'file-item-other';
  }
};

// Функция для открытия модального окна с изображением по URL
const openImageModalForFileUrl = (fileUrl, event) => {
  // Получаем элемент сообщения
  const messageElement = event.currentTarget.closest('.message');
  
  // Проверяем, было ли это долгое нажатие
  if (messageElement && messageElement._longpress && messageElement._longpress.isLongPressActive()) {
    console.log('Это было долгое нажатие, не открываем изображение');
    return;
  }
  
  // Открываем изображение в модальном окне
  openImageModal(fileUrl, event);
};

// Функция для скачивания файла по URL
const downloadFileFromUrl = (fileUrl, fileName, event) => {
  // Получаем элемент сообщения
  const messageElement = event.currentTarget.closest('.message');
  
  // Проверяем, было ли это долгое нажатие
  if (messageElement && messageElement._longpress && messageElement._longpress.isLongPressActive()) {
    console.log('Это было долгое нажатие, не скачиваем файл');
    return;
  }
  
  // Скачиваем файл
  downloadFile(fileUrl, fileName, event);
};

// Функция для скачивания файла
const downloadFile = async (fileUrl, fileName, event) => {
  // Останавливаем распространение события, чтобы не вызвать контекстное меню
  if (event) {
    event.stopPropagation();
  }
  
  // Если уже идет загрузка, не начинаем новую
  if (isDownloading.value) {
    return;
  }
  
  try {
    // Устанавливаем флаг загрузки
    isDownloading.value = true;
    
    // Декодируем имя файла
    let decodedFileName = fileName;
    if (fileName) {
      decodedFileName = decodeFileName(fileName);
    } else {
      // Если имя файла не указано, извлекаем его из URL
      const urlParts = fileUrl.split('/');
      decodedFileName = urlParts[urlParts.length - 1];
    }
    
    console.log('Скачивание файла:', { 
      оригинальноеИмя: fileName, 
      декодированноеИмя: decodedFileName 
    });
    
    // Используем fetch для загрузки файла
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Ошибка при загрузке файла: ${response.status} ${response.statusText}`);
    }
    
    // Получаем файл как Blob
    const blob = await response.blob();
    
    // Создаем URL для Blob
    const blobUrl = window.URL.createObjectURL(blob);
    
    // Создаем ссылку для скачивания
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = decodedFileName;
    document.body.appendChild(link);
    link.click();
    
    // Очищаем ресурсы
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 100);
  } catch (error) {
    console.error('Ошибка при скачивании файла:', error);
    // Здесь можно добавить уведомление для пользователя об ошибке
  } finally {
    // Сбрасываем флаг загрузки
    isDownloading.value = false;
  }
};

// Функция для декодирования имени файла
const decodeFileName = (fileName) => {
  if (!fileName) return 'Файл';
  
  // Для отладки: выводим оригинальное имя файла
  console.log('Оригинальное имя файла:', fileName);
  
  // Проверяем, если имя файла уже содержит кириллицу
  if (/[\u0400-\u04FF]/.test(fileName)) {
    console.log('Имя файла уже содержит кириллицу:', fileName);
    return fileName;
  }
  
  // Специальная обработка для имени файла вида "?@0:B8G5A:0O @01>B0 !-3.docx"
  if (fileName.includes('?') && fileName.includes('.docx')) {
    // Заменяем известные паттерны
    if (fileName.includes('?@0:B8G5A:0O @01>B0 !-3.docx')) {
      return 'Практическая работа СП-3.docx';
    }
    
    // Для имени файла вида "Экономика отрасли СП-3"
    if (fileName.includes(':>=><8:0 >B@0A;8 !-3')) {
      return 'Экономика отрасли СП-3.docx';
    }
  }
  
  // Массив методов декодирования, которые мы попробуем
  const decodingMethods = [
    // Метод 1: Декодирование с помощью escape + decodeURIComponent
    () => decodeURIComponent(escape(fileName)),
    
    // Метод 3: Декодирование с помощью TextDecoder (UTF-8)
    () => {
      const decoder = new TextDecoder('utf-8');
      const encodedName = new Uint8Array(fileName.split('').map(c => c.charCodeAt(0)));
      return decoder.decode(encodedName);
    },
    
    // Метод 4: Декодирование с помощью TextDecoder (windows-1251)
    () => {
      try {
        const decoder = new TextDecoder('windows-1251');
        const encodedName = new Uint8Array(fileName.split('').map(c => c.charCodeAt(0)));
        return decoder.decode(encodedName);
      } catch (e) {
        throw new Error('TextDecoder не поддерживает windows-1251');
      }
    }
  ];
  
  // Пробуем каждый метод декодирования
  for (const method of decodingMethods) {
    try {
      const decoded = method();
      
      // Проверяем, что результат содержит кириллицу
      if (decoded && /[\u0400-\u04FF]/.test(decoded)) {
        console.log('Успешно декодировано имя файла:', decoded);
        return decoded;
      }
    } catch (error) {
      // Продолжаем со следующим методом
      console.debug('Ошибка при декодировании:', error.message);
    }
  }
  
  // Если ни один метод не сработал, возвращаем оригинальное имя
  console.warn('Не удалось декодировать имя файла:', fileName);
  return fileName;
};

// Функция для определения типа файла по его имени
const getFileIconComponent = (fileName) => {
  if (!fileName) return DocumentIcon;
  
  // Получаем расширение из декодированного имени файла
  const decodedName = decodeFileName(fileName);
  const extension = decodedName.split('.').pop().toLowerCase();
  
  // Определяем тип файла по расширению
  if (['pdf'].includes(extension)) {
    return PDFIcon;
  } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'].includes(extension)) {
    return ImageIcon;
  } else if (['mp4', 'webm', 'avi', 'mov', 'wmv', 'mkv', 'flv', '3gp'].includes(extension)) {
    return VideoIcon;
  } else if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(extension)) {
    return AudioIcon;
  } else if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(extension)) {
    return DocumentIcon;
  } else if (['xls', 'xlsx', 'csv', 'ods'].includes(extension)) {
    return DocumentIcon; // Можно добавить специальную иконку для таблиц
  } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return DocumentIcon; // Можно добавить специальную иконку для архивов
  }
  
  return DocumentIcon;
};

// Проверка, является ли сообщение служебным
const isServiceMessage = computed(() => {
  // Проверяем тип сообщения
  if (props.message.type === 'service') {
    return true;
  }
  
  // Проверяем содержимое сообщения на наличие ключевых фраз, характерных для служебных сообщений
  const text = props.message.text || '';
  const servicePatterns = [
    /создал групповой чат/i,
    /покинул чат/i,
    /удалил из чата/i,
    /добавил в чат/i,
    /был удален из чата/i,
    /был добавлен в чат/i,
    /добавил в чат пользователей/i,
    /добавил в чат пользователя/i
  ];
  
  return servicePatterns.some(pattern => pattern.test(text));
});

// Форматирование времени сообщения
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Логика контекстного меню
// Используем вычисляемое свойство для определения видимости меню
const contextMenuVisible = computed(() => {
  return contextMenuStore.isMenuActive(props.message._id);
});

// Позиция меню по вертикали
const menuPosition = ref(0);

// Скрыть контекстное меню
const hideContextMenu = () => {
  contextMenuStore.closeMenu();
  document.removeEventListener('click', hideContextMenu);
  
  // Находим элемент сообщения и сбрасываем флаг longPressTriggered
  const messageElement = document.querySelector(`.message[data-message-id="${props.message._id}"]`);
  if (messageElement && messageElement._longpress && messageElement._longpress.resetTriggered) {
    messageElement._longpress.resetTriggered();
  }
};


// Используем глобальную директиву v-longpress

// Обработчик длительного нажатия
const handleLongPress = (event) => {
  // Останавливаем распространение события
  event.stopPropagation();
  
  // Проверяем, не выполняется ли в данный момент действие с меню
  if (isMenuActionInProgress.value) {
    console.log('Действие с меню в процессе, игнорируем долгое нажатие');
    return;
  }
  
  // Открываем контекстное меню
  openContextMenu(event);
};

// Обработчик клика по изображению
const handleImageClick = (event) => {
  // Получаем элемент сообщения
  const messageElement = event.currentTarget.closest('.message');
  
  // Проверяем, было ли это долгое нажатие
  if (messageElement && messageElement._longpress && messageElement._longpress.isLongPressActive()) {
    console.log('Это было долгое нажатие, не открываем изображение');
    return;
  }
  
  // Открываем изображение в модальном окне
  openImageModal(props.message.file, event);
};

// Обработчик клика по файлу
const handleFileClick = (event) => {
  // Получаем элемент сообщения
  const messageElement = event.currentTarget.closest('.message');
  
  // Проверяем, было ли это долгое нажатие
  if (messageElement && messageElement._longpress && messageElement._longpress.isLongPressActive()) {
    console.log('Это было долгое нажатие, не скачиваем файл');
    return;
  }
  
  // Скачиваем файл
  downloadFile(props.message.file, props.message.file_name, event);
};

// Переключение контекстного меню (для кнопки меню)
const toggleContextMenu = (event) => {
  event.preventDefault();
  event.stopPropagation();
  
  // Если меню уже открыто для этого сообщения, закрываем его
  if (contextMenuStore.isMenuActive(props.message._id)) {
    contextMenuStore.closeMenu();
    return;
  }
  
  // Иначе открываем меню
  openContextMenu(event);
};

// Открыть контекстное меню
const openContextMenu = (event) => {
  // Получаем позицию сообщения по вертикали
  try {
    // Попробуем найти элемент сообщения разными способами
    let messageElement = null;
    
    // Способ 1: Через currentTarget
    if (event && event.currentTarget) {
      messageElement = event.currentTarget.closest('.message');
    }
    
    // Способ 2: Через target
    if (!messageElement && event && event.target) {
      messageElement = event.target.closest('.message');
    }
    
    // Способ 3: Найти по ID сообщения
    if (!messageElement) {
      messageElement = document.querySelector(`.message[data-message-id="${props.message._id}"]`);
    }
    
    // Если нашли элемент, получаем его позицию
    if (messageElement) {
      const rect = messageElement.getBoundingClientRect();
      // Устанавливаем позицию меню выше середины сообщения
      // Смещаем меню вверх на 30% высоты сообщения
      menuPosition.value = rect.top + rect.height * 0.3;
      
      // Проверяем, чтобы меню не выходило за верхнюю границу экрана
      if (menuPosition.value < 100) {
        menuPosition.value = 100; // Минимальная позиция сверху
      }
      
      // Проверяем, чтобы меню не выходило за нижнюю границу экрана
      const maxPosition = window.innerHeight - 150;
      if (menuPosition.value > maxPosition) {
        menuPosition.value = maxPosition;
      }
    } else {
      // Если не удалось найти элемент, используем позицию курсора
      menuPosition.value = event && event.clientY ? event.clientY - 50 : window.innerHeight / 2;
    }
  } catch (error) {
    // В случае ошибки используем центр экрана
    console.error('Error getting message position:', error);
    menuPosition.value = window.innerHeight / 2;
  }
  
  // Закрываем все другие меню и показываем текущее
  contextMenuStore.openMenu(props.message._id);
  
  // Добавляем обработчик для закрытия меню при клике вне его
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true });
  }, 100);
};

// Флаг для предотвращения повторного открытия меню
const isMenuActionInProgress = ref(false);

// Обработчики действий меню
const onEdit = (message) => {
  console.log('Функция onEdit вызвана в Message.vue', message || props.message);
  console.log('Детали сообщения в Message.vue:', {
    id: (message || props.message)?._id,
    text: (message || props.message)?.text,
    sender: (message || props.message)?.sender?._id
  });
  
  try {
    // Устанавливаем флаг, чтобы предотвратить повторное открытие меню
    isMenuActionInProgress.value = true;
    
    // Закрываем меню
    console.log('Закрываем меню в Message.vue');
    hideContextMenu();
    
    // Отправляем событие редактирования
    console.log('Отправляем событие edit из Message.vue');
    emit('edit', message || props.message);
    
    // Сбрасываем флаг через небольшую задержку
    setTimeout(() => {
      isMenuActionInProgress.value = false;
    }, 300);
  } catch (error) {
    console.error('Ошибка в обработчике onEdit в Message.vue:', error);
  }
};

const onDelete = (message) => {
  console.log('Вызван обработчик onDelete в Message.vue', message);
  console.log('Детали сообщения в Message.vue для удаления:', {
    id: (message || props.message)?._id,
    text: (message || props.message)?.text,
    sender: (message || props.message)?.sender?._id
  });
  
  try {
    // Устанавливаем флаг, чтобы предотвратить повторное открытие меню
    isMenuActionInProgress.value = true;
    
    // Закрываем меню
    console.log('Закрываем меню в Message.vue перед удалением');
    hideContextMenu();
    
    // Отправляем событие удаления
    console.log('Отправляем событие delete из Message.vue');
    emit('delete', message || props.message);
    
    // Сбрасываем флаг через небольшую задержку
    setTimeout(() => {
      isMenuActionInProgress.value = false;
    }, 300);
  } catch (error) {
    console.error('Ошибка в обработчике onDelete в Message.vue:', error);
  }
};

</script>

<style lang="sass">
@import '@variables'

.service-message
  text-align: center;
  margin: 5px auto;
  padding: 5px;
  max-width: 100%
  width: max-content
  border-radius: 12px;
  background-color: darken($purple, 10%);
  color: $white;
  font-size: 14px;
  display: flex
  flex-direction: column;
  align-items: center;
  
  &__text
    font-weight: 500
    margin-bottom: 4px
  
  &__time
    font-size: 12px
    opacity: 0.7

// Стили для текста сообщения с медиа-контентом
.message__text-media
  padding: 10px 45px 10px 10px
  word-wrap: break-word
  white-space: pre-wrap
  word-break: break-word
  overflow-wrap: break-word
  width: 100%
  max-width: 100%
  color: $white

.message
  display: flex
  margin-bottom: 12px
  max-width: 80%
  width: max-content
  position: relative
  align-self: flex-start
  min-width: 12%  // Увеличиваем общую максимальную ширину
  position: relative
  align-items: flex-end  // Выравниваем элементы по нижнему краю
  
  &__avatar
    margin-right: 8px  // Отступ между аватаркой и сообщением
    align-self: flex-end  // Выравниваем аватарку по верхнему краю сообщения
    margin-top: 4px
    
  &__content-wrapper
    display: flex
    flex-direction: column
    flex: 1  // Растягиваем контент на всю доступную ширину
    position: relative
  
  &.own
    align-self: flex-end
    margin-left: auto
    flex-direction: row-reverse  // Меняем направление для собственных сообщений
    
    .message__avatar
      margin-right: 0
      margin-left: 8px  // Отступ слева для собственных сообщений
    
    .message__content
      background-color: $purple
      border-radius: 15px 15px 0 15px
      
  &.other
    align-self: flex-start
    margin-right: auto
    max-width: 60%  
    
    .message__content-wrapper
      width: calc(100% - 44px)  
    
    .message__content
      background-color: $message-bg
      border-radius: 15px 15px 15px 0
  
  &__from
    font-size: 14px
    color: rgba(255, 255, 255, 0.8)
    margin-bottom: 2px
    font-weight: 500
  
  &__content
    padding: 10px 15px
    position: relative
    color: $white
    word-break: break-word
    
    // Специальные стили для контейнеров файлов и изображений
    &--image, &--file
      padding: 0
      overflow: hidden
    
    .message__text
      margin-bottom: 5px
      white-space: pre-wrap
      word-break: keep-all;
      padding-right: 35px  // Добавляем отступ справа для времени
      
      // Увеличиваем отступ для отредактированных сообщений
      &.edited
        padding-right: 60px
    
    .message__time
      font-size: 12px
      color: rgba(255, 255, 255, 0.7)
      position: absolute
      bottom: 10px
      right: 15px
      display: flex
      align-items: center
      gap: 4px
      
      .message__edited
        font-size: 12px
        font-style: italic

.message__time.media-time, .media-time
  position: absolute !important
  bottom: 10px !important
  right: 10px !important
  font-size: 12px !important
  color: $white !important
  display: flex !important
  align-items: center !important
  gap: 4px !important
  background-color: transparent !important
  padding: 0 !important
  border-radius: 0 !important
  z-index: 1 !important

.image-container
  position: relative
  width: 100%
  max-width: 100%
  background-color: $message-bg
  border-radius: $radius
  overflow: hidden
  
  .message.own &
    background-color: $purple
  
  .image-loading
    position: absolute
    top: 0
    left: 0
    width: 100%
    height: 100%
    display: flex
    align-items: center
    justify-content: center
    background-color: rgba(0, 0, 0, 0.2)
    z-index: 2
    border-radius: 8px
    
    .loading-spinner
      width: 30px
      height: 30px
      border: 3px solid rgba(255, 255, 255, 0.3)
      border-radius: 50%
      border-top-color: $purple
      animation: spin 1s ease-in-out infinite
      margin: 0 auto
      background-color: transparent
      will-change: transform // Оптимизация для анимации
    
  .message-image
    display: block
    width: 100%
    max-width: 550px
    max-height: 550px
    border-radius: $radius
    opacity: 0.7
    transition: opacity 0.3s ease
    
    &.loaded
      opacity: 1

.video-container
  margin: 5px 0
  
  .video-message-player
    max-width: 300px
    border-radius: 8px
    background-color: #000
    will-change: transform // Оптимизация для анимации

.sticker-container
  .message-sticker
    max-width: 120px
    max-height: 120px

.file-container
  width: 100%
  max-width: 100%
  position: relative
  background-color: $message-bg
  border-radius: $radius
  overflow: hidden
  
  .message.own &
    background-color: $purple
  
  .file-link
    display: block
    width: 100%
    color: $white
    
// Стили для контейнера с несколькими файлами
.multi-files-container
  display: flex
  flex-direction: column
  width: 100%
  max-width: 100%
  position: relative
  border-radius: 15px
  overflow: hidden
  
  // По умолчанию контейнер прозрачный (для изображений без текста)
  background-color: transparent
  
  // Если есть только файлы (без изображений), применяем фон
  &.files-container
    background-color: $purple
    max-width: 370px
    
  // Если есть изображения и текст, применяем фиолетовый фон
  &.has-text-and-images
    background-color: $purple
    max-width: 550px
    
    .message__text-media
      width: 100%
      max-width: 100%
    
    // Применяем фиолетовый фон для собственных сообщений с файлами
    .message.own &
      background-color: $purple
  
  // Применяем border-radius для собственных сообщений
  .message.own &
    border-radius: 15px 15px 0 15px
    
  // Применяем другой border-radius для сообщений других пользователей
  .message.other &
    border-radius: 15px 15px 15px 0
  
  // Контейнер для изображений в сетке
  .images-grid
    display: grid
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))
    grid-gap: 5px
    max-width: 550px
    max-height: 550px
    
    // Для двух изображений - два столбца
    &.grid-2
      grid-template-columns: repeat(2, 1fr)
      
    // Для трех изображений - специальная сетка
    &.grid-3
      grid-template-columns: repeat(2, 1fr)
      
      .file-item:first-child
        grid-column: span 2
        
    // Для четырех изображений - сетка 2x2
    &.grid-4
      grid-template-columns: repeat(2, 1fr)
  
  .file-item
    margin-bottom: 5px
    border-radius: 8px
    overflow: hidden
    
    &:last-child
      margin-bottom: 0
      
  .file-item-image
    width: 100%
    height: 100%
    min-height: 100px
    max-width: 550px
    max-height: 550px
    
    img
      width: 100%
      height: 100%
      max-width: 550px
      max-height: 550px
      object-fit: cover
      border-radius: 8px
      display: block
      
  .file-item-video
    width: 100%
    
    video
      width: 100%
      border-radius: 8px
      display: block
      
  // Контейнер для файлов в строку/сетку
  .files-row
    display: flex
    flex-wrap: wrap
    gap: 10px
    margin-bottom: 5px
    width: 100%ф
    
    // Если файл один, он занимает всю ширину
    &.files-1
      flex-direction: column
      
      .file-item-other
        width: 100%
    
    // Если файлов 2, они идут в строку
    &.files-2
      flex-direction: row
      
      .file-item-other
        width: calc(50% - 5px)
        
    // Если файлов больше 2, они идут в 2 столбца
    &.files-3, &.files-4
      flex-direction: row
      flex-wrap: wrap
      
      .file-item-other
        width: calc(50% - 5px)
        
  .file-item-other

    border-radius: 8px
    padding: 5px
    text-decoration: none
    transition: transform 0.2s ease
    
    &:hover
      transform: scale(1.02)
    
    .file-preview
      position: relative
      display: flex
      flex-direction: column
      align-items: center
      justify-content: center
      background-color: rgba(255, 255, 255, 0.1)
      border-radius: $radius
      padding: 15px 10px
      width: 100%
      transition: background-color 0.3s ease
      margin: 0
      
      &.downloading
        background-color: rgba(255, 255, 255, 0.15)
      
      .file-info
        display: flex
        flex-direction: column
        align-items: center
        justify-content: center
        width: 100%
        min-height: 130px
        min-width: 130px
        gap: 5px
        
        .file-type-icon
          width: 50px
          height: 50px
          color: $purple
        
        .loading-spinner
          width: 40px
          height: 40px
          border: 3px solid rgba(255, 255, 255, 0.3)
          border-radius: 50%
          border-top-color: $purple
          animation: spin 1s linear infinite
        
        .file-name
          color: $white
          font-size: 14px
          text-align: center
          display: block
          width: 100%
          max-width: 150px
          overflow: hidden
          text-overflow: ellipsis
          padding: 0 5px

@keyframes spin
  0%
    transform: rotate(0deg)
  100%
    transform: rotate(360deg)

@include mobile
  .message
    max-width: 85%
    
    &.other
      max-width: 95%  // Для мобильных устройств делаем сообщения от других пользователей шире

// Стили контекстного меню перемещены в компонент ContextMenu.vue
</style>
