// Специальный прокси для отправки сообщений чата на iOS устройствах
// Решает проблему с ошибкой 401 при отправке сообщений на iPhone

export default defineEventHandler(async (event) => {
  try {
    // Получаем параметры запроса
    const body = await readBody(event);
    const query = getQuery(event);
    
    // Получаем необходимые параметры
    const { chatId, text, token } = body;
    
    if (!chatId) {
      return createError({
        statusCode: 400,
        statusMessage: 'Chat ID is required'
      });
    }
    
    if (!text) {
      return createError({
        statusCode: 400,
        statusMessage: 'Message text is required'
      });
    }
    
    console.log('Chat Message Proxy: Получен запрос на отправку сообщения', { 
      chatId, 
      hasText: !!text, 
      hasToken: !!token 
    });
    
    // Формируем URL для запроса к бэкенду
    const config = useRuntimeConfig();
    const backendUrl = config.public.backendUrl || 'https://orglink.onrender.com';
    let targetUrl = `${backendUrl}/api/chats/${chatId}/messages`;
    
    // Добавляем токен в URL, если он предоставлен
    if (token) {
      targetUrl += `?token=${token}`;
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
    console.log('Chat Message Proxy: Отправка запроса к', targetUrl);
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        text, 
        media_type: 'none' 
      })
    });
    
    // Проверяем статус ответа
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Chat Message Proxy: Ошибка при отправке сообщения', { 
        status: response.status,
        error: errorData
      });
      
      return createError({
        statusCode: response.status,
        statusMessage: errorData.error || 'Ошибка при отправке сообщения'
      });
    }
    
    // Получаем данные ответа
    const responseData = await response.json();
    
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
    console.error('Chat Message Proxy Error:', error);
    return createError({
      statusCode: 500,
      statusMessage: `Chat Message Proxy Error: ${error.message}`
    });
  }
});
