<template>
  <div class="pattern-container">
    <div class="app" :class="{ 'sidebar-visible': sidebarVisible && isMessengerPage, 'mobile': isMobile && isMessengerPage }">
      <MessengerSideBar v-if="isAuthenticated" :class="{ 'visible': sidebarVisible }"/>
      <main class="main container">
        <NuxtPage />
      </main>
    </div>
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const { isAuthenticated } = storeToRefs(authStore);
const route = useRoute();

// Проверяем, находимся ли мы на странице мессенджера
const isMessengerPage = computed(() => route.path === '/messenger');

// Состояние видимости боковой панели
// На мобильных устройствах первоначально показываем sidebar
const isMobile = ref(false);
const sidebarVisible = ref(false);

// Проверяем ширину экрана при загрузке и при изменении размера окна
const checkMobile = () => {
  const wasMobile = isMobile.value;
  isMobile.value = window.innerWidth <= 859;
  
  // На мобильных устройствах первоначально показываем sidebar только на странице мессенджера
  if (isMobile.value && !wasMobile && isMessengerPage.value) {
    sidebarVisible.value = true;
  }
};

// Следим за изменением маршрута
watch(() => route?.path, (newPath) => {
  // Если перешли на страницу мессенджера и на мобильном устройстве
  if (newPath === '/messenger' && isMobile.value) {
    sidebarVisible.value = true;
  }
}, { immediate: true });

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});

// Создаем provide для доступа из других компонентов
provide('sidebarVisible', sidebarVisible);
provide('toggleSidebar', () => {
  sidebarVisible.value = !sidebarVisible.value;
});

// Предоставляем информацию о мобильном режиме
provide('isMobile', isMobile);
provide('showChat', () => {
  if (isMobile.value) {
    sidebarVisible.value = false;
  }
});
provide('showSidebar', () => {
  if (isMobile.value) {
    sidebarVisible.value = true;
  }
});
</script>
<style lang="sass">
@import '@variables'

*
  margin: 0
  padding: 0
  box-sizing: border-box
  font-family: "Roboto", -apple-system, BlinkMacSystemFont, "Apple Color Emoji", "Segoe UI", Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif
  touch-action: manipulation
  -webkit-user-select: none
  user-select: none
  &:focus, &:active, *:focus, *:active
    -webkit-tap-highlight-color: transparent

// Контейнер для паттерна
.pattern-container
  position: fixed
  top: 0
  left: 0
  width: 100vw
  height: 100vh
  z-index: -1
  overflow: hidden
  
  &::before
    content: ''
    position: absolute
    top: 0
    left: 0
    width: 100%
    height: 100%
    background-color: $primary-bg
    z-index: -2
  
  &::after
    content: ''
    position: absolute
    top: 0
    left: 0
    width: 100%
    height: 100%
    background-image: url("https://web.telegram.org/a/chat-bg-pattern-dark.ad38368a9e8140d0ac7d.png")
    background-repeat: repeat
    background-size: 510px auto

.app
  display: flex
  position: relative
  overflow: hidden
  height: 100vh
  width: 100vw
  background: transparent
  z-index: 1
  
  // Адаптивный дизайн для мобильных устройств
  &.mobile
    &.sidebar-visible
      .main
        transform: translateX(100%)
    
    &:not(.sidebar-visible)
      .main
        transform: translateX(0)

.main
  flex: 1
  transition: transform $transition-speed $transition-function
  width: 100%
  
  @include tablet
    position: absolute
    left: 0
    top: 0
    height: 100%
    z-index: 10
</style>