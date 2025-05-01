// Глобальный middleware для добавления CORS-заголовков
// Это особенно важно для Safari и iOS, которые строго соблюдают правила CORS

export default defineNuxtRouteMiddleware((to, from) => {
  // Только для серверного рендеринга
  if (process.server) {
    const event = useRequestEvent();
    
    // Добавляем CORS-заголовки для всех ответов
    if (event && event.node && event.node.res) {
      event.node.res.setHeader('Access-Control-Allow-Origin', '*');
      event.node.res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      event.node.res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      event.node.res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      // Если это preflight запрос (OPTIONS), отвечаем сразу
      if (event.node.req.method === 'OPTIONS') {
        event.node.res.statusCode = 204;
        event.node.res.end();
        return false;
      }
    }
  }
});
