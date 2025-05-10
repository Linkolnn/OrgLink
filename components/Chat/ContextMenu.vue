<template>
  <transition name="fade">
    <div 
      v-if="isVisible" 
      class="context-menu"
    >
      <div class="menu-item" @click.stop="onEdit">
        <i class="fas fa-pencil-alt"></i>
        <span>Редактировать</span>
      </div>
      <div class="menu-item delete" @click.stop="onDelete">
        <i class="fas fa-trash-alt"></i>
        <span>Удалить</span>
      </div>
    </div>
  </transition>
</template>

<script setup>
const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  message: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['edit', 'delete', 'close']);

// Закрытие меню при клике вне его области
const handleClickOutside = (event) => {
  const menu = document.querySelector('.context-menu');
  if (menu && !menu.contains(event.target) && props.isVisible) {
    emit('close');
  }
};

// Обработчики действий
const onEdit = () => {
  // Сначала вызываем действие редактирования
  emit('edit', props.message);
  // Затем закрываем меню
  emit('close');
};

const onDelete = () => {
  // Сначала вызываем действие удаления
  emit('delete', props.message);
  // Затем закрываем меню
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

.context-menu
  position: absolute
  bottom: 0
  left: -30%
  border: 1px solid rgba(255, 255, 255, 0.1)
  transform: translate(-100%, -50%)
  background-color: $primary-bg
  border-radius: $radius
  min-width: 180px
  z-index: 10
  overflow: hidden
  
  .menu-item
    display: flex
    align-items: center
    padding: 10px 15px
    color: $white
    cursor: pointer
    transition: background-color 0.2s, color 0.2s
    
    > i
      margin-right: 10px
      font-size: 14px
      width: 20px
      text-align: center
      
    &:hover
      background-color: rgba(255, 255, 255, 0.1)
      color: $purple
      
    &.delete:hover
      background-color: rgba(255, 0, 0, 0.1)
      color: $red

    @include tablet
      &:active
        background-color: rgba(255, 255, 255, 0.1)
        color: $purple

      &.delete:active
        background-color: rgba(255, 0, 0, 0.1)
        color: $red
      
      
// Стили для анимации появления/исчезновения
.fade-enter-active
  animation: fadeIn 0.5s ease-out

.fade-leave-active
  animation: fadeOut 0.5s ease-in

@keyframes fadeIn
  0%
    opacity: 0
    transform: translate(-100%, 20%) scale(0.95)
  100%
    opacity: 1
    transform: translate(-100%, 20%) scale(1)

@keyframes fadeOut
  0%
    opacity: 1
    transform: translate(-100%, 20%) scale(1)
  100%
    opacity: 0
    transform: translate(-100%, 20%) scale(0.95)
</style>
