# main.py — точка входа FastAPI, CORS, подключение роутеров, Sentry, логирование
import os
import time
from pathlib import Path

import sentry_sdk
from dotenv import dotenv_values, load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Блок: загрузка переменных окружения из backend/.env рядом с main.py.
# Иначе при запуске uvicorn из другой папки (IDE, корень репозитория) find_dotenv не находит файл
# и TELEGRAM_BOT_API_SECRET / DATABASE_URL не попадают в процесс.
_backend_env = Path(__file__).resolve().parent / ".env"
load_dotenv(_backend_env, override=False)

# Если в системе/IDE уже есть TELEGRAM_BOT_API_SECRET="" (пустая строка), load_dotenv с override=False
# НЕ перезаписывает её значением из файла — бот получает 503. Дополняем только пустые ключи из .env.
if _backend_env.is_file():
    _file_vals = dotenv_values(_backend_env)
    for _key in (
        "TELEGRAM_BOT_API_SECRET",
        "TELEGRAM_LINK_SIGNING_SECRET",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_BOT_USERNAME",
        "ALLOWED_SPECIALIST_EMAIL",
        "DATABASE_URL",
        "CLERK_JWKS_URL",
        "CLERK_ISSUER",
        "SENTRY_DSN",
    ):
        _raw = _file_vals.get(_key)
        if _raw is None:
            continue
        _v = str(_raw).strip()
        if not _v:
            continue
        if not (os.environ.get(_key) or "").strip():
            os.environ[_key] = _v

# Инициализация Sentry — отправляет ошибки и трассировки в Sentry Dashboard.
# DSN берётся из .env; если пустой, SDK не инициализируется (безопасно для локальной разработки).
_sentry_dsn = os.getenv("SENTRY_DSN", "")
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        # traces_sample_rate=1.0 — 100% трассировок (подходит при малой нагрузке)
        traces_sample_rate=1.0,
        # send_default_pii=True позволяет отправлять IP и заголовки для контекста ошибок
        send_default_pii=True,
        environment=os.getenv("SENTRY_ENV", "production"),
    )

# Настройка структурированного логирования (JSON-формат для удобного парсинга в облаке)
from logger import setup_logging  # noqa: E402
logger = setup_logging()

# ВАЖНО: db/engine читают DATABASE_URL при импорте.
# Этот импорт создаётся ПОСЛЕ load_dotenv(), чтобы DATABASE_URL из backend/.env успел примениться,
# иначе будет использован дефолтный SQLite и возможны несовпадения схемы (например, нет users.username).
from db import init_db  # noqa: E402
# auth роутер отключён: регистрация и вход через Clerk (фронтенд).
from routers import users, news, slots, bookings, site_content, telegram_bot  # noqa: F401,E402

app = FastAPI(
    title="API Сайт ЛФК",
    description="Бэкенд для онлайн-записи на приём к специалисту по ЛФК",
    version="1.0.0",
)

# Блок: настройка CORS для фронтенда и dev-среды.
# Нужен, чтобы браузер разрешал запросы с фронтенда Amvera и localhost.
# Явные origins помогают избежать 405 на preflight OPTIONS за прокси Amvera.
_default_origins = [
    "https://front-svetlanagolovchanskaya.amvera.io",
    "http://front-svetlanagolovchanskaya.amvera.io",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]
_cors_env = os.getenv("CORS_ORIGINS", "").strip()
origins = _default_origins + [x.strip() for x in _cors_env.split(",") if x.strip()]
# Этот regex создаётся, чтобы браузер не блокировал API для *.amvera.io (опциональный порт). CORS_EXTRA_ORIGIN_REGEX — свой домен, полное выражение без ^$.
_amvera_part = r"https?://[a-zA-Z0-9.-]+\.amvera\.io(?::\d+)?"
_cors_extra = (os.getenv("CORS_EXTRA_ORIGIN_REGEX") or "").strip()
if _cors_extra:
    _amvera_origin_regex = rf"^(?:{_amvera_part}|{_cors_extra})$"
else:
    _amvera_origin_regex = rf"^{_amvera_part}$"
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=_amvera_origin_regex,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Middleware для логирования каждого HTTP-запроса: метод, путь, статус, время ответа.
# Позволяет отслеживать производительность и выявлять медленные эндпоинты.
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000, 2)

    log_data = {
        "method": request.method,
        "path": request.url.path,
        "status": response.status_code,
        "duration_ms": duration_ms,
        "client_ip": request.client.host if request.client else "unknown",
    }

    if response.status_code >= 500:
        logger.error("HTTP request failed", extra=log_data)
    elif response.status_code >= 400:
        logger.warning("HTTP client error", extra=log_data)
    else:
        logger.info("HTTP request", extra=log_data)

    return response


# Блок: подключение роутеров под префиксом /api.
# Нужен, чтобы сгруппировать все эндпоинты и сохранить существующий контракт с фронтендом.
app.include_router(users.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(slots.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(site_content.router, prefix="/api")
app.include_router(telegram_bot.router, prefix="/api")


@app.on_event("startup")
def startup() -> None:
    """
    Этот обработчик создаётся, чтобы:
    - инициализировать подключение к БД;
    - создать таблицы и базовые тестовые данные вместо старого init_store().
    """
    init_db()


@app.get("/")
def root():
    """Корневой эндпоинт для проверки работы API."""
    return {"message": "API Сайт ЛФК", "docs": "/docs"}


@app.get("/health")
def health():
    """Health check для мониторинга состояния сервера."""
    return {"status": "ok"}


