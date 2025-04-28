// Этот файл обрабатывает запросы Socket.IO на Vercel через API роуты
export default async function handler(req, res) {
  // Логируем информацию о запросе для отладки
  console.log('Socket.IO proxy request:', {
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl || req.url,
    path: req.path,
    headers: {
      host: req.headers.host,
      referer: req.headers.referer,
      origin: req.headers.origin,
      'x-forwarded-host': req.headers['x-forwarded-host'],
      'x-forwarded-proto': req.headers['x-forwarded-proto']
    }
  });

  // Проверяем, не является ли текущий запрос уже проксированным
  // Это поможет избежать циклических перенаправлений
  if (req.headers['x-socket-io-proxied']) {
    console.log('Detected already proxied request, aborting to prevent loop');
    return res.status(400).json({ error: 'Socket.IO proxy loop detected' });
  }

  // Если запрос пришел на /socket.io, а не на /api/socket.io, это может быть циклическое перенаправление
  if (req.url.startsWith('/socket.io') && !req.url.startsWith('/api/socket.io')) {
    console.log('Detected potential loop with /socket.io path, aborting');
    return res.status(400).json({ error: 'Socket.IO proxy path conflict' });
  }

  // Извлекаем метод и путь запроса
  const method = req.method;
  const url = req.url;

  // Определяем целевой URL для проксирования
  // Используем внешний бэкенд URL вместо прокси на том же домене
  const backendUrl = process.env.BACKEND_URL || 'https://org-link-backend.vercel.app';
  
  // Формируем путь для проксирования
  let socketPath = '';
  if (url.includes('socket.io')) {
    // Извлекаем путь после socket.io
    const match = url.match(/socket\.io(.*)/);
    if (match && match[1]) {
      socketPath = match[1];
    }
  }
  
  const targetUrl = `${backendUrl}/socket.io${socketPath}`;

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
        // Добавляем маркер, что запрос уже проксирован
        'x-socket-io-proxied': '1'
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
