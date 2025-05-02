<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <!-- Вкладки -->
      <div class="tabs">
        <!-- Для личных чатов показываем имя собеседника -->
        <button 
          v-if="chatStore.getChatType(chatData) === 'private'"
          class="tab-btn active"
        >
          {{ getOtherParticipantName(chatData) }}
        </button>
        
        <!-- Для групповых чатов показываем стандартные вкладки -->
        <template v-else>
          <button 
            class="tab-btn" 
            :class="{ 'active': activeTab === 'edit' }" 
            @click="activeTab = 'edit'"
          >
            Редактировать чат
          </button>
          <button 
            class="tab-btn" 
            :class="{ 'active': activeTab === 'participants' }" 
            @click="activeTab = 'participants'"
          >
            Участники
          </button>
        </template>
      </div>
      
      <!-- Вкладка редактирования чата -->
      <div v-if="activeTab === 'edit' && chatStore.getChatType(chatData) !== 'private'" class="tab-content">
        <form @submit.prevent="saveChat">
          <!-- Аватар чата -->
          <div class="avatar-upload">
            <div 
              class="avatar-preview" 
              :style="{ backgroundImage: previewImage ? `url(${secureUrl(previewImage)})` : 'none' }"
              @click="$refs.fileInput.click()"
            >
              <div class="avatar-placeholder" v-if="!previewImage">
                <span v-if="chatFormData.name">{{ getInitials(chatFormData.name) }}</span>
                <span v-else>+</span>
              </div>
            </div>
            <input 
              ref="fileInput" 
              type="file" 
              accept="image/*" 
              class="file-input inp" 
              @change="handleFileChange"
            >
            <div class="avatar-label">Нажмите, чтобы изменить аватар</div>
          </div>
          
          <!-- Название чата -->
          <div class="form-group">
            <label for="chatName">Название чата</label>
            <input 
              id="chatName" 
              v-model="chatFormData.name" 
              type="text" 
              placeholder="Введите название чата"
              required
              class="inp"
            >
          </div>
          
          <!-- Описание чата -->
          <div class="form-group">
            <label for="chatDescription">Описание (необязательно)</label>
            <textarea 
              id="chatDescription" 
              v-model="chatFormData.description" 
              placeholder="Добавьте описание чата"
              rows="3"
              class="inp inp--textarea"
            ></textarea>
          </div>
          
          <!-- Кнопки -->
          <div class="form-actions">
            <button type="button" class="cancel-btn" @click="closeModal">Отмена</button>
            <button type="submit" class="submit-btn" :disabled="loading">
              <span v-if="loading">{{ isNewChat ? 'Создание...' : 'Сохранение...' }}</span>
              <span v-else>{{ isNewChat ? 'Создать' : 'Сохранить' }}</span>
            </button>
          </div>
        </form>
      </div>
      
      <!-- Вкладка управления участниками -->
      <div v-else-if="activeTab === 'participants' && chatStore.getChatType(chatData) !== 'private'" class="tab-content">
        <!-- Поиск пользователей -->
        <div class="search-section">
          <div class="form-group">
            <label>Добавить участников</label>
            <div class="participants-search">
              <input 
                type="text" 
                v-model="searchQuery" 
                placeholder="Поиск пользователей..." 
                @input="searchUsers"
                class="inp"
              >
              <div v-if="searchResults.length > 0" class="search-results">
                <div 
                  v-for="user in searchResults" 
                  :key="user._id" 
                  class="search-result-item"
                  @click="addUserToChat(user)"
                >
                  <div class="user-avatar">{{ getInitials(user.name) }}</div>
                  <div class="user-info">
                    <div class="user-name">{{ user.name }}</div>
                    <div class="user-email">{{ user.email }}</div>
                  </div>
                </div>
              </div>
              <div v-else-if="searchQuery.length >= 2 && !loading" class="no-results">
                Пользователи не найдены
              </div>
            </div>
          </div>
        </div>
        
        <!-- Список участников -->
        <div class="participants-section">
          <h4>Участники ({{ participants.length }})</h4>
          <div v-if="loading" class="loading">
            Загрузка...
          </div>
          <div v-else-if="participants.length === 0" class="no-participants">
            В чате нет участников
          </div>
          <div v-else class="participants-list">
            <div 
              v-for="participant in participants" 
              :key="participant._id" 
              class="participant-item"
              :class="{ 'is-creator': isCreator(participant._id) }"
            >
              <div class="participant-avatar">{{ getInitials(participant.name) }}</div>
              <div class="participant-info">
                <div class="participant-name">
                  {{ participant.name }}
                  <span v-if="isCreator(participant._id)" class="creator-badge">Создатель</span>
                </div>
                <div class="participant-email">{{ participant.email }}</div>
              </div>
              <div class="participant-actions">
                <button 
                  v-if="canRemoveParticipant(participant._id)" 
                  class="remove-btn" 
                  @click="removeUserFromChat(participant._id)"
                  :disabled="removingParticipant === participant._id"
                >
                  <span v-if="removingParticipant === participant._id">...</span>
                  <span v-else>Удалить</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Выйти из чата -->
        <div class="leave-chat-section">
          <button class="leave-btn" @click="confirmLeaveChat" :disabled="leavingChat">
            <span v-if="leavingChat">Выход...</span>
            <span v-else>Выйти из чата</span>
          </button>
          
          <!-- Кнопка удаления чата (только для создателя) -->
          <button 
            v-if="isCreator(authStore.user?._id)" 
            class="delete-btn" 
            @click="confirmDeleteChat" 
            :disabled="deletingChat"
          >
            <span v-if="deletingChat">Удаление...</span>
            <span v-else>Удалить группу</span>
          </button>
        </div>
        
        <!-- Кнопки -->
        <div class="form-actions">
          <button type="button" class="close-btn" @click="closeModal">Закрыть</button>
        </div>
      </div>
      
      <!-- Содержимое для личных чатов -->
      <div v-if="chatStore.getChatType(chatData) === 'private'" class="tab-content">
        <!-- Аватар собеседника -->
        <div class="avatar-upload">
          <div 
            class="avatar-preview" 
            :style="{ backgroundImage: getOtherParticipantAvatar(chatData) ? `url(${getOtherParticipantAvatar(chatData)})` : 'none' }"
          >
            <div class="avatar-placeholder" v-if="!getOtherParticipantAvatar(chatData)">
              <span>{{ getInitials(getOtherParticipantName(chatData)) }}</span>
            </div>
          </div>
        </div>
        
        <!-- Информация о собеседнике -->
        <div class="user-info-section">
          <div class="form-group">
            <label>Имя</label>
            <div class="info-field" @click="copyToClipboard(getOtherParticipantName(chatData))">
              <span>{{ getOtherParticipantName(chatData) }}</span>
              <button class="copy-btn">
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>
          
          <div class="form-group">
            <label>Email</label>
            <div class="info-field" @click="copyToClipboard(getOtherParticipantEmail(chatData))">
              <span>{{ getOtherParticipantEmail(chatData) }}</span>
              <button class="copy-btn">
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Кнопка удаления чата -->
        <div class="actions-section">
          <button 
            class="delete-btn" 
            @click="confirmDeleteChat" 
            :disabled="deletingChat"
          >
            <span v-if="deletingChat">Удаление...</span>
            <span v-else>Удалить чат</span>
          </button>
        </div>
      </div>
      
      <!-- Подтверждение действия -->
      <div v-if="showConfirmDialog" class="confirm-dialog">
        <div class="confirm-content">
          <h4>Подтверждение</h4>
          <p>{{ confirmMessage }}</p>
          <div class="confirm-actions">
            <button class="cancel-btn" @click="showConfirmDialog = false">Отмена</button>
            <button class="confirm-btn" @click="confirmAction">Подтвердить</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useChatStore } from '~/stores/chat';
