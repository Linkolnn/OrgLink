<template>
  <div class="input_area" ref="inputArea" @click.stop>
    <!-- Индикатор редактирования сообщения -->
    <div v-if="isEditingMessage" class="editing-indicator">
      <div class="editing-text">
        <i class="fas fa-edit"></i> Редактирование: {{ originalMessageText.length > 30 ? originalMessageText.substring(0, 30) + '...' : originalMessageText }}
      </div>
      <button class="cancel-btn" @click="cancelEditingMessage">
        <CloseIcon />
      </button>
    </div>
    
    <!-- Индикатор записи голосового сообщения -->
    <div v-if="isRecording" class="recording-indicator">
      <div class="recording-text">
        <i class="fas fa-microphone-alt pulse"></i> Запись: {{ recordingTime }}
      </div>
      <div class="recording-actions">
        <button class="cancel-recording-btn" @click="cancelRecording">
          <i class="fas fa-times"></i>
        </button>
        <button class="send-recording-btn" @click="stopAndSendRecording">
          <i class="fas fa-check"></i>
        </button>
      </div>
    </div>
    
    <!-- Предпросмотр выбранных файлов -->
    <div v-if="selectedFiles.length > 0" class="selected-files-preview">
      <div class="files-grid">
        <div v-for="(file, index) in selectedFiles" :key="index" class="file-preview-item">
          <!-- Предпросмотр изображения -->
          <div v-if="isImageFile(file)" class="image-preview">
            <img :src="getImagePreview(file)" alt="Предпросмотр" />
            <button class="remove-file-btn image-remove-btn" @click="removeFile(index)">
              <CloseIcon />
            </button>
          </div>
          <!-- Предпросмотр для не-изображений -->
          <div v-else class="file-preview">
            <button class="remove-file-btn file-remove-btn" @click="removeFile(index)">
              <CloseIcon />
            </button>
            <div class="file-info">
              <component :is="getFileIconComponent(file)" class="file-type-icon" />
              <span class="file-name">{{ file.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="input_container" ref="inputContainer">
      <!-- Кнопка для загрузки файлов (скрепка) -->
      <button 
        type="button" 
        class="attachment_button"
        @click.stop="openFileSelector"
      >
        <PaperclipIcon />
        <input 
          type="file" 
          ref="fileInput" 
          class="file-input" 
          @change="handleFileSelected" 
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          multiple
        >
      </button>
      
      <textarea 
        v-model="messageText" 
        class="inp inp--textarea message_input" 
        placeholder="Введите сообщение..." 
        @keydown.enter.exact.prevent="handleEnterKey"
        @keydown.shift.enter.prevent="addNewLine"
        @input="adjustTextareaHeight"
        @click.stop
        @focus.stop="preventSidebarOnFocus"
        @touchstart.stop
        ref="messageInput"
        rows="1"
      ></textarea>
      
      <div class="button_container" @click.stop>
        <button 
          type="button" 
          class="send_button"
          :class="{ 'record-button': !messageText.trim() && selectedFiles.length === 0 }"
          :disabled="isRecording"
          @click.stop="sendMessage()"
          @touchstart.stop="messageText.trim() || selectedFiles.length > 0 ? null : handleTouchStart()"
          @touchend.stop="messageText.trim() || selectedFiles.length > 0 ? null : handleTouchEnd()"
        >
          <SendIcon v-if="messageText.trim() || selectedFiles.length > 0" class="icon send-icon" />
          <MicrophoneIcon v-else class="icon mic-icon" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue';
import { useNuxtApp } from '#app';
import { useChatStore } from '~/stores/chat';
import { useAuthStore } from '~/stores/auth';
import SendIcon from '~/components/Icons/SendIcon.vue';
import MicrophoneIcon from '~/components/Icons/MicrophoneIcon.vue';
import PaperclipIcon from '~/components/Icons/PaperclipIcon.vue';
import CloseIcon from '~/components/Icons/CloseIcon.vue';
import FileIcon from '~/components/Icons/FileIcon.vue';
import ImageFileIcon from '~/components/Icons/ImageFileIcon.vue';
import DocFileIcon from '~/components/Icons/DocFileIcon.vue';


// Хранилища
const chatStore = useChatStore();
const authStore = useAuthStore();

// Пропсы
const props = defineProps({
  chatId: {
    type: String,
    required: true
  },
  isPreviewMode: {
    type: Boolean,
    default: false
  }
});

// Эмиты
const emit = defineEmits(['message-sent', 'editing-started', 'editing-cancelled', 'editing-saved', 'height-changed']);

// Экспорт функций будет добавлен в конце файла после объявления всех функций

// Ссылки на элементы
const inputArea = ref(null);
const messageInput = ref(null);
const inputContainer = ref(null);

// Данные для ввода сообщения
const messageText = ref('');
const isEditingMessage = ref(false);
const editingMessageText = ref('');
const originalMessageText = ref('');
const selectedMessage = ref(null);
const isMobile = ref(false);

// Данные для загрузки файлов
const fileInput = ref(null);
const selectedFiles = ref([]);

// Данные для записи голосовых сообщений
const isRecording = ref(false);
const recordingTime = ref('00:00');
const mediaRecorder = ref(null);
const audioChunks = ref([]);
const recordingTimer = ref(null);
const recordingStartTime = ref(0);
const longPressTimer = ref(null);
const isLongPress = ref(false);

// Проверяем ширину экрана и обновляем высоту контейнера
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
  // Вызываем adjustContainerHeight после инициализации компонента
  if (inputArea.value) {
    adjustContainerHeight(true);
  }
};

// Отправка сообщения
const sendMessage = async () => {
  // Если нет ни текста, ни файлов, то начинаем запись
  if (!messageText.value.trim() && selectedFiles.value.length === 0) {
    startRecording();
    return;
  }
  
  // Если в режиме редактирования, то сохраняем изменения
  if (isEditingMessage.value && selectedMessage.value) {
    await saveEditedMessage();
    return;
  }
  
  // Загрузка файлов на сервер
  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return [];
    
    const config = useRuntimeConfig();
    const uploadedFiles = [];
    
    try {
      // Создаем массив промисов для параллельной загрузки файлов
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        // Создаем временный URL для предпросмотра
        const previewUrl = isImageFile(file) ? URL.createObjectURL(file) : null;
        
        try {
          // Импортируем safeFetch для совместимости с iOS
          const { safeFetch } = await import('~/utils/api');
          
          // Загружаем файл на сервер используя safeFetch
          const response = await safeFetch(`${config.public.backendUrl}/api/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authStore.token}`
            },
            body: formData
          });
          
          if (!response.ok) {
            throw new Error(`Ошибка загрузки файла: ${response.status}`);
          }
          
          const result = await response.json();
          
          return {
            file_url: result.fileUrl,
            file_name: file.name,
            mime_type: file.type,
            media_type: file.type && file.type.startsWith('image/') ? 'image' : 
                       file.type && file.type.startsWith('video/') ? 'video' : 'file',
            thumbnail: result.fileUrl,
            // Добавляем временный URL для предпросмотра
            previewUrl
          };
        } catch (error) {
          console.error(`Ошибка при загрузке файла ${file.name}:`, error);
          // Возвращаем нулевой результат для этого файла
          return null;
        }
      });
      
      // Ждем завершения всех загрузок
      const results = await Promise.all(uploadPromises);
      
      // Фильтруем нулевые результаты (ошибки загрузки)
      return results.filter(result => result !== null);
    } catch (error) {
      console.error('[Загрузка] Ошибка при загрузке файлов:', error);
      throw error;
    }
  };
  
  // Подготовка файлов для предпросмотра (используется только для предпросмотра)
  const prepareFilesForPreview = (files) => {
    if (!files || files.length === 0) return [];
    
    const preparedFiles = [];
    
    for (const file of files) {
      // Создаем URL для предпросмотра файла
      const fileUrl = isImageFile(file) ? URL.createObjectURL(file) : null;
      
      preparedFiles.push({
        url: fileUrl,
        name: file.name,
        type: file.type,
        size: file.size,
        thumbnail: fileUrl
      });
    }
    
    return preparedFiles;
  };

  // Сохраняем текст сообщения и файлы перед очисткой
  const messageContent = messageText.value.trim();
  const files = [...selectedFiles.value];
  
  // Проверяем, находимся ли мы в режиме предпросмотра приватного чата
  if (props.isPreviewMode) {
    console.log('[InputArea] Отправка сообщения в режиме предпросмотра');
    
    try {
      // Загружаем файлы на сервер, если они есть
      let uploadedFiles = [];
      if (files.length > 0) {
        console.log('[InputArea] Загрузка файлов в режиме предпросмотра');
        uploadedFiles = await uploadFiles(files);
        console.log('[InputArea] Файлы успешно загружены:', uploadedFiles);
      }
      
      // Создаем новый чат и отправляем сообщение
      const newChat = await chatStore.sendMessageInPreviewMode(messageContent, uploadedFiles);
      console.log('[InputArea] Чат создан и сообщение отправлено:', newChat);
      
      // Оповещаем родительский компонент
      emit('message-sent', { 
        chatId: newChat._id, 
        text: messageContent,
        files: uploadedFiles.length > 0 ? uploadedFiles : null
      });
    } catch (error) {
      console.error('[InputArea] Ошибка при создании чата из предпросмотра:', error);
    }
  } else {
    // Обычная отправка сообщения в существующий чат
    console.log('[WebSocket] Отправка сообщения в чат:', props.chatId);
    
    try {
      // Загружаем файлы на сервер, если они есть
      let uploadedFiles = [];
      if (files.length > 0) {
        console.log('[WebSocket] Загрузка файлов на сервер');
        uploadedFiles = await uploadFiles(files);
        console.log('[WebSocket] Файлы успешно загружены:', uploadedFiles);
      }
      
      // Отправляем сообщение через родительский компонент
      emit('message-sent', { 
        chatId: props.chatId, 
        text: messageContent,
        files: uploadedFiles.length > 0 ? uploadedFiles : null
      });
      
      console.log('[WebSocket] Сообщение отправлено успешно');
    } catch (error) {
      console.error('[WebSocket] Ошибка при отправке сообщения:', error);
    }
  }
  
  // Очищаем поле ввода и список файлов
  messageText.value = '';
  selectedFiles.value = [];
  
  // Сбрасываем высоту textarea
  adjustTextareaHeight();
};

