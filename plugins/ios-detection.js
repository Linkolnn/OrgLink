/**
 * Плагин для определения iOS устройств и адаптации интерфейса
 * под особенности Safari на iPhone, включая учет высоты поискового блока
 */

export default defineNuxtPlugin((nuxtApp) => {
  // Функция для определения iOS устройств
  const detectIOSDevice = () => {
    if (process.client) {
      const userAgent = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
      const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
      
      console.log('Определение устройства:', { isIOS, isSafari, userAgent });
      
      // Если это iOS устройство, добавляем специальный класс к body
      if (isIOS) {
        document.body.classList.add('ios-device');
        
        // Добавляем мета-тег для управления viewport на iOS
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
          viewportMeta.setAttribute('content', 
            'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1');
        } else {
          const meta = document.createElement('meta');
          meta.name = 'viewport';
          meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1';
          document.head.appendChild(meta);
        }
        
        // Устанавливаем высоту для учета поискового блока Safari
        adjustIOSHeight();
        
        // Добавляем обработчик изменения размера окна
        window.addEventListener('resize', adjustIOSHeight);
        window.addEventListener('orientationchange', adjustIOSHeight);
      }
    }
  };
  
  // Функция для адаптации высоты на iOS устройствах
  const adjustIOSHeight = () => {
    // Получаем реальную высоту видимой области
    const vh = window.innerHeight * 0.01;
    
    // Устанавливаем CSS-переменную для использования в стилях
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    console.log('Адаптация высоты для iOS:', {
      innerHeight: window.innerHeight,
      vh: vh,
      screenHeight: window.screen.height
    });
  };
  
  // Вызываем функцию определения устройства при загрузке страницы
  if (process.client) {
    // Используем setTimeout, чтобы дать время на полную загрузку DOM
    setTimeout(() => {
      detectIOSDevice();
    }, 100);
  }
  
  // Предоставляем функции для использования в других компонентах
  return {
    provide: {
      detectIOSDevice,
      adjustIOSHeight
    }
  };
});
