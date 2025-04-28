// Этот файл обрабатывает запросы Socket.IO на Vercel через API роуты
export default async function handler(req, res) {
  // Логируем информацию о запросе для отладки
  console.log('Socket.IO proxy request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      BACKEND_URL: process.env.BACKEND_URL
    }
  });

  // Извлекаем метод и путь запроса
  const method = req.method;
  const url = req.url;

  // Определяем целевой URL для проксирования
  let targetUrl;
  const backendUrl = process.env.BACKEND_URL;
  
  if (backendUrl) {
    // Если задан BACKEND_URL, используем его (для разных доменов фронтенда и бэкенда)
    // Формируем путь для проксирования
    const socketPath = url.split('/socket.io')[1] || '';
    targetUrl = `${backendUrl}/socket.io${socketPath}`;
  } else {
    // Для бэкенда на том же домене используем относительный URL
    const host = req.headers.host || 'localhost';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const origin = `${protocol}://${host}`;
    const socketPath = url.split('/socket.io')[1] || '';
    targetUrl = `${origin}/socket.io${socketPath}`;
  }

  console.log(`Socket.IO proxy: ${method} ${url} -> ${targetUrl}`);

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
        // Удаляем заголовки, которые могут вызвать проблемы при проксировании
        host: undefined,
        'x-forwarded-host': undefined,
        'x-vercel-deployment-url': undefined,
        'x-vercel-id': undefined,
      },
      credentials: 'include',
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
    
    // Добавляем CORS заголовки для поддержки WebSocket
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

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
