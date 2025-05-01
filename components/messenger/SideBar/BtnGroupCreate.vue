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
      right: 20px
      bottom: 20px
      color: $white
      width: 50px
      height: 50px
      border-radius: 50%
      display: flex
      align-items: center
      justify-content: center
      font-size: 36px
      line-height: 1
      
      &:hover
        background-color: darken($purple, 10%)
</style>
