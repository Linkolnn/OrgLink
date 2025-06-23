<!-- components/AudioPlayer.vue -->
<template>
  <div class="audio-player" :class="{ 'playing': isPlaying, 'loading': isLoading }">
    <!-- Audio element -->
    <audio
      ref="audioEl"
      :src="src"
      class="audio-element"
      preload="metadata"
      @timeupdate="updateProgress"
      @loadedmetadata="initProgress"
      @canplaythrough="handleCanPlayThrough"
      @ended="handleAudioEnd"
      @play="handlePlay"
      @error="handleAudioError"
      @loadstart="isLoading = true"
      @loadeddata="isLoading = false"
    ></audio>

    <!-- Play/pause button -->
    <div class="play-pause-button" @click.stop="togglePlay">
      <div v-if="isLoading" class="loading-icon">
        <div class="spinner"></div>
      </div>
      <div v-else-if="!isPlaying" class="play-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 3L19 12L5 21V3Z" fill="white"/>
        </svg>
      </div>
      <div v-else class="pause-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="4" width="4" height="16" fill="white"/>
          <rect x="14" y="4" width="4" height="16" fill="white"/>
        </svg>
      </div>
    </div>

    <!-- Визуализация аудио волны с функцией перемотки -->
    <div class="audio-wave-container">
      <div 
        ref="waveElement"
        class="audio-wave" 
        @click="handleWaveClick"
        @mousedown="startDrag"
        @touchstart.passive="startDrag"
      >
        <div 
          v-for="(bar, index) in 27" 
          :key="index" 
          class="wave-bar"
          :class="{ 
            'active': isPlaying && index % 2 === 0,
            'played': (index / 27) * 100 <= progressPercentage
          }"
          :style="{ 
            height: `${getRandomHeight(index)}px`,
            animationDelay: `${index * 0.05}s`
          }"
        ></div>
      </div>

      <!-- Отображение времени -->
      <div class="time-display">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue';

// Props and emits
const props = defineProps({
  src: {
    type: String,
    required: true
  }
});
const emit = defineEmits(['update:time', 'update:playing', 'audio-ended']);

// Reactive state
const audioEl = ref(null);
const waveElement = ref(null);
const isPlaying = ref(false);
const isLoading = ref(true);
const currentTime = ref(0);
const duration = ref(0);
const progressPercentage = ref(0);
const isAudioReady = ref(false);
const durationCheckAttempts = ref(0);
const maxDurationCheckAttempts = 10;
const isDragging = ref(false);
const isClick = ref(false);
const dragStartPosition = ref({ x: 0, y: 0 });
const hasError = ref(false);

// Форматирование времени (мм:сс)
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Генерация случайной высоты для полосок визуализации
const getRandomHeight = (index) => {
  // Создаем детерминированную, но случайную высоту для каждой полоски
  const baseHeight = 10; // Минимальная высота
  const maxAdditionalHeight = 15; // Максимальное дополнительное значение
  
  // Используем индекс для создания псевдослучайного числа
  const randomValue = Math.sin(index * 0.5) * 0.5 + 0.5; // Значение от 0 до 1
  
  return baseHeight + Math.floor(randomValue * maxAdditionalHeight);
};

// Обновление прогресса воспроизведения
const updateProgress = () => {
  if (audioEl.value && !isDragging.value) {
    currentTime.value = audioEl.value.currentTime;
    
    // Если длительность еще не установлена или некорректна, пробуем получить ее снова
    if (!duration.value || !isFinite(duration.value)) {
      const audioDuration = audioEl.value.duration;
      if (isFinite(audioDuration) && audioDuration > 0) {
        duration.value = audioDuration;
        console.log('Audio duration updated during playback:', duration.value);
      }
    }
    
    if (duration.value > 0 && isFinite(duration.value)) {
      progressPercentage.value = (currentTime.value / duration.value) * 100;
    } else {
      // Если длительность все еще некорректна, используем приближенное значение для прогресса
      // Предполагаем, что длительность около 30 секунд (стандартное голосовое сообщение)
      const estimatedDuration = 30;
      progressPercentage.value = (currentTime.value / estimatedDuration) * 100;
      
      // Если длительность еще не установлена, пробуем получить ее снова
      if (durationCheckAttempts.value === 0) {
        checkDuration();
      }
    }
    emit('update:time', currentTime.value);
  }
};

