<template>
  <div class="pattern-container">
    <div class="app" :class="{ 'sidebar-visible': sidebarVisible && needsSidebar, 'mobile': isMobile && needsSidebar }">
      <MessengerSideBar v-if="isAuthenticated" :class="{ 'visible': sidebarVisible }"/>
      <main class="main container">
        <NuxtPage>
          <template #default="{ Component }">
            <transition name="page-transition" mode="out-in">
              <component :is="Component" />
            </transition>
          </template>
        </NuxtPage>
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

// Проверяем, находимся ли мы на странице мессенджера или админа
const isMessengerPage = computed(() => route.path === '/messenger');
const isAdminPage = computed(() => route.path === '/admin');
const needsSidebar = computed(() => isMessengerPage.value || isAdminPage.value);

// Состояние видимости боковой панели
// На мобильных устройствах первоначально показываем sidebar
const isMobile = ref(false);
const sidebarVisible = ref(false);

// Проверяем ширину экрана при загрузке и при изменении размера окна
const checkMobile = () => {
  const wasMobile = isMobile.value;
  isMobile.value = window.innerWidth <= 859;
  console.log('[App] Проверка мобильного устройства:', { isMobile: isMobile.value, wasMobile, needsSidebar: needsSidebar.value, path: route.path });
  
  // На мобильных устройствах первоначально показываем sidebar на страницах мессенжера и админа
  if (isMobile.value && needsSidebar.value) {
    // Используем setTimeout, чтобы дать время на отрисовку компонентов
    setTimeout(() => {
      sidebarVisible.value = true;
      console.log('[App] Показываем SideBar после проверки мобильного устройства');
    }, 0);
  }
};

// Следим за изменением маршрута и состоянием аутентификации
watch(
  [() => route?.path, () => isAuthenticated.value],
  ([newPath, isAuth]) => {
    console.log('[App] Изменение маршрута или состояния аутентификации:', { path: newPath, isAuth });
    
    // Если пользователь аутентифицирован и находится на странице мессенжера или админа
    if (isAuth && (newPath === '/messenger' || newPath === '/admin')) {
      // Проверяем ширину экрана
      const isMobileNow = window.innerWidth <= 859;
      isMobile.value = isMobileNow;
      
      // На мобильных устройствах показываем sidebar
      if (isMobileNow) {
        // Используем nextTick вместо setTimeout для гарантии отрисовки
        nextTick(() => {
          sidebarVisible.value = true;
          console.log('[App] Показываем SideBar на мобильном устройстве', { path: newPath, isMobile: isMobileNow });
        });
      }
    }
  },
  { immediate: true }
);

onMounted(() => {
  console.log('[App] Монтирование компонента');
  
  // Проверяем размер экрана при загрузке
  checkMobile();
  window.addEventListener('resize', checkMobile);
  
  // Делаем состояние видимости боковой панели доступным глобально
  const nuxtApp = useNuxtApp();
  nuxtApp.$sidebarVisible = sidebarVisible;
  
  // Следим за изменениями глобального состояния
  watch(() => nuxtApp.$sidebarVisible.value, (newValue) => {
    sidebarVisible.value = newValue;
  });
  
  // Если мы на странице мессенжера или админа и на мобильном устройстве
  if (isAuthenticated.value && (route.path === '/messenger' || route.path === '/admin') && isMobile.value) {
    // Используем вложенные setTimeout для гарантии отрисовки
    setTimeout(() => {
      sidebarVisible.value = true;
      console.log('[App] Показываем SideBar при монтировании', { path: route.path, isMobile: isMobile.value });
    }, 50);
  }
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
    background-image: url("/assets/img/pattern.png")
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

// Плавный переход между страницами
.page-transition-enter-active,
.page-transition-leave-active
  transition: opacity 0.3s ease, transform 0.3s ease

.page-transition-enter-from
  opacity: 0
  transform: translateX(20px)

.page-transition-leave-to
  opacity: 0
  transform: translateX(-20px)
  
  @include tablet
    position: absolute
    left: 0
    top: 0
    height: 100%
    z-index: 10
</style>