// Функции для редактирования сообщений
const startEditingMessage = (message) => {
  console.log('Вызвана функция startEditingMessage в InputArea.vue', message);
  console.log('Детали сообщения в InputArea.vue:', {
    id: message?._id,
    text: message?.text,
    sender: message?.sender?._id,
    'authStore.user._id': authStore.user?._id
  });
  
  try {
    // Проверяем, что сообщение существует
    if (!message) {
      console.warn('Не можем редактировать: сообщение не передано');
      return;
    }
    
    console.log('Начинаем редактирование сообщения в InputArea.vue');
    
    // Устанавливаем значения для редактирования
    console.log('Устанавливаем значения для редактирования');
    originalMessageText.value = message.text;
    editingMessageText.value = message.text;
    messageText.value = message.text;
    selectedMessage.value = message;
    isEditingMessage.value = true;
    
    console.log('Значения установлены:', {
      originalMessageText: originalMessageText.value,
      editingMessageText: editingMessageText.value,
      messageText: messageText.value,
      selectedMessage: selectedMessage.value?._id,
      isEditingMessage: isEditingMessage.value
    });
  
    nextTick(() => {
      if (messageInput.value) {
        messageInput.value.focus();
      }
    });
    
    // Оповещаем родительский компонент
    emit('editing-started', message);
  } catch (error) {
    console.error('Ошибка при редактировании сообщения:', error);
  }
};