import { useAuthStore } from '~/stores/auth';
import { useDebounce } from '@vueuse/core';
import { secureUrl } from '~/utils/secureUrl';

const chatStore = useChatStore();
const authStore = useAuthStore();

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  chatData: {
    type: Object,
    default: () => ({})
  },
  isNewChat: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'saved']);

const fileInput = ref(null);
const loading = ref(false);
const activeTab = ref('edit'); // 'edit' или 'participants' или 'settings'
const searchQuery = ref('');
const debouncedSearchQuery = useDebounce(searchQuery, 300);
const searchResults = ref([]);
const removingParticipant = ref(null);
const leavingChat = ref(false);
const deletingChat = ref(false); // Добавляем переменную deletingChat
const showConfirmDialog = ref(false);
const confirmMessage = ref('');
const confirmAction = ref(null);

// Данные формы чата
const chatFormData = ref({
  name: '',
  description: '',
  avatar: null,
  theme: 'light',
  language: 'ru'
});

// Предварительный просмотр аватара
const previewImage = ref('');

// Список участников чата
const participants = computed(() => {
  if (!props.chatData || !props.chatData.participants) return [];
  
  // Сортируем участников так, чтобы создатель был в начале списка
  return [...props.chatData.participants].sort((a, b) => {
    // Если a - создатель, он должен быть первым
    if (isCreator(a._id)) return -1;
    // Если b - создатель, он должен быть первым
    if (isCreator(b._id)) return 1;
    // Иначе сохраняем исходный порядок
    return 0;
  });
});

