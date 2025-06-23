// Специальный прокси для отправки сообщений чата на iOS устройствах
// Решает проблему с ошибкой 401 при отправке сообщений на iPhone

export default defineEventHandler(async (event) => {
  try {
    // Получаем параметры запроса
    const body = await readBody(event);
    const query = getQuery(event);
    
    // Получаем необходимые параметры
    const { chatId, text, token, media_type, files, sender } = body;
    
    if (!chatId) {
      console.error('Chat Message Proxy: Ошибка - chatId не указан');
      return { error: true, message: 'Chat ID is required' };
    }
    
    // Проверяем, что есть текст или файлы
    if ((!text || text.trim() === '') && (!files || !files.length) && !media_type) {
      console.error('Chat Message Proxy: Ошибка - сообщение не может быть пустым');
      return { error: true, message: 'Message must contain text or media' };
    }
    
    console.log('Chat Message Proxy: Получен запрос на отправку сообщения', { 
      chatId, 
      hasText: !!text, 
      hasToken: !!token,
      media_type,
      hasFiles: files && files.length > 0,
      filesInfo: files ? files.map(f => ({
        name: f.file_name,
        type: f.mime_type,
        media_type: f.media_type
      })) : [],
      hasSender: !!sender
    });
    
    // Формируем URL для запроса к бэкенду
    const config = useRuntimeConfig();
    const backendUrl = config.public.backendUrl || 'https://orglink.onrender.com';
    let targetUrl = `${backendUrl}/api/chats/${chatId}/messages`;
    
    // Добавляем токен в URL, если он предоставлен
    if (token) {
      targetUrl += `?token=${token}`;
    }
    
    console.log('Chat Message Proxy: URL запроса:', targetUrl);
    
    // Получаем заголовки запроса
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Добавляем заголовок Authorization, если есть токен
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Подготавливаем тело запроса
    const requestBody = {
      text: text || ''
    };
    
    // Добавляем тип медиа
    if (media_type) {
      requestBody.media_type = media_type;
    } else {
      requestBody.media_type = 'none';
    }
    
    // Добавляем файлы, если они есть
    if (files && files.length > 0) {
      // Проверяем и нормализуем медиа тип для аудио файлов
      const processedFiles = files.map(file => {
        // Проверяем, является ли файл аудио по расширению или типу
        const isAudioByType = file.mime_type && 
          (file.mime_type.startsWith('audio/') || file.mime_type === 'audio/webm');
        const isAudioByName = file.file_name && 
          (file.file_name.startsWith('voice_message_') || 
           file.file_name.endsWith('.mp3') || 
           file.file_name.endsWith('.wav') || 
           file.file_name.endsWith('.ogg') || 
           file.file_name.endsWith('.webm'));
        const isAudioByMediaType = file.media_type === 'audio' || file.type === 'audio';
        
        // Если это аудио файл, устанавливаем правильный media_type
        if (isAudioByType || isAudioByName || isAudioByMediaType) {
          console.log('Chat Message Proxy: Обнаружен аудиофайл:', file.file_name);
          return {
            ...file,
            media_type: 'audio',
            type: 'audio'
          };
        }
        
        return file;
      });
      
      requestBody.files = processedFiles;
      
      // Если это голосовое сообщение (единственный аудио файл), устанавливаем media_type всего сообщения как audio
      if (processedFiles.length === 1 && processedFiles[0].media_type === 'audio') {
        requestBody.media_type = 'audio';
        console.log('Chat Message Proxy: Установлен media_type сообщения как audio');
      }
    }
    
    console.log('Chat Message Proxy: Тело запроса:', {
      hasText: !!requestBody.text,
      media_type: requestBody.media_type,
      filesCount: requestBody.files?.length || 0,
      filesTypes: requestBody.files?.map(f => f.media_type) || []
    });
    
    try {
    // Отправляем запрос к бэкенду
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
        body: JSON.stringify(requestBody)
      });
      
      // Получаем ответ в виде текста для анализа
      const responseText = await response.text();
      
      // Проверяем, что ответ не HTML
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html>')) {
        console.log('Chat Message Proxy: Сервер вернул HTML, используем временное сообщение');
        
        // Формируем нормализованный объект отправителя
        const normalizedSender = typeof sender === 'string' 
          ? { _id: sender, name: 'Пользователь' }
          : sender || { _id: 'unknown', name: 'Пользователь' };
        
        // Возвращаем сформированный ответ, который клиент сможет обработать
        return { 
          success: true,
          _id: `temp_${Date.now()}`,
          text,
          chat: chatId,
          media_type: media_type || 'none',
          files: files || [],
          createdAt: new Date().toISOString(),
          sender: normalizedSender
        };
      }
    
    // Проверяем статус ответа
    if (!response.ok) {
        console.error('Chat Message Proxy: Ошибка от сервера:', response.status, responseText.substring(0, 200));
        
        // Формируем нормализованный объект отправителя
        const normalizedSender = typeof sender === 'string' 
          ? { _id: sender, name: 'Пользователь' }
          : sender || { _id: 'unknown', name: 'Пользователь' };
        
        return { 
          error: true, 
        status: response.status,
          message: `Ошибка ${response.status}: ${responseText.substring(0, 200)}`,
          fallback: {
            _id: `temp_${Date.now()}`,
            text,
            chat: chatId,
            media_type: media_type || 'none',
            files: files || [],
            createdAt: new Date().toISOString(),
            sender: normalizedSender
          }
        };
      }
      
      // Пробуем распарсить JSON
      let responseData;
      try {
        // Проверяем, что ответ похож на JSON
        if (responseText && responseText.trim() && 
          (responseText.trim().startsWith('{') || responseText.trim().startsWith('['))) {
          responseData = JSON.parse(responseText);
          
          // Если в ответе нет sender, или sender - это строка, заменяем на объект
          if (!responseData.sender || typeof responseData.sender === 'string') {
            const normalizedSender = typeof sender === 'string' 
              ? { _id: sender, name: 'Пользователь' }
              : sender || { _id: 'unknown', name: 'Пользователь' };
            
            responseData.sender = normalizedSender;
          }
        } else {
          console.warn('Chat Message Proxy: Ответ не в формате JSON:', responseText.substring(0, 200));
          
          // Формируем нормализованный объект отправителя
          const normalizedSender = typeof sender === 'string' 
            ? { _id: sender, name: 'Пользователь' }
            : sender || { _id: 'unknown', name: 'Пользователь' };
          
          // Формируем базовый успешный ответ
          responseData = { 
            success: true, 
            _id: `temp_${Date.now()}`,
            chatId,
            text,
            media_type: media_type || 'none',
            files: files || [],
            createdAt: new Date().toISOString(),
            sender: normalizedSender
          };
        }
      } catch (parseError) {
        console.error('Chat Message Proxy: Ошибка при парсинге ответа:', parseError, responseText.substring(0, 200));
        
        // Формируем нормализованный объект отправителя
        const normalizedSender = typeof sender === 'string' 
          ? { _id: sender, name: 'Пользователь' }
          : sender || { _id: 'unknown', name: 'Пользователь' };
        
        // Возвращаем объект с информацией и фолбэком
        return { 
          error: true, 
          message: 'Ошибка при обработке ответа сервера',
          errorDetails: parseError.message,
          responsePreview: responseText.substring(0, 200),
          fallback: {
            _id: `temp_${Date.now()}`,
            text,
            chat: chatId,
            media_type: media_type || 'none',
            files: files || [],
            createdAt: new Date().toISOString(),
            sender: normalizedSender
          }
        };
      }
    
    // Добавляем CORS заголовки
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin',
        'Content-Type': 'application/json'
    });
    
    // Возвращаем ответ
    return responseData;
    } catch (fetchError) {
      console.error('Chat Message Proxy: Ошибка при выполнении запроса:', fetchError);
      
      // Формируем нормализованный объект отправителя
      const normalizedSender = typeof sender === 'string' 
        ? { _id: sender, name: 'Пользователь' }
        : sender || { _id: 'unknown', name: 'Пользователь' };
      
      // Возвращаем объект с информацией об ошибке и фолбэком
      return { 
        error: true, 
        message: 'Ошибка сетевого запроса',
        errorDetails: fetchError.message,
        fallback: {
          _id: `temp_${Date.now()}`,
          text,
          chat: chatId,
          media_type: media_type || 'none',
          files: files || [],
          createdAt: new Date().toISOString(),
          sender: normalizedSender
        }
      };
    }
  } catch (error) {
    console.error('Chat Message Proxy: Критическая ошибка:', error);
    
    // Пытаемся извлечь sender из body, если возможно
    let normalizedSender;
    try {
      const body = await readBody(event);
      normalizedSender = typeof body.sender === 'string' 
        ? { _id: body.sender, name: 'Пользователь' }
        : body.sender || { _id: 'unknown', name: 'Пользователь' };
    } catch {
      normalizedSender = { _id: 'unknown', name: 'Пользователь' };
    }
    
    return { 
      error: true, 
      message: 'Внутренняя ошибка прокси',
      errorDetails: error.message,
      fallback: {
        _id: `temp_${Date.now()}`,
        text: body?.text || '',
        chat: body?.chatId || '',
        media_type: body?.media_type || 'none',
        files: body?.files || [],
        createdAt: new Date().toISOString(),
        sender: normalizedSender
      }
    };
  }
});
