// postcss.config.cjs — конфигурация PostCSS, через которую работает Tailwind
module.exports = {
  // plugins — список PostCSS-плагинов: сначала Tailwind, затем Autoprefixer
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};