// Инициализация прогресса при загрузке метаданных аудио
const initProgress = () => {
  if (!audioEl.value) return;
  
  // Сбрасываем счетчик попыток
  durationCheckAttempts.value = 0;
  
  // Получаем длительность напрямую из аудиоэлемента и сразу устанавливаем ее
  const audioDuration = audioEl.value.duration;
  if (isFinite(audioDuration) && audioDuration > 0) {
    duration.value = audioDuration;
    console.log('Audio duration set immediately:', duration.value);
    isLoading.value = false;
  } else {
    // Если не удалось получить длительность сразу, запускаем проверку
    nextTick(() => {
      checkDuration();
    });
  }
  
  currentTime.value = 0;
  progressPercentage.value = 0;
  emit('update:time', currentTime.value);
  emit('update:playing', false);
  
  // Сбрасываем флаг ошибки
  hasError.value = false;
};

// Функция для проверки длительности с повторными попытками
const checkDuration = () => {
  if (!audioEl.value) return;
  
  // Если уже есть валидная длительность, не продолжаем
  if (duration.value > 0 && isFinite(duration.value)) {
    return;
  }
  
  // Увеличиваем счетчик попыток
  durationCheckAttempts.value++;
  
  try {
    // Пробуем получить длительность
    const audioDuration = audioEl.value.duration;
    
    if (isFinite(audioDuration) && audioDuration > 0) {
      // Успешно получили длительность
      duration.value = audioDuration;
      console.log(`[Attempt ${durationCheckAttempts.value}] Audio duration set:`, duration.value);
      isLoading.value = false;
    } else {
      console.warn(`[Attempt ${durationCheckAttempts.value}] Invalid audio duration:`, audioDuration);
      
      // Пробуем загрузить аудио еще раз
      if (durationCheckAttempts.value === 3) {
        console.log('Trying to reload audio...');
        if (audioEl.value) {
          // Пробуем предзагрузить метаданные принудительно
          audioEl.value.preload = "metadata";
          audioEl.value.load();
        }
      }
      
      // Пробуем через XHR запрос получить длительность, если обычные методы не работают
      if (durationCheckAttempts.value === 5) {
        fetchAudioDuration(props.src);
      }
      
      // Если не достигли максимального числа попыток, пробуем снова через некоторое время
      if (durationCheckAttempts.value < maxDurationCheckAttempts) {
        setTimeout(() => {
          checkDuration();
        }, 300 * durationCheckAttempts.value); // Увеличиваем интервал с каждой попыткой
      } else {
        console.error('Failed to get valid audio duration after multiple attempts');
        // Устанавливаем фиксированную длительность как запасной вариант
        duration.value = 30; // 30 секунд как стандартная длительность для голосовых сообщений
        isLoading.value = false;
      }
    }
  } catch (error) {
    console.error('Error checking audio duration:', error);
    
    // В случае ошибки также пробуем еще раз, если не достигли максимального числа попыток
    if (durationCheckAttempts.value < maxDurationCheckAttempts) {
      setTimeout(() => {
        checkDuration();
      }, 300 * durationCheckAttempts.value);
    } else {
      // Устанавливаем фиксированную длительность как запасной вариант
      duration.value = 30;
      isLoading.value = false;
    }
  }
};

// Функция для получения длительности аудио через XHR запрос
const fetchAudioDuration = (url) => {
  console.log('Fetching audio duration via XHR:', url);
  
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'blob';
  
  xhr.onload = function() {
    if (xhr.status === 200) {
      const blob = xhr.response;
      const audioURL = URL.createObjectURL(blob);
      
      const tempAudio = new Audio();
      tempAudio.addEventListener('loadedmetadata', function() {
        const audioDuration = tempAudio.duration;
        if (isFinite(audioDuration) && audioDuration > 0) {
          duration.value = audioDuration;
          console.log('Audio duration fetched via XHR:', duration.value);
          URL.revokeObjectURL(audioURL);
        }
      });
      
      tempAudio.src = audioURL;
    }
  };
  
  xhr.onerror = function() {
    console.error('XHR request failed to fetch audio duration');
  };
  
  xhr.send();
};

