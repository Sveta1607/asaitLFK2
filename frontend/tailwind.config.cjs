// tailwind.config.cjs — конфигурация Tailwind CSS с палитрой для детского ЛФК
module.exports = {
  // content — пути к файлам, в которых Tailwind сканирует классы для генерации CSS
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Кастомная палитра: мятно-зелёные основные тона + мягкие коралловые акценты
      colors: {
        mint: {
          50:  '#f0fdf6',
          100: '#dcfce9',
          200: '#bbf7d4',
          300: '#86efb0',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        coral: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        warm: {
          50:  '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
        },
      },
      // Шрифт Nunito — округлый, дружелюбный, хорошо читаемый
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      // Плавные скругления для «детского» ощущения
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      // Мягкие тени для карточек
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 4px 20px -4px rgba(34, 197, 94, 0.12)',
      },
    },
  },
  plugins: [],
};
