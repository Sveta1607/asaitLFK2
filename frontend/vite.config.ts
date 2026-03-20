// vite.config.ts — конфигурация Vite для React-проекта
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Экспортируем конфигурацию по умолчанию: подключаем React-плагин
export default defineConfig({
  plugins: [
    // react() — добавляет поддержку React (JSX/TSX) и fast refresh
    react()
  ]
});

