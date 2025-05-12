<template>
  <transition name="fade">
    <div 
      v-if="isVisible" 
      class="context-menu"
      :style="{ top: `${top}px` }"
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
  },
  top: {
    type: Number,
    default: 0
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
const onEdit = (event) => {
  // Предотвращаем всплытие события
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  console.log('Нажата кнопка редактирования', props.message);
  console.log('Детали сообщения:', {
    id: props.message._id,
    text: props.message.text,
    sender: props.message.sender?._id
  });
  
  try {
    // Сначала вызываем действие редактирования
    console.log('Отправляем событие edit из ContextMenu');
    emit('edit', props.message);
    
    // Затем закрываем меню
    console.log('Закрываем контекстное меню');
    emit('close');
  } catch (error) {
    console.error('Ошибка в обработчике onEdit:', error);
  }
};

const onDelete = (event) => {
  // Предотвращаем всплытие события
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  console.log('Нажата кнопка удаления', props.message);
  console.log('Детали сообщения для удаления:', {
    id: props.message._id,
    text: props.message.text,
    sender: props.message.sender?._id
  });
  
  try {
    // Сначала вызываем действие удаления
    console.log('Отправляем событие delete из ContextMenu');
    emit('delete', props.message);
    
    // Затем закрываем меню
    console.log('Закрываем контекстное меню после удаления');
    emit('close');
  } catch (error) {
    console.error('Ошибка в обработчике onDelete:', error);
  }
};

// Функция для управления скроллом
const toggleScroll = (disable) => {
  const messagesContainer = document.querySelector('.messages_container');
  if (messagesContainer) {
    messagesContainer.style.overflow = disable ? 'hidden' : 'auto';
    console.log(`Скролл ${disable ? 'отключен' : 'включен'}`);
  }
};

// Отслеживаем изменения видимости меню
watch(() => props.isVisible, (newValue) => {
  toggleScroll(newValue);
  console.log(`Видимость меню изменилась: ${newValue}`);
}, { immediate: true });

// Добавляем и удаляем обработчик клика при монтировании/размонтировании компонента
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('contextmenu', handleClickOutside);
  
  // Отключаем скролл при монтировании, если меню видимо
  if (props.isVisible) {
    toggleScroll(true);
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('contextmenu', handleClickOutside);
  
  // Включаем скролл при размонтировании
  toggleScroll(false);
});
</script>

<style lang="sass">
@import '~/assets/styles/variables'

.context-menu
  position: fixed
  left: 50%
  transform: translate(-50%, -50%)
  border: 1px solid rgba(255, 255, 255, 0.2)
  background-color: $primary-bg
  border-radius: $radius
  min-width: 220px
  z-index: 1000
  overflow: hidden
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4)
  
  .menu-item
    display: flex
    align-items: center
    padding: 16px 20px
    color: $white
    cursor: pointer
    transition: background-color 0.2s, color 0.2s
    font-size: 16px
    
    > i
      margin-right: 12px
      font-size: 18px
      width: 24px
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
