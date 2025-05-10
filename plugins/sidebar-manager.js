// Плагин для управления состоянием боковой панели
import { ref, watch } from 'vue';
import { useChatStore } from '~/stores/chat';

// Создаем глобальное состояние для сайдбара
const globalSidebarVisible = ref(true);

export default defineNuxtPlugin((nuxtApp) => {
  // Используем глобальное состояние видимости боковой панели
  const sidebarVisible = globalSidebarVisible;
  
  // Флаг для игнорирования активного чата при определении видимости боковой панели
  const ignoreActiveChatForSidebar = ref(false);
  
  // Функция для проверки, является ли устройство мобильным
  // Мобильная версия начинается от 859px
  const isMobileDevice = () => {
    return process.client && window.innerWidth <= 859;
  };
  
  // Функция для обновления классов в DOM
  const updateDOMClasses = () => {
    if (!process.client) return;
    
    setTimeout(() => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        if (sidebarVisible.value) {
          sidebar.classList.add('visible');
          sidebar.style.transform = '';
          console.log('[SidebarManager] Добавлен класс visible к .sidebar');
        } else {
          sidebar.classList.remove('visible');
          sidebar.style.transform = 'translateX(-100%)';
          console.log('[SidebarManager] Удален класс visible у .sidebar');
        }
      }
      
      // Обновляем класс sidebar-visible у приложения
      const app = document.querySelector('.app');
      if (app) {
        if (sidebarVisible.value) {
          app.classList.add('sidebar-visible');
          console.log('[SidebarManager] Добавлен класс sidebar-visible к .app');
        } else {
          app.classList.remove('sidebar-visible');
          console.log('[SidebarManager] Удален класс sidebar-visible у .app');
        }
      }
    }, 50);
  };
  
  // Функция для показа боковой панели
  const showSidebar = () => {
    sidebarVisible.value = true;
    console.log('[SidebarManager] Показываем боковую панель');
    updateDOMClasses();
  };
  
  // Функция для скрытия боковой панели
  const hideSidebar = () => {
    sidebarVisible.value = false;
    console.log('[SidebarManager] Скрываем боковую панель');
    updateDOMClasses();
  };
  
  // Функция для переключения состояния боковой панели
  const toggleSidebar = (value) => {
    if (value !== undefined) {
      sidebarVisible.value = value;
    } else {
      sidebarVisible.value = !sidebarVisible.value;
    }
    
    console.log('[SidebarManager] Переключаем боковую панель:', sidebarVisible.value);
    updateDOMClasses();
    return sidebarVisible.value;
  };
  
  // Функция для проверки наличия активного чата и показа боковой панели при необходимости
  const checkActiveChatAndShowSidebar = () => {
    // Получаем ссылку на хранилище чата
    const chatStore = useChatStore();
    
    if (!chatStore) {
      console.warn('[SidebarManager] Хранилище чата недоступно');
      return;
    }
    
    // Получаем текущий маршрут
    const route = useRoute();
    
    // Проверяем, находимся ли мы на странице мессенджера или админ-панели
    const isMessengerPage = route.path === '/messenger';
    const isAdminPage = route.path === '/admin';
    
    // Проверяем, является ли устройство мобильным
    const isMobile = isMobileDevice();
    
    // Проверяем, есть ли активный чат
    const hasActiveChat = chatStore.activeChat !== null;
    
    console.log('[SidebarManager] Проверка активного чата:', { 
      hasActiveChat, 
      isMessengerPage,
      isAdminPage, 
      isMobile,
      ignoreActiveChatForSidebar: ignoreActiveChatForSidebar.value
    });
    
    // Проверяем, находимся ли мы на странице мессенджера или админ-панели и на мобильном устройстве
    if ((isMessengerPage || isAdminPage) && isMobile) {
      // Для страницы мессенджера проверяем наличие активного чата
      if (isMessengerPage && hasActiveChat && !ignoreActiveChatForSidebar.value) {
        // Скрываем боковую панель
        hideSidebar();
        console.log('[SidebarManager] Скрываем боковую панель, так как есть активный чат');
      } else if (isAdminPage) {
        // Для админ-панели проверяем, выбран ли пользователь
        // Проверяем, есть ли выбранный пользователь в админ-панели
        const selectedUserElement = document.querySelector('.admin-panel__section-title');
        if (selectedUserElement && selectedUserElement.textContent.includes('Чаты пользователя:')) {
          // Если выбран пользователь, скрываем боковую панель
          hideSidebar();
          console.log('[SidebarManager] Скрываем боковую панель, так как выбран пользователь в админ-панели');
        } else {
          // Если пользователь не выбран, показываем боковую панель
          showSidebar();
          console.log('[SidebarManager] Показываем боковую панель, так как пользователь не выбран в админ-панели');
        }
      } else {
        // Показываем боковую панель
        showSidebar();
        console.log('[SidebarManager] Показываем боковую панель, так как нет активного чата или установлен флаг игнорирования');
      }
    }
  };
  
  // Функция для проверки наличия элемента no-chat-selected и показа боковой панели при необходимости
  const checkChatElementAndShowSidebar = () => {
    if (!process.client) return;
    
    // Проверяем, есть ли элемент no-chat-selected
    const noChatSelected = document.querySelector('.no-chat-selected');
    
    if (noChatSelected) {
      console.log('[SidebarManager] Обнаружен элемент no-chat-selected, показываем боковую панель');
      showSidebar();
    }
  };
  
  // Инициализация боковой панели на мобильных устройствах
  const initMobileSidebar = () => {
    if (!process.client) return;
    
    // Проверяем, является ли устройство мобильным
    const isMobile = isMobileDevice();
    
    if (isMobile) {
      console.log('[SidebarManager] Инициализация боковой панели на мобильном устройстве');
      
      // Показываем боковую панель по умолчанию
      showSidebar();
    }
  };
  
  // Инициализация наблюдателей за изменениями в хранилище чата
  const initWatchers = (chatStore) => {
    // Наблюдаем за изменениями активного чата
    watch(() => chatStore.activeChat, (newActiveChat) => {
      console.log('[SidebarManager] Изменился активный чат:', newActiveChat?._id);
      
      // Проверяем наличие активного чата и показываем/скрываем боковую панель при необходимости
      checkActiveChatAndShowSidebar();
    });
  };
  
  // Инициализируем слушателей и наблюдателей
  if (process.client) {
    // Инициализируем боковую панель на мобильных устройствах
    initMobileSidebar();
    
    nuxtApp.hook('app:mounted', () => {
      console.log('[SidebarManager] Приложение смонтировано, инициализируем слушателей');
      
      try {
        // Получаем хранилище чата с помощью useChatStore
        const chatStore = useChatStore();
        
        if (chatStore) {
          console.log('[SidebarManager] Хранилище чата успешно получено');
          initWatchers(chatStore);
        } else {
          console.warn('[SidebarManager] Хранилище чата недоступно при инициализации');
        }
      } catch (error) {
        console.error('[SidebarManager] Ошибка при получении хранилища чата:', error);
      }
      
      // Выполняем первичную проверку
      setTimeout(() => {
        checkActiveChatAndShowSidebar();
        checkChatElementAndShowSidebar();
      }, 500);
    });
  }
  
  // Экспортируем функции для использования в других компонентах
  return {
    provide: {
      toggleSidebar
    }
  };
});
