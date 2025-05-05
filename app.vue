<template>
  <div class="pattern-container">
    <div class="app" :class="{ 'sidebar-visible': showSidebar, 'mobile': isMobile && needsSidebar, 'initial-load': isInitialLoad }">
      <MessengerSideBar v-if="isAuthenticated" :class="{ 'visible': showSidebar }"/>
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
    <!-- Компонент для глобальных уведомлений -->
    <UiNotification ref="notificationComponent" />
  </div>
</template>

<script setup>
import { storeToRefs } from 'pinia';
import { useChatStore } from '~/stores/chat';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const { isAuthenticated } = storeToRefs(authStore);
const route = useRoute();

// Получаем доступ к плагину управления боковой панелью
const nuxtApp = useNuxtApp();
const { $sidebarVisible } = nuxtApp;

// Флаг для отслеживания первой загрузки страницы
const isInitialLoad = ref(true);

// Проверяем, находимся ли мы на странице мессенджера или админа
const isMessengerPage = computed(() => route.path === '/messenger');
const isAdminPage = computed(() => route.path === '/admin');
const needsSidebar = computed(() => isMessengerPage.value || isAdminPage.value);

// Состояние видимости боковой панели
const sidebarVisibleState = computed(() => $sidebarVisible?.value || false);
const isMobile = ref(false);

// Получаем ссылку на хранилище чата
const chatStore = useChatStore();

// Вычисляемое свойство для определения, нужно ли показывать боковую панель
const showSidebar = computed(() => {
  const ignoreFlag = chatStore.ignoreActiveChatForSidebar;
  const sidebarState = sidebarVisibleState.value;
  const needsSidebarValue = needsSidebar.value;
  
  // Добавляем логирование для отладки
  console.log('[App] Расчет showSidebar:', { 
    ignoreFlag, 
    sidebarState, 
    needsSidebarValue,
    result: ignoreFlag ? sidebarState : (sidebarState && needsSidebarValue)
  });
  
  // Если флаг игнорирования активного чата установлен, всегда показываем боковую панель
  if (ignoreFlag) {
    return sidebarState;
  }
  
  // Иначе показываем боковую панель только если мы на странице мессенджера или админа
  return sidebarState && needsSidebarValue;
});

// Проверяем ширину экрана при загрузке и при изменении размера окна
const checkMobile = () => {
  const wasMobile = isMobile.value;
  isMobile.value = window.innerWidth <= 859;
  console.log('[App] Проверка мобильного устройства:', { isMobile: isMobile.value, wasMobile, needsSidebar: needsSidebar.value, path: route.path });
  
  // На мобильных устройствах первоначально показываем sidebar на страницах мессенжера и админа,
  // но только при первоначальной загрузке, а не при изменении размера окна
  if (isMobile.value && needsSidebar.value && !wasMobile) {
    // Используем setTimeout, чтобы дать время на отрисовку компонентов
    setTimeout(() => {
      // Используем метод из плагина sidebar-manager.js
      const { $showSidebar } = useNuxtApp();
      if ($showSidebar) $showSidebar();
      console.log('[App] Показываем SideBar после проверки мобильного устройства');
    }, 0);
  }
};

// Следим за изменением маршрута и состоянием аутентификации
watch(
  () => route.path,
  (newPath, oldPath) => {
    // Проверяем, что мы на странице мессенджера или админа
    const isMobileNow = isMobile.value;
    const comingFromDifferentPage = route.from && 
                                    (route.from.path !== '/messenger' && route.from.path !== '/admin');
    
    if (isMobileNow && comingFromDifferentPage) {
      // Используем nextTick вместо setTimeout для гарантии отрисовки
      nextTick(() => {
        const { $showSidebar } = useNuxtApp();
        if ($showSidebar) $showSidebar();
        console.log('[App] Показываем SideBar на мобильном устройстве при входе на страницу', 
                     { path: newPath, isMobile: isMobileNow, from: route.from?.path });
      });
    }
  },
  { immediate: true }
);

onMounted(() => {
  console.log('[App] Монтирование компонента');
  
  // Проверяем размер экрана при загрузке
  checkMobile();
  window.addEventListener('resize', checkMobile);
  
  // Вся логика проверки активного чата и наблюдения за DOM реализована в плагине sidebar-manager.js
  
  // Если мы на странице мессенджера или админа и на мобильном устройстве,
  // показываем SideBar только при первой загрузке страницы
  if (isAuthenticated.value && (route.path === '/messenger' || route.path === '/admin') && isMobile.value) {
    // Проверяем, что это первая загрузка страницы, а не возврат из чата
    const isInitialPageLoad = !sessionStorage.getItem('hasVisitedMessenger');
    
    if (isInitialPageLoad) {
      // Отмечаем, что пользователь уже посетил страницу мессенджера
      sessionStorage.setItem('hasVisitedMessenger', 'true');
      
      // Используем вложенные setTimeout для гарантии отрисовки
      setTimeout(() => {
        // Используем метод из плагина sidebar-manager.js
        const { $showSidebar } = useNuxtApp();
        if ($showSidebar) $showSidebar();
        console.log('[App] Показываем SideBar при первом монтировании', { path: route.path, isMobile: isMobile.value });
      }, 0);
    }
  }
  
  // Сбрасываем флаг isInitialLoad после небольшой задержки
  setTimeout(() => {
    isInitialLoad.value = false;
    console.log('[App] Сброс флага isInitialLoad');
  }, 500); // Достаточное время для загрузки без анимации
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});

// Используем методы из плагина sidebar-manager.js
// Все необходимые методы уже предоставлены через плагин

// Предоставляем информацию о мобильном режиме
provide('isMobile', isMobile);

// Используем методы из плагина sidebar-manager.js для управления боковой панелью
provide('showChat', () => {
  if (isMobile.value) {
    const { $hideSidebar } = useNuxtApp();
    if ($hideSidebar) $hideSidebar();
  }
});

provide('showSidebar', () => {
  if (isMobile.value) {
    const { $showSidebar } = useNuxtApp();
    if ($showSidebar) $showSidebar();
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
    // Отключаем анимацию при первой загрузке
    &.initial-load
      .main, .sidebar
        transition: none !important
      
    &.sidebar-visible
      .main
        transform: translateX(100%)
        // Добавляем важные стили
        overflow: hidden
        position: fixed
        width: 100%
        height: 100%
      
      // Явно показываем боковую панель
      .messenger-sidebar
        transform: translateX(0) !important
        display: block !important
    
    &:not(.sidebar-visible)
      .main
        transform: translateX(0)
      
      // Явно скрываем боковую панель
      .messenger-sidebar
        transform: translateX(-100%) !important

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

.page-transition-enter-active
  transition: opacity 0.2s ease-in

.page-transition-leave-active
  transition: opacity 0.2s ease-out

.page-transition-enter-from,
.page-transition-leave-to
  opacity: 0

// Стили для контейнера управления уведомлениями
.notification-control-container
  position: fixed
  bottom: 20px
  right: 20px
  z-index: 1000
  
  // На мобильных устройствах размещаем в другом месте
  @media (max-width: 859px)
    bottom: 70px
    right: 15px
</style>