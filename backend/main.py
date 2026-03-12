# main.py — точка входа FastAPI, CORS, подключение роутеров
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from routers import auth, users, news, slots, bookings  # noqa: F401

# Блок: загрузка переменных окружения.
# Нужен, чтобы прочитать PORT, HOST, DATABASE_URL и дополнительные CORS_ORIGINS из .env.
load_dotenv()

app = FastAPI(
    title="API Сайт ЛФК",
    description="Бэкенд для онлайн-записи на приём к специалисту по ЛФК",
    version="1.0.0",
)

# Блок: настройка CORS для dev-среды.
# Нужен, чтобы фронтенд на Vite (localhost:5173 и др.) мог обращаться к API.
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:3000",
]
if os.getenv("CORS_ORIGINS"):
    origins.extend(os.getenv("CORS_ORIGINS", "").split(","))
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Блок: подключение роутеров под префиксом /api.
# Нужен, чтобы сгруппировать все эндпоинты и сохранить существующий контракт с фронтендом.
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(slots.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")


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
