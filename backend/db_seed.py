from __future__ import annotations

"""
Этот модуль создаётся, чтобы:
- инициализировать минимальные тестовые данные в PostgreSQL;
- перенести в БД те же сущности, которые раньше создавались в init_store().
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from db_models import User, News, Slot, Booking


def seed_if_empty(session: Session) -> None:
    """
    Эта функция создаётся, чтобы:
    - проверить, есть ли уже пользователи в БД;
    - если таблицы пустые, наполнить их начальными данными для демо.
    """
    # Проверяем, есть ли хотя бы один пользователь.
    has_users = session.execute(select(User.id).limit(1)).scalar_one_or_none()
    if has_users:
        return

    # Создаём базовых пользователей: один пациент и один специалист.
    patient = User(
        id="u1",
        role="user",
        email="patient@example.com",
        first_name="Иван",
        last_name="Иванов",
        phone="+7 900 000 00 01",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    specialist = User(
        id="spec1",
        role="specialist",
        email="specialist@example.com",
        first_name="Анна",
        last_name="Смирнова",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add_all([patient, specialist])

    # Новости специалиста — аналогичные мок-данные, что были в store.py.
    news_items = [
        News(
            id="n1",
            specialist_id="spec1",
            title="ЛФК для детей: с чего начать",
            excerpt="Первые шаги в лечебной физкультуре: мягкие упражнения и рекомендации специалиста.",
            image_url="https://images.pexels.com/photos/903171/pexels-photo-903171.jpeg?auto=compress&cs=tinysrgb&w=600",
            date="2026-03-01",
            source="manual",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        ),
        News(
            id="n2",
            specialist_id="spec1",
            title="Польза регулярной зарядки",
            excerpt="Как 10–15 минут утренней зарядки влияют на здоровье спины и осанку ребёнка.",
            image_url="https://images.pexels.com/photos/4662348/pexels-photo-4662348.jpeg?auto=compress&cs=tinysrgb&w=600",
            date="2026-02-20",
            source="rss",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        ),
    ]
    session.add_all(news_items)

    # Слоты специалиста.
    slots = [
        Slot(id="s1", specialist_id="spec1", date="2026-03-10", time="10:00", status="free"),
        Slot(id="s2", specialist_id="spec1", date="2026-03-10", time="11:00", status="busy"),
        Slot(id="s3", specialist_id="spec1", date="2026-03-10", time="12:00", status="free"),
        Slot(id="s4", specialist_id="spec1", date="2026-03-11", time="10:00", status="free"),
    ]
    session.add_all(slots)

    # Одна активная запись на слот s2.
    booking = Booking(
        id="b1",
        slot_id="s2",
        specialist_id="spec1",
        user_id="u1",
        date="2026-03-10",
        time="11:00",
        last_name="Иванов",
        first_name="Иван",
        phone="+7 900 000 00 01",
        status="active",
        cancel_token="b1-demo-token",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(booking)

    session.commit()