const cancelEditingMessage = () => {
  isEditingMessage.value = false;
  selectedMessage.value = null;
  messageText.value = '';
  editingMessageText.value = '';
  originalMessageText.value = '';
  
  // Сбрасываем высоту textarea вручную
  if (messageInput.value) {
    messageInput.value.style.height = '45px';
  }
  
  // Вызываем adjustTextareaHeight для обновления высоты
  nextTick(() => {
    adjustTextareaHeight();
  });
  
  // Оповещаем родительский компонент
  emit('editing-cancelled');
};

const saveEditedMessage = async () => {
  if (!selectedMessage.value || messageText.value.trim() === originalMessageText.value) {
    cancelEditingMessage();
    return;
  }
  
  try {
    // Сохраняем текст сообщения перед очисткой
    const editedText = messageText.value.trim();
    const messageId = selectedMessage.value._id;
    
    // Отправляем запрос на обновление сообщения
    await chatStore.updateMessage({
      messageId: messageId,
      chatId: props.chatId,
      text: editedText
    });
    
    // Очищаем поле ввода и сбрасываем его высоту
    isEditingMessage.value = false;
    selectedMessage.value = null;
    messageText.value = '';
    editingMessageText.value = '';
    originalMessageText.value = '';
    
    // Сбрасываем высоту textarea вручную
    if (messageInput.value) {
      messageInput.value.style.height = '45px';
    }
    
    // Вызываем adjustTextareaHeight для обновления высоты
    nextTick(() => {
      adjustTextareaHeight();
    });
    
    // Оповещаем родительский компонент
    emit('editing-saved', {
      messageId: messageId,
      text: editedText
    });
  } catch (error) {
    console.error('Ошибка при обновлении сообщения:', error);
  }
};

