// vite.config.ts — конфигурация Vite для React-проекта
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Экспортируем конфигурацию по умолчанию: подключаем React-плагин
export default defineConfig({
  plugins: [
    // react() — добавляет поддержку React (JSX/TSX) и fast refresh
    react()
  ],
  // Этот блок создаётся, чтобы при отсутствии VITE_API_URL в .dev запросы /api шли на локальный uvicorn без CORS.
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});