// Обработчик события canplaythrough
const handleCanPlayThrough = () => {
  isAudioReady.value = true;
  isLoading.value = false;
  
  // Повторно проверяем длительность, если она не была установлена ранее
  if (duration.value <= 0 || !isFinite(duration.value)) {
    // Пробуем получить длительность напрямую
    const audioDuration = audioEl.value.duration;
    if (isFinite(audioDuration) && audioDuration > 0) {
      duration.value = audioDuration;
      console.log('Audio duration set from canplaythrough event:', duration.value);
    } else {
    checkDuration();
    }
  }
};

// Обработка окончания воспроизведения
const handleAudioEnd = () => {
  isPlaying.value = false;
  currentTime.value = 0;
  progressPercentage.value = 0;
  emit('update:time', currentTime.value);
  emit('update:playing', false);
  emit('audio-ended');
};

// Обработка начала воспроизведения
const handlePlay = () => {
  isPlaying.value = true;
  isLoading.value = false;
  emit('update:playing', true);
  
  // Если длительность еще не установлена, пробуем получить ее снова
  if (duration.value <= 0 || !isFinite(duration.value)) {
    checkDuration();
  }
};

// Обработка ошибок аудио
const handleAudioError = (event) => {
  console.error('Audio error:', event.target.error?.message || 'Unknown error');
  isPlaying.value = false;
  isLoading.value = false;
  hasError.value = true;
  emit('update:playing', false);
  emit('update:time', 0);
  
  // Пробуем перезагрузить аудио после небольшой задержки
  setTimeout(() => {
    if (audioEl.value) {
      audioEl.value.load();
    }
  }, 1000);
};

// Переключение воспроизведения/паузы
const togglePlay = () => {
  // Если аудио загружается, не делаем ничего
  if (isLoading.value) return;
  
  if (!audioEl.value) {
    console.error('Audio element is not available');
    return;
  }

  if (isPlaying.value) {
    pauseAudio();
  } else {
    playAudio();
  }
};

// Воспроизведение аудио
const playAudio = () => {
  if (!audioEl.value) {
    console.error('Audio element is not available');
    return Promise.reject(new Error('Audio element not available'));
  }
  
  // Если была ошибка, пробуем перезагрузить аудио
  if (hasError.value) {
    audioEl.value.load();
    hasError.value = false;
  }

  // Если длительность еще не установлена, пробуем получить ее снова
  if (duration.value <= 0 || !isFinite(duration.value)) {
    checkDuration();
  }
  
  // Устанавливаем флаг загрузки
  isLoading.value = true;

  return audioEl.value.play().then(() => {
    isPlaying.value = true;
    isLoading.value = false;
    emit('update:playing', true);
  }).catch((error) => {
    console.error('Ошибка воспроизведения:', error);
    isPlaying.value = false;
    isLoading.value = false;
    emit('update:playing', false);
    
    if (error.name !== 'AbortError') {
      hasError.value = true;
      throw error;
    }
  });
};

// Пауза аудио
const pauseAudio = () => {
  if (!audioEl.value) {
    console.error('Audio element is not available');
    return;
  }

  try {
    audioEl.value.pause();
    isPlaying.value = false;
    emit('update:playing', false);
  } catch (error) {
    console.error('Ошибка при паузе аудио:', error);
  }
};

// Обработчик клика по волне
const handleWaveClick = (event) => {
  // Если это был клик (а не часть перетаскивания), то перематываем
  if (isClick.value) {
    seekAudio(event);
  }
  isClick.value = false;
};