// Проверка, является ли сообщение собственным
const isOwnMessage = (message) => {
  return message.sender && authStore.user && message.sender._id === authStore.user._id;
};

// Предотвращаем появление SideBar при фокусе на поле ввода
const preventSidebarOnFocus = (event) => {
  event.stopPropagation();
  
  // Убедимся, что SideBar скрыт на мобильных устройствах
  if (isMobile.value) {
    const nuxtApp = useNuxtApp();
    if (nuxtApp && nuxtApp.$sidebarVisible !== undefined && nuxtApp.$sidebarVisible.value) {
      nuxtApp.$sidebarVisible.value = false;
      console.log('[InputArea] Скрываем SideBar при фокусе на поле ввода');
    }
  }
};

// Универсальная функция для адаптации высоты контейнеров и textarea
const adjustContainerHeight = (adjustTextarea = false) => {
  // Проверяем наличие всех необходимых ref
  if (!inputArea.value || (adjustTextarea && !messageInput.value)) {
    console.warn('[InputArea] Missing refs:', {
      inputArea: inputArea.value,
      messageInput: adjustTextarea ? messageInput.value : 'not required'
    });
    return;
  }

  // Если нужно адаптировать textarea (для ввода текста)
  if (adjustTextarea && messageInput.value) {
    // Важно: сначала полностью сбрасываем высоту
    messageInput.value.style.height = 'auto';
    
    // Определяем минимальную и максимальную высоту
    const maxHeight = 150;
    const minHeight = 44; // Минимальная высота равна высоте кнопки
    
    // Получаем актуальную высоту контента
    const scrollHeight = messageInput.value.scrollHeight;

    // Всегда вычисляем высоту в зависимости от содержимого
    // Это позволит корректно обрабатывать как добавление, так и удаление переносов строк
    const newHeight = Math.min(maxHeight, Math.max(minHeight, scrollHeight));
    messageInput.value.style.height = `${newHeight}px`;
  }
  
  // Оповещаем родительский компонент об изменении высоты
  emit('height-changed', inputArea.value.offsetHeight);
};

// Алиас для обратной совместимости
const adjustTextareaHeight = () => adjustContainerHeight(true);

// Обработка нажатия клавиши Enter
const handleEnterKey = () => {
  if (isMobile.value) {
    addNewLine();
  } else {
    sendMessage();
  }
};

// Добавление новой строки при нажатии Shift+Enter
const addNewLine = () => {
  messageText.value += '\n';
  nextTick(() => {
    adjustTextareaHeight();
  });
};

// Публичные методы и свойства для родительского компонента
defineExpose({
  // Методы для редактирования сообщений
  startEditingMessage,
  cancelEditingMessage,
  saveEditedMessage,
  // Методы для управления размерами
  adjustContainerHeight,
  adjustTextareaHeight,
  // Свойства
  messageText,
  // DOM-элементы
  inputArea,
  messageInput,
  inputContainer
});

// Функция checkMobile определена выше

// Функции для работы с файлами
// Открыть диалог выбора файлов
const openFileSelector = () => {
  if (fileInput.value) {
    fileInput.value.click();
  }
};

// Обработка выбранных файлов
const handleFileSelected = (event) => {
  const files = event.target.files;
  if (files && files.length > 0) {
    // Добавляем выбранные файлы в массив
    for (let i = 0; i < files.length; i++) {
      selectedFiles.value.push(files[i]);
    }
    // Сбрасываем значение инпута, чтобы можно было выбрать тот же файл снова
    event.target.value = '';
  }
};

