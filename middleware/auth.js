// middleware/auth.js
export default defineNuxtRouteMiddleware(async (to, from) => {
    // Получаем доступ к хранилищу аутентификации
    const authStore = useAuthStore();
    
    // Добавляем искусственную минимальную задержку для гарантированного 
    // отображения загрузочного экрана
    // await new Promise(resolve => setTimeout(resolve, 0));
    
    // Проверяем, требует ли данный маршрут прав администратора
    const requiresAdmin = to.meta.requiresAdmin;
    const requiresAuth = to.meta.requiresAuth;
    
    // Проверяем состояние аутентификации
    if (!authStore.isAuthenticated) {
      try {
        // Пробуем проверить токен
        await authStore.checkAuth();
      } catch (error) {
        console.error('Ошибка аутентификации:', error);
      }
    }
    
    // Если пользователь на главной и уже аутентифицирован - перенаправляем в мессенджер
    if (to.path === '/' && authStore.isAuthenticated && !authStore.isLoggingOut) {
      return navigateTo('/messenger');
    }
    
    // После проверки проверяем права доступа
    if (requiresAdmin && !authStore.isAdmin) {
      return navigateTo('/');
    }
    
    // Для защищенных маршрутов проверяем аутентификацию
    if (requiresAuth && !authStore.isAuthenticated) {
      return navigateTo('/');
    }
    
    // Продолжаем нормальную навигацию - лоадер будет скрыт автоматически
    // плагином global-loader после завершения навигации
    return;
  });