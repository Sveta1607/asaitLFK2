from __future__ import annotations

"""
Этот модуль создаётся, чтобы:
- инициализировать минимальные тестовые данные в PostgreSQL;
- перенести в БД те же сущности, которые раньше создавались в init_store().
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from db_models import User, SiteContent


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

    # Демо-пациент. Специалист не сидится — регистрация только через Clerk (ALLOWED_SPECIALIST_EMAIL).
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
    session.add(patient)

    # Этот блок создаётся, чтобы при первом запуске сразу заполнить
    # редактируемый контент главной страницы дефолтными значениями.
    home_content = SiteContent(
        id="home",
        content_json="""{
  "heroBadge": "🌿 Лечебная физкультура для детей",
  "heroTitle": "Здоровье и радость движения для вашего ребёнка",
  "heroSubtitle": "Индивидуальные занятия ЛФК с опытным специалистом. Коррекция осанки, укрепление мышечного корсета и профилактика травм.",
  "heroCtaNote": "Онлайн-запись на приём с выбором даты и времени.",
  "feature1Title": "🏃 Индивидуальный подход",
  "feature1Text": "Программа упражнений под каждого ребёнка",
  "feature2Title": "📅 Удобная запись",
  "feature2Text": "Выбирайте время прямо на сайте",
  "benefit1Title": "Укрепление здоровья",
  "benefit1Text": "Коррекция осанки и укрепление мышечного корсета под руководством специалиста",
  "benefit2Title": "Индивидуальный план",
  "benefit2Text": "Подбор упражнений с учётом возраста, здоровья и рекомендаций врача",
  "benefit3Title": "Позитивная атмосфера",
  "benefit3Text": "Занятия в игровой форме, чтобы ребёнку было интересно и весело",
  "newsTitle": "Новости и статьи",
  "newsSubtitle": "ЛФК и здоровье детей",
  "specialistTitle": "О специалисте",
  "specialistText": "Специалист по лечебной физкультуре с опытом работы более 10 лет. Индивидуальный подбор упражнений с учётом возраста, состояния здоровья и рекомендаций врача. Работа с детьми от 3 лет."
}""",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(home_content)

    session.commit()

