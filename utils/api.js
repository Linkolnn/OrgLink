/**
 * Утилиты для работы с API
 */

import { useCookie } from 'nuxt/app';
import { useRuntimeConfig } from '#imports';

/**
 * Преобразует URL для безопасной загрузки ресурсов
 * @param {string} url - URL для преобразования
 * @returns {string} - Безопасный URL
 */
export const secureUrl = (url) => {
  if (!url) return '';
  
  // Проверяем, находимся ли мы в продакшн-окружении (Vercel)
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
  
  // Обработка локальных URL в продакшн-окружении
  if ((isProduction || isVercel) && (url.includes('localhost') || url.includes('127.0.0.1'))) {
    // Если это URL для загрузки файлов, перенаправляем на API роут
    if (url.includes('/uploads/')) {
      // Извлекаем путь к файлу после /uploads/
      const filePath = url.split('/uploads/')[1];
      return `/api/uploads/${filePath}`;
    }
    return url;
  }
  
  // Не преобразуем локальные URL в разработке, так как локальный сервер может не поддерживать HTTPS
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    // Для локальных URL убедимся, что они используют HTTP, а не HTTPS
    if (url.startsWith('https://localhost') || url.startsWith('https://127.0.0.1')) {
      return url.replace('https://', 'http://');
    }
    return url;
  }
  
  // Заменяем http:// на https:// только для внешних URL в продакшн-окружении
  if (process.env.NODE_ENV === 'production' && url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  
  // Если URL относительный или уже использует HTTPS, возвращаем как есть
  return url;
};

/**
 * Безопасная функция для выполнения fetch запросов, которая корректно обрабатывает
 * аутентификацию на всех устройствах, включая Safari и iOS
 * 
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции для fetch
 * @returns {Promise<Response>} - Результат запроса
 */
export const safeFetch = async (url, options = {}) => {
  const config = useRuntimeConfig();
  const backendUrl = config.public.backendUrl || 'https://orglink.onrender.com';
  
  // Полный URL для запроса
  let fullUrl = url;
  if (!url.startsWith('http')) {
    fullUrl = `${backendUrl}${url.startsWith('/') ? url : `/${url}`}`;
  }
  
  // Получаем токен из cookie
  const tokenCookie = useCookie('token');
  const clientTokenCookie = useCookie('client_token');
  const token = tokenCookie.value || clientTokenCookie.value;
  
  // Определяем, используется ли Safari или iOS
  const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  console.log('API Utils: safeFetch вызван для URL:', fullUrl, { isSafari, isIOS, hasToken: !!token });
  
  // Устанавливаем заголовки по умолчанию
  const headers = {
    ...(options.headers || {}),
  };
  
  // Добавляем заголовок Authorization, если есть токен
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Для Safari и iOS удаляем заголовок Origin, так как он запрещен
  if (isSafari || isIOS) {
    delete headers['Origin'];
  }
  
  // Создаем новые опции с обновленными заголовками
  const updatedOptions = {
    ...options,
    headers,
    credentials: 'include'
  };
  
  try {
    // Выполняем запрос
    const response = await fetch(fullUrl, updatedOptions);
    
    // Если получили 401 Unauthorized и есть токен, пробуем запрос с токеном в URL
    if (response.status === 401 && token && (isSafari || isIOS)) {
      console.log('API Utils: Получили 401, пробуем запрос с токеном в URL для Safari/iOS');
      
      // Добавляем токен в URL
      const separator = fullUrl.includes('?') ? '&' : '?';
      const urlWithToken = `${fullUrl}${separator}token=${token}`;
      
      // Создаем новые опции без заголовка Authorization
      const newOptions = { ...updatedOptions };
      if (newOptions.headers && newOptions.headers['Authorization']) {
        delete newOptions.headers['Authorization'];
      }
      
      // Выполняем повторный запрос с токеном в URL
      return fetch(urlWithToken, newOptions);
    }
    
    return response;
  } catch (error) {
    console.error('API Utils: Ошибка при выполнении запроса:', error);
    
    // Для Safari и iOS, если ошибка связана с CORS или аутентификацией
    if ((error.message?.includes('CORS') || error.message?.includes('Failed to fetch') || 
         error.message?.includes('401') || error.status === 401) && 
        (isSafari || isIOS)) {
      console.log('API Utils: Используем универсальный iOS API прокси');
      
      // Используем универсальный iOS API прокси
      const proxyUrl = `${window.location.origin}/api/ios-api-proxy`;
      
      // Извлекаем относительный путь API из полного URL
      let endpoint = fullUrl;
      if (fullUrl.includes(backendUrl)) {
        endpoint = fullUrl.replace(backendUrl, '');
      }
      
      // Извлекаем параметры запроса
      let params = {};
      if (options.body) {
        try {
          // Если тело запроса является JSON-строкой
          if (typeof options.body === 'string') {
            params = JSON.parse(options.body);
          } else if (options.body instanceof FormData) {
            // Если тело запроса является FormData, преобразуем его в объект
            for (const [key, value] of options.body.entries()) {
              params[key] = value;
            }
          }
        } catch (e) {
          console.error('API Utils: Ошибка при разборе тела запроса:', e);
        }
      }
      
      // Создаем данные для прокси
      const proxyData = {
        endpoint,
        method: options.method || 'GET',
        params,
        token
      };
      
      // Выполняем запрос через прокси
      return fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(proxyData)
      });
    }
    
    throw error;
  }
};

/**
 * Обрабатывает ответ API и возвращает данные или выбрасывает ошибку
 * 
 * @param {Response} response - Ответ от API
 * @param {string} errorMessage - Сообщение об ошибке для отображения пользователю
 * @returns {Promise<any>} - Данные из ответа API
 */
export const handleApiResponse = async (response, errorMessage = 'Ошибка при выполнении запроса') => {
  if (!response.ok) {
    // Если ответ не успешный, пытаемся получить текст ошибки из ответа
    let errorText = errorMessage;
    try {
      const errorData = await response.json();
      errorText = errorData.message || errorData.error || errorMessage;
    } catch (e) {
      // Если не удалось получить JSON, используем текст ошибки по умолчанию
    }
    
    // Создаем и выбрасываем ошибку с текстом и статусом
    const error = new Error(errorText);
    error.status = response.status;
    throw error;
  }
  
  // Для успешного ответа возвращаем данные
  return await response.json();
};

/**
 * Выполняет API запрос с использованием safeFetch и обрабатывает ответ
 * 
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции для fetch
 * @param {string} errorMessage - Сообщение об ошибке для отображения пользователю
 * @returns {Promise<any>} - Данные из ответа API
 */
export const apiRequest = async (url, options = {}, errorMessage = 'Ошибка при выполнении запроса') => {
  const response = await safeFetch(url, options);
  return handleApiResponse(response, errorMessage);
};

/**
 * Нормализует URL, убирая двойные слеши
 * 
 * @param {string} baseUrl - Базовый URL
 * @param {string} path - Путь для добавления к базовому URL
 * @returns {string} - Нормализованный URL
 */
export const normalizeUrl = (baseUrl, path) => {
  if (!baseUrl) return path;
  if (!path) return baseUrl;
  
  // Убираем слеш в конце baseUrl, если он есть
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  // Добавляем слеш в начало path, если его нет
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${normalizedBase}${normalizedPath}`;
};
