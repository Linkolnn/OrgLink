// Плагин для регистрации директивы longpress
export default defineNuxtPlugin((nuxtApp) => {
  // Директива для обработки долгого нажатия (long press)
  nuxtApp.vueApp.directive('longpress', {
    mounted(el, binding) {
      // Настройки
      const longPressDuration = binding.value?.duration || 1000; // Длительность нажатия в мс (1 секунда)
      const handler = binding.value?.handler || binding.value;
      
      // Состояние
      let pressTimer = null;
      let startX = 0;
      let startY = 0;
      let isDragging = false;
      let isLongPressTriggered = false;
      
      // Порог перемещения для определения перетаскивания
      const moveThreshold = 10; // в пикселях
      
      // Обработчик начала нажатия
      const startHandler = (e) => {
        // Сохраняем начальные координаты
        if (e.type === 'touchstart') {
          if (e.touches.length > 0) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
          }
        } else {
          startX = e.clientX;
          startY = e.clientY;
        }
        
        // Сбрасываем флаги
        isDragging = false;
        isLongPressTriggered = false;
        
        // Запускаем таймер для долгого нажатия
        pressTimer = setTimeout(() => {
          if (!isDragging) {
            isLongPressTriggered = true;
            handler(e);
          }
        }, longPressDuration);
      };
      
      // Обработчик перемещения
      const moveHandler = (e) => {
        if (pressTimer === null) return;
        
        let currentX, currentY;
        
        if (e.type === 'touchmove') {
          if (e.touches.length > 0) {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
          }
        } else {
          currentX = e.clientX;
          currentY = e.clientY;
        }
        
        // Проверяем, было ли значительное перемещение
        if (Math.abs(currentX - startX) > moveThreshold || 
            Math.abs(currentY - startY) > moveThreshold) {
          isDragging = true;
          cancelPress();
        }
      };
      
      // Обработчик окончания нажатия
      const endHandler = () => {
        cancelPress();
      };
      
      // Функция отмены долгого нажатия
      const cancelPress = () => {
        if (pressTimer !== null) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      };
      
      // Обработчик контекстного меню (правый клик или долгое нажатие в браузере)
      const contextMenuHandler = (e) => {
        // Отменяем стандартное контекстное меню браузера
        e.preventDefault();
        return false;
      };
      
      // Регистрируем обработчики событий
      el.addEventListener('mousedown', startHandler);
      el.addEventListener('touchstart', startHandler, { passive: true });
      
      el.addEventListener('mousemove', moveHandler);
      el.addEventListener('touchmove', moveHandler, { passive: true });
      
      el.addEventListener('mouseup', endHandler);
      el.addEventListener('mouseleave', endHandler);
      el.addEventListener('touchend', endHandler);
      el.addEventListener('touchcancel', endHandler);
      
      // Отключаем стандартное контекстное меню
      el.addEventListener('contextmenu', contextMenuHandler);
      
      // Сохраняем ссылки на обработчики для возможности их удаления
      el._longpress = {
        startHandler,
        moveHandler,
        endHandler,
        contextMenuHandler,
        isLongPressActive: () => isLongPressTriggered
      };
    },
    
    // Удаляем обработчики при размонтировании элемента
    unmounted(el) {
      if (el._longpress) {
        const { startHandler, moveHandler, endHandler, contextMenuHandler } = el._longpress;
        
        el.removeEventListener('mousedown', startHandler);
        el.removeEventListener('touchstart', startHandler);
        
        el.removeEventListener('mousemove', moveHandler);
        el.removeEventListener('touchmove', moveHandler);
        
        el.removeEventListener('mouseup', endHandler);
        el.removeEventListener('mouseleave', endHandler);
        el.removeEventListener('touchend', endHandler);
        el.removeEventListener('touchcancel', endHandler);
        
        el.removeEventListener('contextmenu', contextMenuHandler);
        
        delete el._longpress;
      }
    }
  });
});
