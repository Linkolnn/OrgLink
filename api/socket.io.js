// Этот файл обрабатывает запросы Socket.IO на Vercel через API роуты
export default async function handler(req, res) {
  // Получаем URL бэкенда из переменных окружения
  // Используем захардкоженный URL для продакшена, если переменная окружения не установлена
  const backendUrl = process.env.BACKEND_URL || 'https://orglink-backend.onrender.com';
  
  if (!backendUrl) {
    console.error('Socket.IO proxy error: Backend URL is not defined');
    return res.status(500).json({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Backend URL is not configured',
    });
  }
  
  // Извлекаем метод и путь запроса
  const method = req.method;
  const url = req.url;
  
  // Логируем запрос для отладки
  console.log(`Socket.IO proxy: ${method} ${url} -> ${backendUrl}`);
  
  // Формируем путь для проксирования
  const socketPath = url.split('/api/socket.io')[1] || '';
  const targetUrl = `${backendUrl}/socket.io${socketPath}`;
  
  try {
    // Получаем тело запроса для методов, отличных от GET
    let body;
    if (method !== 'GET') {
      body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      await new Promise((resolve) => {
        req.on('end', resolve);
      });
      
      try {
        body = JSON.parse(body);
      } catch (e) {
        // Если не JSON, оставляем как есть
      }
    }
    
    // Настраиваем параметры запроса
    const fetchOptions = {
      method,
      headers: {
        ...req.headers,
        host: new URL(backendUrl).host,
      },
    };
    
    if (method !== 'GET' && body) {
      fetchOptions.body = JSON.stringify(body);
      fetchOptions.headers['content-type'] = 'application/json';
    }
    
    // Выполняем запрос к бэкенду
    const fetchResponse = await fetch(targetUrl, fetchOptions);
    
    // Получаем ответ
    const responseData = await fetchResponse.text();
    const contentType = fetchResponse.headers.get('content-type');
    
    // Устанавливаем заголовки ответа
    res.setHeader('Content-Type', contentType || 'text/plain');
    
    // Отправляем ответ клиенту
    res.status(fetchResponse.status);
    
    if (contentType && contentType.includes('application/json')) {
      try {
        const jsonData = JSON.parse(responseData);
        return res.json(jsonData);
      } catch (e) {
        // Если не удалось распарсить JSON, отправляем как текст
      }
    }
    
    return res.send(responseData);
  } catch (error) {
    console.error(`Socket.IO proxy error for ${targetUrl}:`, error);
    
    // Возвращаем ошибку
    return res.status(error.status || 500).json({
      statusCode: error.status || 500,
      statusMessage: error.statusMessage || 'Internal Server Error',
      message: error.message || 'Failed to proxy Socket.IO request',
    });
  }
}
