# routers/users.py — эндпоинты профиля пользователя.
# Также логирует бизнес-события: регистрация, синхронизация, смена роли.
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth_deps import RequireSuperuser, RequireUser, get_clerk_payload
from db import get_db
from db_models import User
from models import UserUpdateRequest, UserResponse, SpecialistPublicResponse
from logger import get_logger

router = APIRouter(prefix="/users", tags=["users"])
log = get_logger()


def _allowed_specialist_email_norm() -> str:
    """E-mail единственного разрешённого специалиста (из .env или значение по умолчанию)."""
    return (os.getenv("ALLOWED_SPECIALIST_EMAIL") or "Sharunkina2014@yandex.ru").strip().lower()


def _require_specialist_email_allowed(email: str, role: str) -> None:
    """Запрещает роль specialist всем, кроме адреса из ALLOWED_SPECIALIST_EMAIL."""
    if role != "specialist":
        return
    if (email or "").strip().lower() != _allowed_specialist_email_norm():
        allowed = _allowed_specialist_email_norm()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "detail": f"Роль «специалист» доступна только для e-mail: {allowed}",
                "code": "SPECIALIST_EMAIL_NOT_ALLOWED",
            },
        )


class ClerkSyncRequest(BaseModel):
    """
    Эта схема создаётся, чтобы:
    - описать и валидировать данные, приходящие из Clerk (webhook / фронтенд);
    - убедиться, что username соответствует правилам (ТОЛЬКО латинские буквы без цифр и спецсимволов);
    - ограничить роль только разрешёнными значениями;
    - сохранять ФИО и телефон при регистрации в профиль пользователя.
    """

    email: str = Field(..., description="E-mail пользователя из Clerk")
    # Это поле создаётся, чтобы хранить логин пользователя, состоящий только
    # из латинских букв (без цифр и спецсимволов), соответствуя требованиям ТЗ.
    username: str = Field(..., description="Логин пользователя (только латинские буквы без цифр и спецсимволов)")
    role: str = Field("user", description="Роль в приложении: user или specialist")
    # Эти поля создаются, чтобы сохранять ФИО и телефон сразу при регистрации,
    # а не заставлять пользователя заполнять профиль отдельно после входа.
    firstName: Optional[str] = Field(None, description="Имя пользователя")
    lastName: Optional[str] = Field(None, description="Фамилия пользователя")
    phone: Optional[str] = Field(None, description="Телефон пользователя")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        # Этот валидатор создаётся, чтобы:
        # - запретить кириллицу, пробелы, цифры и спецсимволы в логине;
        # - ограничить допустимые символы только латинскими буквами (A–Z, a–z).
        v = (v or "").strip()
        if not (3 <= len(v) <= 32):
            raise ValueError("Логин должен быть от 3 до 32 символов")
        import re

        if not re.fullmatch(r"[A-Za-z]+", v):
            raise ValueError("Логин может содержать только латинские буквы без цифр и спецсимволов")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        # Этот валидатор создаётся, чтобы ограничить список ролей user и specialist.
        v = (v or "user").strip()
        if v not in ("user", "specialist"):
            raise ValueError("Роль должна быть 'user' или 'specialist'")
        return v


@router.get("/me", response_model=UserResponse)
def get_me(current_user: RequireUser, db: Session = Depends(get_db)):
    """
    Возвращает профиль текущего пользователя на основе JWT Clerk.
    Если пользователь ещё не синхронизирован, зависимость поднимет 403.
    """
    stmt = select(User).where(User.id == current_user.id)
    user = db.execute(stmt).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Пользователь не найден.", "code": "USER_NOT_FOUND"},
        )
    return UserResponse(
        id=user.id,
        role=user.role,
        email=user.email,
        firstName=user.first_name,
        lastName=user.last_name,
        phone=user.phone,
    )


@router.patch("/me", response_model=UserResponse)
def update_me(body: UserUpdateRequest, current_user: RequireUser, db: Session = Depends(get_db)):
    """
    Этот обработчик создаётся, чтобы:
    - позволить пользователю обновлять свои контактные данные (email, имя, фамилия, телефон);
    - игнорировать userId из тела и использовать id из текущей сессии (JWT Clerk).
    """
    stmt = select(User).where(User.id == current_user.id)
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


@router.get("/specialists", response_model=list[SpecialistPublicResponse])
def list_specialists(current_user: RequireUser, db: Session = Depends(get_db)):
    """
    Этот обработчик создаётся, чтобы:
    - позволить авторизованному пациенту увидеть список специалистов;
    - показать карточку каждого специалиста на странице записи.
    """
    stmt = select(User).where(User.role == "specialist", User.approved == True)
    specialists = db.execute(stmt).scalars().all()
    return [
        SpecialistPublicResponse(
            id=s.id,
            firstName=s.first_name,
            lastName=s.last_name,
            email=s.email,
        )
        for s in specialists
    ]


