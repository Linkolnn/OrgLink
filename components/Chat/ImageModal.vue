<template>
  <div v-if="isVisible" class="image-modal" @click="closeModal">
    <div class="image-modal__content" @click.stop>
      <button class="image-modal__close" @click="closeModal">
        <i class="fas fa-times"></i>
      </button>
      <img :src="imageUrl" alt="Просмотр изображения" class="image-modal__image" />
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  imageUrl: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close']);

const closeModal = () => {
  emit('close');
};
</script>

<style lang="sass">
@import '@variables'

.image-modal
  position: fixed
  top: 0
  left: 0
  width: 100%
  height: 100%
  background-color: rgba(0, 0, 0, 0.85)
  display: flex
  align-items: center
  justify-content: center
  z-index: 1000
  animation: fadeIn 0.2s ease
  
  &__content
    position: relative
    max-width: 90%
    max-height: 90%
    animation: scaleIn 0.2s ease
  
  &__close
    position: absolute
    top: -40px
    right: 0
    background: none
    border: none
    color: white
    font-size: 24px
    cursor: pointer
    padding: 8px
    z-index: 1001
    
    &:hover
      color: $purple
  
  &__image
    max-width: 100%
    max-height: 80vh
    object-fit: contain
    border-radius: 4px
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3)

@keyframes fadeIn
  from
    opacity: 0
  to
    opacity: 1

@keyframes scaleIn
  from
    transform: scale(0.95)
  to
    transform: scale(1)
</style>
