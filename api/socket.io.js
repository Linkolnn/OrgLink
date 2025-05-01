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

  // Обрабатываем preflight запросы CORS
  if (req.method === 'OPTIONS') {
    // Получаем значение Origin из заголовка запроса или используем звездочку
    const origin = req.headers.origin || '*';
    
    // Добавляем расширенные заголовки CORS для совместимости с Safari и iOS
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Socket-IO-Proxied');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 часа
    res.setHeader('Vary', 'Origin'); // Важно для кэширования
    return res.status(204).end();
  }
  
  // Добавляем CORS заголовки для всех ответов, не только для OPTIONS
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  // Проверяем, не является ли текущий запрос уже проксированным
  // Это поможет избежать циклических перенаправлений
  if (req.headers['x-socket-io-proxied']) {
    console.log('Detected already proxied request, aborting to prevent loop');
    return res.status(400).json({ error: 'Socket.IO proxy loop detected' });
  }

  // Извлекаем метод и путь запроса
  const method = req.method;
  const url = req.url;

  // Определяем целевой URL для проксирования
  // Используем внешний бэкенд URL
  const backendUrl = process.env.BACKEND_URL || 'https://orglink-production-e9d8.up.railway.app';
  
  // Проверяем, что URL не заканчивается на слэш
  const cleanBackendUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
  
  // Определяем, используется ли Safari или iOS
  const userAgent = req.headers['user-agent'] || '';
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !userAgent.includes('MSStream');
  
  console.log('Socket.IO proxy browser detection:', { isSafari, isIOS });
  console.log('Using backend URL for Socket.IO proxy:', backendUrl);
  
  // Формируем путь для проксирования
  let socketPath = '';
  if (url.includes('socket.io')) {
    // Извлекаем путь после socket.io
    const match = url.match(/socket\.io(.*)/);
    if (match && match[1]) {
      socketPath = match[1];
    }
  }
  
  const targetUrl = `${cleanBackendUrl}/socket.io${socketPath}`;

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

    // Создаем объект с опциями для запроса
    const options = {
      method: method,
      headers: {
        ...req.headers,
        'x-socket-io-proxied': 'true', // Метка для предотвращения циклических перенаправлений
        'host': new URL(cleanBackendUrl).host, // Заменяем заголовок host на целевой хост
        'origin': req.headers.origin || 'https://org-link.vercel.app', // Добавляем явный origin для Safari/iOS
      },
      // Добавляем параметры для совместимости с Safari/iOS
      credentials: 'include',
      mode: 'cors',
    };

    // Копируем необходимые заголовки
    const headersToKeep = [
      'accept', 'accept-encoding', 'accept-language', 'content-type', 'content-length',
      'user-agent', 'cookie', 'authorization', 'connection', 'cache-control',
      'if-none-match', 'if-modified-since', 'referer', 'origin'
    ];
    
    // Добавляем только необходимые заголовки
    for (const header of headersToKeep) {
      if (req.headers[header]) {
        headers[header] = req.headers[header];
      }
    }
    
    // Добавляем дополнительные заголовки
    headers['x-socket-io-proxied'] = '1';
    headers['origin'] = origin;
    
    const fetchOptions = {
      method,
      headers,
      credentials: 'include',
    };

    if (method !== 'GET' && body) {
      fetchOptions.body = JSON.stringify(body);
      fetchOptions.headers['content-type'] = 'application/json';
    }

    // Выполняем запрос к бэкенду с таймаутом
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 секунд таймаут (меньше чем у Vercel)
    
    try {
      fetchOptions.signal = controller.signal;
      const fetchResponse = await fetch(targetUrl, fetchOptions);
      clearTimeout(timeoutId);

      // Получаем ответ
      const responseData = await fetchResponse.text();
      const contentType = fetchResponse.headers.get('content-type');

      // Устанавливаем заголовки ответа
      res.setHeader('Content-Type', contentType || 'text/plain');
    
      // Добавляем CORS заголовки для поддержки WebSocket
      res.setHeader('Access-Control-Allow-Origin', origin !== '*' ? origin : '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      // Копируем все заголовки из ответа бэкенда
      for (const [key, value] of fetchResponse.headers.entries()) {
        // Пропускаем заголовки, которые мы уже установили
        if (!['content-type', 'access-control-allow-origin', 'access-control-allow-methods', 
             'access-control-allow-headers', 'access-control-allow-credentials'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }

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
      // Проверяем, является ли ошибка таймаутом
      if (error.name === 'AbortError') {
        console.error('Socket.IO proxy timeout for:', targetUrl);
        return res.status(504).json({
          statusCode: 504,
          statusMessage: 'Gateway Timeout',
          message: 'Socket.IO proxy request timed out',
        });
      }
      
      return res.status(error.status || 500).json({
        statusCode: error.status || 500,
        statusMessage: error.statusMessage || 'Internal Server Error',
        message: error.message || 'Failed to proxy Socket.IO request',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error(`Socket.IO proxy error for ${targetUrl}:`, error);

    // Возвращаем ошибку
    // Проверяем, является ли ошибка таймаутом
    if (error.name === 'AbortError') {
      console.error('Socket.IO proxy timeout for:', targetUrl);
      return res.status(504).json({
        statusCode: 504,
        statusMessage: 'Gateway Timeout',
        message: 'Socket.IO proxy request timed out',
      });
    }
    
    return res.status(error.status || 500).json({
      statusCode: error.status || 500,
      statusMessage: error.statusMessage || 'Internal Server Error',
      message: error.message || 'Failed to proxy Socket.IO request',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
