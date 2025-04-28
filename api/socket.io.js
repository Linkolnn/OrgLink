// Этот файл обрабатывает запросы Socket.IO на Vercel через API роуты
export default async function handler(req, res) {
  // Если бэкенд и фронтенд находятся на одном домене, используем относительный URL
  // Это позволяет избежать проблем с CORS и проксированием

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

  // Получаем текущий хост и протокол из заголовков запроса
  const host = req.headers.host || 'localhost';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const origin = `${protocol}://${host}`;

  // Формируем путь для проксирования
  const socketPath = url.split('/api/socket.io')[1] || '';

  // Для бэкенда на том же домене используем относительный URL
  const targetUrl = `${origin}/socket.io${socketPath}`;

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
        // Не устанавливаем host, т.к. обращаемся к тому же домену
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
