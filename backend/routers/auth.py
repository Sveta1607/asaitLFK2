# routers/auth.py — эндпоинты авторизации (login, register)
from fastapi import APIRouter, HTTPException, Body, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from db_models import User
from models import UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _validate_auth(data: dict) -> list[dict]:
    """Валидирует обязательные поля, возвращает список ошибок или пустой список"""
    errors = []
    email = str(data.get("email") or "").strip()
    firstName = str(data.get("firstName") or "").strip()
    lastName = str(data.get("lastName") or "").strip()
    role = data.get("role") if data.get("role") in ("user", "specialist") else "user"
    phone = str(data.get("phone") or "").strip()
    if not email:
        errors.append({"field": "email", "message": "E-mail обязателен"})
    if not firstName:
        errors.append({"field": "firstName", "message": "Имя обязательно"})
    if not lastName:
        errors.append({"field": "lastName", "message": "Фамилия обязательна"})
    if role == "user" and not phone:
        errors.append({"field": "phone", "message": "Телефон обязателен для пациентов"})
    return errors


@router.post("/login", response_model=UserResponse)
def login(body: dict = Body(...), db: Session = Depends(get_db)):
    """Вход: валидация полей, поиск/создание пользователя по email+role."""
    errs = _validate_auth(body)
    if errs:
        raise HTTPException(
            status_code=400,
            detail={
                "detail": "Пожалуйста, заполните все обязательные поля.",
                "code": "VALIDATION_ERROR",
                "errors": errs,
            },
        )
    return _auth_impl(body, db)


@router.post("/register", response_model=UserResponse)
def register(body: dict = Body(...), db: Session = Depends(get_db)):
    """Регистрация: то же, что и login (упрощённая авторизация)."""
    errs = _validate_auth(body)
    if errs:
        raise HTTPException(
            status_code=400,
            detail={
                "detail": "Пожалуйста, заполните все обязательные поля.",
                "code": "VALIDATION_ERROR",
                "errors": errs,
            },
        )
    return _auth_impl(body, db)


def _auth_impl(data: dict, db: Session) -> UserResponse:
    """
    Общая логика авторизации создаётся, чтобы:
    - найти пользователя по email+role в БД;
    - при отсутствии создать новую запись и вернуть её.
    """
    email = (data.get("email") or "").strip()
    role = data.get("role") if data.get("role") in ("user", "specialist") else "user"
    firstName = (data.get("firstName") or "").strip()
    lastName = (data.get("lastName") or "").strip()
    phone = (data.get("phone") or "").strip() if role == "user" else None

    stmt = select(User).where(User.email == email, User.role == role)
    existing = db.execute(stmt).scalar_one_or_none()
    if existing:
        return UserResponse(
            id=existing.id,
            role=existing.role,
            email=existing.email,
            firstName=existing.first_name,
            lastName=existing.last_name,
            phone=existing.phone,
            telegramLinked=bool(existing.telegram_chat_id) if existing.role == "specialist" else False,
        )

    # Генерация нового идентификатора в формате, совместимом с фронтендом.
    prefix = "u" if role == "user" else "spec"
    # Считаем существующих пользователей с такой ролью, чтобы сделать простую нумерацию.
    count_stmt = select(User).where(User.role == role)
    count = len(db.execute(count_stmt).scalars().all())
    new_id = f"{prefix}-{count + 1}"

    new_user = User(
        id=new_id,
        role=role,
        email=email,
        first_name=firstName,
        last_name=lastName,
        phone=phone,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserResponse(
        id=new_user.id,
        role=new_user.role,
        email=new_user.email,
        firstName=new_user.first_name,
        lastName=new_user.last_name,
        phone=new_user.phone,
        telegramLinked=bool(new_user.telegram_chat_id) if new_user.role == "specialist" else False,
    )
