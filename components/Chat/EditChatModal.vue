<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <h3>{{ isNewChat ? 'Создать новый чат' : 'Редактировать чат' }}</h3>
      
      <form @submit.prevent="saveChat">
        <!-- Аватар чата -->
        <div class="avatar-upload">
          <div 
            class="avatar-preview" 
            :style="{ backgroundImage: previewImage ? `url(${previewImage})` : 'none' }"
            @click="$refs.fileInput.click()"
          >
            <div v-if="!previewImage" class="avatar-placeholder">
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
        
        <!-- Участники (только для нового чата) -->
        <div v-if="isNewChat" class="form-group">
          <label>Участники</label>
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
                @click="addParticipant(user)"
              >
                <div class="user-avatar">{{ getInitials(user.name) }}</div>
                <div class="user-info">
                  <div class="user-name">{{ user.name }}</div>
                  <div class="user-email">{{ user.email }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Выбранные участники -->
          <div v-if="selectedParticipants.length > 0" class="selected-participants">
            <div 
              v-for="participant in selectedParticipants" 
              :key="participant._id" 
              class="participant-item"
            >
              <div class="participant-avatar">{{ getInitials(participant.name) }}</div>
              <div class="participant-name">{{ participant.name }}</div>
              <button 
                type="button" 
                class="remove-participant" 
                @click="removeParticipant(participant._id)"
              >×</button>
            </div>
          </div>
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
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useChatStore } from '~/stores/chat';
import { useDebounce } from '@vueuse/core';

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
    default: true
  }
});

const emit = defineEmits(['close', 'saved']);

const chatStore = useChatStore();
const fileInput = ref(null);
const loading = ref(false);
const searchQuery = ref('');
const debouncedSearchQuery = useDebounce(searchQuery, 300);
const searchResults = ref([]);
const selectedParticipants = ref([]);

// Данные чата
const chatFormData = ref({
  name: '',
  description: '',
  avatar: null
});

// Предварительный просмотр аватара
const previewImage = ref('');

// Инициализация данных при открытии модального окна
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Если редактируем существующий чат
    if (!props.isNewChat && props.chatData?._id) {
      chatFormData.value = {
        name: props.chatData.name || '',
        description: props.chatData.description || '',
        avatar: null
      };
      
      // Если у чата есть аватар, устанавливаем его для предпросмотра
      if (props.chatData.avatar) {
        previewImage.value = props.chatData.avatar;
      } else {
        previewImage.value = '';
      }
      
      // Если есть участники, инициализируем их
      if (props.chatData.participants && Array.isArray(props.chatData.participants)) {
        // Исключаем текущего пользователя из списка участников
        selectedParticipants.value = props.chatData.participants
          .filter(p => p._id !== chatStore.currentUserId)
          .map(p => ({
            _id: p._id,
            name: p.name || p.email,
            email: p.email,
            avatar: p.avatar
          }));
      }
    } else {
      // Если создаем новый чат
      chatFormData.value = {
        name: '',
        description: '',
        avatar: null
      };
      previewImage.value = '';
      selectedParticipants.value = [];
    }
    
    searchQuery.value = '';
    searchResults.value = [];
  }
}, { immediate: true });

// Поиск пользователей при изменении запроса
watch(debouncedSearchQuery, async (query) => {
  if (query.length >= 2) {
    try {
      const results = await chatStore.searchUsers(query);
      // Фильтруем результаты, исключая уже выбранных участников
      searchResults.value = results.filter(user => 
        !selectedParticipants.value.some(p => p._id === user._id)
      );
    } catch (error) {
      console.error('Ошибка при поиске пользователей:', error);
      searchResults.value = [];
    }
  } else {
    searchResults.value = [];
  }
});

// Обработка загрузки файла
const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  // Проверяем, что это изображение
  if (!file.type.startsWith('image/')) {
    alert('Пожалуйста, выберите изображение');
    return;
  }
  
  // Устанавливаем файл для загрузки
  chatFormData.value.avatar = file;
  
  // Создаем URL для предпросмотра
  previewImage.value = URL.createObjectURL(file);
};

