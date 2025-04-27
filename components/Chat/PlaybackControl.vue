<!-- components/PlaybackControl.vue -->
<template>
  <div class="playback_control" :class="{ 'active': isActive }">
    <div class="playback_control__content">
      <div class="playback_control__user">
        {{ username }}
      </div>
      <div class="playback_control__actions">
        <div
          class="playback_control__speed"
          :class="{
            'speed-1': currentSpeed === '1',
            'speed-1-5': currentSpeed === '1.5',
            'speed-2': currentSpeed === '2',
          }"
          @click="toggleSpeed"
        >
          {{ currentSpeed }}x
        </div>
        <div class="playback_control__stop" @click="$emit('stop')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 3.5L3.5 12.5" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <path d="M3.5 3.5L12.5 12.5" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps(['isActive', 'username', 'currentSpeed', 'availableSpeeds'])

const emit = defineEmits(['update:speed', 'stop']);

const toggleSpeed = () => {
  const currentIndex = props.availableSpeeds.indexOf(props.currentSpeed);
  const nextIndex = (currentIndex + 1) % props.availableSpeeds.length;
  const nextSpeed = props.availableSpeeds[nextIndex];
  emit('update:speed', nextSpeed);
};
</script>

<style lang="sass">
@import '~/assets/styles/variables'

.playback_control
  border-top: 2px solid $purple
  position: fixed
  top: -50px
  left: 0
  width: 100%
  background-color: $header-bg
  padding: 10px 40px
  z-index: 9
  transition: transform 0.4s ease

  &.active
    transform: translateY(120px)

  &__content
    display: flex
    justify-content: space-between
    align-items: center

  &__user
    color: $white
    font-weight: 500

  &__actions
    display: flex
    gap: 15px
    align-items: center

  &__speed
    color: $white
    cursor: pointer
    font-weight: 500
    padding: 4px 8px
    border-radius: 10px
    transition: all 0.2s ease

    &.speed-1
      background: rgba(255, 255, 255, 0.1) 

    &.speed-1-5
      background: $purple

    &.speed-2
      background: $purple

  &__stop
    cursor: pointer
    width: 24px
    height: 24px
    display: flex
    align-items: center
    justify-content: center

    svg
      width: 16px
      height: 16px

@include mobile
  .playback_control
    padding: 10px 25px
</style> 