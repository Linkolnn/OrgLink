import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    user: null,
    isLoggingOut: false
  }),
  
  getters: {
    isAdmin: (state) => state.user?.role === 'admin'
  },
  
  actions: {
    async checkAuth() {
      // Если выход в процессе, не проверяем аутентификацию
      if (this.isLoggingOut) {
        return false;
      }
      
      try {
        const config = useRuntimeConfig();
        const response = await $fetch(`${config.public.backendUrl}/api/auth/me`, {
          credentials: 'include',
        });
        
        if (response) {
          this.user = response;
          this.isAuthenticated = true;
          return true;
        }
        return false;
      } catch (error) {
        this.isAuthenticated = false;
        this.user = null;
        return false;
      }
    },
    
    setUser(userData) {
      this.user = userData;
      this.isAuthenticated = true;
    },
    
    async logout() {
      // Получаем доступ к лоадеру
      const nuxtApp = useNuxtApp();
      if (nuxtApp.$loader) {
        nuxtApp.$loader.start();
      }
      
      this.isLoggingOut = true;
      
      // Сначала сбрасываем локальное состояние
      this.isAuthenticated = false;
      this.user = null;
      
      try {
        const config = useRuntimeConfig();
        await $fetch(`${config.public.backendUrl}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error('Ошибка при выходе:', error);
      } finally {
        // Небольшая задержка для корректной работы перенаправления
        await new Promise(resolve => setTimeout(resolve, 300));
        this.isLoggingOut = false;
      }
    }
  }
});