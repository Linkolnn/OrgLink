// Этот файл обрабатывает запросы Socket.IO на Vercel через API роуты

export default defineEventHandler(async (event) => {
  // Получаем URL бэкенда из конфигурации
  const config = useRuntimeConfig();
  const backendUrl = config.public.backendUrl;
  
  // Извлекаем метод и путь запроса
  const method = event.node.req.method;
  const url = event.node.req.url;
  
  try {
    // Проксируем запрос к бэкенду
    const response = await $fetch(`${backendUrl}/socket.io${url.split('/api/socket.io')[1] || ''}`, {
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
    console.error('Socket.IO proxy error:', error);
    
    // Возвращаем ошибку
    return {
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal Server Error',
      message: error.message || 'Failed to proxy Socket.IO request',
    };
  }
});
