<template>
  <div class="input_area" ref="inputArea" @click.stop>
    <!-- Индикатор редактирования сообщения -->
    <div v-if="isEditingMessage" class="editing-indicator">
      <div class="editing-text">
        <i class="fas fa-edit"></i> Редактирование: {{ originalMessageText.length > 30 ? originalMessageText.substring(0, 30) + '...' : originalMessageText }}
      </div>
      <button class="cancel-btn" @click="cancelEditingMessage">
        x
      </button>
    </div>
    
    <div class="input_container" ref="inputContainer">
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
          :disabled="!messageText.trim()"
          @click.stop="sendMessage"
        >
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue';
import { useNuxtApp } from '#app';
import { useChatStore } from '~/stores/chat';
import { useAuthStore } from '~/stores/auth';

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
  if (!messageText.value.trim()) return;
  
  if (isEditingMessage.value && selectedMessage.value) {
    await saveEditedMessage();
    return;
  }
  
  // Сохраняем текст сообщения перед очисткой
  const messageContent = messageText.value;
  
  // Проверяем, находимся ли мы в режиме предпросмотра приватного чата
  if (props.isPreviewMode) {
    console.log('[InputArea] Отправка сообщения в режиме предпросмотра');
    
    try {
      // Создаем реальный чат и отправляем сообщение
      console.log('[InputArea] Создаем реальный чат из предпросмотра с сообщением:', messageContent);
      
      // Очищаем поле ввода и сбрасываем его высоту
      messageText.value = '';
      
      // Сбрасываем высоту textarea вручную
      if (messageInput.value) {
        messageInput.value.style.height = '45px';
      }
      
      // Вызываем adjustTextareaHeight для обновления высоты
      nextTick(() => {
        adjustTextareaHeight();
      });
      
      try {
        // Вызываем метод sendMessageInPreviewMode, который создает чат и отправляет сообщение
        const newChat = await chatStore.sendMessageInPreviewMode(messageContent);
        console.log('[InputArea] Чат создан и сообщение отправлено:', newChat);
        
        // Оповещаем родительский компонент
        emit('message-sent', { chatId: newChat._id, text: messageContent });
      } catch (error) {
        console.error('[InputArea] Ошибка при создании чата из предпросмотра:', error);
      }
      
      return;
    } catch (error) {
      console.error('[InputArea] Ошибка при создании чата из предпросмотра:', error);
    }
  }
  
  // Обычная отправка сообщения в существующий чат
  console.log('[WebSocket] Отправка сообщения в чат:', props.chatId);
  
  try {
    await chatStore.sendMessage({
      chatId: props.chatId,
      text: messageText.value,
      media_type: 'none'
    });
    
    console.log('[WebSocket] Сообщение отправлено успешно');
    
    // Оповещаем родительский компонент
    emit('message-sent', { chatId: props.chatId, text: messageContent });
    
    // Очищаем поле ввода и сбрасываем его высоту
    messageText.value = '';
    
    // Сбрасываем высоту textarea вручную
    if (messageInput.value) {
      messageInput.value.style.height = '45px';
    }
    
    // Вызываем adjustTextareaHeight для обновления высоты
    nextTick(() => {
      adjustTextareaHeight();
    });
  } catch (error) {
    console.error('[WebSocket] Ошибка при отправке сообщения:', error);
  }
};

// Функции для редактирования сообщений
const startEditingMessage = (message) => {
  if (!message || !isOwnMessage(message)) return;
  
  originalMessageText.value = message.text;
  editingMessageText.value = message.text;
  messageText.value = message.text;
  selectedMessage.value = message;
  isEditingMessage.value = true;
  
  nextTick(() => {
    if (messageInput.value) {
      messageInput.value.focus();
    }
  });
  
  // Оповещаем родительский компонент
  emit('editing-started', message);
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

// Публичные методы
defineExpose({
  startEditingMessage,
  cancelEditingMessage,
  adjustContainerHeight,
  adjustTextareaHeight,
  messageText
});

// Функция checkMobile определена выше

// Жизненный цикл компонента
onMounted(() => {
  console.log('[InputArea] Монтирование компонента');
  checkMobile();
  window.addEventListener('resize', checkMobile);
  adjustContainerHeight(true);
  
  // Удаляем слушатель при размонтировании
  onUnmounted(() => {
    window.removeEventListener('resize', checkMobile);
  });
});
</script>

<style lang="sass">
@import '~/assets/styles/variables.sass'

.input_area
  position: relative
  width: 100%
  padding: 10px
  max-width: 700px
  align-self: center

.input_container
  display: flex
  align-items: flex-end
  background-color: $primary-bg
  border-radius: $radius
  position: relative

.message_input
  flex: 1
  border: none
  background: transparent
  resize: none
  height: 45px
  max-height: 150px
  padding: 10px 0
  font-size: 14px
  line-height: 1.4
  color: $white
  
  &:focus
    outline: none

.button_container
  display: flex
  align-items: center

.send_button
  background-color: $purple 
  color: white
  border: none
  border-radius: 50%
  width: 45px
  height: 45px
  display: flex
  align-items: center
  justify-content: center
  cursor: pointer
  transition: background-color 0.2s
  margin-left: 8px
  
  &:disabled
    background-color: rgba(108, 92, 231, 0.4); // Серый полупрозрачный цвет
    cursor: not-allowed
  
  &:hover:not(:disabled)
    background-color: darken($purple, 10%)

.editing-indicator
  display: flex
  align-items: center
  justify-content: space-between
  background-color: rgba(255, 255, 255, 0.1)
  color: $white
  padding: 8px 12px
  border-radius: $radius
  margin-bottom: 8px
  font-size: 13px

.editing-text
  flex: 1

.cancel-btn
  background: none
  border: none
  color: $white
  font-weight: bold
  cursor: pointer
  padding: 0 8px
  font-size: 16px
  
  &:hover
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
