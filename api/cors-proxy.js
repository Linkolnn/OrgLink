// CORS-прокси для обхода ограничений CORS в Safari и iOS
// Этот прокси будет использоваться для запросов к бэкенду, когда возникают проблемы с CORS

export default defineEventHandler(async (event) => {
  try {
    // Получаем URL и токен из query параметров
    const query = getQuery(event);
    const url = query.url;
    const token = query.token; // Получаем токен из URL
    
    console.log('CORS Proxy: Получен запрос', { url, hasToken: !!token });
    
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
    } else if (token) {
      // Если токен есть в URL, используем его в заголовке Authorization
      headers.authorization = `Bearer ${token}`;
      console.log('CORS Proxy: Добавлен токен в заголовок Authorization');
    }
    
    if (requestHeaders.cookie) {
      headers.cookie = requestHeaders.cookie;
    }
    if (requestHeaders['content-type']) {
      headers['content-type'] = requestHeaders['content-type'];
    }
    
    // Добавляем заголовок Origin, но не для Safari
    const userAgent = requestHeaders['user-agent'] || '';
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    
    if (!isSafari) {
      headers.origin = requestHeaders.origin || 'https://org-link.vercel.app';
    }
    
    // Добавляем токен в URL, если он есть и его нет в заголовке
    let targetUrl = url;
    if (token && !headers.authorization) {
      targetUrl = url.includes('?') 
        ? `${url}&token=${token}` 
        : `${url}?token=${token}`;
      console.log('CORS Proxy: Добавлен токен в URL');
    }
    
    console.log('CORS Proxy: Выполняем запрос к', targetUrl);
    
    // Выполняем запрос к целевому URL
    const response = await fetch(targetUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });
    
    // Получаем ответ
    const responseData = await response.json();
    
    // Добавляем CORS заголовки
    const origin = requestHeaders.origin || '*';
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
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
