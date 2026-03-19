# Сайт ЛФК: раздельный Docker-деплой (Amvera)

Этот проект разворачивается двумя полностью автономными контейнерами:

- `frontend` — отдельный контейнер со статикой (Vite build + Nginx);
- `backend` — отдельный контейнер с FastAPI на порту `3000`.

## Продакшен-ссылки (Amvera)

- Бэкенд API: [https://lfk-b-svetlanagolovchanskaya.amvera.io](https://lfk-b-svetlanagolovchanskaya.amvera.io)
- Swagger: [https://lfk-b-svetlanagolovchanskaya.amvera.io/docs](https://lfk-b-svetlanagolovchanskaya.amvera.io/docs)
- Health check: [https://lfk-b-svetlanagolovchanskaya.amvera.io/health](https://lfk-b-svetlanagolovchanskaya.amvera.io/health)

Фронтенд обращается к бэкенду через `VITE_API_URL=https://lfk-b-svetlanagolovchanskaya.amvera.io/api`.

## Структура деплоя

- `frontend/Dockerfile` — самостоятельная сборка фронтенда и запуск Nginx.
- `frontend/.dockerignore` — исключения только для фронтенд-образа.
- `backend/Dockerfile` — самостоятельная сборка backend-сервиса.
- `backend/.dockerignore` — исключения только для backend-образа.
- `amvera.yaml` — конфигурация для Amvera (путь к Dockerfile, порт).
- `docker-compose.yml` — оркестрация двух изолированных сервисов (для локального запуска).

## Быстрый запуск (локально)

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

## Порты сервисов (локально)

- Фронтенд: [http://localhost:8080](http://localhost:8080)
- Бэкенд API: [http://localhost:3000](http://localhost:3000)
- Swagger: [http://localhost:3000/docs](http://localhost:3000/docs)

## Настройка `VITE_API_URL`

Фронтенд получает адрес API на этапе сборки Docker-образа (`ARG VITE_API_URL`).

По умолчанию используется продакшен-бэкенд на Amvera:

```env
VITE_API_URL=https://lfk-b-svetlanagolovchanskaya.amvera.io/api
```

Для локальной разработки можно переопределить в `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

После изменения `VITE_API_URL` обязательно выполняйте пересборку фронтенда (`--build`), так как значение встраивается в статические файлы.

## Проверка доступности бэкенда

```bash
curl https://lfk-b-svetlanagolovchanskaya.amvera.io/health
```

Ожидаемый ответ:

```json
{"status":"ok"}
```

## Деплой на Amvera

На Amvera `docker-compose.yml` не поддерживается. Каждый сервис деплоится как отдельный проект:

1. **Backend** — проект с `backend/Dockerfile` и `amvera.yaml` (containerPort: 3000).
2. **Frontend** — отдельный проект с `frontend/Dockerfile` (containerPort: 80).

При деплое фронтенда убедитесь, что `VITE_API_URL` указывает на реальный URL бэкенда.

## Важно по изоляции

- Нет общего Dockerfile для frontend/backend.
- Фронтенд не копируется в backend-контейнер.
- Backend не раздаёт frontend-статику.
- Shared volumes/bind mounts между сервисами не используются.
- Каждый сервис можно масштабировать отдельно.
