from __future__ import annotations

"""
Этот модуль создаётся, чтобы:
- инициализировать подключение к PostgreSQL через SQLAlchemy;
- предоставить базовый класс моделей и фабрику сессий;
- дать зависимость get_db для роутеров FastAPI;
- выполнить базовую инициализацию схемы и тестовых данных.
"""

from typing import Generator

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session


# Блок: базовая конфигурация подключения к БД.
# Нужен, чтобы читать строку подключения из переменных окружения и создать движок SQLAlchemy.
# По умолчанию используем локальный SQLite-файл, чтобы бэкенд мог работать без запущенного PostgreSQL.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./lfk_app.db",
)

# Этот блок создаётся, чтобы:
# - поддержать переход с psycopg2 на psycopg (v3) без ручного изменения .env;
# - избежать ошибок несовместимости psycopg2 с новыми версиями Python.
if DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=Session)

# Блок: базовый класс для ORM-моделей.
# Нужен, чтобы все модели наследовали общую Metadata и могли создавать таблицы через Base.metadata.
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Этот генератор создаётся, чтобы:
    - предоставить сессию БД в обработчики FastAPI через Depends;
    - гарантировать закрытие сессии после обработки запроса.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Эта функция создаётся, чтобы:
    - выполнить создание таблиц (если их ещё нет);
    - при первом запуске заполнить БД минимальными тестовыми данными
      (эквивалент текущего in-memory init_store).
    """
    # Отложенный импорт, чтобы избежать циклов: модели зависят от Base.
    # Используем абсолютные импорты, так как backend запускается как обычный модуль, а не пакет.
    import db_models  # noqa: F401
    from db_seed import seed_if_empty

    # Создаём таблицы, если их нет.
    Base.metadata.create_all(bind=engine)

    # Добавляем начальные данные один раз.
    with SessionLocal() as session:
        seed_if_empty(session)

