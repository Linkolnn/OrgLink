<template>
  <div class="notification-container">
    <!-- Уведомления будут добавляться сюда динамически -->
  </div>
</template>

<script setup>
// Счетчик для уникальных ID уведомлений
let notificationCounter = 0;

// Функция для создания и показа уведомления
const showNotification = (message, type = 'info', duration = 3000) => {
  // Создаем уникальный ID для уведомления
  const notificationId = `notification-${notificationCounter++}`;
  
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

// Экспортируем функцию для использования в других компонентах
defineExpose({ showNotification });

// Регистрируем глобальный метод при монтировании компонента
onMounted(() => {
  // Добавляем метод в глобальный объект window для доступа из любого места
  window.$showNotification = showNotification;
});
</script>

<style lang="sass">
@import '@variables'

// Стили для уведомлений
.notification
  position: fixed
  bottom: 20px
  left: 50%
  transform: translateX(-50%) translateY(100px)
  padding: 10px 
  border-radius: $radius
  color: $white
  font-size: 14px
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2)
  z-index: 2000
  opacity: 0
  transition: transform 0.3s, opacity 0.3s
  text-align: center
  min-width: 250px
  
  &--show
    transform: translateX(-50%) translateY(0)
    opacity: 1
  
  &--info
    background-color: $purple
  
  &--success
    background-color: $green
  
  &--error
    background-color: $red
  
  &--warning
    background-color: $orange
  
  &__title
    font-weight: bold
    margin-bottom: 5px
  
  &__message
    font-size: 14px
</style>
