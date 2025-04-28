<template>
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    :width="width" 
    :height="height" 
    viewBox="0 0 24 24" 
    :fill="filled ? 'currentColor' : 'none'" 
    stroke="currentColor" 
    stroke-width="2" 
    stroke-linecap="round" 
    stroke-linejoin="round"
  >
    <path d="M12 5l7 7-7 7"></path>
  </svg>
</template>

<script setup>
const props = defineProps({
  width: {
    type: [Number, String],
    default: 24
  },
  height: {
    type: [Number, String],
    default: 24
  },
  filled: {
    type: Boolean,
    default: false
  }
});
</script>
