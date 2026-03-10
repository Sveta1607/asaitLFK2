# Бэкенд API — Сайт ЛФК

FastAPI-бэкенд для онлайн-записи на приём к специалисту по ЛФК. Данные хранятся в памяти (без БД).

## Требования

- Python 3.10+
- pip

## Установка

1. Перейдите в папку `backend`:

   ```bash
   cd backend
   ```

2. Создайте виртуальное окружение (рекомендуется):

   ```bash
   python -m venv venv
   ```

3. Активируйте виртуальное окружение:
   - **Windows (cmd):** `venv\Scripts\activate`
   - **Windows (PowerShell):** `.\venv\Scripts\Activate.ps1`
   - **Linux/macOS:** `source venv/bin/activate`

4. Установите зависимости:

   ```bash
   pip install -r requirements.txt
   ```

## Настройка

Файл `.env` уже создан с примерами. При необходимости скопируйте `.env.example` и измените переменные:

| Переменная   | Описание                     | Пример                     |
| ------------ | ---------------------------- | -------------------------- |
| PORT         | Порт сервера                 | 8000                       |
| HOST         | Хост (0.0.0.0 — все интерфейсы) | 0.0.0.0                 |
| CORS_ORIGINS | Дополнительные CORS origins  | http://localhost:8080      |

## Запуск

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 3000
```

API будет доступен по адресу: **http://localhost:3000** (эндпоинты: http://localhost:3000/api/...)

- Swagger UI (документация): http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Фронтенд

Для работы с фронтендом (Vite, React) в `saitLFK`:

1. Запустите бэкенд: `uvicorn main:app --reload --port 8000`
2. Запустите фронтенд: `cd saitLFK && npm run dev`
3. Откройте http://localhost:5173

CORS настроен для `http://localhost:5173` и `http://localhost:3000`. При запросах к API передавайте заголовок `X-User-Id` (ID текущего пользователя после логина).
