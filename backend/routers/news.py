# routers/news.py — CRUD новостей (просмотр — любой, создание/редактирование — специалист)
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth_deps import RequireSpecialist
from db import get_db
from db_models import News
from models import NewsCreateRequest, NewsUpdateRequest, NewsItemResponse

router = APIRouter(prefix="/news", tags=["news"])


@router.get("", response_model=list[NewsItemResponse])
def list_news(db: Session = Depends(get_db)):
    """Список новостей — доступно любому (гость, пациент, специалист)."""
    stmt = select(News).order_by(News.date.desc(), News.created_at.desc())
    rows = db.execute(stmt).scalars().all()
    return [
        NewsItemResponse(
            id=n.id,
            title=n.title,
            excerpt=n.excerpt,
            imageUrl=n.image_url,
            date=n.date,
            source=n.source,
        )
        for n in rows
    ]


@router.post("", response_model=NewsItemResponse, status_code=201)
def create_news(
    body: NewsCreateRequest,
    user: RequireSpecialist,
    db: Session = Depends(get_db),
):
    """Добавить новость — только специалист (JWT Clerk, RequireSpecialist)."""
    new_id = f"n-{int(datetime.now().timestamp() * 1000)}"
    now = datetime.utcnow()
    item = News(
        id=new_id,
        specialist_id=user.id,
        title=body.title.strip(),
        excerpt=body.excerpt.strip(),
        image_url=body.imageUrl.strip(),
        date=now.strftime("%Y-%m-%d"),
        source="manual",
        created_at=now,
        updated_at=now,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return NewsItemResponse(
        id=item.id,
        title=item.title,
        excerpt=item.excerpt,
        imageUrl=item.image_url,
        date=item.date,
        source=item.source,
    )


@router.patch("/{news_id}", response_model=NewsItemResponse)
def update_news(
    news_id: str,
    body: NewsUpdateRequest,
    user: RequireSpecialist,
    db: Session = Depends(get_db),
):
    """Редактировать новость — только специалист (JWT Clerk)."""
    stmt = select(News).where(News.id == news_id)
    item = db.execute(stmt).scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Новость не найдена.", "code": "NOT_FOUND"},
        )
    if body.title is not None:
        item.title = body.title.strip()
    if body.excerpt is not None:
        item.excerpt = body.excerpt.strip()
    if body.imageUrl is not None:
        item.image_url = body.imageUrl.strip()
    item.updated_at = datetime.utcnow()
    db.add(item)
    db.commit()
    db.refresh(item)
    return NewsItemResponse(
        id=item.id,
        title=item.title,
        excerpt=item.excerpt,
        imageUrl=item.image_url,
        date=item.date,
        source=item.source,
    )


@router.delete("/{news_id}", status_code=204)
def delete_news(
    news_id: str,
    user: RequireSpecialist,
    db: Session = Depends(get_db),
):
    """Удалить новость — только специалист (JWT Clerk)."""
    stmt = select(News).where(News.id == news_id)
    item = db.execute(stmt).scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Новость не найдена.", "code": "NOT_FOUND"},
        )
    db.delete(item)
    db.commit()
    return