// Инициализация данных при открытии модального окна
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Если редактируем существующий чат
    if (!props.isNewChat && props.chatData?._id) {
      chatFormData.value = {
        name: props.chatData.name || '',
        description: props.chatData.description || '',
        avatar: null,
        theme: props.chatData.theme || 'light',
        language: props.chatData.language || 'ru'
      };
      
      if (props.chatData.avatar) {
        previewImage.value = props.chatData.avatar;
      } else {
        previewImage.value = '';
      }
    } else {
      // Если создаем новый чат
      chatFormData.value = {
        name: '',
        description: '',
        avatar: null,
        theme: 'light',
        language: 'ru'
      };
      previewImage.value = '';
    }
    
    searchQuery.value = '';
    searchResults.value = [];
    activeTab.value = 'edit';
  }
}, { immediate: true });

// Поиск пользователей при изменении запроса
watch(debouncedSearchQuery, async (query) => {
  if (query.length >= 2) {
    try {
      loading.value = true;
      const results = await chatStore.searchUsers(query);
      
      // Фильтруем результаты, исключая уже добавленных участников
      searchResults.value = results.filter(user => {
        return !participants.value.some(participant => participant._id === user._id);
      });
    } catch (error) {
      console.error('Ошибка при поиске пользователей:', error);
      searchResults.value = [];
    } finally {
      loading.value = false;
    }
  } else {
    searchResults.value = [];
  }
});

// Обработка загрузки файла
const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  chatFormData.value.avatar = file;
  
  // Создаем URL для предпросмотра
  if (previewImage.value && previewImage.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewImage.value);
  }
  
  previewImage.value = URL.createObjectURL(file);
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

// Проверка, является ли пользователь создателем чата
const isCreator = (userId) => {
  // Проверяем разные возможные поля для определения создателя
  return (
    props.chatData?.creator === userId || 
    props.chatData?.createdBy === userId ||
    (props.chatData?.creator && props.chatData.creator._id === userId)
  );
};

// Проверка, может ли текущий пользователь удалить участника
const canRemoveParticipant = (userId) => {
  // Создатель может удалять всех, кроме себя
  // Обычный пользователь не может удалять никого
  const currentUserId = authStore.user?._id;
  return isCreator(currentUserId) && userId !== currentUserId;
};

// Поиск пользователей
const searchUsers = async () => {
  if (searchQuery.value.length < 2) {
    searchResults.value = [];
    return;
  }
  
  try {
    loading.value = true;
    const results = await chatStore.searchUsers(searchQuery.value);
    
    // Фильтруем результаты, исключая уже добавленных участников
    searchResults.value = results.filter(user => {
      return !participants.value.some(participant => participant._id === user._id);
    });
  } catch (error) {
    console.error('Ошибка при поиске пользователей:', error);
    searchResults.value = [];
  } finally {
    loading.value = false;
  }
};

// Добавление пользователя в чат
const addUserToChat = async (user) => {
  try {
    loading.value = true;
    await chatStore.addChatParticipants(props.chatData._id, [user._id]);
    searchQuery.value = '';
    searchResults.value = [];
  } catch (error) {
    console.error('Ошибка при добавлении пользователя:', error);
  } finally {
    loading.value = false;
  }
};

// Удаление пользователя из чата
const removeUserFromChat = async (userId) => {
  try {
    removingParticipant.value = userId;
    await chatStore.removeChatParticipant(props.chatData._id, userId);
  } catch (error) {
    console.error('Ошибка при удалении пользователя:', error);
  } finally {
    removingParticipant.value = null;
  }
};

// Подтверждение выхода из чата
const confirmLeaveChat = () => {
  confirmMessage.value = 'Вы уверены, что хотите покинуть этот чат?';
  confirmAction.value = leaveChat;
  showConfirmDialog.value = true;
};

// Выход из чата
const leaveChat = async () => {
  try {
    leavingChat.value = true;
    await chatStore.leaveChat(props.chatData._id);
    closeModal();
    emit('saved');
  } catch (error) {
    console.error('Ошибка при выходе из чата:', error);
  } finally {
    leavingChat.value = false;
    showConfirmDialog.value = false;
  }
};

