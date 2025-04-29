/**
 * Преобразует HTTP URL в HTTPS URL для безопасной загрузки ресурсов
 * @param {string} url - URL для преобразования
 * @returns {string} - Безопасный URL
 */
export const secureUrl = (url) => {
  if (!url) return '';
  
  // Определяем, находимся ли мы в production окружении
  const isProduction = process.env.NODE_ENV === 'production' || 
                      (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'));
  
  // Если мы в production и URL содержит localhost, заменяем его на production URL
  if (isProduction && (url.includes('localhost') || url.includes('127.0.0.1'))) {
    return url.replace(/https?:\/\/localhost(:[0-9]+)?|https?:\/\/127\.0\.0\.1(:[0-9]+)?/g, 'https://org-link.vercel.app');
  }
  
  // Не преобразуем локальные URL в локальной среде, так как локальный сервер может не поддерживать HTTPS
  if (!isProduction && (url.includes('localhost') || url.includes('127.0.0.1'))) {
    return url;
  }
  
  // Заменяем http:// на https:// только для внешних URL
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  
  // Если URL относительный или уже использует HTTPS, возвращаем как есть
  return url;
};
