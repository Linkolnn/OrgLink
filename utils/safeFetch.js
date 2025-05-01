// Утилита для безопасных запросов с поддержкой CORS для Safari и iOS
import { useRuntimeConfig } from '#imports';

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
  
  try {
    // Сначала пробуем обычный запрос
    const response = await fetch(fullUrl, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        'Origin': window.location.origin,
      }
    });
    
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    
    // Если ошибка связана с CORS и используется Safari/iOS, используем прокси
    if ((error.message.includes('CORS') || error.message.includes('Failed to fetch')) && 
        (isSafari || isIOS)) {
      console.log('Using CORS proxy for Safari/iOS');
      
      // Формируем URL для прокси
      const proxyUrl = `${window.location.origin}/api/cors-proxy?url=${encodeURIComponent(fullUrl)}`;
      
      // Выполняем запрос через прокси
      const proxyResponse = await fetch(proxyUrl, {
        ...options,
        credentials: 'include',
        headers: {
          ...options.headers,
          'X-Requested-With': 'XMLHttpRequest',
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
