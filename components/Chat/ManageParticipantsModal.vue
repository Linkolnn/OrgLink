<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <h3>Управление участниками</h3>
      
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
            <div v-else-if="searchQuery.length >= 2 && !loading" class="no-results">
              Пользователи не найдены
            </div>
          </div>
        </div>
      </div>
      
      <!-- Список текущих участников -->
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
                @click="removeParticipant(participant._id)"
                :disabled="removingParticipant === participant._id"
              >
                <span v-if="removingParticipant === participant._id">...</span>
                <span v-else>Удалить</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Кнопка выхода из чата -->
      <div class="leave-chat-section">
        <button class="leave-btn" @click="confirmLeaveChat" :disabled="leavingChat">
          <span v-if="leavingChat">Выход...</span>
          <span v-else>Покинуть чат</span>
        </button>
      </div>
      
      <!-- Кнопки -->
      <div class="form-actions">
        <button type="button" class="close-btn" @click="closeModal">Закрыть</button>
      </div>
      
      <!-- Модальное окно подтверждения -->
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
import { ref, computed, watch } from 'vue';
import { useChatStore } from '~/stores/chat';
import { useDebounce } from '@vueuse/core';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  chat: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['close', 'participantsUpdated', 'chatLeft']);

const chatStore = useChatStore();
const loading = ref(false);
const searchQuery = ref('');
const debouncedSearchQuery = useDebounce(searchQuery, 300);
const searchResults = ref([]);
const participants = ref([]);
const removingParticipant = ref(null);
const leavingChat = ref(false);
const showConfirmDialog = ref(false);
const confirmMessage = ref('');
const pendingAction = ref(null);

// Инициализация данных при открытии модального окна
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && props.chat?._id) {
    // Копируем участников из чата
    participants.value = props.chat.participants || [];
    
    searchQuery.value = '';
    searchResults.value = [];
    removingParticipant.value = null;
    leavingChat.value = false;
    showConfirmDialog.value = false;
  }
}, { immediate: true });

// Поиск пользователей при изменении запроса
watch(debouncedSearchQuery, async (query) => {
  if (query.length >= 2) {
    loading.value = true;
    try {
      const results = await chatStore.searchUsers(query);
      // Фильтруем результаты, исключая уже существующих участников
      searchResults.value = results.filter(user => 
        !participants.value.some(p => p._id === user._id)
      );
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

// Проверка, является ли пользователь создателем чата
const isCreator = (userId) => {
  return props.chat?.creator?._id === userId;
};

// Проверка, может ли текущий пользователь удалить участника
const canRemoveParticipant = (userId) => {
  // Текущий пользователь должен быть создателем чата
  // И нельзя удалить самого создателя
  return isCreator(chatStore.user?._id) && !isCreator(userId);
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

// Добавление участника
const addParticipant = async (user) => {
  if (!props.chat?._id) return;
  
  loading.value = true;
  
  try {
    await chatStore.addChatParticipants(props.chat._id, [user._id]);
    
    // Обновляем список участников
    participants.value = props.chat.participants || [];
    
    // Очищаем поиск
    searchQuery.value = '';
    searchResults.value = [];
    
    // Уведомляем родителя об обновлении
    emit('participantsUpdated');
  } catch (error) {
    console.error('Ошибка при добавлении участника:', error);
    alert('Не удалось добавить участника. Пожалуйста, попробуйте еще раз.');
  } finally {
    loading.value = false;
  }
};

// Удаление участника
const removeParticipant = (userId) => {
  confirmMessage.value = 'Вы уверены, что хотите удалить этого участника из чата?';
  pendingAction.value = () => performRemoveParticipant(userId);
  showConfirmDialog.value = true;
};

// Выполнение удаления участника
const performRemoveParticipant = async (userId) => {
  if (!props.chat?._id) return;
  
  removingParticipant.value = userId;
  
  try {
    const result = await chatStore.removeChatParticipant(props.chat._id, userId);
    
    // Если чат был удален
    if (result.deleted) {
      emit('chatLeft');
      closeModal();
      return;
    }
    
    // Обновляем список участников
    participants.value = props.chat.participants || [];
    
    // Уведомляем родителя об обновлении
    emit('participantsUpdated');
  } catch (error) {
    console.error('Ошибка при удалении участника:', error);
    alert('Не удалось удалить участника. Пожалуйста, попробуйте еще раз.');
  } finally {
    removingParticipant.value = null;
  }
};

// Подтверждение выхода из чата
const confirmLeaveChat = () => {
  confirmMessage.value = 'Вы уверены, что хотите покинуть этот чат?';
  pendingAction.value = leaveChat;
  showConfirmDialog.value = true;
};

// Выход из чата
const leaveChat = async () => {
  if (!props.chat?._id) return;
  
  leavingChat.value = true;
  
  try {
    await chatStore.leaveChat(props.chat._id);
    
    // Уведомляем родителя о выходе из чата
    emit('chatLeft');
    closeModal();
  } catch (error) {
    console.error('Ошибка при выходе из чата:', error);
    alert('Не удалось выйти из чата. Пожалуйста, попробуйте еще раз.');
  } finally {
    leavingChat.value = false;
  }
};

// Выполнение подтвержденного действия
const confirmAction = () => {
  showConfirmDialog.value = false;
  if (pendingAction.value) {
    pendingAction.value();
    pendingAction.value = null;
  }
};

// Закрытие модального окна
const closeModal = () => {
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
    position: relative
    
    h3
      margin-top: 0
      margin-bottom: 20px
      color: $white
      text-align: center
    
    h4
      color: $white
      margin-top: 20px
      margin-bottom: 10px
      font-size: 16px
    
    .search-section
      margin-bottom: 20px
      
      .form-group
        label
          display: block
          margin-bottom: 5px
          color: $white
        
        .participants-search
          position: relative
          
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
      margin-bottom: 20px
      
      .loading, .no-participants
        padding: 10px
        text-align: center
        color: rgba(255, 255, 255, 0.7)
        font-size: 14px
      
      .participants-list
        .participant-item
          display: flex
          align-items: center
          padding: 10px
          border-bottom: 1px solid rgba(255, 255, 255, 0.1)
          
          &:last-child
            border-bottom: none
          
          &.is-creator
            background-color: rgba(152, 132, 232, 0.1)
          
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
              font-size: 12px
              
              &:hover
                background-color: rgba(255, 59, 48, 0.3)
                color: rgb(255, 59, 48)
              
              &:disabled
                opacity: 0.5
                cursor: not-allowed
    
    .leave-chat-section
      margin-bottom: 20px
      display: flex
      justify-content: center
      
      .leave-btn
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
      justify-content: center
      margin-top: 20px
      
      .close-btn
        background-color: transparent
        color: $white
        border: 1px solid rgba(255, 255, 255, 0.2)
        padding: 8px 15px
        border-radius: 4px
        cursor: pointer
        
        &:hover
          background-color: rgba(255, 255, 255, 0.1)
    
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
</style>