// Удаление файла из списка выбранных
const removeFile = (index) => {
  selectedFiles.value.splice(index, 1);
};

// Проверка, является ли файл изображением
const isImageFile = (file) => {
  return file.type.startsWith('image/');
};

// Получение URL для предпросмотра изображения
const getImagePreview = (file) => {
  if (isImageFile(file)) {
    return URL.createObjectURL(file);
  }
  return '';
};

// Определяем иконку для файла в зависимости от его типа
const getFileIconComponent = (file) => {
  const fileType = file.type || '';
  const extension = file.name.split('.').pop().toLowerCase();
  
  if (fileType.startsWith('image/') || isImageFile(file)) {
    return ImageFileIcon;
  } else if (['doc', 'docx', 'pdf', 'txt'].includes(extension) || 
           fileType.includes('pdf') || 
           fileType.includes('word') || 
           fileType === 'text/plain') {
    return DocFileIcon;
  } else {
    return FileIcon;
  }
};

// Получение иконки для файла в зависимости от его типа
const getFileIcon = (file) => {
  const fileType = file.type || '';
  const extension = file.name.split('.').pop().toLowerCase();
  
  if (fileType.startsWith('image/')) {
    return 'fas fa-image';
  } else if (extension === 'pdf' || fileType === 'application/pdf') {
    return 'fas fa-file-pdf';
  } else if (['doc', 'docx'].includes(extension) || fileType.includes('word')) {
    return 'fas fa-file-word';
  } else if (['xls', 'xlsx'].includes(extension) || fileType.includes('excel') || fileType.includes('spreadsheet')) {
    return 'fas fa-file-excel';
  } else if (extension === 'txt' || fileType === 'text/plain') {
    return 'fas fa-file-alt';
  } else {
    return 'fas fa-file';
  }
};

// Отправка файлов
const sendFiles = async () => {
  if (selectedFiles.value.length === 0) return;
  
  try {
    // Создаем FormData для отправки файлов
    const formData = new FormData();
    formData.append('chatId', props.chatId);
    
    // Добавляем все файлы в FormData
    selectedFiles.value.forEach((file, index) => {
      formData.append('files', file);
    });
    
    // Добавляем текст сообщения, если он есть
    if (messageText.value.trim()) {
      formData.append('text', messageText.value.trim());
    }
    
    // Отправляем файлы на сервер
    await chatStore.sendFiles(formData);
    
    // Очищаем список выбранных файлов и поле ввода
    selectedFiles.value = [];
    messageText.value = '';
    
    // Сбрасываем высоту textarea вручную
    if (messageInput.value) {
      messageInput.value.style.height = '45px';
    }
    
    // Вызываем adjustTextareaHeight для обновления высоты
    nextTick(() => {
      adjustTextareaHeight();
      adjustContainerHeight(true);
    });
    
    // Оповещаем родительский компонент
    emit('message-sent', { chatId: props.chatId, files: true });
  } catch (error) {
    console.error('[Файлы] Ошибка при отправке файлов:', error);
  }
};

// Функции для работы с голосовыми сообщениями
// Начать запись голосового сообщения
const startRecording = async () => {
  // Проверяем, есть ли текст в поле ввода
  if (messageText.value.trim()) {
    sendMessage();
    return;
  }
  
  try {
    // Запрашиваем доступ к микрофону
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Создаем MediaRecorder
    mediaRecorder.value = new MediaRecorder(stream);
    audioChunks.value = [];
    
    // Обработчик для сохранения частей аудио
    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data);
      }
    };
    
    // Начинаем запись
    mediaRecorder.value.start();
    isRecording.value = true;
    recordingStartTime.value = Date.now();
    
    // Запускаем таймер для отображения времени записи
    recordingTimer.value = setInterval(updateRecordingTime, 1000);
    
    console.log('[Запись] Началась запись голосового сообщения');
  } catch (error) {
    console.error('[Запись] Ошибка при начале записи:', error);
  }
};

// Обновление времени записи
const updateRecordingTime = () => {
  const elapsed = Math.floor((Date.now() - recordingStartTime.value) / 1000);
  const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');
  recordingTime.value = `${minutes}:${seconds}`;
};