// Подтверждение удаления чата
const confirmDeleteChat = () => {
  confirmMessage.value = 'Вы уверены, что хотите удалить этот чат?';
  confirmAction.value = deleteChat;
  showConfirmDialog.value = true;
};

// Удаление чата
const deleteChat = async () => {
  try {
    deletingChat.value = true;
    await chatStore.deleteChat(props.chatData._id);
    closeModal();
    emit('saved');
  } catch (error) {
    console.error('Ошибка при удалении чата:', error);
  } finally {
    deletingChat.value = false;
    showConfirmDialog.value = false;
  }
};

// Сохранение чата
const saveChat = async () => {
  try {
    loading.value = true;
    
    if (props.isNewChat) {
      // Создание нового чата
      const newChatData = {
        ...chatFormData.value,
        participants: []
      };
      
      const chat = await chatStore.createChat(newChatData);
      emit('saved', chat);
    } else {
      // Обновление существующего чата
      await chatStore.updateChat(props.chatData._id, chatFormData.value);
      emit('saved');
    }
    
    closeModal();
  } catch (error) {
    console.error('Ошибка при сохранении чата:', error);
  } finally {
    loading.value = false;
  }
};

// Сохранение настроек чата
const saveChatSettings = async () => {
  try {
    loading.value = true;
    await chatStore.updateChatSettings(props.chatData._id, chatFormData.value);
    emit('saved');
  } catch (error) {
    console.error('Ошибка при сохранении настроек чата:', error);
  } finally {
    loading.value = false;
  }
};

// Выполнение подтвержденного действия
const executeConfirmAction = () => {
  if (typeof confirmAction.value === 'function') {
    confirmAction.value();
  }
  showConfirmDialog.value = false;
};

// Закрытие модального окна
const closeModal = () => {
  emit('close');
};

// Наблюдаем за изменением поискового запроса
watch(debouncedSearchQuery, searchUsers);

// Получение имени собеседника в личном чате
const getOtherParticipantName = (chat) => {
  if (!chat || !chat.participants || chat.participants.length === 0) {
    return chat.name || 'Чат';
  }
  
  // Получаем ID текущего пользователя
  const currentUserId = authStore.user?._id;
  
  // Находим собеседника (не текущего пользователя)
  const otherParticipant = chat.participants.find(p => p._id !== currentUserId);
  
  // Возвращаем имя собеседника или название чата, если собеседник не найден
  return otherParticipant?.name || chat.name || 'Чат';
};

// Получение email собеседника в личном чате
const getOtherParticipantEmail = (chat) => {
  if (!chat || !chat.participants || chat.participants.length === 0) {
    return '';
  }
  
  // Получаем ID текущего пользователя
  const currentUserId = authStore.user?._id;
  
  // Находим собеседника (не текущего пользователя)
  const otherParticipant = chat.participants.find(p => p._id !== currentUserId);
  
  // Возвращаем email собеседника
  return otherParticipant?.email || '';
};

// Получение аватара собеседника в личном чате
const getOtherParticipantAvatar = (chat) => {
  if (!chat || !chat.participants || chat.participants.length === 0) {
    return null;
  }
  
  // Получаем ID текущего пользователя
  const currentUserId = authStore.user?._id;
  
  // Находим собеседника (не текущего пользователя)
  const otherParticipant = chat.participants.find(p => p._id !== currentUserId);
  
  // Возвращаем аватар собеседника
  return otherParticipant?.avatar || null;
};

// Копирование текста в буфер обмена
const copyToClipboard = (text) => {
  if (!text) return;
  
  navigator.clipboard.writeText(text)
    .then(() => {
      console.log('Текст скопирован в буфер обмена:', text);
      showNotification('Скопировано в буфер обмена', 'info');
    })
    .catch(err => {
      console.error('Не удалось скопировать текст: ', err);
      showNotification('Не удалось скопировать текст', 'error');
    });
};

