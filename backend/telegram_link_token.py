# telegram_link_token.py — подписанные токены привязки Telegram без строки в БД (несколько реплик / SQLite).
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import struct
from datetime import datetime, timezone

# Максимальная длина user.id в UTF-8, чтобы весь start=… уместился в лимит Telegram (~64 символа).
_MAX_USER_ID_BYTES = 24


def _signing_secret_bytes() -> bytes | None:
    """
    Этот блок создаётся, чтобы взять общий секрет для HMAC: отдельный ключ или тот же, что у бота.
    """
    raw = (os.getenv("TELEGRAM_LINK_SIGNING_SECRET") or os.getenv("TELEGRAM_BOT_API_SECRET") or "").strip()
    if not raw:
        return None
    return raw.encode("utf-8")


def can_issue_signed_telegram_link_token(user_id: str) -> bool:
    """Проверка: можно ли выдать подписанный токен для данного id без обрезки."""
    return bool(_signing_secret_bytes()) and len(user_id.encode("utf-8")) <= _MAX_USER_ID_BYTES


def _utc_epoch_seconds(dt: datetime) -> int:
    """Перевод datetime в unix-секунды; наивное время считаем уже UTC (как datetime.utcnow() в проекте)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def create_signed_telegram_link_token(user_id: str, expires_at: datetime) -> str:
    """
    Этот блок создаётся, чтобы сформировать короткий токен для ?start=link_<token> без записи в telegram_link_tokens.
    Формат: base64url( version(1) + exp_unix(4) + len(1) + user_id + hmac8 ).
    """
    secret = _signing_secret_bytes()
    if not secret:
        raise RuntimeError("Нет TELEGRAM_LINK_SIGNING_SECRET и TELEGRAM_BOT_API_SECRET для подписи ссылки.")
    uid_b = user_id.encode("utf-8")
    if len(uid_b) > _MAX_USER_ID_BYTES:
        raise ValueError("user_id слишком длинный для подписанной ссылки.")
    exp = _utc_epoch_seconds(expires_at)
    ver = 1
    payload = struct.pack(">BIB", ver, exp, len(uid_b)) + uid_b
    sig = hmac.new(secret, payload, hashlib.sha256).digest()[:8]
    blob = payload + sig
    return base64.urlsafe_b64encode(blob).decode("ascii").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    """Декодирование base64url с доп. паддингом."""
    pad = (4 - len(s) % 4) % 4
    return base64.urlsafe_b64decode(s + ("=" * pad))


def verify_signed_telegram_link_token(token: str) -> tuple[str, datetime] | None:
    """
    Этот блок создаётся, чтобы проверить подпись и срок; вернуть (user_id, expires_at_utc) или None.
    """
    secret = _signing_secret_bytes()
    if not secret:
        return None
    raw_t = (token or "").strip()
    if not raw_t or len(raw_t) > 96:
        return None
    try:
        blob = _b64url_decode(raw_t)
    except Exception:
        return None
    if len(blob) < 1 + 4 + 1 + 8:
        return None
    ver, exp_unix, uid_len = struct.unpack(">BIB", blob[:6])
    if ver != 1:
        return None
    if uid_len < 1 or uid_len > _MAX_USER_ID_BYTES:
        return None
    if len(blob) != 6 + uid_len + 8:
        return None
    uid_b = blob[6 : 6 + uid_len]
    sig_got = blob[6 + uid_len :]
    payload = blob[: 6 + uid_len]
    sig_exp = hmac.new(secret, payload, hashlib.sha256).digest()[:8]
    if not hmac.compare_digest(sig_got, sig_exp):
        return None
    try:
        user_id = uid_b.decode("utf-8")
    except UnicodeDecodeError:
        return None
    # Сравнение с datetime.utcnow() в роутере — отдаём наивный UTC.
    expires_at = datetime.utcfromtimestamp(exp_unix)
    return user_id, expires_at
