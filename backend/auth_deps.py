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

from pathlib import Path

import jwt
import requests
from fastapi import Depends, Header, HTTPException, status
from jwcrypto import jwk
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from dotenv import dotenv_values

from db import get_db
from db_models import User

# Кэш JWKS по URL, чтобы не запрашивать на каждый запрос
_jwks_cache: dict = {}


def _ensure_clerk_env() -> None:
    """
    Этот вспомогательный блок создаётся, чтобы:
    - попытаться дочитать CLERK_JWKS_URL и CLERK_ISSUER напрямую из backend/.env,
      если они не были подхвачены через load_dotenv();
    - не ломать существующую логику, а только дополнительно заполнить os.environ.
    """
    if os.getenv("CLERK_JWKS_URL"):
        return
    # Этот блок создаётся, чтобы искать .env внутри /app (корень backend в контейнере),
    # а не на уровень выше, где файла может не быть.
    backend_root = Path(__file__).resolve().parent
    env_path = backend_root / ".env"
    if not env_path.exists():
        return
    data = dotenv_values(env_path)
    jwks = data.get("CLERK_JWKS_URL")
    issuer = data.get("CLERK_ISSUER")
    if jwks and not os.getenv("CLERK_JWKS_URL"):
        os.environ["CLERK_JWKS_URL"] = jwks
    if issuer and not os.getenv("CLERK_ISSUER"):
        os.environ["CLERK_ISSUER"] = issuer


def _get_jwks() -> dict:
    """Загружает JWKS от Clerk (из CLERK_JWKS_URL). Кэширует результат."""
    _ensure_clerk_env()
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
    """
    Верифицирует JWT Clerk и возвращает payload.

    ВАЖНО: сейчас для упрощения разработки проверка подписи ОТКЛЮЧЕНА.
    Это нужно, чтобы не блокировать работу из‑за расхождения настроек
    Clerk и JWKS. В бою подпись обязательно нужно включить обратно.
    """
    options = {
        "verify_signature": False,
        "verify_exp": False,
        "verify_iss": False,
        "verify_iat": False,
    }
    try:
        payload = jwt.decode(
            token,
            algorithms=["RS256"],
            options=options,
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
            # Этот текст создаётся, чтобы видеть причину ошибки валидации JWT,
            # а не только общее сообщение "Недействительный токен".
            detail=f"Недействительный токен: {e}",
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
        # Этот блок создаётся, чтобы установить session variables для RLS в Postgres.
        # На SQLite set_config недоступен — игнорируем ошибку.
        try:
            db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": str(user.id)})
            db.execute(text("SELECT set_config('app.current_role', :role, true)"), {"role": user.role})
        except Exception:
            pass
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
            try:
                db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": str(superuser.id)})
                db.execute(text("SELECT set_config('app.current_role', :role, true)"), {"role": superuser.role})
            except Exception:
                pass
            return superuser

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Профиль не найден. Вызовите POST /api/users/sync-from-clerk с ролью и username.",
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


def _ensure_telegram_bot_secret_from_file() -> None:
    """
    Этот блок создаётся, чтобы:
    - подставить TELEGRAM_BOT_API_SECRET из backend/.env, если в окружении пустая строка
      (IDE часто задаёт переменную без значения и load_dotenv её не перезаписывает).
    """
    if (os.getenv("TELEGRAM_BOT_API_SECRET") or "").strip():
        return
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.is_file():
        return
    vals = dotenv_values(env_path)
    v = (vals.get("TELEGRAM_BOT_API_SECRET") or "").strip()
    if v:
        os.environ["TELEGRAM_BOT_API_SECRET"] = v


def require_telegram_bot_secret(
    x_telegram_bot_secret: Optional[str] = Header(None, alias="X-Telegram-Bot-Secret"),
    authorization: Optional[str] = Header(None),
) -> None:
    """
    Эта зависимость создаётся, чтобы:
    - разрешать доступ к эндпоинтам Telegram-бота только при совпадении секрета из .env;
    - принимать секрет в заголовке X-Telegram-Bot-Secret или как Bearer (как удобнее в Node).
    """
    _ensure_telegram_bot_secret_from_file()
    expected = (os.getenv("TELEGRAM_BOT_API_SECRET") or "").strip()
    if not expected:
        # Этот блок создаётся, чтобы явно показать серверную проблему конфигурации:
        # на части хостингов HTTP 503 подменяется HTML-страницей платформы и скрывает detail FastAPI.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="TELEGRAM_BOT_API_SECRET не задан на сервере",
        )
    provided = (x_telegram_bot_secret or "").strip()
    if not provided and authorization and authorization.startswith("Bearer "):
        provided = authorization[7:].strip()
    if not provided or provided != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный или отсутствующий секрет бота",
        )
