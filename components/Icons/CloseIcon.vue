<template>
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2" 
    stroke-linecap="round" 
    stroke-linejoin="round"
    class="close-icon"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
</template>

<script>
export default {
  name: 'CloseIcon'
}
</script>

<style lang="sass" scoped>
.close-icon
  color: inherit
  transition: transform 0.2s ease
  
  &:hover
    transform: scale(1.1)
</style>
