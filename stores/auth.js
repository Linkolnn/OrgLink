import { defineStore } from 'pinia';
import { useRuntimeConfig } from '#app';
import { useCookie } from '#app';
import { useRouter } from '#app';
import { jwtDecode } from 'jwt-decode';
import { safeFetch } from '~/utils/safeFetch';

export const useAuthStore = defineStore('auth', {
  state: () => {
    // Пытаемся восстановить токен из cookie при инициализации хранилища
    const tokenCookie = useCookie('token', {
      // Улучшенные настройки для серверной cookie
      maxAge: 60 * 60 * 24 * 30, // 30 дней в секундах
      path: '/',
      secure: process.env.NODE_ENV === 'production', // Только в продакшене
      sameSite: 'strict'
    });
    
    const clientTokenCookie = useCookie('client_token', {
      // Улучшенные настройки для локальной cookie
      maxAge: 60 * 60 * 24 * 30, // 30 дней в секундах
      path: '/',
      sameSite: 'lax',
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) // Явно устанавливаем дату истечения
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
    // Загрузка полных данных пользователя
    async loadUserProfile() {
      try {
        if (!this.isAuthenticated || !this.token) {
          console.log('Нет токена для загрузки профиля');
          return false;
        }
        
        const config = useRuntimeConfig();
        console.log('Загрузка полных данных пользователя...');
        
        // Выбираем URL в зависимости от окружения
        let backendUrl = config.public.backendUrl;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          backendUrl = config.public.localBackendUrl || 'http://localhost:5000';
        }
        
        // Запрашиваем полные данные пользователя с сервера
        const response = await safeFetch(`${backendUrl}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          }
        });
        
        if (response && response._id) {
          console.log('Получены полные данные пользователя:', response);
          // Обновляем данные пользователя в хранилище
          this.user = {
            ...this.user,
            ...response,
            // Добавляем параметр для предотвращения кэширования аватара
            avatar: response.avatar ? `${response.avatar}?t=${new Date().getTime()}` : null
          };
          return true;
        }
        return false;
      } catch (error) {
        console.error('Ошибка при загрузке профиля пользователя:', error);
        return false;
      }
    },
    
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
            
            // Устанавливаем базовые данные пользователя из токена
            this.user = {
              _id: decoded.id,
              role: decoded.role,
              email: decoded.email
            };
            this.token = token;
            this.isAuthenticated = true;
            
            // Загружаем полные данные пользователя (включая аватар)
            await this.loadUserProfile();
            
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
          
          // Определяем, используется ли Safari или iOS
          const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
          const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
          
          console.log('Auth check browser detection:', { isSafari, isIOS });
          
          // Используем safeFetch для совместимости с Safari/iOS
          const response = await safeFetch(`${normalizedUrl}/api/auth/me`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${token}`,
            }
          }).then(res => res.json()).catch(err => {
            console.error('Auth check error:', err);
            return null;
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
              
              // Сохраняем токен в localStorage для резервного механизма аутентификации на iOS
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('auth_token', response.token);
              }
            }
            
            this.isAuthenticated = true;
            return true;
          }
        } catch (error) {
          // Ошибка при запросе к серверу
          console.error('Auth check fetch error:', error);
          
          // Если ошибка связана с CORS или сетевыми проблемами
          if (error.message && (error.message.includes('CORS') || error.message.includes('Failed to fetch') || error.message.includes('Load failed') || error.message.includes('Network request failed'))) {
            const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            
            if (isSafari || isIOS) {
              console.warn('Safari/iOS CORS issue detected. Using fallback authentication.');
              
              // Пробуем альтернативный метод аутентификации для iOS
              try {
                // Используем токен из localStorage, если он есть
                const savedToken = localStorage.getItem('auth_token');
                
                if (savedToken) {
                  this.token = savedToken;
                  clientTokenCookie.value = savedToken;
                  this.isAuthenticated = true;
                  
                  // Декодируем JWT токен для получения информации о пользователе
                  const base64Url = savedToken.split('.')[1];
                  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                  }).join(''));
                  
                  const decodedToken = JSON.parse(jsonPayload);
                  
                  if (decodedToken.id) {
                    this.user = {
                      _id: decodedToken.id,
                      role: decodedToken.role || 'user',
                      email: decodedToken.email || ''
                    };
                    return true;
                  }
                }
              } catch (fallbackError) {
                console.error('Fallback authentication failed:', fallbackError);
              }
            }
          }
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
      console.log('Начало процесса выхода из учетной записи');
      this.isLoggingOut = true;
      
      // Очищаем данные пользователя
      this.isAuthenticated = false;
      this.user = null;
      this.token = null;
      
      // Удаляем все возможные токены из cookie
      const tokenCookie = useCookie('token');
      const clientTokenCookie = useCookie('client_token');
      
      console.log('Удаление токенов из cookie');
      tokenCookie.value = null;
      clientTokenCookie.value = null;
      
      // Удаляем все другие куки, связанные с аутентификацией
      const authCookie = useCookie('auth');
      const userCookie = useCookie('user');
      
      authCookie.value = null;
      userCookie.value = null;
      
      try {
        // Отправляем запрос на сервер Railway для удаления серверной cookie
        const config = useRuntimeConfig();
        
        // Всегда используем прямое подключение к бэкенду на Railway
        const railwayBackendUrl = 'https://orglink-production-e9d8.up.railway.app';
        const normalizedRailwayUrl = railwayBackendUrl.endsWith('/') ? railwayBackendUrl.slice(0, -1) : railwayBackendUrl;
        
        console.log('Отправка запроса на выход на Railway:', `${normalizedRailwayUrl}/api/auth/logout`);
        await $fetch(`${normalizedRailwayUrl}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${this.token}`,
          }
        });
        
        // Если мы на Vercel, также отправляем запрос на выход на локальный API маршрут
        if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
          console.log('Отправка запроса на выход на Vercel:', `/api/auth/logout`);
          try {
            await $fetch(`/api/auth/logout`, {
              method: 'POST',
              credentials: 'include'
            });
          } catch (vercelError) {
            console.error('Ошибка при выходе на Vercel:', vercelError);
          }
        }
        
        // Очищаем локальное хранилище
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
        }
        
        console.log('Успешный выход из учетной записи');
      } catch (error) {
        console.error('Ошибка при выходе:', error);
      } finally {
        this.isLoggingOut = false;
        
        // Используем роутер для перехода на главную страницу без перезагрузки
        const router = useRouter();
        if (router) {
          console.log('Бесшовный переход на главную страницу');
          router.push('/');
        }
      }
    }
  }
});