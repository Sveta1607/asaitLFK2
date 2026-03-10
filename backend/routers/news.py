# routers/news.py — CRUD новостей (просмотр — любой, создание/редактирование — специалист)
from datetime import datetime
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from store import news, users
from models import NewsCreateRequest, NewsUpdateRequest, NewsItemResponse

router = APIRouter(prefix="/news", tags=["news"])


def _require_specialist(x_user_id: Optional[str] = Header(None, alias="X-User-Id")) -> str:
    """Проверяет, что пользователь — специалист"""
    if not x_user_id:
        raise HTTPException(
            status_code=401,
            detail={"detail": "Требуется авторизация специалиста.", "code": "UNAUTHORIZED"},
        )
    u = users.get(x_user_id)
    if not u or u.get("role") != "specialist":
        raise HTTPException(
            status_code=403,
            detail={"detail": "Доступ только для специалиста.", "code": "FORBIDDEN"},
        )
    return x_user_id


@router.get("", response_model=list[NewsItemResponse])
def list_news():
    """Список новостей — доступно любому (гость, пациент, специалист)"""
    return [NewsItemResponse(**n) for n in news]


@router.post("", response_model=NewsItemResponse, status_code=201)
def create_news(body: NewsCreateRequest, x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """Добавить новость — только специалист"""
    _require_specialist(x_user_id)
    new_id = f"n-{int(datetime.now().timestamp() * 1000)}"
    item = {
        "id": new_id,
        "title": body.title.strip(),
        "excerpt": body.excerpt.strip(),
        "imageUrl": body.imageUrl.strip(),
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "source": "manual",
    }
    news.insert(0, item)
    return NewsItemResponse(**item)


@router.patch("/{news_id}", response_model=NewsItemResponse)
def update_news(news_id: str, body: NewsUpdateRequest, x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """Редактировать новость — только специалист"""
    _require_specialist(x_user_id)
    for n in news:
        if n["id"] == news_id:
            if body.title is not None:
                n["title"] = body.title.strip()
            if body.excerpt is not None:
                n["excerpt"] = body.excerpt.strip()
            if body.imageUrl is not None:
                n["imageUrl"] = body.imageUrl.strip()
            return NewsItemResponse(**n)
    raise HTTPException(
        status_code=404,
        detail={"detail": "Новость не найдена.", "code": "NOT_FOUND"},
    )


@router.delete("/{news_id}", status_code=204)
def delete_news(news_id: str, x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """Удалить новость — только специалист"""
    _require_specialist(x_user_id)
    for i, n in enumerate(news):
        if n["id"] == news_id:
            news.pop(i)
            return
    raise HTTPException(
        status_code=404,
        detail={"detail": "Новость не найдена.", "code": "NOT_FOUND"},
    )
