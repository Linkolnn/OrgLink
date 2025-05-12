<template>
  <svg 
    :width="size" 
    :height="size" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    :stroke="color"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path 
      d="M6 9L12 15L18 9" 
      :fill="filled ? color : 'none'" 
      :stroke="color"
    />
  </svg>
</template>

<script setup>
const props = defineProps({
  size: {
    type: [Number, String],
    default: 24
  },
  color: {
    type: String,
    default: 'currentColor'
  },
  filled: {
    type: Boolean,
    default: false
  }
});
</script>