// Перемотка аудио по клику на аудио-волну
const seekAudio = (event) => {
  try {
    // Если аудио загружается, не делаем ничего
    if (isLoading.value) return;
    
    if (!audioEl.value) {
      console.warn('Audio element not available for seeking');
      return;
    }
    
    // Если длительность не установлена или некорректна, не выполняем перемотку
    if (duration.value <= 0 || !isFinite(duration.value)) {
      console.warn('Cannot seek: invalid duration', duration.value);
      return;
    }
    
    // Проверяем, что аудио готово к воспроизведению
    if (audioEl.value.readyState === 0) {
      console.warn('Audio not ready for seeking');
      return;
    }
    
    const rect = event.currentTarget.getBoundingClientRect();
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    
    if (!clientX) {
      console.warn('Cannot determine click position');
      return;
    }
    
    const clickPosition = (clientX - rect.left) / rect.width;
    
    // Проверяем, что clickPosition находится в допустимом диапазоне
    if (clickPosition < 0 || clickPosition > 1 || !isFinite(clickPosition)) {
      console.error('Invalid click position:', clickPosition);
      return;
    }
    
    // Вычисляем новое время и проверяем его
    const newTime = clickPosition * duration.value;
    if (!isFinite(newTime) || newTime < 0) {
      console.error('Invalid new time value:', newTime);
      return;
    }
    
    // Ограничиваем время в пределах длительности
    const clampedTime = Math.min(Math.max(0, newTime), duration.value);
    
    // Устанавливаем новое время воспроизведения
    audioEl.value.currentTime = clampedTime;
    
    // Обновляем прогресс
    currentTime.value = clampedTime;
    progressPercentage.value = (clampedTime / duration.value) * 100;
    emit('update:time', currentTime.value);
  } catch (error) {
    console.error('Error during audio seeking:', error);
  }
};

