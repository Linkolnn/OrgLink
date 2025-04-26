// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  ssr: true,
  modules: ['@pinia/nuxt'],
  
  // Переменные окружения, доступные на клиенте
  runtimeConfig: {
    // Приватные ключи, доступны только на сервере
    // публичные ключи, доступны на клиенте
    public: {
      backendUrl: process.env.BACKEND_URL,
    }
  }
})
