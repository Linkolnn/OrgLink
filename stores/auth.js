import { defineStore } from 'pinia';
import { useCookie } from '#app';
import { jwtDecode } from 'jwt-decode';

export const useAuthStore = defineStore('auth', {
  state: () => {
    // Пытаемся восстановить токен из cookie при инициализации хранилища
    const tokenCookie = useCookie('token');
    const clientTokenCookie = useCookie('client_token', {
      // Настройки для локальной cookie
      maxAge: 2592000, // 30 дней в секундах
      sameSite: 'lax',
      path: '/'
    });
    
    let token = null;
    
    // Проверяем, есть ли токен в защищенной cookie
    if (tokenCookie.value) {
      // Если есть, создаем локальную копию для WebSocket
      clientTokenCookie.value = tokenCookie.value;
      token = tokenCookie.value;
    } else if (clientTokenCookie.value) {
      // Если защищенной cookie нет, но есть локальная копия
      token = clientTokenCookie.value;
    }
    
    let userData = null;
    
    // Если токен существует, декодируем его для получения информации о пользователе
    if (token) {
      try {
        const decoded = jwtDecode(token);
        userData = {
          _id: decoded.id,
          role: decoded.role,
          email: decoded.email
        };
      } catch (error) {
        console.error('Ошибка декодирования токена:', error);
        // Очищаем невалидный токен
        token = null;
        clientTokenCookie.value = null;
      }
    }
    
    return {
      isAuthenticated: !!token,
      user: userData,
      token: token,
      isLoggingOut: false
    };
  },
  
  getters: {
    isAdmin: (state) => state.user?.role === 'admin'
  },
  
  actions: {
    // Проверка аутентификации пользователя
    async checkAuth() {
      try {
        const config = useRuntimeConfig();
        
        // Проверяем наличие токена в cookie
        const tokenCookie = useCookie('token');
        const clientTokenCookie = useCookie('client_token');
        let token = tokenCookie.value || clientTokenCookie.value;
        
        if (token) {
          
          try {
            // Декодируем токен для получения информации о пользователе
            const decoded = jwtDecode(token);
            
            // Проверяем, не истек ли срок действия токена
            const currentTime = Date.now() / 1000;
            if (decoded.exp && decoded.exp < currentTime) {
              this.logout();
              return false;
            }
            
            // Устанавливаем данные пользователя из токена
            this.user = {
              _id: decoded.id,
              role: decoded.role,
              email: decoded.email
            };
            this.token = token;
            this.isAuthenticated = true;
            
            // Синхронизируем локальную копию токена
            if (tokenCookie.value && !clientTokenCookie.value) {
              clientTokenCookie.value = tokenCookie.value;
            }
            
            return true;
          } catch (error) {
            this.logout();
            return false;
          }
        }
        
        // Если токена нет, пытаемся получить данные пользователя с сервера
        try {
          // Используем прямое подключение к бэкенду на Railway в продакшене
          const backendUrl = process.env.NODE_ENV === 'production' || (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'))
            ? 'https://orglink-production-e9d8.up.railway.app'
            : config.public.backendUrl;
          
          // Удаляем слэш в конце URL если он есть
          const normalizedUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
          
          const response = await $fetch(`${normalizedUrl}/api/auth/me`, {
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${token}`,
            }
          });
          
          if (response && response.token) {
            
            // Устанавливаем данные пользователя
            this.user = {
              _id: response._id,
              role: response.role,
              email: response.email
            };
            
            // Если в ответе есть токен, сохраняем его
            if (response.token) {
              this.token = response.token;
              // Сохраняем локальную копию токена для WebSocket
              clientTokenCookie.value = response.token;
            }
            
            this.isAuthenticated = true;
            return true;
          }
        } catch (error) {
          // Ошибка при запросе к серверу
        }
        
        return false;
      } catch (error) {
        this.isAuthenticated = false;
        this.user = null;
        this.token = null;
        
        // Очищаем cookie при ошибке аутентификации
        const clientTokenCookie = useCookie('client_token');
        clientTokenCookie.value = null;
        
        return false;
      }
    },
    
    // Установка данных пользователя
    setUserData(userData) {
      if (userData && userData.token) {
        try {
          // Декодируем токен для получения информации о пользователе
          const decoded = jwtDecode(userData.token);
          
          // Устанавливаем данные пользователя
          this.user = {
            _id: decoded.id,
            role: decoded.role,
            email: decoded.email
          };
          this.token = userData.token;
          this.isAuthenticated = true;
          
          // Сохраняем локальную копию токена для WebSocket
          const clientTokenCookie = useCookie('client_token');
          clientTokenCookie.value = userData.token;
        } catch (error) {
          // Ошибка при декодировании токена
        }
      }
    },
    
    // Алиас для setUserData для обратной совместимости
    setUser(userData) {
      return this.setUserData(userData);
    },
    
    // Выход пользователя
    async logout() {
      this.isLoggingOut = true;
      
      // Очищаем данные пользователя
      this.isAuthenticated = false;
      this.user = null;
      this.token = null;
      
      // Удаляем локальную копию токена
      const clientTokenCookie = useCookie('client_token');
      clientTokenCookie.value = null;
      
      try {
        // Отправляем запрос на сервер для удаления серверной cookie
        const config = useRuntimeConfig();
        
        // Используем прямое подключение к бэкенду на Railway в продакшене
        const backendUrl = process.env.NODE_ENV === 'production' || (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'))
          ? 'https://orglink-production-e9d8.up.railway.app'
          : config.public.backendUrl;
        
        // Удаляем слэш в конце URL если он есть
        const normalizedUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
        
        await $fetch(`${normalizedUrl}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${this.token}`,
          }
        });
      } catch (error) {
        // Ошибка при выходе
      } finally {
        this.isLoggingOut = false;
      }
    }
  }
});