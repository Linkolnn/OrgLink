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
