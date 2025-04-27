<!-- components/VideoPlayer.vue -->
<template>
  <div class="video-player" :class="{ 'playing': isPlaying }">
    <!-- Video element -->
    <video
      ref="videoEl"
      :src="src"
      playsinline
      class="round-video"
      loading="lazy"
      preload="metadata"
      @timeupdate="updateProgress"
      @loadedmetadata="initProgress"
      @ended="handleVideoEnd"
      @play="handlePlay"
      @error="handleVideoError"
    >
      Ваш браузер не поддерживает видео
    </video>

    <!-- Progress ring for seeking -->
    <div class="progress-container">
      <svg class="progress-ring" width="100%" height="100%" viewBox="0 0 384 384">
        <!-- Background circle -->
        <circle
          class="progress-ring__circle-bg"
          stroke="#ffffff"
          stroke-width="6"
          fill="transparent"
          r="182"
          cx="192"
          cy="192"
        />
        <!-- Progress circle -->
        <circle
          ref="progressCircle"
          class="progress-ring__circle"
          stroke="#ffffff"
          stroke-width="6"
          fill="transparent"
          r="182"
          cx="192"
          cy="192"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="progressOffset"
          @mousedown="startDragging"
          @touchstart="startDragging"
          @click="rewindVideo"
        />
        <!-- Touch area for better interaction -->
        <circle
          class="progress-ring__touch-area"
          fill="transparent"
          r="192"
          cx="192"
          cy="192"
          @mousedown="startDragging"
          @touchstart="startDragging"
          @click="rewindVideo"
        />
      </svg>
    </div>

    <!-- Play/pause overlay -->
    <div class="play-pause-overlay" @click.stop="togglePlay">
      <div v-if="!isPlaying" class="pause-container">
        <IconPause class="play-icon" filled />
      </div>
    </div>
  </div>
</template>

<script setup>
import throttle from 'lodash/throttle';

// Props and emits
defineProps(['src']);
const emit = defineEmits(['update:time', 'update:playing', 'video-ended', 'update:rate']);

// Reactive state
const videoEl = ref(null);
const progressCircle = ref(null);
const isPlaying = ref(false);
const isDragging = ref(false);
const circumference = ref(2 * Math.PI * 182); // Circle circumference (r=182)
const progressOffset = ref(circumference.value); // Progress offset for SVG
const currentTime = ref(0);
let wasPlayingBeforeDrag = false; // Track play state during dragging

// Throttle progress updates to improve performance
const updateProgress = throttle(() => {
  if (videoEl.value && !isDragging.value) {
    const progress = videoEl.value.currentTime / videoEl.value.duration;
    progressOffset.value = circumference.value * (1 - progress);
    currentTime.value = Math.floor(videoEl.value.currentTime);
    emit('update:time', currentTime.value);
  }
}, 100);

// Initialize progress when video metadata is loaded
const initProgress = () => {
  if (!videoEl.value) return;
  progressOffset.value = circumference.value;
  currentTime.value = 0;
  emit('update:time', currentTime.value);
  emit('update:playing', false);

  // Emit playback rate if set
  if (videoEl.value.playbackRate !== 1) {
    emit('update:rate', videoEl.value.playbackRate);
  }
};

// Reset progress when video ends or is stopped
const resetProgress = () => {
  isPlaying.value = false;
  progressOffset.value = circumference.value;
  currentTime.value = 0;
  emit('update:time', currentTime.value);
  emit('update:playing', false);
};

// Handle video end event
const handleVideoEnd = () => {
  resetProgress();
  emit('video-ended');
};

// Handle video play event
const handlePlay = () => {
  isPlaying.value = true;
  emit('update:playing', true);
};

// Handle video errors
const handleVideoError = (event) => {
  console.error('Video error:', event.target.error?.message || 'Unknown error');
  isPlaying.value = false;
  emit('update:playing', false);
  emit('update:time', 0);
};

// Set playback rate
const setPlaybackRate = (rate) => {
  if (videoEl.value) {
    try {
      videoEl.value.playbackRate = rate;
    } catch (error) {
      console.error('Error setting playback rate:', error);
    }
  }
};

// Toggle play/pause
const togglePlay = () => {
  if (!videoEl.value) {
    console.error('Video element is not available');
    return;
  }

  if (isPlaying.value) {
    pauseVideo();
  } else {
    playVideo();
  }
};

// Play the video
const playVideo = () => {
  if (!videoEl.value) {
    console.error('Video element is not available');
    return Promise.reject(new Error('Video element not available'));
  }

  return videoEl.value.play().then(() => {
    isPlaying.value = true;
    emit('update:playing', true);
  }).catch((error) => {
    // Don't treat AbortError as critical since it's common during seeking
    if (error.name === 'AbortError') {
      // AbortError is expected during seeking operations
    } else {
      console.error('Ошибка воспроизведения:', error);
      isPlaying.value = false;
      emit('update:playing', false);
    }
    // Don't rethrow AbortError as it's expected during seeking operations
    if (error.name !== 'AbortError') {
      throw error;
    }
  });
};

// Pause the video
const pauseVideo = () => {
  if (!videoEl.value) {
    console.error('Video element is not available');
    return;
  }

  try {
    videoEl.value.pause();
    isPlaying.value = false;
    emit('update:playing', false);
  } catch (error) {
    console.error('Ошибка при паузе видео:', error);
    isPlaying.value = true;
    emit('update:playing', true);
  }
};

