// CORS-прокси для обхода ограничений CORS в Safari и iOS
// Этот прокси будет использоваться для запросов к бэкенду, когда возникают проблемы с CORS

export default defineEventHandler(async (event) => {
  try {
    // Получаем URL из query параметров
    const query = getQuery(event);
    const url = query.url;
    
    if (!url) {
      return createError({
        statusCode: 400,
        statusMessage: 'URL parameter is required'
      });
    }
    
    // Получаем метод и тело запроса
    const method = event.node.req.method;
    const body = method !== 'GET' && method !== 'HEAD' ? await readBody(event) : undefined;
    
    // Получаем заголовки запроса
    const headers = {};
    const requestHeaders = event.node.req.headers;
    
    // Копируем необходимые заголовки
    if (requestHeaders.authorization) {
      headers.authorization = requestHeaders.authorization;
    }
    if (requestHeaders.cookie) {
      headers.cookie = requestHeaders.cookie;
    }
    if (requestHeaders['content-type']) {
      headers['content-type'] = requestHeaders['content-type'];
    }
    
    // Добавляем заголовок Origin
    headers.origin = requestHeaders.origin || 'https://org-link.vercel.app';
    
    // Выполняем запрос к целевому URL
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });
    
    // Получаем ответ
    const responseData = await response.json();
    
    // Добавляем CORS заголовки
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true'
    });
    
    // Возвращаем ответ
    return responseData;
  } catch (error) {
    console.error('CORS Proxy Error:', error);
    return createError({
      statusCode: 500,
      statusMessage: `CORS Proxy Error: ${error.message}`
    });
  }
});
