<template>
  <button class="sidebar__button sidebar__button--new" @click="$emit('create-chat')">
    <span>+</span>
  </button>
</template>

<script setup>
defineEmits(['create-chat']);
</script>

<style lang="sass" scoped>
@import '@variables'

.sidebar
  &__button
    border: none
    cursor: pointer
    transition: background-color $transition-speed $transition-function
    
    &--new
      position: absolute
      background-color: $purple
      bottom: 20px
      right: 20px
      color: $white
      width: 50px
      height: 50px
      border-radius: 50%
      display: flex
      align-items: center
      justify-content: center
      font-size: 36px
      line-height: 1
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3)
      z-index: 10 // Высокий z-index для гарантии видимости

      // Специальные стили для мобильных устройств
      @include mobile
        bottom: 110px
        right: 20px
      
      // Специальные стили для режима PWA
      @media (display-mode: standalone), (display-mode: fullscreen)
        bottom: 60px
        right: 20px
      
      &:hover
        background-color: darken($purple, 10%)
</style>
