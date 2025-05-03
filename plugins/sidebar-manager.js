// Плагин для управления состоянием боковой панели
import { ref, watch } from 'vue';

export default defineNuxtPlugin((nuxtApp) => {
  // Состояние видимости боковой панели
  const sidebarVisible = ref(false);
  
  // Функция для проверки, является ли устройство мобильным
  const isMobileDevice = () => {
    return window.innerWidth <= 859;
  };
  
  // Функция для показа боковой панели
  const showSidebar = () => {
    sidebarVisible.value = true;
    console.log('[SidebarManager] Показываем боковую панель');
  };
  
  // Функция для скрытия боковой панели
  const hideSidebar = () => {
    sidebarVisible.value = false;
    console.log('[SidebarManager] Скрываем боковую панель');
  };
  
  // Функция для переключения состояния боковой панели
  const toggleSidebar = () => {
    sidebarVisible.value = !sidebarVisible.value;
    console.log('[SidebarManager] Переключаем боковую панель:', sidebarVisible.value);
  };
  
  // Функция для проверки наличия активного чата и показа боковой панели при необходимости
  const checkActiveChatAndShowSidebar = () => {
    // Получаем ссылку на хранилище чата
    const chatStore = nuxtApp.$chatStore;
    
    if (!chatStore) {
      console.warn('[SidebarManager] Хранилище чата недоступно');
      return;
    }
    
    // Получаем текущий маршрут
    const route = useRoute();
    
    // Проверяем, находимся ли мы на странице мессенджера
    const isMessengerPage = route.path === '/messenger';
    
    // Проверяем, является ли устройство мобильным
    const isMobile = isMobileDevice();
    
    // Проверяем наличие активного чата
    const hasActiveChat = chatStore.activeChat !== null;
    
    console.log('[SidebarManager] Проверка состояния:', { 
      isMessengerPage, 
      isMobile, 
      hasActiveChat, 
      currentSidebarState: sidebarVisible.value 
    });
    
    // Если мы на странице мессенджера, на мобильном устройстве и нет активного чата
    if (isMessengerPage && isMobile && !hasActiveChat) {
      console.log('[SidebarManager] Нет активного чата на мобильном устройстве, показываем боковую панель');
      showSidebar();
    }
  };
  
  // Функция для проверки DOM-элемента чата
  const checkChatElementAndShowSidebar = () => {
    // Проверяем, является ли устройство мобильным
    const isMobile = isMobileDevice();
    if (!isMobile) return;
    
    // Получаем текущий маршрут
    const route = useRoute();
    
    // Проверяем, находимся ли мы на странице мессенджера
    const isMessengerPage = route.path === '/messenger';
    if (!isMessengerPage) return;
    
    // Проверяем наличие элемента с классом no-chat-selected
    const noChatSelectedElement = document.querySelector('.no-chat-selected');
    
    if (noChatSelectedElement) {
      console.log('[SidebarManager] Обнаружен элемент no-chat-selected, показываем боковую панель');
      showSidebar();
    }
  };
  
  // Функция для инициализации наблюдателей
  const initWatchers = (chatStore) => {
    // Следим за изменениями активного чата
    watch(() => chatStore.activeChat, (newActiveChat) => {
      // Если активный чат стал null, проверяем необходимость показа боковой панели
      if (!newActiveChat) {
        checkActiveChatAndShowSidebar();
      }
    });
    
    // Наблюдаем за DOM, чтобы обнаружить элемент no-chat-selected
    if (typeof window !== 'undefined' && window.MutationObserver) {
      const observer = new MutationObserver(() => {
        checkChatElementAndShowSidebar();
      });
      
      // Начинаем наблюдение за изменениями в DOM
      setTimeout(() => {
        const targetNode = document.body;
        if (targetNode) {
          observer.observe(targetNode, { childList: true, subtree: true });
          console.log('[SidebarManager] Наблюдатель за DOM инициализирован');
        }
      }, 1000); // Даем время для загрузки DOM
    }
  };
  
  // Инициализируем наблюдатели при монтировании приложения
  nuxtApp.hook('app:mounted', () => {
    console.log('[SidebarManager] Приложение смонтировано, инициализируем менеджер боковой панели');
    
    // Получаем хранилище чата
    const chatStore = useChatStore();
    
    // Сохраняем ссылку на хранилище чата в глобальном контексте
    nuxtApp.$chatStore = chatStore;
    
    // Инициализируем наблюдатели
    initWatchers(chatStore);
    
    // Выполняем первичную проверку
    setTimeout(() => {
      checkActiveChatAndShowSidebar();
      checkChatElementAndShowSidebar();
    }, 500);
  });
  
  // Возвращаем объект с методами и состоянием для глобального доступа
  return {
    provide: {
      sidebarVisible,
      showSidebar,
      hideSidebar,
      toggleSidebar,
      checkActiveChatAndShowSidebar
    }
  };
});
