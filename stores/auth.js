import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    user: null,
    logoutInProgress: false
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
        // Если выход в процессе, не проверяем аутентификацию
        if (this.logoutInProgress) {
          return false;
        }
        
        const config = useRuntimeConfig();
        // Получаем данные пользователя с сервера (cookie будет отправлен автоматически)
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
        // Если не в процессе выхода, то сбрасываем состояние
        if (!this.logoutInProgress) {
          this.isAuthenticated = false;
          this.user = null;
        }
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
        // Устанавливаем флаг, что выход в процессе
        this.logoutInProgress = true;
        
        // Сначала сбрасываем локальное состояние
        this.isAuthenticated = false;
        this.user = null;
        
        // Устанавливаем локальный флаг в localStorage, чтобы предотвратить автоматический редирект
        if (process.client) {
          localStorage.setItem('logout_in_progress', 'true');
        }
        
        const config = useRuntimeConfig();
        // Вызываем сервер для удаления cookie
        await $fetch(`${config.public.backendUrl}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include'
        });
        
        // Добавляем небольшую задержку перед сбросом флага логаута
        // Это даст время для фактического удаления cookie и перерисовки UI
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (process.client) {
          // Удаляем флаг из localStorage
          localStorage.removeItem('logout_in_progress');
        }
      } catch (error) {
        console.error('Ошибка при выходе:', error);
      } finally {
        // В любом случае сбрасываем флаг процесса выхода
        this.logoutInProgress = false;
      }
    },
  },
});