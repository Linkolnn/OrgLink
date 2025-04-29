/**
 * Преобразует HTTP URL в HTTPS URL для безопасной загрузки ресурсов
 * @param {string} url - URL для преобразования
 * @returns {string} - Безопасный URL
 */
export const secureUrl = (url) => {
  if (!url) return '';
  
  // Не преобразуем локальные URL, так как локальный сервер может не поддерживать HTTPS
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return url;
  }
  
  // Заменяем http:// на https:// только для внешних URL
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  
  // Если URL относительный или уже использует HTTPS, возвращаем как есть
  return url;
};
