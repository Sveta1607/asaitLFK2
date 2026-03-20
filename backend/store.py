# store.py — in-memory хранилища (словари и списки) без БД
from typing import Optional
import uuid

# Пользователи: id -> dict (User)
users: dict[str, dict] = {}

# Новости: список dict (NewsItem)
news: list[dict] = []

# Слоты: список dict (TimeSlot)
slots: list[dict] = []

# Записи: список dict (Booking)
bookings: list[dict] = []

# Токены отмены: token -> booking_id (для GET /cancel/:token)
cancel_tokens: dict[str, str] = {}


def _generate_id(prefix: str) -> str:
    """Генерирует уникальный id с префиксом"""
    return f"{prefix}-{int(1000 * __import__('time').time())}"


def _generate_cancel_token(booking_id: str) -> str:
    """Генерирует токен отмены для записи"""
    token = str(uuid.uuid4().hex[:12])
    cancel_tokens[token] = booking_id
    return token


def init_store() -> None:
    """Инициализирует хранилище начальными данными (как в mockData.ts)"""
    global users, news, slots, bookings, cancel_tokens

    # Моковые пользователи
    users["u1"] = {
        "id": "u1",
        "role": "user",
        "email": "patient@example.com",
        "firstName": "Иван",
        "lastName": "Иванов",
        "phone": "+7 900 000 00 01",
    }
    users["spec1"] = {
        "id": "spec1",
        "role": "specialist",
        "email": "specialist@example.com",
        "firstName": "Анна",
        "lastName": "Смирнова",
    }

    # Моковые новости
    news.extend([
        {
            "id": "n1",
            "title": "ЛФК для детей: с чего начать",
            "excerpt": "Первые шаги в лечебной физкультуре: мягкие упражнения и рекомендации специалиста.",
            "imageUrl": "https://images.pexels.com/photos/903171/pexels-photo-903171.jpeg?auto=compress&cs=tinysrgb&w=600",
            "date": "2026-03-01",
            "source": "manual",
        },
        {
            "id": "n2",
            "title": "Польза регулярной зарядки",
            "excerpt": "Как 10–15 минут утренней зарядки влияют на здоровье спины и осанку ребёнка.",
            "imageUrl": "https://images.pexels.com/photos/4662348/pexels-photo-4662348.jpeg?auto=compress&cs=tinysrgb&w=600",
            "date": "2026-02-20",
            "source": "rss",
        },
    ])

    # Моковые слоты
    slots.extend([
        {"id": "s1", "specialistId": "spec1", "date": "2026-03-10", "time": "10:00", "status": "free"},
        {"id": "s2", "specialistId": "spec1", "date": "2026-03-10", "time": "11:00", "status": "busy"},
        {"id": "s3", "specialistId": "spec1", "date": "2026-03-10", "time": "12:00", "status": "free"},
        {"id": "s4", "specialistId": "spec1", "date": "2026-03-11", "time": "10:00", "status": "free"},
    ])

    # Моковые записи (s2 занят записью b1)
    b1_id = "b1"
    bookings.append({
        "id": b1_id,
        "specialistId": "spec1",
        "userId": "u1",
        "date": "2026-03-10",
        "time": "11:00",
        "lastName": "Иванов",
        "firstName": "Иван",
        "phone": "+7 900 000 00 01",
        "status": "active",
    })
    cancel_tokens["b1-demo-token"] = b1_id


def get_slot_by_id(slot_id: str) -> Optional[dict]:
    """Возвращает слот по id или None"""
    for s in slots:
        if s["id"] == slot_id:
            return s
    return None


def get_booking_by_id(booking_id: str) -> Optional[dict]:
    """Возвращает запись по id или None"""
    for b in bookings:
        if b["id"] == booking_id:
            return b
    return None


def get_slot_by_specialist_date_time(specialist_id: str, date: str, time: str) -> Optional[dict]:
    """Возвращает слот по specialistId, date, time или None"""
    for s in slots:
        if s["specialistId"] == specialist_id and s["date"] == date and s["time"] == time:
            return s
    return None


def mark_slot_busy(slot_id: str) -> None:
    """Помечает слот как занятый"""
    for s in slots:
        if s["id"] == slot_id:
            s["status"] = "busy"
            break


def mark_slot_free(specialist_id: str, date: str, time: str) -> None:
    """Помечает слот как свободный (при отмене записи)"""
    for s in slots:
        if s["specialistId"] == specialist_id and s["date"] == date and s["time"] == time:
            s["status"] = "free"
            break
