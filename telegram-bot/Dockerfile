# Образ Node.js для Telegram-бота (long polling). Секреты задаются в Amvera через переменные окружения, не через .env внутри образа.
FROM node:20-alpine

WORKDIR /app

# Слой зависимостей отдельно — пересборка быстрее, если меняется только код.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Остальной код бота (src/, index.js и т.д.); node_modules и .env не копируются — см. .dockerignore.
COPY . .

# Запуск как в package.json — node index.js (long polling).
CMD ["npm", "start"]
