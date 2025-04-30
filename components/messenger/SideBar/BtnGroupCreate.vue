<template>
  <div class="sidebar__actions">
    <h3 class="sidebar__title">Чаты</h3>
    <div class="sidebar__connection-status" :class="{ 'sidebar__connection-status--connected': isConnected }" title="Статус соединения"></div>
    <button class="sidebar__button sidebar__button--new" @click="$emit('create-chat')">
      <span>+</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  isConnected: {
    type: Boolean,
    default: false
  }
});

defineEmits(['create-chat']);
</script>

<style lang="sass" scoped>
@import '~/assets/styles/variables'

.sidebar
  &__actions
    display: flex
    align-items: center
    gap: 12px
  
  &__connection-status
    width: 10px
    height: 10px
    border-radius: 50%
    background-color: #f44336 // красный для отключенного состояния
    transition: background-color 0.3s ease
    
    &--connected
      background-color: #4caf50 // зеленый для подключенного состояния
  
  &__title
    margin: 0
    font-size: 18px
    font-weight: 600
  
  &__button
    border: none
    cursor: pointer
    transition: background-color $transition-speed $transition-function
    
    &--new
      background-color: $purple
      color: $white
      width: 28px
      height: 28px
      border-radius: 50%
      display: flex
      align-items: center
      justify-content: center
      font-size: 18px
      line-height: 1
      
      &:hover
        background-color: darken($purple, 10%)
</style>