@router.post("/sync-from-clerk", status_code=status.HTTP_200_OK)
def sync_from_clerk(
    body: ClerkSyncRequest,
    payload: dict = Depends(get_clerk_payload),
    db: Session = Depends(get_db),
):
    """
    Этот обработчик создаётся, чтобы:
    - синхронизировать профиль пользователя из Clerk с локальной БД;
    - создавать новую запись User при первом логине;
    - обновлять email и username при последующих логинах.
    """
    clerk_id = (payload.get("sub") or "").strip()
    if not clerk_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="В токене Clerk отсутствует sub (clerk_id)",
        )

    _require_specialist_email_allowed(body.email, body.role)

    stmt = select(User).where(User.clerk_id == clerk_id)
    user = db.execute(stmt).scalar_one_or_none()

    if user is None:
        email_norm = body.email.strip().lower()
        # Этот блок создаётся, чтобы при смене сессии Clerk (новый sub) не создавать второго специалиста,
        # а привязать существующую строку User с тем же e-mail к текущему токену.
        if body.role == "specialist":
            existing_spec = db.execute(
                select(User).where(
                    User.role == "specialist",
                    func.lower(User.email) == email_norm,
                )
            ).scalar_one_or_none()
            if existing_spec:
                existing_spec.clerk_id = clerk_id
                existing_spec.username = body.username
                existing_spec.email = body.email.strip()
                existing_spec.first_name = (body.firstName or "").strip() or None
                existing_spec.last_name = (body.lastName or "").strip() or None
                existing_spec.phone = (body.phone or "").strip() or None
                existing_spec.updated_at = datetime.utcnow()
                db.add(existing_spec)
                db.commit()
                db.refresh(existing_spec)
                log.info(
                    "specialist_clerk_relinked",
                    extra={
                        "event": "specialist_clerk_relinked",
                        "user_id": existing_spec.id,
                        "email": body.email,
                    },
                )
                return {
                    "id": existing_spec.id,
                    "role": existing_spec.role,
                    "email": existing_spec.email,
                    "username": existing_spec.username,
                }
            # Один специалист в системе: если уже есть другой specialist (другой e-mail), нового не создаём.
            spec_count = db.execute(
                select(func.count(User.id)).where(User.role == "specialist")
            ).scalar_one()
            if spec_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "detail": "Специалист уже зарегистрирован. Дополнительная регистрация как специалист невозможна.",
                        "code": "SPECIALIST_ALREADY_EXISTS",
                    },
                )
        # Этот блок создаётся, чтобы:
        # - создать нового пользователя с ролью из body.role;
        # - сгенерировать id в формате, совместимом с фронтендом (u-* или spec-*).
        prefix = "u" if body.role == "user" else "spec"
        count_stmt = select(User).where(User.role == body.role)
        count = len(db.execute(count_stmt).scalars().all())
        new_id = f"{prefix}-{count + 1}"
        user = User(
            id=new_id,
            role=body.role,
            clerk_id=clerk_id,
            username=body.username,
            email=body.email.strip(),
            first_name=(body.firstName or "").strip() or None,
            last_name=(body.lastName or "").strip() or None,
            phone=(body.phone or "").strip() or None,
            approved=True,
        )
        db.add(user)
        log.info("user_registered", extra={
            "event": "user_registered",
            "user_id": new_id,
            "role": body.role,
            "email": body.email,
        })
    else:
        # Этот блок создаётся, чтобы:
        # - обновлять email и username, если пользователь уже существует;
        # - не трогать роль и другие поля при повторной синхронизации.
        user.email = body.email.strip()
        user.username = body.username
        db.add(user)
        log.info("user_synced", extra={
            "event": "user_synced",
            "user_id": user.id,
            "email": body.email,
        })

    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "role": user.role,
        "email": user.email,
        "username": user.username,
    }


@router.get("/admin", response_model=list[UserResponse])
def list_users_admin(admin: RequireSuperuser, db: Session = Depends(get_db)):
    """
    Этот обработчик создаётся, чтобы:
    - позволить администратору просматривать список всех пользователей;
    - использоваться в будущем в админ-панели для назначения ролей.
    """
    stmt = select(User)
    users = db.execute(stmt).scalars().all()
    return [
        UserResponse(
            id=u.id,
            role=u.role,
            email=u.email,
            firstName=u.first_name,
            lastName=u.last_name,
            phone=u.phone,
        )
        for u in users
    ]


class ChangeRoleRequest(BaseModel):
    """
    Эта схема создаётся, чтобы:
    - безопасно принимать новую роль пользователя от администратора;
    - ограничить допустимые значения ролей user, specialist и superuser.
    """

    role: str = Field(..., description="Новая роль: user, specialist или superuser")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"user", "specialist", "superuser"}
        if v not in allowed:
            raise ValueError(f"Роль должна быть одной из: {', '.join(sorted(allowed))}")
        return v


@router.patch("/admin/{user_id}/role", response_model=UserResponse)
def change_user_role(
    user_id: str,
    body: ChangeRoleRequest,
    admin: RequireSuperuser,
    db: Session = Depends(get_db),
):
    """
    Этот обработчик создаётся, чтобы:
    - позволить администратору сменить роль выбранного пользователя;
    - использоваться для перевода user -> specialist и назначения superuser.
    """
    stmt = select(User).where(User.id == user_id)
    user = db.execute(stmt).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Пользователь не найден.", "code": "USER_NOT_FOUND"},
        )
    if body.role == "specialist":
        _require_specialist_email_allowed(user.email, "specialist")
    old_role = user.role
    user.role = body.role
    db.add(user)
    db.commit()
    db.refresh(user)
    log.info("user_role_changed", extra={
        "event": "user_role_changed",
        "user_id": user.id,
        "old_role": old_role,
        "new_role": body.role,
        "changed_by": admin.id,
    })
    return UserResponse(
        id=user.id,
        role=user.role,
        email=user.email,
        firstName=user.first_name,
        lastName=user.last_name,
        phone=user.phone,
    )
