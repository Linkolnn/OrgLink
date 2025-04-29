<template>
  <div class="new-messages-indicator" @click="$emit('click')">
    <IconBottomArrow class="new-messages-arrow"/>
  </div>
</template>

<script setup>
defineEmits(['click']);
</script>

<style lang="sass" scoped>
@import '@variables'

.new-messages-indicator
  position: absolute
  bottom: 80px
  right: 0
  transform: translateX(-30%)
  background-color: $purple
  color: $white
  width: 45px !important
  height: 45px
  border-radius: 50%
  cursor: pointer
  display: flex
  align-items: center
  justify-content: center
  animation: fadeIn 0.5s ease-in-out
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3)
  transition: transform 0.3s ease, box-shadow 0.3s ease
  
  &:hover
    transform: translateX(-30%) scale(1.05)
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4)
  
  .new-messages-arrow
      stroke: $white

@keyframes fadeIn
  from
    opacity: 0
    transform: translateX(-30%) translateY(20px)
  to
    opacity: 1
    transform: translateX(-30%)

@include mobile 
  .new-messages-indicator
    bottom: 170px
</style>
