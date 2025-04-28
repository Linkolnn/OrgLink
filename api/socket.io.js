// Этот файл обрабатывает запросы Socket.IO на Vercel через API роуты

export default defineEventHandler(async (event) => {
  // Получаем URL бэкенда из конфигурации
  const config = useRuntimeConfig();
  const backendUrl = config.public.backendUrl;
  
  if (!backendUrl) {
    console.error('Socket.IO proxy error: Backend URL is not defined');
    return {
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Backend URL is not configured',
    };
  }
  
  // Извлекаем метод и путь запроса
  const method = event.node.req.method;
  const url = event.node.req.url;
  
  // Логируем запрос для отладки
  console.log(`Socket.IO proxy: ${method} ${url} -> ${backendUrl}`);
  
  // Формируем путь для проксирования
  const socketPath = url.split('/api/socket.io')[1] || '';
  const targetUrl = `${backendUrl}/socket.io${socketPath}`;
  
  try {
    // Проксируем запрос к бэкенду
    const response = await $fetch(targetUrl, {
      method,
      body: method !== 'GET' ? await readBody(event) : undefined,
      headers: {
        ...event.node.req.headers,
        host: new URL(backendUrl).host,
      },
    });
    
    // Возвращаем ответ от бэкенда
    return response;
  } catch (error) {
    console.error(`Socket.IO proxy error for ${targetUrl}:`, error);
    
    // Возвращаем ошибку
    return {
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal Server Error',
      message: error.message || 'Failed to proxy Socket.IO request',
    };
  }
});
