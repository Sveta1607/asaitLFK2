# Этот этап создаётся, чтобы собрать фронтенд как статические файлы Vite.
FROM node:22-alpine AS build

# Этот блок создаётся, чтобы изолировать сборку фронтенда в своей директории.
WORKDIR /app

# Этот блок создаётся, чтобы установить зависимости frontend-приложения.
COPY package*.json ./
RUN npm ci

# Этот блок создаётся, чтобы в сборке использовать относительный /api: Nginx проксирует на бэкенд (без CORS).
# Для статики без Nginx задайте полный URL: --build-arg VITE_API_URL=https://ваш-бэкенд.../api
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

# Этот блок создаётся, чтобы Clerk-ключ попал в продакшен-сборку (publishable key — публичный).
ARG VITE_CLERK_PUBLISHABLE_KEY=pk_test_aHVtb3JvdXMtbW9sbHktNTUuY2xlcmsuYWNjb3VudHMuZGV2JA
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

# Этот блок создаётся, чтобы собрать production-версию фронтенда.
COPY . .
RUN npm run build

# Этот этап создаётся, чтобы обслуживать только статику фронтенда через Nginx.
FROM nginx:1.27-alpine

# Этот блок создаётся, чтобы выбрать прокси: nginx.conf → Amvera API; nginx-docker-compose.conf → сервис backend в compose.
ARG NGINX_CONFIG=nginx.conf
COPY ${NGINX_CONFIG} /etc/nginx/conf.d/default.conf

# Этот блок создаётся, чтобы скопировать итоговую статику из этапа сборки.
COPY --from=build /app/dist /usr/share/nginx/html

# Этот блок создаётся, чтобы документировать порт веб-сервера фронтенда.
EXPOSE 80
