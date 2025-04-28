<template>
  <div class="new-messages-indicator" @click="$emit('click')">
    <IconArrow class="new-messages-arrow"/>
  </div>
</template>

<script setup>
import IconArrow from '~/components/Icons/IconArrow.vue';

defineEmits(['click']);
</script>

<style lang="sass" scoped>
@import '~/assets/styles/variables'

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
  
  .new-messages-arrow
      stroke: $white
      transform: rotate(90deg)

</style>
