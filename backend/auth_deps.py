# auth_deps.py — зависимости FastAPI для проверки JWT Clerk и прав доступа
"""
Извлечение Bearer-токена, верификация через Clerk JWKS, получение текущего
пользователя из БД по clerk_id (JWT sub), проверка approved и ролей.
"""
from __future__ import annotations

import base64
import json
import os
from typing import Annotated, Callable, List, Optional

import jwt
import requests
from fastapi import Depends, Header, HTTPException, status
from jwcrypto import jwk
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from db_models import User

# Кэш JWKS по URL, чтобы не запрашивать на каждый запрос
_jwks_cache: dict = {}


def _get_jwks() -> dict:
    """Загружает JWKS от Clerk (из CLERK_JWKS_URL). Кэширует результат."""
    url = os.getenv("CLERK_JWKS_URL")
    if not url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CLERK_JWKS_URL не задан. Настройте Clerk в .env.",
        )
    if url not in _jwks_cache:
        try:
            r = requests.get(url, timeout=10)
            r.raise_for_status()
            _jwks_cache[url] = r.json()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Не удалось загрузить JWKS Clerk: {e}",
            )
    return _jwks_cache[url]


def get_token_from_header(
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> str:
    """Извлекает Bearer-токен из заголовка Authorization. Иначе 401."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется заголовок Authorization: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return authorization[7:].strip()


def _get_kid_from_token(token: str) -> Optional[str]:
    """Декодирует JWT header (без проверки подписи) и возвращает kid."""
    parts = token.split(".")
    if len(parts) < 2:
        return None
    raw = parts[0]
    raw += "=" * (4 - len(raw) % 4)
    try:
        header = json.loads(base64.urlsafe_b64decode(raw))
        return header.get("kid")
    except Exception:
        return None


def verify_clerk_token(token: str) -> dict:
    """Верифицирует JWT подписью Clerk (JWKS) и возвращает payload. Иначе 401."""
    kid = _get_kid_from_token(token)
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный или повреждённый токен",
            headers={"WWW-Authenticate": "Bearer"},
        )

    jwks_data = _get_jwks()
    keys = jwks_data.get("keys", [])
    key_obj = None
    for k in keys:
        if k.get("kid") == kid:
            key_obj = jwk.JWK.from_json(json.dumps(k))
            break
    if not key_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ключ подписи не найден в JWKS",
            headers={"WWW-Authenticate": "Bearer"},
        )

    pem = key_obj.export_to_pem().decode("utf-8")
    issuer = os.getenv("CLERK_ISSUER")
    options = {"verify_signature": True, "verify_exp": True}
    try:
        payload = jwt.decode(
            token,
            pem,
            algorithms=["RS256"],
            options=options,
            issuer=issuer if issuer else None,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Срок действия токена истёк",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    token: Annotated[str, Depends(get_token_from_header)],
) -> User:
    """
    Верифицирует JWT, извлекает clerk_id (sub), находит User в БД.
    Если пользователь не найден по clerk_id, проверяет привязку суперюзера по email (из JWT).
    Иначе 401 или 403 (завершите регистрацию профиля).
    """
    payload = verify_clerk_token(token)
    clerk_id = payload.get("sub")
    email = (payload.get("email") or "").strip()

    if not clerk_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="В токене отсутствует sub (clerk_id)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Поиск по clerk_id
    stmt = select(User).where(User.clerk_id == clerk_id)
    user = db.execute(stmt).scalar_one_or_none()
    if user:
        return user

    # Привязка суперюзера по email (один раз): суперюзер с clerk_id=None и совпадающим email
    if email:
        stmt_super = select(User).where(
            User.role == "superuser",
            User.clerk_id.is_(None),
            User.email == email,
        )
        superuser = db.execute(stmt_super).scalar_one_or_none()
        if superuser:
            superuser.clerk_id = clerk_id
            db.add(superuser)
            db.commit()
            db.refresh(superuser)
            return superuser

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Профиль не найден. Вызовите POST /api/auth/sync-profile с ролью и ФИО.",
    )


def get_current_user_approved(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Проверяет, что пользователь одобрен (approved). Иначе 403."""
    if not user.approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ожидайте одобрения регистрации. Ваша заявка на рассмотрении.",
        )
    return user


def require_role(roles: List[str]) -> Callable:
    """Возвращает зависимость: текущий пользователь должен иметь одну из переданных ролей."""

    def _require_role(
        user: Annotated[User, Depends(get_current_user_approved)],
    ) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для этого действия.",
            )
        return user

    return _require_role


def get_clerk_payload(
    token: Annotated[str, Depends(get_token_from_header)],
) -> dict:
    """Только верификация JWT и возврат payload (для sync-profile, без требования User в БД)."""
    return verify_clerk_token(token)


# Удобные зависимости для роутеров
RequireUser = Annotated[User, Depends(get_current_user)]
RequireApproved = Annotated[User, Depends(get_current_user_approved)]
RequireSpecialist = Annotated[User, Depends(require_role(["specialist"]))]
RequireSuperuser = Annotated[User, Depends(require_role(["superuser"]))]
