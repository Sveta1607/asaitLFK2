# Сайт ЛФК: раздельный Docker-деплой

Этот проект разворачивается двумя полностью автономными контейнерами:

- `frontend` — отдельный контейнер со статикой (Vite build + Nginx);
- `backend` — отдельный контейнер с FastAPI на порту `3000`.

Контейнеры связаны только по HTTP API через стандартную Docker-сеть (`frontend -> http://backend:3000/api`).

## Структура деплоя

- `frontend/Dockerfile` — самостоятельная сборка фронтенда и запуск Nginx.
- `frontend/.dockerignore` — исключения только для фронтенд-образа.
- `backend/Dockerfile` — самостоятельная сборка backend-сервиса.
- `backend/.dockerignore` — исключения только для backend-образа.
- `docker-compose.yml` — оркестрация двух изолированных сервисов.

## Быстрый запуск

Из корня проекта:

```bash
docker compose up --build -d
```

Проверка статуса:

```bash
docker compose ps
```

Остановка:

```bash
docker compose down
```

## Порты сервисов

- Фронтенд: [http://localhost:8080](http://localhost:8080)
- Бэкенд API: [http://localhost:3000](http://localhost:3000)
- Swagger: [http://localhost:3000/docs](http://localhost:3000/docs)

## Настройка `VITE_API_URL` для продакшена

Фронтенд получает адрес API на этапе сборки Docker-образа (`ARG VITE_API_URL`).

По умолчанию в `docker-compose.yml` используется:

```env
VITE_API_URL=http://backend:3000/api
```

Чтобы использовать внешний URL API (например, отдельный домен), задайте переменную перед сборкой:

```bash
set VITE_API_URL=https://api.example.com/api
docker compose up --build -d
```

Для PowerShell:

```powershell
$env:VITE_API_URL="https://api.example.com/api"
docker compose up --build -d
```

После изменения `VITE_API_URL` обязательно выполняйте пересборку фронтенда (`--build`), так как значение встраивается в статические файлы.

## Проверка доступности бэкенда

Проверка healthcheck:

```bash
curl http://localhost:3000/health
```

Ожидаемый ответ:

```json
{"status":"ok"}
```

Проверка API-префикса:

```bash
curl http://localhost:3000/
```

## Важно по изоляции

- Нет общего Dockerfile для frontend/backend.
- Фронтенд не копируется в backend-контейнер.
- Backend не раздаёт frontend-статику.
- Shared volumes/bind mounts между сервисами не используются.
- Каждый сервис можно масштабировать отдельно, например:

```bash
docker compose up --scale backend=2 -d
```
