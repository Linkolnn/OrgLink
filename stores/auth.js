import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    user: null
  }),
  
  getters: {
    isAdmin: (state) => {
      const hasAdminRole = state.user && state.user.role === 'admin';
      return hasAdminRole;
    }
  },
  
  actions: {
    async checkAuth() {
      try {
        const config = useRuntimeConfig();
        // Получаем данные пользователя с сервера (cookie будет отправлен автоматически)
        const response = await $fetch(`${config.public.backendUrl}/auth/me`, {
          credentials: 'include',
        });
        
        if (response) {
          this.user = response;
          this.isAuthenticated = true;
          return true;
        }
        
        return false;
      } catch (error) {
        this.logout();
        return false;
      }
    },
    
    setUser(userData) {
      this.user = userData;
      this.isAuthenticated = true;
    },
    
    setAuthenticated(status) {
      this.isAuthenticated = status;
    },
    
    async logout() {
      try {
        const config = useRuntimeConfig();
        // Вызываем сервер для удаления cookie
        await $fetch(`${config.public.backendUrl}/auth/logout`, {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error('Ошибка при выходе:', error);
      }
      
      // Локальное состояние
      this.isAuthenticated = false;
      this.user = null;
    },
  },
});