// Функции для перетаскивания (drag)
const startDrag = (event) => {
  // Если аудио загружается, не делаем ничего
  if (isLoading.value) return;
  
  if (!audioEl.value || (duration.value <= 0 || !isFinite(duration.value))) {
    return;
  }
  
  // Сохраняем начальную позицию для определения клика
  dragStartPosition.value = {
    x: event.clientX || (event.touches && event.touches[0].clientX) || 0,
    y: event.clientY || (event.touches && event.touches[0].clientY) || 0
  };
  
  // Устанавливаем флаг возможного клика
  isClick.value = true;
  
  // Устанавливаем флаг перетаскивания
  isDragging.value = true;
  
  // Добавляем обработчики событий
  if (event.type === 'mousedown') {
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
  } else if (event.type === 'touchstart') {
    document.addEventListener('touchmove', handleDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
    document.addEventListener('touchcancel', stopDrag);
  }
};

const handleDrag = (event) => {
  if (!isDragging.value || !audioEl.value) return;
  
  // Предотвращаем стандартное поведение браузера при перетаскивании только если событие можно отменить
  if (event.cancelable) {
    event.preventDefault();
  }
  
  // Определяем текущую позицию
  const currentX = event.clientX || (event.touches && event.touches[0].clientX) || 0;
  const currentY = event.clientY || (event.touches && event.touches[0].clientY) || 0;
  
  // Проверяем, был ли это клик или перетаскивание
  const deltaX = Math.abs(currentX - dragStartPosition.value.x);
  const deltaY = Math.abs(currentY - dragStartPosition.value.y);
  
  // Если перемещение больше порогового значения, считаем это перетаскиванием, а не кликом
  if (deltaX > 5 || deltaY > 5) {
    isClick.value = false;
  }
  
  if (!waveElement.value) return;
  
  const rect = waveElement.value.getBoundingClientRect();
  
  // Вычисляем позицию перетаскивания
  let dragPosition = (currentX - rect.left) / rect.width;
  
  // Ограничиваем позицию в пределах от 0 до 1
  dragPosition = Math.min(Math.max(0, dragPosition), 1);
  
  // Вычисляем новое время
  const newTime = dragPosition * duration.value;
  
  // Обновляем прогресс
  currentTime.value = newTime;
  progressPercentage.value = (newTime / duration.value) * 100;
  
  // Устанавливаем новое время воспроизведения
  audioEl.value.currentTime = newTime;
  
  // Отправляем событие обновления времени
  emit('update:time', currentTime.value);
};

const stopDrag = (event) => {
  if (!isDragging.value) return;
  
  // Сбрасываем флаг перетаскивания
  isDragging.value = false;
  
  // Удаляем обработчики событий
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', handleDrag);
  document.removeEventListener('touchend', stopDrag);
  document.removeEventListener('touchcancel', stopDrag);
};

// Наблюдаем за изменением src и сбрасываем состояние при его изменении
watch(() => props.src, (newSrc, oldSrc) => {
  if (newSrc !== oldSrc) {
    // Сбрасываем состояние при изменении источника
    isPlaying.value = false;
    currentTime.value = 0;
    progressPercentage.value = 0;
    isAudioReady.value = false;
    durationCheckAttempts.value = 0;
    duration.value = 0;
    isLoading.value = true;
    hasError.value = false;
    
    // Если аудио элемент уже существует, сбрасываем его состояние
    if (audioEl.value) {
      audioEl.value.pause();
      audioEl.value.currentTime = 0;
      
      // Запускаем проверку длительности после небольшой задержки
      setTimeout(() => {
        checkDuration();
      }, 300);
    }
  }
});

// Lifecycle hooks
onMounted(() => {
  if (!audioEl.value) {
    console.warn('Audio element ref is not initialized on mount');
  } else {
    // Устанавливаем обработчики событий для лучшей обработки аудио
    audioEl.value.addEventListener('durationchange', () => {
      const audioDuration = audioEl.value.duration;
      if (isFinite(audioDuration) && audioDuration > 0) {
        duration.value = audioDuration;
        console.log('Duration changed:', duration.value);
      }
    });
    
    // Загружаем метаданные принудительно
    audioEl.value.preload = "metadata";
    
    // Запускаем проверку длительности после монтирования
    setTimeout(() => {
      // Пробуем получить длительность напрямую
      const audioDuration = audioEl.value.duration;
      if (isFinite(audioDuration) && audioDuration > 0) {
        duration.value = audioDuration;
        console.log('Audio duration set from mount timeout:', duration.value);
      } else {
      checkDuration();
      }
    }, 300);
  }
});

// Удаляем обработчики событий при размонтировании компонента
onUnmounted(() => {
  stopDrag();
});

// Expose methods for parent component
defineExpose({ playAudio, pauseAudio, audioEl });
</script>

<style lang="sass">
@import '~/assets/styles/variables'

.audio-player
  position: relative
  width: 100%
  background-color: rgba(0, 0, 0, 0.2)
  border-radius: 15px
  padding: 15px 15px 15px 60px
  display: flex
  flex-direction: column
  
  &.loading
    .wave-bar
      opacity: 0.5

.audio-element
  display: none

.audio-wave-container
  display: flex
  flex-direction: column
  width: 100%

.audio-wave
  display: flex
  align-items: center
  justify-content: space-between
  height: 40px
  margin-bottom: 5px
  gap: 2px
  cursor: pointer
  position: relative
  touch-action: none // Предотвращает стандартное поведение браузера при касании

.wave-bar
  flex: 1
  width: 3px
  background-color: rgba(255, 255, 255, 0.5)
  border-radius: 1px
  transition: height 0.2s ease, background-color 0.2s ease
  position: relative
  z-index: 2

  &.active
    animation: pulse 0.5s infinite alternate
  
  &.played
    background-color: $purple

@keyframes pulse
  0%
    opacity: 0.6
    height: 15px
  100%
    opacity: 1
    height: 25px

.time-display
  font-size: 12px
  color: rgba(255, 255, 255, 0.7)

.play-pause-button
  position: absolute
  top: 15px
  left: 15px
  width: 36px
  height: 36px
  border-radius: 50%
  background-color: $purple
  display: flex
  align-items: center
  justify-content: center
  cursor: pointer
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2)

  .play-icon, .pause-icon, .loading-icon
    display: flex
    align-items: center
    justify-content: center

  .play-icon svg
    margin-left: 2px
    
  .loading-icon .spinner
    width: 20px
    height: 20px
    border: 2px solid rgba(255, 255, 255, 0.3)
    border-radius: 50%
    border-top-color: white
    animation: spin 1s linear infinite

@keyframes spin
  0%
    transform: rotate(0deg)
  100%
    transform: rotate(360deg)

@include mobile
  .audio-player
    max-width: none
</style> 