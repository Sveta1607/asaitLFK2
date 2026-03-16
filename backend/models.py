# models.py — Pydantic-модели для валидации запросов и ответов API
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


# Роли пользователя: пациент или специалист
UserRole = Literal["user", "specialist"]


# --- Auth --- (тело запроса парсится как dict в auth.py)


class UserResponse(BaseModel):
    """Ответ с данными пользователя"""
    id: str
    role: str
    email: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: Optional[str] = None


# --- Users ---
class UserUpdateRequest(BaseModel):
    """
    Этот класс создаётся, чтобы:
    - валидировать запрос на обновление профиля пользователя;
    - позволить менять e-mail, имя, фамилию и телефон одной операцией.
    """

    userId: str
    email: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("email")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("E-mail обязателен")
        return v


# --- News ---
class NewsCreateRequest(BaseModel):
    """Запрос на создание новости"""
    title: str
    excerpt: str
    imageUrl: str


class NewsUpdateRequest(BaseModel):
    """Запрос на обновление новости"""
    title: Optional[str] = None
    excerpt: Optional[str] = None
    imageUrl: Optional[str] = None


class NewsItemResponse(BaseModel):
    """Ответ с данными новости"""
    id: str
    title: str
    excerpt: str
    imageUrl: str
    date: str
    source: Optional[str] = None


# --- Slots ---
class SlotCreateRequest(BaseModel):
    """Запрос на добавление одного слота"""
    specialistId: str
    date: str  # YYYY-MM-DD
    time: str  # HH:mm


class SlotBatchCreateRequest(BaseModel):
    """Запрос на добавление нескольких слотов"""
    specialistId: str
    date: str
    times: list[str]


class SlotResponse(BaseModel):
    """Ответ со слотом"""
    id: str
    specialistId: str
    date: str
    time: str
    status: Literal["free", "busy"]


# --- Bookings ---
class BookingCreateByPatientRequest(BaseModel):
    """Запрос на создание записи от пациента"""
    userId: str
    specialistId: str
    slotId: str
    firstName: str
    lastName: str
    phone: Optional[str] = None


class BookingCreateBySpecialistRequest(BaseModel):
    """Запрос на создание записи специалистом"""
    specialistId: str
    date: str
    time: str
    firstName: str
    lastName: str
    phone: Optional[str] = None


class BookingCancelRequest(BaseModel):
    """Запрос на отмену записи (опционально)"""
    userId: Optional[str] = None


class BookingResponse(BaseModel):
    """Ответ с данными записи"""
    id: str
    specialistId: str
    userId: Optional[str] = None
    date: str
    time: str
    lastName: str
    firstName: str
    phone: Optional[str] = None
    status: Literal["active", "cancelled"]
    cancelToken: Optional[str] = None


# --- Error ---
class ErrorDetail(BaseModel):
    """Структура ошибки API"""
    detail: str
    code: Optional[str] = None
    errors: Optional[list[dict]] = None
