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

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker, Session


# Блок: базовая конфигурация подключения к БД.
# Нужен, чтобы читать строку подключения из переменных окружения и создать движок SQLAlchemy.
# Если DATABASE_URL не задан, используем SQLite. Путь к файлу зависит от среды:
# — в Amvera/Docker каталог /data монтируется как persistent volume, поэтому БД выживает при пересборке;
# — локально (без /data) файл создаётся рядом с кодом, как и раньше.
_PERSISTENT_DIR = "/data"
_sqlite_path = (
    f"{_PERSISTENT_DIR}/lfk_app.db"
    if os.path.isdir(_PERSISTENT_DIR)
    else "./lfk_app.db"
)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{_sqlite_path}",
)

# Этот блок создаётся, чтобы:
# - поддержать переход с psycopg2 на psycopg (v3) без ручного изменения .env;
# - избежать ошибок несовместимости psycopg2 с новыми версиями Python.
if DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)

_db_type = "PostgreSQL" if DATABASE_URL.startswith("postgresql") else "SQLite"
print(f"DB: подключение к {_db_type} ({DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL})")

engine = create_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=Session)

# Блок: базовый класс для ORM-моделей.
# Нужен, чтобы все модели наследовали общую Metadata и могли создавать таблицы через Base.metadata.
Base = declarative_base()


def _ensure_sqlite_users_columns() -> None:
    """
    Этот хелпер создаётся, чтобы:
    - мягко обновлять legacy SQLite-схему в постоянном хранилище Amvera;
    - добавлять новые колонки в users без ручной миграции;
    - устранять падения вида "no such column: users.username".
    """
    # Этот блок создаётся, чтобы применять совместимость только для SQLite.
    if not str(engine.url).startswith("sqlite"):
        return

    # Этот блок создаётся, чтобы безопасно проверить существующие колонки users.
    with engine.begin() as conn:
        table_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        ).first()
        if not table_exists:
            return

        existing_columns = {
            row[1] for row in conn.execute(text("PRAGMA table_info('users')")).fetchall()
        }

        # Этот блок создаётся, чтобы дозаполнить только отсутствующие поля,
        # которые используются текущим кодом и запросами SQLAlchemy.
        alter_statements = []
        if "clerk_id" not in existing_columns:
            alter_statements.append("ALTER TABLE users ADD COLUMN clerk_id TEXT")
        if "username" not in existing_columns:
            alter_statements.append("ALTER TABLE users ADD COLUMN username TEXT")
        if "first_name" not in existing_columns:
            alter_statements.append("ALTER TABLE users ADD COLUMN first_name TEXT")
        if "last_name" not in existing_columns:
            alter_statements.append("ALTER TABLE users ADD COLUMN last_name TEXT")
        if "phone" not in existing_columns:
            alter_statements.append("ALTER TABLE users ADD COLUMN phone TEXT")
        if "approved" not in existing_columns:
            alter_statements.append("ALTER TABLE users ADD COLUMN approved INTEGER NOT NULL DEFAULT 1")
        if "created_at" not in existing_columns:
            alter_statements.append("ALTER TABLE users ADD COLUMN created_at DATETIME")
        if "updated_at" not in existing_columns:
            alter_statements.append("ALTER TABLE users ADD COLUMN updated_at DATETIME")

        for statement in alter_statements:
            conn.execute(text(statement))


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
    # Этот блок создаётся, чтобы при необходимости переинициализировать глобальные
    # engine/SessionLocal на fallback SQLite внутри этой функции.
    global engine, SessionLocal

    # Отложенный импорт, чтобы избежать циклов: модели зависят от Base.
    # Используем абсолютные импорты, так как backend запускается как обычный модуль, а не пакет.
    import db_models  # noqa: F401
    from db_seed import seed_if_empty

    # Этот блок создаётся, чтобы:
    # - создать таблицы в основной БД;
    # - при ошибке подключения к локальному Postgres в контейнере (localhost)
    #   автоматически переключиться на SQLite и не падать на старте в облаке.
    try:
        Base.metadata.create_all(bind=engine)
        _ensure_sqlite_users_columns()
    except OperationalError as exc:
        db_url = os.getenv("DATABASE_URL", "")
        is_local_postgres = (
            db_url.startswith("postgresql")
            and ("@localhost:" in db_url or "@127.0.0.1:" in db_url or "@[::1]:" in db_url)
        )
        if not is_local_postgres:
            raise

        # Этот блок создаётся, чтобы мягко деградировать на SQLite,
        # если в окружении задан нерабочий localhost Postgres.
        # Используем _sqlite_path, чтобы fallback тоже шёл на persistent volume.
        fallback_url = f"sqlite:///{_sqlite_path}"
        print(
            "WARN: DATABASE_URL указывает на localhost Postgres, который недоступен. "
            f"Переключаемся на {fallback_url}. Исходная ошибка: {exc}"
        )
        engine = create_engine(fallback_url, echo=False, future=True)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=Session)
        Base.metadata.create_all(bind=engine)
        _ensure_sqlite_users_columns()

    # Добавляем начальные данные один раз.
    with SessionLocal() as session:
        seed_if_empty(session)

