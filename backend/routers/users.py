# routers/users.py — эндпоинты профиля пользователя
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from db_models import User
from models import UserUpdateRequest, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


def _require_user(
    db: Session,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
) -> User:
    """
    Эта функция создаётся, чтобы:
    - проверить наличие заголовка X-User-Id;
    - найти пользователя в БД или вернуть 404.
    """
    if not x_user_id:
        raise HTTPException(
            status_code=401,
            detail={"detail": "Требуется авторизация.", "code": "UNAUTHORIZED"},
        )
    stmt = select(User).where(User.id == x_user_id)
    user = db.execute(stmt).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Пользователь не найден.", "code": "USER_NOT_FOUND"},
        )
    return user


@router.get("/me", response_model=UserResponse)
def get_me(
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """Текущий пользователь (по заголовку X-User-Id)."""
    user = _require_user(db, x_user_id)
    return UserResponse(
        id=user.id,
        role=user.role,
        email=user.email,
        firstName=user.first_name,
        lastName=user.last_name,
        phone=user.phone,
    )


@router.patch("/me", response_model=UserResponse)
def update_me(body: UserUpdateRequest, db: Session = Depends(get_db)):
    """
    Этот обработчик создаётся, чтобы:
    - обновлять e-mail, имя, фамилию и телефон пользователя;
    - использовать простую схему без JWT, принимая userId в теле запроса.
    """
    stmt = select(User).where(User.id == body.userId)
    user = db.execute(stmt).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Пользователь не найден.", "code": "USER_NOT_FOUND"},
        )
    user.email = body.email.strip()
    if body.firstName is not None:
        user.first_name = body.firstName.strip() or None
    if body.lastName is not None:
        user.last_name = body.lastName.strip() or None
    if body.phone is not None:
        user.phone = body.phone.strip() or None
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse(
        id=user.id,
        role=user.role,
        email=user.email,
        firstName=user.first_name,
        lastName=user.last_name,
        phone=user.phone,
    )
