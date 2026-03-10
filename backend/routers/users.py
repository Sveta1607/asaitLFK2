# routers/users.py — эндпоинты профиля пользователя
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from store import users
from models import UserUpdateRequest, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


def _require_user(x_user_id: Optional[str] = Header(None, alias="X-User-Id")) -> str:
    """Проверяет наличие заголовка X-User-Id, иначе 401"""
    if not x_user_id:
        raise HTTPException(
            status_code=401,
            detail={"detail": "Требуется авторизация.", "code": "UNAUTHORIZED"},
        )
    if x_user_id not in users:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Пользователь не найден.", "code": "USER_NOT_FOUND"},
        )
    return x_user_id


@router.get("/me", response_model=UserResponse)
def get_me(x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """Текущий пользователь (по заголовку X-User-Id)"""
    uid = _require_user(x_user_id)
    return UserResponse(**users[uid])


@router.patch("/me", response_model=UserResponse)
def update_me(body: UserUpdateRequest):
    """Обновление профиля (email). В теле передаётся userId (без JWT)."""
    uid = body.userId
    if uid not in users:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Пользователь не найден.", "code": "USER_NOT_FOUND"},
        )
    users[uid]["email"] = body.email.strip()
    return UserResponse(**users[uid])
