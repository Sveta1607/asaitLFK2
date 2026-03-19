// tailwind.config.cjs — конфигурация Tailwind CSS (указывает файлы, где искать классы)
module.exports = {
  // content — пути к файлам, в которых Tailwind сканирует классы для генерации CSS
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // theme — базовая тема (цвета, размеры); пока оставляем стандартную
  theme: {
    extend: {}
  },
  // plugins — дополнительные плагины Tailwind; пока не используем
  plugins: []
};

