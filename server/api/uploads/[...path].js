// Этот файл обрабатывает запросы к загруженным файлам на Vercel через API роуты

export default defineEventHandler(async (event) => {
  // Получаем URL бэкенда из конфигурации
  const config = useRuntimeConfig();
  const backendUrl = config.public.backendUrl || 'https://org-link-backend.vercel.app';
  
  // Извлекаем путь запроса
  const path = event.context.params.path || '';
  
  // Логируем запрос для отладки
  console.log(`Uploads proxy: ${event.node.req.method} ${event.node.req.url} -> ${backendUrl}/uploads/${path}`);
  
  try {
    // Формируем URL для проксирования
    const targetUrl = `${backendUrl}/uploads/${path}`;
    
    // Проксируем запрос к бэкенду
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        ...event.node.req.headers,
        host: new URL(backendUrl).host,
      },
    });
    
    // Проверяем статус ответа
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    
    // Получаем данные и тип контента
    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type');
    
    // Устанавливаем заголовки ответа
    event.node.res.setHeader('Content-Type', contentType || 'application/octet-stream');
    event.node.res.setHeader('Cache-Control', 'public, max-age=31536000'); // Кэшируем на 1 год
    
    // Возвращаем данные
    return Buffer.from(data);
  } catch (error) {
    console.error(`Uploads proxy error for ${path}:`, error);
    
    // Возвращаем ошибку
    return {
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: error.message || 'Failed to proxy file request',
    };
  }
});
