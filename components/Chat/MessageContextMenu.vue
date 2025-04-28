<template>
  <div 
    v-if="isVisible" 
    class="message-context-menu" 
    :style="{ top: `${position.y}px`, left: `${position.x}px` }"
  >
    <div class="menu-item" @click="onEdit">
      <i class="fas fa-edit"></i>
      <span>Редактировать</span>
    </div>
    <div class="menu-item delete" @click="onDelete">
      <i class="fas fa-trash"></i>
      <span>Удалить</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  },
  message: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['edit', 'delete', 'close']);

// Закрытие меню при клике вне его области
const handleClickOutside = (event) => {
  const menu = document.querySelector('.message-context-menu');
  if (menu && !menu.contains(event.target) && props.isVisible) {
    emit('close');
  }
};

// Обработчики действий
const onEdit = () => {
  emit('edit', props.message);
  emit('close');
};

const onDelete = () => {
  emit('delete', props.message);
  emit('close');
};

// Добавляем и удаляем обработчик клика при монтировании/размонтировании компонента
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('contextmenu', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('contextmenu', handleClickOutside);
});
</script>

<style lang="sass">
@import '~/assets/styles/variables'

.message-context-menu
  position: fixed
  background-color: $header-bg
  border-radius: 8px
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2)
  min-width: 180px
  z-index: 1000
  overflow: hidden
  
  .menu-item
    display: flex
    align-items: center
    padding: 10px 15px
    color: $white
    cursor: pointer
    transition: background-color 0.2s
    
    i
      margin-right: 10px
      font-size: 14px
    
    &:hover
      background-color: rgba(255, 255, 255, 0.1)
    
    &.delete
      color: $error-color
      
      &:hover
        background-color: rgba(255, 0, 0, 0.1)
</style>
