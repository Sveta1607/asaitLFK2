from __future__ import annotations

# routers/site_content.py — редактируемый контент главной страницы
import json
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth_deps import RequireSpecialist
from db import get_db
from db_models import SiteContent
from models import HomeContentResponse, HomeContentUpdateRequest

router = APIRouter(prefix="/site-content", tags=["site-content"])


# Этот блок создаётся, чтобы иметь единый дефолтный контент,
# если запись ещё не создана в БД.
DEFAULT_HOME_CONTENT: dict[str, str] = {
    "heroBadge": "🌿 Лечебная физкультура для детей",
    "heroTitle": "Здоровье и радость движения для вашего ребёнка",
    "heroSubtitle": "Индивидуальные занятия ЛФК с опытным специалистом. Коррекция осанки, укрепление мышечного корсета и профилактика травм.",
    "heroCtaNote": "Онлайн-запись на приём с выбором даты и времени.",
    "primaryCtaText": "Записаться на приём",
    "secondaryCtaText": "Войти",
    "feature1Icon": "🏃",
    "feature1Title": "Индивидуальный подход",
    "feature1Text": "Программа упражнений под каждого ребёнка",
    "feature2Icon": "📅",
    "feature2Title": "Удобная запись",
    "feature2Text": "Выбирайте время прямо на сайте",
    "benefit1Icon": "💪",
    "benefit1Title": "Укрепление здоровья",
    "benefit1Text": "Коррекция осанки и укрепление мышечного корсета под руководством специалиста",
    "benefit2Icon": "🎯",
    "benefit2Title": "Индивидуальный план",
    "benefit2Text": "Подбор упражнений с учётом возраста, здоровья и рекомендаций врача",
    "benefit3Icon": "😊",
    "benefit3Title": "Позитивная атмосфера",
    "benefit3Text": "Занятия в игровой форме, чтобы ребёнку было интересно и весело",
    "newsIcon": "📰",
    "newsTitle": "Новости и статьи",
    "newsSubtitle": "ЛФК и здоровье детей",
    "specialistIcon": "⚕️",
    "specialistTitle": "О специалисте",
    "specialistText": "Специалист по лечебной физкультуре с опытом работы более 10 лет. Индивидуальный подбор упражнений с учётом возраста, состояния здоровья и рекомендаций врача. Работа с детьми от 3 лет.",
}


def _normalize_content(raw: dict | None) -> dict[str, str]:
    """
    Этот блок создаётся, чтобы:
    - гарантировать наличие всех ключей в ответе API;
    - подмешивать дефолтные значения, если в БД неполные данные.
    """
    data = dict(DEFAULT_HOME_CONTENT)
    if isinstance(raw, dict):
        for key in DEFAULT_HOME_CONTENT.keys():
            value = raw.get(key)
            if isinstance(value, str) and value.strip():
                data[key] = value.strip()
    return data


@router.get("/home", response_model=HomeContentResponse)
def get_home_content(db: Session = Depends(get_db)):
    """Получить контент главной страницы — доступно всем."""
    stmt = select(SiteContent).where(SiteContent.id == "home")
    row = db.execute(stmt).scalar_one_or_none()
    if not row:
        return HomeContentResponse(**DEFAULT_HOME_CONTENT)
    try:
        content = json.loads(row.content_json or "{}")
    except Exception:
        content = {}
    return HomeContentResponse(**_normalize_content(content))


@router.patch("/home", response_model=HomeContentResponse)
def update_home_content(
    body: HomeContentUpdateRequest,
    user: RequireSpecialist,
    db: Session = Depends(get_db),
):
    """Обновить контент главной страницы — только специалист."""
    _ = user
    stmt = select(SiteContent).where(SiteContent.id == "home")
    row = db.execute(stmt).scalar_one_or_none()
    now = datetime.utcnow()
    payload = _normalize_content(body.model_dump())
    if not row:
        row = SiteContent(
            id="home",
            content_json=json.dumps(payload, ensure_ascii=False),
            created_at=now,
            updated_at=now,
        )
    else:
        row.content_json = json.dumps(payload, ensure_ascii=False)
        row.updated_at = now
    db.add(row)
    db.commit()
    return HomeContentResponse(**payload)

