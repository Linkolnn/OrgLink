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
    
    // Если ошибка связана с CORS и используется Safari/iOS, используем прокси
    if ((error.message.includes('CORS') || error.message.includes('Failed to fetch')) && 
        (isSafari || isIOS)) {
      console.log('Using CORS proxy for Safari/iOS');
      
      // Формируем URL для прокси с токеном
      let proxyUrl = `${window.location.origin}/api/cors-proxy?url=${encodeURIComponent(fullUrl)}`;
      
      // Добавляем токен в URL для iOS
      if (token) {
        proxyUrl += `&token=${encodeURIComponent(token)}`;
      }
      
      console.log('SafeFetch: Используем CORS прокси', { proxyUrl });
      
      // Выполняем запрос через прокси
      const proxyResponse = await fetch(proxyUrl, {
        ...options,
        credentials: 'include',
        headers: {
          ...options.headers,
          'X-Requested-With': 'XMLHttpRequest',
          // Удаляем Origin для Safari
          ...(isSafari || isIOS ? { Origin: undefined } : {})
        }
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