// Остановить запись и отправить голосовое сообщение
const stopAndSendRecording = () => {
  if (!isRecording.value || !mediaRecorder.value) return;
  
  // Останавливаем запись
  mediaRecorder.value.stop();
  
  // Обработчик завершения записи
  mediaRecorder.value.onstop = async () => {
    try {
      // Создаем аудиофайл из частей
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm' });
      
      // Создаем файл для отправки
      const audioFile = new File([audioBlob], `voice_message_${Date.now()}.webm`, { type: 'audio/webm' });
      
      // Создаем FormData для отправки файла
      const formData = new FormData();
      formData.append('chatId', props.chatId);
      formData.append('files', audioFile);
      formData.append('media_type', 'audio');
      
      // Отправляем голосовое сообщение на сервер
      await chatStore.sendFiles(formData);
      
      console.log('[Запись] Голосовое сообщение отправлено');
      
      // Оповещаем родительский компонент
      emit('message-sent', { chatId: props.chatId, audio: true });
    } catch (error) {
      console.error('[Запись] Ошибка при отправке голосового сообщения:', error);
    } finally {
      // Сбрасываем состояние записи
      resetRecording();
    }
  };
};

// Отменить запись голосового сообщения
const cancelRecording = () => {
  if (!isRecording.value || !mediaRecorder.value) return;
  
  // Останавливаем запись
  mediaRecorder.value.stop();
  
  // Сбрасываем состояние записи
  resetRecording();
  
  console.log('[Запись] Запись голосового сообщения отменена');
};

// Сбросить состояние записи
const resetRecording = () => {
  // Останавливаем таймер
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value);
    recordingTimer.value = null;
  }
  
  // Останавливаем все треки
  if (mediaRecorder.value && mediaRecorder.value.stream) {
    mediaRecorder.value.stream.getTracks().forEach(track => track.stop());
  }
  
  // Сбрасываем состояние
  isRecording.value = false;
  recordingTime.value = '00:00';
  mediaRecorder.value = null;
  audioChunks.value = [];
};

// Обработчики для мобильных устройств
const handleTouchStart = () => {
  // Запускаем таймер для определения длительного нажатия
  longPressTimer.value = setTimeout(() => {
    isLongPress.value = true;
    startRecording();
  }, 500); // 500 мс для определения длительного нажатия
};

const handleTouchEnd = () => {
  // Отменяем таймер длительного нажатия
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
  
  // Если было длительное нажатие и запись активна, останавливаем и отправляем
  if (isLongPress.value && isRecording.value) {
    stopAndSendRecording();
  } else if (!isLongPress.value) {
    // Если это было короткое нажатие, просто начинаем запись
    startRecording();
  }
  
  // Сбрасываем флаг длительного нажатия
  isLongPress.value = false;
};

// Функции для редактирования сообщений экспортированы выше через defineExpose

// Жизненный цикл компонента
onMounted(() => {
  console.log('[InputArea] Монтирование компонента');
  checkMobile();
  window.addEventListener('resize', checkMobile);
  adjustContainerHeight(true);
});
</script>

<style lang="sass">
@import '~/assets/styles/variables.sass'

.input_area
  position: relative
  width: 100%
  max-width: 700px
  align-self: center

.input_container
  display: flex
  align-items: flex-end
  border-radius: $radius
  position: relative
  
.message_input
  flex: 1
  background: transparent
  border: none
  resize: none
  padding: 10px 35px 10px 10px !important // Увеличиваем отступ слева для кнопки скрепки
  color: $white
  font-size: 14px
  line-height: 1.4
  max-height: 150px
  overflow-y: auto
  
  &::placeholder
    color: $service-color
  
  &:focus
    outline: none

// Кнопка для загрузки файлов (скрепка)
.attachment_button
  position: absolute
  right: 65px
  bottom: 12px
  width: 20px
  height: 20px
  border-radius: 50%
  background-color: transparent
  border: none
  display: flex
  align-items: center
  justify-content: center
  color: $service-color
  cursor: pointer
  transition: color 0.2s ease
  z-index: 2
  
  &:hover
    color: $white
  
  .file-input
    display: none
    
