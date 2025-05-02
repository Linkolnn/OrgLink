// Универсальный прокси для API-запросов на iOS устройствах
// Решает проблемы с CORS и аутентификацией в Safari на iOS

export default defineEventHandler(async (event) => {
  try {
    // Проверяем, является ли запрос OPTIONS (preflight)
    if (event.node.req.method === 'OPTIONS') {
      setResponseHeaders(event, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
      });
      return { success: true };
    }
    
    // Получаем параметры запроса
    const body = await readBody(event).catch(() => ({}));
    const query = getQuery(event);
    
    // Получаем необходимые параметры
    const { endpoint, method = 'GET', token, params = {} } = body;
    
    if (!endpoint) {
      return createError({
        statusCode: 400,
        statusMessage: 'API endpoint is required'
      });
    }
    
    console.log('iOS API Proxy: Получен запрос', { 
      endpoint, 
      method,
      hasToken: !!token,
      params: Object.keys(params)
    });
    
    // Формируем URL для запроса к бэкенду
    const config = useRuntimeConfig();
    const backendUrl = config.public.backendUrl || 'https://orglink.onrender.com';
    let targetUrl = `${backendUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    // Добавляем параметры запроса в URL для GET-запросов
    if (method === 'GET' && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        queryParams.append(key, value);
      }
      targetUrl += `?${queryParams.toString()}`;
    }
    
    // Добавляем токен в URL, если он предоставлен
    if (token) {
      targetUrl += targetUrl.includes('?') ? `&token=${token}` : `?token=${token}`;
    }
    
    // Получаем заголовки запроса
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Добавляем заголовок Authorization, если есть токен
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Отправляем запрос к бэкенду
    console.log('iOS API Proxy: Отправка запроса', { method, url: targetUrl });
    
    const fetchOptions = {
      method,
      headers,
      credentials: 'include'
    };
    
    // Добавляем тело запроса для не-GET запросов
    if (method !== 'GET' && params && Object.keys(params).length > 0) {
      fetchOptions.body = JSON.stringify(params);
    }
    
    const response = await fetch(targetUrl, fetchOptions);
    
    // Проверяем статус ответа
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('iOS API Proxy: Ошибка при выполнении запроса', { 
        status: response.status,
        error: errorData
      });
      
      return createError({
        statusCode: response.status,
        statusMessage: errorData.error || `Ошибка при выполнении запроса: ${response.status}`
      });
    }
    
    // Получаем данные ответа
    const responseData = await response.json().catch(() => ({}));
    
    // Добавляем CORS заголовки
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    });
    
    // Возвращаем ответ
    return responseData;
  } catch (error) {
    console.error('iOS API Proxy Error:', error);
    return createError({
      statusCode: 500,
      statusMessage: `iOS API Proxy Error: ${error.message}`
    });
  }
});