// Stop the video and reset
const stopVideo = () => {
  if (!videoEl.value) return;
  try {
    videoEl.value.pause();
    videoEl.value.currentTime = 0;
    isPlaying.value = false;
    emit('update:playing', false);
    resetProgress();
  } catch (error) {
    console.error('Error stopping video:', error);
  }
};

// Get event position for touch/mouse events
const getEventPosition = (event) => {
  const isTouch = event.type.startsWith('touch');
  return {
    x: isTouch ? event.touches[0].clientX : event.clientX,
    y: isTouch ? event.touches[0].clientY : event.clientY,
  };
};

// Rewind video based on click position on progress ring
const rewindVideo = (event) => {
  if (!videoEl.value || !progressCircle.value) return;

  const rect = progressCircle.value.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const { x: clientX, y: clientY } = getEventPosition(event);

  const dx = clientX - centerX;
  const dy = clientY - centerY;
  let angle = Math.atan2(dy, dx) + Math.PI / 2;
  if (angle < 0) angle += 2 * Math.PI;

  const progress = angle / (2 * Math.PI);
  const newTime = progress * videoEl.value.duration;
  
  videoEl.value.currentTime = newTime;
  progressOffset.value = circumference.value * (1 - progress);
  currentTime.value = Math.floor(newTime);
  emit('update:time', currentTime.value);
};

// Start dragging the progress ring
const startDragging = (event) => {
  isDragging.value = true;
  wasPlayingBeforeDrag = !videoEl.value.paused;
  if (!videoEl.value.paused) {
    videoEl.value.pause();
  }
  rewindVideo(event);
  window.addEventListener('mousemove', dragProgress);
  window.addEventListener('mouseup', stopDragging);
  window.addEventListener('touchmove', dragProgress);
  window.addEventListener('touchend', stopDragging);
};

// Drag the progress ring
const dragProgress = (event) => {
  if (isDragging.value) {
    event.preventDefault();
    rewindVideo(event);
  }
};

// Stop dragging the progress ring
const stopDragging = () => {
  if (isDragging.value) {
    isDragging.value = false;
    window.removeEventListener('mousemove', dragProgress);
    window.removeEventListener('mouseup', stopDragging);
    window.removeEventListener('touchmove', dragProgress);
    window.removeEventListener('touchend', stopDragging);
    
    setTimeout(() => {
      playVideo();
    }, 50);
  }
};

// Toggle video between play and pause states and return the new state
const toggleVideo = () => {
  if (!videoEl.value) {
    console.error('Video element is not available');
    return false;
  }

  const currentlyPaused = videoEl.value.paused;
  
  // Check if we're already in a transition state
  if ((currentlyPaused && isPlaying.value) || (!currentlyPaused && !isPlaying.value)) {
    return currentlyPaused ? false : true;
  }
  
  if (currentlyPaused) {
    playVideo();
    return true; // Return playing state
  } else {
    pauseVideo();
    return false; // Return paused state
  }
};

// Lifecycle hooks
onMounted(() => {
  if (!videoEl.value) {
    console.warn('Video element ref is not initialized on mount');
  }
});

// Expose methods for parent component
defineExpose({ playVideo, pauseVideo, setPlaybackRate, stopVideo, videoEl, toggleVideo });
</script>

<style lang="sass">
@import '~/assets/sass/variables'

.video-player
  position: relative
  padding: 0px 10px
  width: 100%
  touch-action: manipulation
  -webkit-user-select: none
  user-select: none
  &:focus, &:active, *:focus, *:active
    -webkit-tap-highlight-color: transparent

.round-video
  border-radius: 50%
  width: 100%
  height: auto
  aspect-ratio: 1
  object-fit: cover

.progress-container
  border-radius: 50%
  position: absolute
  top: 0
  left: 0
  width: 100%
  height: 100%
  touch-action: none

.progress-ring
  border-radius: 50%
  width: 100%
  height: 100%

.progress-ring__circle
  transition: stroke-dashoffset 0.25s linear
  transform: rotate(-90deg) translate(3px, 0px)
  transform-origin: 50% 50%
  pointer-events: auto
  cursor: pointer
  touch-action: pan-x pan-y

.progress-ring__circle-bg
  opacity: 0.3
  transform-origin: 50% 50%
  transform: rotate(-90deg) translate(3px, 0px)

.progress-ring__touch-area
  border-radius: 50%
  stroke-width: 40
  stroke: transparent
  pointer-events: auto
  cursor: pointer
  touch-action: pan-x pan-y

.play-pause-overlay
  position: absolute
  border-radius: 50%
  top: 5%
  left: 5%
  width: 90%
  height: 90%
  display: flex
  align-items: center
  justify-content: center
  cursor: pointer
  pointer-events: auto

.pause-container
  position: relative
  display: flex
  align-items: center
  justify-content: center
  width: 60px
  height: 60px
  border-radius: 50%
  background: rgba(0, 0, 0, 0.4)

.play-icon
  width: 40px
  height: 40px
  transform: translate(8%, 5%)
  z-index: 1

.playing .pause-container
  display: none

@include mobile
  .pause-container
    width: 50px
    height: 50px

  .play-icon
    width: 30px
    height: 30px

  .progress-ring__circle
    stroke-width: 8

  .progress-ring__circle-bg
    stroke-width: 8
</style>