// Кнопка отправки сообщения
.send_button
  width: 45px
  height: 45px
  border-radius: 50%
  background-color: $purple
  border: none
  display: flex
  align-items: center
  justify-content: center
  color: $white
  cursor: pointer
  transition: background-color 0.2s ease
  margin-left: 8px
  position: relative
  
  &:hover
    background-color: darken($purple, 10%)
  
  &:disabled
    background-color: $service-color
    cursor: not-allowed
  
  // Стили для кнопки записи
  &.record-button
    background-color: $purple
    
    &:hover
      background-color: darken($purple, 10%)
  
  // Стили для иконок
  .icon
    width: 20px
    height: 20px
    stroke: white
    stroke-width: 2
    display: block
    margin: 0 auto
    animation: fadeIn 0.5s ease

    
  @keyframes fadeIn
    0%
      opacity: 0
    100%
      opacity: 1

// Индикатор редактирования сообщения
.editing-indicator
  display: flex
  align-items: center
  justify-content: space-between
  padding: 5px 10px
  background-color: rgba(255, 255, 255, 0.1)
  border-radius: $radius
  margin-bottom: 10px
  
  .editing-text
    color: $white
    font-size: 14px
    
    i
      margin-right: 5px
  
  .cancel-btn
    border-radius: 50%
    background-color: $purple
    color: $white
    width: 24px
    height: 24px
    border: none
    display: flex
    align-items: center
    justify-content: center
    cursor: pointer
    
    &:hover
      background-color: darken($purple, 10%)

// Индикатор записи голосового сообщения
.recording-indicator
  display: flex
  align-items: center
  justify-content: space-between
  padding: 5px 10px
  background-color: rgba(255, 0, 0, 0.2)
  border-radius: $radius
  margin-bottom: 10px
  
  .recording-text
    color: $white
    font-size: 14px
    display: flex
    align-items: center
    
    i
      margin-right: 5px
      color: $red
      
      &.pulse
        animation: pulse 1.5s infinite
  
  .recording-actions
    display: flex
    align-items: center
    
    button
      width: 30px
      height: 30px
      border-radius: 50%
      border: none
      display: flex
      align-items: center
      justify-content: center
      cursor: pointer
      margin-left: 5px
      
      &.cancel-recording-btn
        background-color: $red
        color: $white
        
        &:hover
          background-color: darken($red, 10%)
      
      &.send-recording-btn
        background-color: $green
        color: $white
        
        &:hover
          background-color: darken($green, 10%)

// Предпросмотр выбранных файлов
.selected-files-preview
  margin-bottom: 10px
  max-height: 200px
  overflow-y: auto
  @include custom-scrollbar
  
  .files-grid
    display: grid
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))
    gap: 10px
  
  // Стили для элемента предпросмотра файла
  .file-preview-item
    height: 120px;
    position: relative
    border-radius: 15px
    display: flex
    overflow: hidden
    align-items: center
    justify-content: center
    text-align: center
    color: $white
    
    // Стили для предпросмотра изображения
    .image-preview
      position: relative
      width: 100%
      height: 120px
      
      img
        width: 100%
        height: 100%
        object-fit: cover
        border-radius: $radius
      
  // Общие стили для кнопки удаления файлов
  .remove-file-btn
    position: absolute
    top: 5px
    right: 5px
    background-color: rgba(0, 0, 0, 0.5)
    border-radius: 50%
    width: 24px
    height: 24px
    display: flex
    align-items: center
    justify-content: center
    border: none
    color: $white
    cursor: pointer
    z-index: 2
    
    &:hover
      background-color: rgba(0, 0, 0, 0.7)
    
    // Стили для предпросмотра не-изображений
  .file-preview
    position: relative
    display: flex
    flex-direction: column
    align-items: center
    justify-content: center
    background-color: rgba(255, 255, 255, 0.1)
    border-radius: $radius
    padding: 15px 10px
    height: 100%
    
    .file-info
      display: flex
      flex-direction: column
      align-items: center
      justify-content: center
      width: 100%
      gap: 5px
      
      .file-type-icon
        width: 40px
        height: 40px
        color: $purple
      
      .file-name
        color: $white
        font-size: 12px
        text-align: center
        max-width: 100px
        overflow: hidden
    
    // Стили для кнопки удаления перенесены в общие стили выше

// Анимация пульсации для индикатора записи
@keyframes pulse
  0%
    opacity: 1
  50%
    opacity: 0.5
  100%
    opacity: 1
    opacity: 0.8

// Мобильные стили
@include mobile
  .input_area
    padding: 8px
  
  .message_input
    font-size: 16px // Увеличиваем размер шрифта на мобильных
  
  .send_button
    width: 40px
    height: 40px
</style>