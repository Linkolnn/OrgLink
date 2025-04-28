// Этот файл обрабатывает запросы к загруженным файлам на Vercel
export default async function handler(req, res) {
  // Логируем информацию о запросе для отладки
  console.log('Uploads proxy request:', {
    method: req.method,
    url: req.url,
    path: req.url.split('/uploads/')[1] || '',
    headers: {
      host: req.headers.host,
      referer: req.headers.referer
    }
  });

  // Проверяем, что это GET-запрос
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Получаем путь к файлу из URL
  const filePath = req.url.split('/uploads/')[1];
  if (!filePath) {
    return res.status(400).json({ error: 'File path not specified' });
  }

  // Определяем тип файла
  let fileType = 'unknown';
  if (filePath.includes('chat-avatar')) {
    fileType = 'chat-avatar';
  } else if (filePath.includes('message-file')) {
    fileType = 'message-file';
  }

  // Определяем целевой URL для проксирования
  const backendUrl = process.env.BACKEND_URL || 'https://org-link-backend.vercel.app';
  
  // Формируем URL для проксирования
  let targetUrl;
  if (fileType === 'chat-avatar') {
    targetUrl = `${backendUrl}/uploads/chat-avatars/${filePath}`;
  } else if (fileType === 'message-file') {
    targetUrl = `${backendUrl}/uploads/message-files/${filePath}`;
  } else {
    targetUrl = `${backendUrl}/uploads/${filePath}`;
  }

  console.log(`Uploads proxy: GET ${req.url} -> ${targetUrl}`);

  try {
    // Выполняем запрос к бэкенду
    const fetchResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        // Удаляем заголовки, которые могут вызвать проблемы при проксировании
        ...req.headers,
        host: undefined,
        'x-forwarded-host': undefined,
        'x-vercel-deployment-url': undefined,
        'x-vercel-id': undefined
      }
    });

    // Проверяем статус ответа
    if (!fetchResponse.ok) {
      return res.status(fetchResponse.status).json({ 
        error: `Failed to fetch file: ${fetchResponse.statusText}` 
      });
    }

    // Получаем тип контента и данные
    const contentType = fetchResponse.headers.get('content-type');
    const buffer = await fetchResponse.arrayBuffer();

    // Устанавливаем заголовки ответа
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Кэшируем на 1 год
    
    // Отправляем файл
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    console.error(`Uploads proxy error for ${targetUrl}:`, error);

    // Возвращаем ошибку
    return res.status(500).json({
      error: 'Failed to proxy file request',
      message: error.message
    });
  }
}
