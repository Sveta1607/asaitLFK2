# main.py — точка входа FastAPI, CORS, подключение роутеров
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from store import init_store
from routers import auth, users, news, slots, bookings  # noqa: F401

# Загружаем переменные из .env
load_dotenv()

app = FastAPI(
    title="API Сайт ЛФК",
    description="Бэкенд для онлайн-записи на приём к специалисту по ЛФК",
    version="1.0.0",
)

# CORS: разрешаем запросы с фронтенда (Vite dev server)
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

# Подключаем роутеры под префиксом /api
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(slots.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")


@app.on_event("startup")
def startup():
    """Инициализация in-memory хранилища при старте"""
    init_store()


@app.get("/")
def root():
    """Корневой эндпоинт для проверки работы"""
    return {"message": "API Сайт ЛФК", "docs": "/docs"}


@app.get("/health")
def health():
    """Health check"""
    return {"status": "ok"}
