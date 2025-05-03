// Плагин для глобальных уведомлений
export default defineNuxtPlugin((nuxtApp) => {
  // Метод для показа уведомлений
  const showNotification = (message, type = 'info', duration = 3000) => {
    // Используем глобальную функцию, если она доступна
    if (window.$showNotification) {
      return window.$showNotification(message, type, duration);
    }
    
    // Запасной вариант, если компонент еще не инициализирован
    const notificationId = `notification-${Date.now()}`;
    
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.id = notificationId;
    notification.className = `notification notification--${type}`;
    
    // Определяем заголовок в зависимости от типа
    let title = 'Информация';
    if (type === 'success') title = 'Успешно';
    if (type === 'error') title = 'Ошибка';
    if (type === 'warning') title = 'Внимание';
    
    // Устанавливаем содержимое уведомления
    notification.innerHTML = `
      <div class="notification__title">${title}</div>
      <div class="notification__message">${message}</div>
    `;
    
    // Добавляем уведомление на страницу
    document.body.appendChild(notification);
    
    // Показываем уведомление
    setTimeout(() => {
      notification.classList.add('notification--show');
    }, 10);
    
    // Скрываем уведомление через указанное время
    setTimeout(() => {
      notification.classList.remove('notification--show');
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, duration);
    
    return notificationId;
  };
  
  // Добавляем метод в глобальный контекст Nuxt
  nuxtApp.provide('notify', showNotification);
});
