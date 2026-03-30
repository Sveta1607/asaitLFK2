# telegram_notify.py — исходящие уведомления специалисту в Telegram после записи пациента.
from __future__ import annotations

import os
from typing import Optional

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from db_models import User
from logger import get_logger

log = get_logger()

# Этот кэш создаётся, чтобы не дергать getMe Telegram на каждый клик «Получить ссылку» в профиле.
_bot_username_cache: Optional[str] = None


def resolve_telegram_bot_username() -> Optional[str]:
    """
    Этот блок создаётся, чтобы:
    - собрать username для ссылки t.me/... (без @ в URL);
    - принимать TELEGRAM_BOT_USERNAME с ведущим @ или без;
    - если username в env не задан — один раз запросить getMe по TELEGRAM_BOT_TOKEN (удобно для деплоя, где уже есть токен).
    """
    global _bot_username_cache
    from_env = (os.getenv("TELEGRAM_BOT_USERNAME") or "").strip().lstrip("@")
    if from_env:
        return from_env
    if _bot_username_cache:
        return _bot_username_cache
    token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        return None
    try:
        r = requests.get(
            f"https://api.telegram.org/bot{token}/getMe",
            timeout=10,
        )
        if not r.ok:
            log.warning(
                "telegram_getme_failed",
                extra={"event": "telegram_getme_failed", "status": r.status_code},
            )
            return None
        data = r.json()
        result = data.get("result") if isinstance(data, dict) else None
        if not data.get("ok") or not isinstance(result, dict):
            return None
        u = (result.get("username") or "").strip()
        if u:
            _bot_username_cache = u
            return u
    except requests.RequestException as e:
        log.warning(
            "telegram_getme_error",
            extra={"event": "telegram_getme_error", "error": str(e)[:200]},
        )
    return None


def _notify_env_enabled() -> bool:
    """
    Этот блок создаётся, чтобы:
    - быстро отключать рассылку через TELEGRAM_NOTIFY_ENABLED без смены кода;
    - по умолчанию считать уведомления включёнными, если переменная не задана.
    """
    v = (os.getenv("TELEGRAM_NOTIFY_ENABLED") or "true").strip().lower()
    return v not in ("0", "false", "no", "off")


def _mask_phone_for_log(phone: Optional[str]) -> str:
    """
    Этот блок создаётся, чтобы:
    - не писать полный номер в логах (требование приватности из плана).
    """
    if not phone or not str(phone).strip():
        return "—"
    digits = "".join(c for c in str(phone) if c.isdigit())
    if len(digits) < 4:
        return "***"
    return f"***{digits[-4:]}"


def notify_specialist_new_booking(
    db: Session,
    *,
    specialist_id: str,
    first_name: str,
    last_name: str,
    phone: Optional[str],
    date: str,
    time: str,
    booking_id: str,
    source_label: str,
) -> None:
    """
    Этот блок создаётся, чтобы:
    - после успешной фиксации записи в БД предупредить специалиста в личном чате;
    - не поднимать исключений наружу: сбой Telegram не отменяет запись.
    """
    if not _notify_env_enabled():
        log.info(
            "telegram_notify_skipped_disabled",
            extra={"event": "telegram_notify_skipped", "reason": "disabled", "booking_id": booking_id},
        )
        return

    token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        log.info(
            "telegram_notify_skipped_no_token",
            extra={"event": "telegram_notify_skipped", "reason": "no_token", "booking_id": booking_id},
        )
        return

    stmt = select(User).where(User.id == specialist_id)
    specialist = db.execute(stmt).scalar_one_or_none()
    chat_id = (specialist.telegram_chat_id or "").strip() if specialist else ""
    if not chat_id:
        log.info(
            "telegram_notify_skipped_no_chat",
            extra={
                "event": "telegram_notify_skipped",
                "reason": "no_telegram_chat_id",
                "booking_id": booking_id,
                "specialist_id": specialist_id,
            },
        )
        return

    phone_display = (phone or "").strip() or "не указан"
    patient_line = f"{(last_name or '').strip()} {(first_name or '').strip()}".strip() or "Пациент"
    text = (
        f"Новая запись ({source_label})\n"
        f"Пациент: {patient_line}\n"
        f"Телефон: {phone_display}\n"
        f"Дата: {date}\n"
        f"Время: {time}"
    )

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        r = requests.post(
            url,
            json={"chat_id": chat_id, "text": text},
            timeout=10,
        )
        if not r.ok:
            log.warning(
                "telegram_send_message_failed",
                extra={
                    "event": "telegram_send_failed",
                    "booking_id": booking_id,
                    "specialist_id": specialist_id,
                    "status": r.status_code,
                    "telegram_body": (r.text or "")[:500],
                    "phone_masked": _mask_phone_for_log(phone),
                },
            )
            return
        log.info(
            "telegram_notify_sent",
            extra={
                "event": "telegram_notify_sent",
                "booking_id": booking_id,
                "specialist_id": specialist_id,
                "phone_masked": _mask_phone_for_log(phone),
            },
        )
    except requests.RequestException as e:
        log.warning(
            "telegram_send_message_error",
            extra={
                "event": "telegram_send_error",
                "booking_id": booking_id,
                "specialist_id": specialist_id,
                "error": str(e)[:300],
                "phone_masked": _mask_phone_for_log(phone),
            },
        )