// Функция для показа уведомлений
const showNotification = (message, type = 'info') => {
  // Здесь можно использовать любую библиотеку уведомлений
  // или просто вывести в консоль для тестирования
  console.log(`Уведомление (${type}): ${message}`);
  
  // Пример реализации простого уведомления
  const notification = document.createElement('div');
  notification.className = `notification notification--${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('notification--show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('notification--show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
};
</script>

<style lang="sass" scoped>
@import '~/assets/styles/variables'

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
    max-width: 500px
    max-height: 90vh
    overflow-y: auto
    position: relative
    
    .tabs
      display: flex
      margin-bottom: 20px
      border-bottom: 1px solid rgba(255, 255, 255, 0.1)
      
      .tab-btn
        flex: 1
        background: none
        border: none
        color: rgba(255, 255, 255, 0.7)
        padding: 10px
        cursor: pointer
        font-size: 16px
        transition: all 0.3s ease
        
        &:hover
          color: $white
        
        &.active
          color: $white
          border-bottom: 2px solid $purple
    
    .tab-content
      animation: fadeIn 0.3s ease
    
    .avatar-upload
      display: flex
      flex-direction: column
      align-items: center
      
      .avatar-preview
        width: 100px
        height: 100px
        border-radius: 50%
        background-color: rgba(255, 255, 255, 0.1)
        background-size: cover
        background-position: center
        cursor: pointer
        display: flex
        align-items: center
        justify-content: center
        border: 2px solid rgba(255, 255, 255, 0.2)
        
        .avatar-placeholder
          width: 100%
          height: 100%
          display: flex
          align-items: center
          justify-content: center
          font-size: 36px
          background-color: $purple
          border-radius: 50%
          >*
            color: $white
      
      .file-input
        display: none
      
      .avatar-label
        font-size: 12px
        color: rgba(255, 255, 255, 0.7)
    
    .form-group
      margin-bottom: 15px
      
      label
        display: block
        margin-bottom: 5px
        color: $white
      
      input, textarea, select
        width: 100%
        padding: 10px
        border-radius: 4px
        border: 1px solid rgba(255, 255, 255, 0.2)
        background-color: rgba(255, 255, 255, 0.1)
        color: $white
        resize: none
        
        &:focus
          outline: none
          border-color: $purple
    
    .participants-search
      position: relative
      
      .search-results
        position: absolute
        top: 100%
        left: 0
        right: 0
        background-color: $header-bg
        border: 1px solid rgba(255, 255, 255, 0.2)
        border-radius: 4px
        max-height: 200px
        overflow-y: auto
        z-index: 10
        
        .search-result-item
          padding: 10px
          display: flex
          align-items: center
          cursor: pointer
          border-bottom: 1px solid rgba(255, 255, 255, 0.1)
          
          &:last-child
            border-bottom: none
          
          &:hover
            background-color: rgba(255, 255, 255, 0.1)
          
          .user-avatar
            width: 30px
            height: 30px
            border-radius: 50%
            background-color: $purple
            display: flex
            align-items: center
            justify-content: center
            color: $white
            font-size: 12px
            margin-right: 10px
          
          .user-info
            flex: 1
            
            .user-name
              color: $white
              font-size: 14px
            
            .user-email
              color: rgba(255, 255, 255, 0.7)
              font-size: 12px
      
      .no-results
        padding: 10px
        text-align: center
        color: rgba(255, 255, 255, 0.7)
        font-size: 14px
    
    .participants-section
      margin-top: 20px
      
      h4
        color: $white
        margin-top: 0
        margin-bottom: 10px
        font-size: 16px
      
      .loading, .no-participants
        padding: 20px
        text-align: center
        color: rgba(255, 255, 255, 0.7)
      
      .participants-list
        .participant-item
          display: flex
          align-items: center
          padding: 10px 0px
        
          &:last-child
            border-bottom: none
          
          &.is-creator
          
          .participant-avatar
            width: 40px
            height: 40px
            border-radius: 50%
            background-color: $purple
            display: flex
            align-items: center
            justify-content: center
            color: $white
            font-size: 16px
            margin-right: 10px
          
          .participant-info
            flex: 1
            
            .participant-name
              color: $white
              font-size: 14px
              display: flex
              align-items: center
              
              .creator-badge
                background-color: $purple
                color: $white
                font-size: 10px
                padding: 2px 5px
                border-radius: 10px
                margin-left: 5px
            
            .participant-email
              color: rgba(255, 255, 255, 0.7)
              font-size: 12px
          
          .participant-actions
            .remove-btn
              background-color: rgba(255, 59, 48, 0.2)
              color: rgba(255, 59, 48, 0.8)
              border: none
              padding: 5px 10px
              border-radius: 4px
              cursor: pointer
              
              &:hover
                background-color: rgba(255, 59, 48, 0.3)
                color: rgb(255, 59, 48)
              
              &:disabled
                opacity: 0.5
                cursor: not-allowed
    
    .leave-chat-section
      margin: 20px 0
      display: flex
      justify-content: center
      gap: 10px
      flex-wrap: wrap
      
      .leave-btn, .delete-btn
        background-color: rgba(255, 59, 48, 0.2)
        color: rgba(255, 59, 48, 0.8)
        border: none
        padding: 8px 15px
        border-radius: 4px
        cursor: pointer
        
        &:hover
          background-color: rgba(255, 59, 48, 0.3)
          color: rgb(255, 59, 48)
        
        &:disabled
          opacity: 0.5
          cursor: not-allowed
    
    .form-actions
      display: flex
      justify-content: flex-end
      gap: 10px
      margin-top: 20px
      
      button
        padding: 8px 15px
        border-radius: 4px
        cursor: pointer
        border: none
        
        &.cancel-btn, &.close-btn
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
    
    .confirm-dialog
      position: absolute
      top: 0
      left: 0
      right: 0
      bottom: 0
      background-color: rgba(0, 0, 0, 0.7)
      display: flex
      align-items: center
      justify-content: center
      border-radius: 8px
      
      .confirm-content
        background-color: $header-bg
        padding: 20px
        border-radius: 8px
        width: 80%
        
        h4
          margin-top: 0
          margin-bottom: 10px
          color: $white
          text-align: center
        
        p
          color: $white
          margin-bottom: 20px
          text-align: center
        
        .confirm-actions
          display: flex
          justify-content: center
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
            
            &.confirm-btn
              background-color: rgba(255, 59, 48, 0.7)
              color: $white
              
              &:hover
                background-color: rgb(255, 59, 48)

@keyframes fadeIn
  from
    opacity: 0
  to
    opacity: 1

// Стили для личных чатов
.user-info-section
  border-radius: 8px
  padding: 15px

.info-section-title
  margin-top: 0
  margin-bottom: 15px
  font-size: 16px
  color: $white
  border-bottom: 1px solid rgba(255, 255, 255, 0.1)
  padding-bottom: 10px

.info-item
  margin-bottom: 15px
  
  &:last-child
    margin-bottom: 0

.info-label
  font-size: 12px
  color: rgba(255, 255, 255, 0.7)
  margin-bottom: 5px

.info-field
  display: flex
  align-items: center
  justify-content: space-between
  padding: 8px 10px
  background-color: rgba(255, 255, 255, 0.05)
  border-radius: $radius
  color: $white
  transition: all 0.2s
  border: 1px solid $primary-bg
  cursor: pointer
  
  &:hover
    border: 1px $purple solid
  
  &:active
    border: 1px $purple solid

.info-value
  font-size: 14px
  color: $white
  word-break: break-word
  
  &.copyable
    cursor: pointer
    display: flex
    align-items: center
    justify-content: space-between
    padding: 8px 10px
    background-color: rgba(255, 255, 255, 0.05)
    border-radius: 4px
    transition: background-color 0.2s
    
    &:hover
      background-color: rgba(255, 255, 255, 0.1)

.copy-icon
  font-size: 16px
  color: rgba(255, 255, 255, 0.7)
  margin-left: 5px

.copy-btn
  background-color: transparent
  border: none
  padding: 5px
  cursor: pointer
  color: $white
  
  &:hover
    color: $purple

.actions-section
  display: flex
  justify-content: center
  gap: 10px
  flex-wrap: wrap

.delete-btn
  background-color: rgba(255, 59, 48, 0.2)
  color: rgba(255, 59, 48, 0.8)
  border: none
  padding: 8px 15px
  border-radius: 4px
  cursor: pointer
  
  &:hover
    background-color: rgba(255, 59, 48, 0.3)
    color: rgb(255, 59, 48)
  
  &:disabled
    opacity: 0.5
    cursor: not-allowed

// Стили для уведомлений
.notification
  position: fixed
  bottom: 20px
  left: 50%
  transform: translateX(-50%) translateY(100px)
  padding: 12px 20px
  border-radius: $radius
  color: $white
  font-size: 14px
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2)
  z-index: 2000
  opacity: 0
  transition: transform 0.3s, opacity 0.3s
  text-align: center
  min-width: 250px
  
  &--show
    transform: translateX(-50%) translateY(0)
    opacity: 1
  
  &--success
    background-color: $green
  
  &--error
    background-color: $red
  
  &--info
    background-color: $purple
  
  &--warning
    background-color: $orange
</style>
