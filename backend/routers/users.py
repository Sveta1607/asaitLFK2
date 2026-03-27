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
    # Значение по умолчанию совпадает с прод-аккаунтом; регистр не важен — ниже всегда .lower().
    return (os.getenv("ALLOWED_SPECIALIST_EMAIL") or "sharunkina2014@yandex.ru").strip().lower()


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


def _payload_email_norm(payload: dict) -> str:
    """
    Достаёт e-mail из JWT Clerk: поле в разных шаблонах сессии может называться по-разному.
    """
    if not isinstance(payload, dict):
        return ""
    for key in ("email", "email_address"):
        v = payload.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip().lower()
    em = payload.get("email_addresses")
    if isinstance(em, list) and em:
        first = em[0]
        if isinstance(first, dict):
            e = first.get("email_address") or first.get("email")
            if isinstance(e, str) and e.strip():
                return e.strip().lower()
    u = payload.get("user")
    if isinstance(u, dict):
        e = u.get("email")
        if isinstance(e, str) and e.strip():
            return e.strip().lower()
    return ""


def _jwt_email_matches_body_or_unset(payload: dict, email_norm: str) -> bool:
    """
    Проверяет, что e-mail из JWT совпадает с телом запроса (если в токене e-mail есть).
    Если в токене поля нет — доверяем телу (некоторые режимы Clerk/отладки).
    """
    jwt_em = _payload_email_norm(payload)
    if not jwt_em:
        return True
    return jwt_em == email_norm


def _relink_user_by_email_row(
    db: Session,
    existing: User,
    clerk_id: str,
    body: ClerkSyncRequest,
) -> dict:
    """
    Перепривязывает существующую строку User к новому Clerk sub при совпадении e-mail.
    Нужна, чтобы при новом браузере/сессии не создавать дубликат и не ловить UNIQUE(email).
    Роль «специалист» повышаем только при разрешённом адресе; понижать роль нельзя.
    """
    existing.clerk_id = clerk_id
    existing.username = body.username
    existing.email = body.email.strip()
    existing.first_name = (body.firstName or "").strip() or None
    existing.last_name = (body.lastName or "").strip() or None
    existing.phone = (body.phone or "").strip() or None
    email_norm = body.email.strip().lower()
    if body.role == "specialist" and email_norm == _allowed_specialist_email_norm():
        existing.role = "specialist"
    existing.updated_at = datetime.utcnow()
    db.add(existing)
    db.commit()
    db.refresh(existing)
    log.info(
        "user_clerk_relinked",
        extra={
            "event": "user_clerk_relinked",
            "user_id": existing.id,
            "email": body.email,
        },
    )
    return {
        "id": existing.id,
        "role": existing.role,
        "email": existing.email,
        "username": existing.username,
    }


def _relink_specialist_row(
    db: Session,
    existing_spec: User,
    clerk_id: str,
    body: ClerkSyncRequest,
) -> dict:
    """Делегирует общей перепривязке (та же логика полей и роли, что и для пациента по e-mail)."""
    return _relink_user_by_email_row(db, existing_spec, clerk_id, body)


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
        allowed_norm = _allowed_specialist_email_norm()
        # Этот блок создаётся, чтобы при том же e-mail и новом Clerk sub (другой браузер/аккаунт) не создавать второго пользователя и не ловить ошибку уникальности e-mail («уже зарегистрирован»).
        # Для единственного разрешённого специалиста допускаем перепривязку по телу запроса, даже если claim email в JWT не совпадает (шаблон токена в Clerk без поля email или устаревший).
        jwt_ok = _jwt_email_matches_body_or_unset(payload, email_norm)
        specialist_allowlist_bypass = body.role == "specialist" and email_norm == allowed_norm
        if jwt_ok or specialist_allowlist_bypass:
            existing_by_email = db.execute(
                select(User).where(func.lower(User.email) == email_norm)
            ).scalar_one_or_none()
            if existing_by_email:
                return _relink_user_by_email_row(db, existing_by_email, clerk_id, body)
        # Ниже — случаи специалиста, когда в БД e-mail отличается от Clerk; для пациента новая регистрация идёт дальше к INSERT.
        if body.role == "specialist":
            # 1) Совпадение логина с записью специалиста при разрешённом адресе sharunkina2014@yandex.ru (и аналогах из .env).
            if email_norm == allowed_norm:
                existing_spec = db.execute(
                    select(User).where(
                        User.role == "specialist",
                        func.lower(User.username) == body.username.strip().lower(),
                    )
                ).scalar_one_or_none()
                if existing_spec:
                    return _relink_specialist_row(db, existing_spec, clerk_id, body)
            # 2) В БД ровно один специалист и в Clerk — тот же разрешённый e-mail: перепривязка даже при расхождении полей в старой строке.
            spec_rows = db.execute(select(User).where(User.role == "specialist")).scalars().all()
            if len(spec_rows) == 1 and email_norm == allowed_norm:
                return _relink_specialist_row(db, spec_rows[0], clerk_id, body)
            # Если специалисты уже есть, а перепривязать не удалось — нового специалиста не создаём.
            spec_count = len(spec_rows)
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