// Добавление участника
const addParticipant = (user) => {
  // Проверяем, не выбран ли уже этот участник
  if (!selectedParticipants.value.some(p => p._id === user._id)) {
    selectedParticipants.value.push(user);
  }
  
  // Очищаем поиск
  searchQuery.value = '';
  searchResults.value = [];
};

// Удаление участника
const removeParticipant = (userId) => {
  selectedParticipants.value = selectedParticipants.value.filter(p => p._id !== userId);
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

// Сохранение чата
const saveChat = async () => {
  if (!chatFormData.value.name) return;
  
  loading.value = true;
  
  try {
    let result;
    
    if (props.isNewChat) {
      // Создаем новый чат
      const newChatData = {
        ...chatFormData.value,
        participants: selectedParticipants.value.map(p => p._id)
      };
      
      // Если есть аватар, создаем FormData
      if (chatFormData.value.avatar) {
        const formData = new FormData();
        formData.append('name', newChatData.name);
        formData.append('description', newChatData.description || '');
        formData.append('avatar', newChatData.avatar);
        
        // Добавляем участников
        newChatData.participants.forEach(participantId => {
          formData.append('participants[]', participantId);
        });
        
        // Отправляем запрос
        const response = await fetch('/api/chats', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        result = await response.json();
        
        // Добавляем чат в список и делаем его активным
        chatStore.chats.unshift(result);
        chatStore.setActiveChat(result._id);
      } else {
        // Если нет аватара, используем обычный JSON
        result = await chatStore.createChat(newChatData);
      }
    } else {
      // Редактируем существующий чат
      result = await chatStore.updateChat(props.chatData._id, chatFormData.value);
    }
    
    // Закрываем модальное окно и уведомляем родителя
    closeModal();
    emit('saved', result);
  } catch (error) {
    console.error('Ошибка при сохранении чата:', error);
    alert('Не удалось сохранить чат. Пожалуйста, попробуйте еще раз.');
  } finally {
    loading.value = false;
  }
};

// Закрытие модального окна
const closeModal = () => {
  // Очищаем URL предпросмотра, чтобы избежать утечек памяти
  if (previewImage.value && previewImage.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewImage.value);
  }
  
  emit('close');
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
    
    h3
      margin-top: 0
      margin-bottom: 20px
      color: $white
      text-align: center
    
    .avatar-upload
      display: flex
      flex-direction: column
      align-items: center
      margin-bottom: 20px
      
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
        margin-bottom: 10px
        border: 2px solid rgba(255, 255, 255, 0.2)
        
        &:hover
          border-color: $purple
        
        .avatar-placeholder
          width: 100%
          height: 100%
          display: flex
          align-items: center
          justify-content: center
          font-size: 36px
          color: $white
          background-color: $purple
          border-radius: 50%
      
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
      
      input, textarea
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
      
      .selected-participants
        margin-top: 10px
        display: flex
        flex-wrap: wrap
        gap: 8px
        
        .participant-item
          display: flex
          align-items: center
          background-color: rgba(255, 255, 255, 0.1)
          border-radius: 20px
          padding: 5px 10px
          
          .participant-avatar
            width: 24px
            height: 24px
            border-radius: 50%
            background-color: $purple
            display: flex
            align-items: center
            justify-content: center
            color: $white
            font-size: 10px
            margin-right: 5px
          
          .participant-name
            color: $white
            font-size: 12px
            margin-right: 5px
          
          .remove-participant
            background: none
            border: none
            color: rgba(255, 255, 255, 0.7)
            cursor: pointer
            font-size: 16px
            padding: 0
            width: 16px
            height: 16px
            display: flex
            align-items: center
            justify-content: center
            
            &:hover
              color: $white
    
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
</style>
