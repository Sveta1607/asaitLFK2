# main.py — точка входа FastAPI, CORS, подключение роутеров
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Блок: загрузка переменных окружения.
# Нужен, чтобы прочитать PORT, HOST, DATABASE_URL и дополнительные CORS_ORIGINS из .env.
load_dotenv()

# ВАЖНО: db/engine читают DATABASE_URL при импорте.
# Этот импорт создаётся ПОСЛЕ load_dotenv(), чтобы DATABASE_URL из backend/.env успел примениться,
# иначе будет использован дефолтный SQLite и возможны несовпадения схемы (например, нет users.username).
from db import init_db  # noqa: E402
# auth роутер отключён: регистрация и вход через Clerk (фронтенд).
from routers import users, news, slots, bookings, site_content  # noqa: F401,E402

app = FastAPI(
    title="API Сайт ЛФК",
    description="Бэкенд для онлайн-записи на приём к специалисту по ЛФК",
    version="1.0.0",
)

# Блок: настройка CORS для dev-среды.
# Нужен, чтобы фронтенд на Vite с любого localhost:порт мог обращаться к API.
# В разработке можно безопасно разрешить все источники без учёта cookies.
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Блок: подключение роутеров под префиксом /api.
# Нужен, чтобы сгруппировать все эндпоинты и сохранить существующий контракт с фронтендом.
app.include_router(users.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(slots.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(site_content.router, prefix="/api")


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
