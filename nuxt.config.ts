import { resolve } from 'path'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  ssr: false, // Отключаем SSR для решения проблем с гидратацией
  modules: ['@pinia/nuxt', 'nuxt-svgo'],
  
  // Переменные окружения, доступные на клиенте
  runtimeConfig: {
    // Приватные ключи, доступны только на сервере
    jwtSecret: process.env.JWT_SECRET,
    // публичные ключи, доступны на клиенте
    public: {
      backendUrl: process.env.BACKEND_URL,
    }
  },
  
  // Настройки для PWA и мобильных устройств
  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'theme-color', content: '#1E1E1E' } // Цвет темы, соответствующий вашему дизайну
      ],
      link: [
        { rel: 'manifest', href: '/manifest.json' }
      ]
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
