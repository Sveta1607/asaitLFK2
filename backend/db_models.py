from __future__ import annotations

"""
Этот модуль создаётся, чтобы:
- описать ORM-модели SQLAlchemy для пользователей, новостей, слотов и записей;
- сопоставить их по структуре с текущими Pydantic-моделями и in-memory схемой;
- использовать их во всех роутерах вместо store.py.
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from db import Base


class User(Base):
    """
    Эта модель создаётся, чтобы:
    - хранить пациентов и специалистов в одной таблице с разделением по роли;
    - иметь строковый id, совместимый с текущим фронтендом (u-*, spec-*);
    - интегрироваться с Clerk через внешнее поле clerk_id;
    - предоставлять связи с новостями, слотами и записями.
    """

    __tablename__ = "users"

    # Это поле создаётся, чтобы хранить строковый идентификатор пользователя,
    # совместимый с текущим фронтендом (u-*, spec-*), и использовать его в X-User-Id / JWT-пейлоаде.
    id = Column(String, primary_key=True, index=True)
    # Это поле создаётся, чтобы хранить роль приложения (user, specialist, superuser),
    # на основе которой бэкенд и фронтенд ограничивают доступ к эндпоинтам.
    role = Column(String, nullable=False)  # "user", "specialist" или "superuser"
    # Это поле создаётся, чтобы связать локального пользователя с аккаунтом в Clerk по sub из JWT.
    clerk_id = Column(String, unique=True, index=True, nullable=True)
    # Это поле создаётся, чтобы хранить логин пользователя (username) с валидацией на латиницу.
    username = Column(String, unique=True, index=True, nullable=True)
    # Это поле создаётся, чтобы хранить основной e-mail пользователя.
    email = Column(String, nullable=False, unique=True, index=True)
    # Это поле создаётся, чтобы хранить имя пользователя для отображения и записей.
    first_name = Column(String, nullable=True)
    # Это поле создаётся, чтобы хранить фамилию пользователя.
    last_name = Column(String, nullable=True)
    # Это поле создаётся, чтобы хранить телефон пользователя (опционально).
    phone = Column(String, nullable=True)
    # Это поле создаётся, чтобы пометить профиль как одобренный администратором перед доступом к ряду операций.
    approved = Column(Boolean, default=True, nullable=False)
    # Это поле создаётся, чтобы хранить дату создания пользователя.
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Это поле создаётся, чтобы хранить дату последнего обновления записи пользователя.
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Это отношение создаётся, чтобы получть список новостей, опубликованных специалистом.
    news_items = relationship("News", back_populates="specialist", cascade="all, delete-orphan")
    # Это отношение создаётся, чтобы получить список слотов расписания, принадлежащих специалисту.
    slots = relationship("Slot", back_populates="specialist", cascade="all, delete-orphan")
    # Это отношение создаётся, чтобы получить список записей, где пользователь выступает пациентом.
    bookings_as_patient = relationship(
        "Booking",
        back_populates="patient",
        foreign_keys="Booking.user_id",
    )
    # Это отношение создаётся, чтобы получить список записей, где пользователь выступает специалистом.
    bookings_as_specialist = relationship(
        "Booking",
        back_populates="specialist",
        foreign_keys="Booking.specialist_id",
    )


class News(Base):
    """
    Эта модель создаётся, чтобы:
    - хранить новости, которые специалист показывает на главной странице;
    - связать каждую новость с конкретным специалистом.
    """

    __tablename__ = "news"

    id = Column(String, primary_key=True, index=True)
    specialist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    excerpt = Column(Text, nullable=False)
    image_url = Column(String, nullable=False)
    # Дата публикации в виде строки YYYY-MM-DD для совместимости с текущим фронтендом.
    date = Column(String, nullable=False)
    source = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    specialist = relationship("User", back_populates="news_items")


class Slot(Base):
    """
    Эта модель создаётся, чтобы:
    - хранить слоты расписания по датам и времени;
    - связывать их с конкретным специалистом;
    - отмечать статус слота (free/busy).
    """

    __tablename__ = "slots"

    id = Column(String, primary_key=True, index=True)
    specialist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    time = Column(String, nullable=False)  # HH:mm
    status = Column(String, nullable=False, default="free")  # "free" или "busy"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    specialist = relationship("User", back_populates="slots")
    bookings = relationship("Booking", back_populates="slot", cascade="all, delete-orphan")


class Booking(Base):
    """
    Эта модель создаётся, чтобы:
    - хранить записи на приём как от пациентов, так и созданные специалистом;
    - привязать запись к слоту, пациенту и специалисту;
    - хранить токен отмены для публичной ссылки.
    """

    __tablename__ = "bookings"

    id = Column(String, primary_key=True, index=True)
    slot_id = Column(String, ForeignKey("slots.id", ondelete="CASCADE"), nullable=False, index=True)
    specialist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    time = Column(String, nullable=False)  # HH:mm
    last_name = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    status = Column(String, nullable=False, default="active")  # "active" или "cancelled"
    cancel_token = Column(String, nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    slot = relationship("Slot", back_populates="bookings")
    specialist = relationship("User", foreign_keys=[specialist_id], back_populates="bookings_as_specialist")
    patient = relationship("User", foreign_keys=[user_id], back_populates="bookings_as_patient")


class SiteContent(Base):
    """
    Эта модель создаётся, чтобы:
    - хранить редактируемый контент главной страницы в БД;
    - позволить специалисту менять тексты без правок кода;
    - отдавать единый контент всем посетителям сайта.
    """

    __tablename__ = "site_content"

    # Это поле создаётся, чтобы хранить тип контента (например, "home").
    id = Column(String, primary_key=True, index=True)
    # Это поле создаётся, чтобы хранить JSON со всеми текстами главной страницы.
    content_json = Column(Text, nullable=False)
    # Это поле создаётся, чтобы хранить дату создания записи контента.
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Это поле создаётся, чтобы хранить дату последнего обновления контента.
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

