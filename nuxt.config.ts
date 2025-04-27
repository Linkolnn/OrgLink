import { resolve } from 'path'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  ssr: true,
  modules: ['@pinia/nuxt', 'nuxt-svgo'],
  
  // Переменные окружения, доступные на клиенте
  runtimeConfig: {
    // Приватные ключи, доступны только на сервере
    // публичные ключи, доступны на клиенте
    public: {
      backendUrl: process.env.BACKEND_URL,
    }
  },
  svgo: {
    autoImportPath: "./assets/icons/",
    componentPrefix: "Icon",
    svgoConfig: {
      plugins: [
        { 
          name: 'preset-default',
          params: {
            overrides: {
              removeViewBox: false,
            }
          }
        }
      ]
    }
  },
  alias: {
    '@variables': resolve(__dirname, './assets/styles/variables.sass'),
    '@chat': resolve(__dirname, './assets/styles/chat.sass'),
  },

})
