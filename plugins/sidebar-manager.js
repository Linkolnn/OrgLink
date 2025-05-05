// Плагин для управления состоянием боковой панели
import { ref, watch } from 'vue';
import { useChatStore } from '~/stores/chat';

// Создаем глобальное состояние для сайдбара
const globalSidebarVisible = ref(true);

export default defineNuxtPlugin((nuxtApp) => {
  // Используем глобальное состояние видимости боковой панели
  // На мобильных устройствах сразу показываем боковую панель
  const sidebarVisible = globalSidebarVisible;
  
  // Флаг для игнорирования активного чата при определении видимости боковой панели
  const ignoreActiveChatForSidebar = ref(false);
  
  // Функция для проверки, является ли устройство мобильным
  const isMobileDevice = () => {
    return process.client && window.innerWidth <= 859;
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
  
  // Функция для обновления классов в DOM
  const updateDOMClasses = () => {
    if (!process.client) return;
    
    setTimeout(() => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        if (sidebarVisible.value) {
          sidebar.classList.add('visible');
          console.log('[SidebarManager] Добавлен класс visible к .sidebar');
        } else {
          sidebar.classList.remove('visible');
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
  
  // Функция для переключения состояния боковой панели
  const toggleSidebar = (value) => {
    if (value !== undefined) {
      sidebarVisible.value = value;
    } else {
      sidebarVisible.value = !sidebarVisible.value;
    }
    
    console.log('[SidebarManager] Переключаем боковую панель:', sidebarVisible.value);
    updateDOMClasses();
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
    
    // Проверяем, находимся ли мы на странице мессенджера
    const isMessengerPage = route.path === '/messenger';
    
    // Проверяем, является ли устройство мобильным
    const isMobile = isMobileDevice();
    
    // Проверяем наличие активного чата и флаг игнорирования
    const hasActiveChat = chatStore.activeChat !== null;
    const ignoreActiveChat = chatStore.ignoreActiveChatForSidebar === true;
    
    console.log('[SidebarManager] Проверка состояния:', { 
      isMessengerPage, 
      isMobile, 
      hasActiveChat, 
      ignoreActiveChat,
      currentSidebarState: sidebarVisible.value 
    });
    
    // Если мы на странице мессенджера и на мобильном устройстве
    if (isMessengerPage && isMobile) {
      // Если флаг игнорирования установлен, показываем боковую панель вне зависимости от активного чата
      if (ignoreActiveChat) {
        console.log('[SidebarManager] Флаг игнорирования активного чата установлен, показываем боковую панель');
        showSidebar();
        return;
      }
      
      // Если нет активного чата, показываем боковую панель
      if (!hasActiveChat) {
        console.log('[SidebarManager] Нет активного чата на мобильном устройстве, показываем боковую панель');
        showSidebar();
      }
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
  
  // Инициализация боковой панели на мобильных устройствах
  const initMobileSidebar = () => {
    if (process.client) {
      // Принудительно устанавливаем боковую панель видимой
      sidebarVisible.value = true;
      console.log('[SidebarManager] Принудительно устанавливаем боковую панель видимой');
      
      // Добавляем классы видимости напрямую к элементам DOM
      // Используем несколько задержек для гарантии применения стилей
      setTimeout(() => {
        // Первая попытка
        const sideBar = document.querySelector('.messenger-sidebar');
        if (sideBar) {
          sideBar.classList.add('visible');
          console.log('[SidebarManager] Добавлен класс visible к .messenger-sidebar');
        }
        
        const app = document.querySelector('.app');
        if (app) {
          app.classList.add('sidebar-visible');
          console.log('[SidebarManager] Добавлен класс sidebar-visible к .app');
        }
        
        // Вторая попытка с большей задержкой
        setTimeout(() => {
          const sideBar = document.querySelector('.messenger-sidebar');
          if (sideBar) {
            sideBar.classList.add('visible');
          }
          
          const app = document.querySelector('.app');
          if (app) {
            app.classList.add('sidebar-visible');
          }
        }, 500);
        
        // Третья попытка с еще большей задержкой
        setTimeout(() => {
          const sideBar = document.querySelector('.messenger-sidebar');
          if (sideBar) {
            sideBar.classList.add('visible');
          }
          
          const app = document.querySelector('.app');
          if (app) {
            app.classList.add('sidebar-visible');
          }
        }, 1000);
      }, 100);
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
}, {
  // Делаем функцию toggleSidebar доступной глобально через nuxtApp.$toggleSidebar
  provide: {
    toggleSidebar: (value) => {
      console.log('[SidebarManager] Вызвана глобальная функция toggleSidebar:', value);
      const sidebarVisible = ref(true);
      if (value !== undefined) {
        sidebarVisible.value = value;
      } else {
        sidebarVisible.value = !sidebarVisible.value;
      }
      
      // Обновляем классы в DOM
      setTimeout(() => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
          if (sidebarVisible.value) {
            sidebar.classList.add('visible');
            console.log('[SidebarManager] Добавлен класс visible к .sidebar');
          } else {
            sidebar.classList.remove('visible');
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
      
      return sidebarVisible.value;
    }
  }  
});
