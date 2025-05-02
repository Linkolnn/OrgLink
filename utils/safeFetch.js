// Утилита для безопасных запросов с поддержкой CORS для Safari и iOS
import { useRuntimeConfig } from '#imports';
import { useCookie } from '#imports';

/**
 * Выполняет fetch запрос с учетом особенностей Safari и iOS
 * Автоматически использует CORS-прокси при необходимости
 * 
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @returns {Promise} - Результат запроса
 */
export const safeFetch = async (url, options = {}) => {
  const config = useRuntimeConfig();
  const backendUrl = config.public.backendUrl || 'https://orglink.onrender.com';
  
  // Определяем, используется ли Safari или iOS
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  // Полный URL для запроса
  let fullUrl = url;
  if (!url.startsWith('http')) {
    fullUrl = `${backendUrl}${url.startsWith('/') ? url : `/${url}`}`;
  }
  
  // Получаем токен из cookie
  const tokenCookie = useCookie('token');
  const clientTokenCookie = useCookie('client_token');
  const token = tokenCookie.value || clientTokenCookie.value;
  
  // Добавляем заголовок Authorization, если есть токен и он не указан в опциях
  const headers = {
    ...options.headers,
  };
  
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Для Safari и iOS удаляем заголовок Origin, так как он запрещен
  if (isSafari || isIOS) {
    delete headers['Origin'];
  }
  
  console.log(`SafeFetch: Запрос к ${fullUrl}`, { isSafari, isIOS, hasToken: !!token });
  
  try {
    // Сначала пробуем обычный запрос
    const response = await fetch(fullUrl, {
      ...options,
      credentials: 'include',
      headers: headers
    });
    
    // Проверяем статус ответа
    if (response.status === 401 && token) {
      console.warn('SafeFetch: Получен 401, пробуем повторный запрос с явным токеном');
      
      // Пробуем еще раз с явным токеном в URL
      const urlWithToken = fullUrl.includes('?') 
        ? `${fullUrl}&token=${token}` 
        : `${fullUrl}?token=${token}`;
      
      return await fetch(urlWithToken, {
        ...options,
        credentials: 'include',
        headers: headers
      });
    }
    
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    
    // Если ошибка связана с CORS или аутентификацией и используется Safari/iOS
    if ((error.message.includes('CORS') || error.message.includes('Failed to fetch') || 
         error.message.includes('401') || error.status === 401) && 
        (isSafari || isIOS)) {
      console.log('SafeFetch: Используем универсальный iOS API прокси');
      
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
          } else {
            // Если тело запроса является объектом
            params = options.body;
          }
        } catch (e) {
          console.error('SafeFetch: Ошибка при парсинге тела запроса:', e);
        }
      }
      
      // Извлекаем параметры запроса из URL для GET-запросов
      if (options.method === 'GET' && fullUrl.includes('?')) {
        const urlParams = new URLSearchParams(fullUrl.split('?')[1]);
        for (const [key, value] of urlParams.entries()) {
          params[key] = value;
        }
        // Удаляем параметры из endpoint
        endpoint = endpoint.split('?')[0];
      }
      
      console.log('SafeFetch: Используем универсальный прокси', { endpoint, method: options.method || 'GET', params });
      
      // Выполняем запрос через универсальный прокси
      const proxyResponse = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint,
          method: options.method || 'GET',
          token,
          params
        })
      });
      
      return proxyResponse;
    }
    
    throw error;
  }
};

/**
 * Выполняет GET запрос с учетом особенностей Safari и iOS
 * 
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @returns {Promise} - Результат запроса
 */
export const safeGet = async (url, options = {}) => {
  return safeFetch(url, { ...options, method: 'GET' });
};

/**
 * Выполняет POST запрос с учетом особенностей Safari и iOS
 * 
 * @param {string} url - URL для запроса
 * @param {Object} data - Данные для отправки
 * @param {Object} options - Опции fetch
 * @returns {Promise} - Результат запроса
 */
export const safePost = async (url, data, options = {}) => {
  return safeFetch(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: JSON.stringify(data)
  });
};

export default safeFetch;
