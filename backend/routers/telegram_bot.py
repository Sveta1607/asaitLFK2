# routers/telegram_bot.py — чтение специалистов/слотов и создание записи для Telegram-бота (секрет в заголовке).
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth_deps import require_telegram_bot_secret
from db import get_db
from db_models import Booking, Slot, TelegramLinkToken, User
from logger import get_logger
from models import SlotResponse, SpecialistPublicResponse
from routers.bookings import _generate_cancel_token, _next_booking_id
from telegram_link_token import verify_signed_telegram_link_token
from telegram_notify import notify_specialist_new_booking

router = APIRouter(prefix="/telegram", tags=["telegram-bot"])
log = get_logger()


class TelegramBookingCreate(BaseModel):
    """Тело запроса: запись гостя из бота (без Clerk), как у ручной записи специалиста."""

    slotId: str = Field(..., description="ID свободного слота")
    firstName: str = Field(..., min_length=1)
    lastName: str = Field(..., min_length=1)
    phone: Optional[str] = None


class TelegramLinkChatBody(BaseModel):
    """Тело запроса: привязка chat_id специалиста после перехода по ссылке из ЛК."""

    token: str = Field(
        ...,
        min_length=12,
        max_length=96,
        description="Hex-токен из БД (32 символа) или подписанный токен из ссылки",
    )
    chatId: str = Field(..., min_length=1, description="Идентификатор чата Telegram (личка с ботом)")


@router.post("/link-chat", status_code=status.HTTP_200_OK)
def telegram_link_specialist_chat(
    body: TelegramLinkChatBody,
    db: Session = Depends(get_db),
    _: None = Depends(require_telegram_bot_secret),
):
    """
    Этот обработчик создаётся, чтобы:
    - после /start link_<token> в боте сохранить telegram_chat_id у специалиста;
    - принимать hex-токен из telegram_link_tokens или подписанный токен (без строки в БД).
    """
    raw_token = body.token.strip()
    now = datetime.utcnow()

    # Этот блок создаётся, чтобы обработать подписанный токен: одинаковый секрет на всех репликах — не нужна общая БД для выдачи ссылки.
    if not re.fullmatch(r"[a-fA-F0-9]{32}", raw_token):
        signed = verify_signed_telegram_link_token(raw_token)
        if signed:
            user_id, exp_at = signed
            if exp_at < now:
                raise HTTPException(
                    status_code=400,
                    detail={"detail": "Ссылка истекла. Создайте новую в профиле на сайте.", "code": "LINK_EXPIRED"},
                )
            user = db.get(User, user_id)
            if not user or user.role != "specialist" or not user.approved:
                raise HTTPException(
                    status_code=403,
                    detail={"detail": "Привязка доступна только одобренному специалисту.", "code": "FORBIDDEN"},
                )
            user.telegram_chat_id = str(body.chatId).strip()
            db.add(user)
            db.commit()
            log.info(
                "telegram_specialist_chat_linked",
                extra={"event": "telegram_chat_linked", "user_id": user.id, "via": "signed"},
            )
            return {"ok": True}

    # Этот блок создаётся, чтобы поддержать старые одноразовые hex-токены в таблице telegram_link_tokens.
    raw_hex = raw_token.lower()
    row = db.get(TelegramLinkToken, raw_hex)
    if not row:
        log.warning(
            "telegram_link_token_missing",
            extra={
                "event": "invalid_telegram_link_token",
                "token_prefix": raw_hex[:8] if len(raw_hex) >= 8 else raw_hex,
                "looks_like_db_hex": bool(re.fullmatch(r"[a-f0-9]{32}", raw_hex)),
            },
        )
        # Этот блок создаётся, чтобы явно подсказать типичную причину для 32-символьного hex (токен только в БД этого инстанса).
        hex_db_hint = ""
        if re.fullmatch(r"[a-f0-9]{32}", raw_hex):
            hex_db_hint = (
                " Токен из 32 символов (0–9, a–f) хранится только в базе того сервера, где нажали «Получить ссылку». "
                "Если бот в telegram-bot/.env смотрит на другой хост (часто остаётся API_BASE_URL=http://127.0.0.1:3000 "
                "при сайте на Amvera), в его базе строки нет → эта ошибка. Укажите в .env бота полный URL продакшен-API "
                "и тот же TELEGRAM_BOT_API_SECRET, что в переменных бэкенда. На Amvera в контейнере бэкенда задайте "
                "TELEGRAM_BOT_API_SECRET — тогда новые ссылки станут подписанными (не только hex) и переживут несколько реплик SQLite."
            )
        raise HTTPException(
            status_code=400,
            detail={
                "detail": "Ссылка недействительна или уже использована.",
                "code": "INVALID_LINK_TOKEN",
                "hint": "Проверьте: 1) не нажимали ли «Получить ссылку» повторно до открытия старой ссылки; "
                "2) в telegram-bot/.env задан тот же TELEGRAM_BOT_API_SECRET, что на бэкенде, и верный API_BASE_URL; "
                "3) при старых ссылках (только hex) и SQLite на нескольких подах — включите подписанные ссылки (секрет на бэкенде) и запросите ссылку заново."
                + hex_db_hint,
            },
        )
    if row.expires_at < now:
        db.delete(row)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail={"detail": "Ссылка истекла. Создайте новую в профиле на сайте.", "code": "LINK_EXPIRED"},
        )
    user = db.get(User, row.user_id)
    if not user or user.role != "specialist" or not user.approved:
        db.delete(row)
        db.commit()
        raise HTTPException(
            status_code=403,
            detail={"detail": "Привязка доступна только одобренному специалисту.", "code": "FORBIDDEN"},
        )
    user.telegram_chat_id = str(body.chatId).strip()
    db.delete(row)
    db.add(user)
    db.commit()
    log.info(
        "telegram_specialist_chat_linked",
        extra={"event": "telegram_chat_linked", "user_id": user.id, "via": "db_row"},
    )
    return {"ok": True}


@router.get("/specialists", response_model=list[SpecialistPublicResponse])
def list_specialists_for_bot(
    db: Session = Depends(get_db),
    _: None = Depends(require_telegram_bot_secret),
):
    """
    Этот обработчик создаётся, чтобы:
    - отдать тот же список одобренных специалистов, что видит пациент на сайте;
    - не требовать JWT Clerk — только секрет бота.
    """
    stmt = select(User).where(User.role == "specialist", User.approved.is_(True))
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


@router.get("/slots", response_model=list[SlotResponse])
def list_free_slots_for_bot(
    specialistId: str = Query(..., description="ID специалиста"),
    date: Optional[str] = Query(None, description="Фильтр YYYY-MM-DD; без фильтра — все свободные слоты"),
    db: Session = Depends(get_db),
    _: None = Depends(require_telegram_bot_secret),
):
    """
    Этот обработчик создаётся, чтобы:
    - показать актуальные свободные слоты из БД (как на сайте);
    - позволить боту построить выбор дня и времени.
    """
    stmt = (
        select(Slot, User.first_name, User.last_name)
        .join(User, Slot.specialist_id == User.id)
        .where(
            Slot.specialist_id == specialistId,
            Slot.status == "free",
        )
    )
    if date:
        stmt = stmt.where(Slot.date == date)
    stmt = stmt.order_by(Slot.date, Slot.time)
    rows = db.execute(stmt).all()
    return [
        SlotResponse(
            id=s.id,
            specialistId=s.specialist_id,
            date=s.date,
            time=s.time,
            status=s.status,
            specialistFirstName=fn,
            specialistLastName=ln,
        )
        for s, fn, ln in rows
    ]


@router.post("/bookings", status_code=status.HTTP_201_CREATED)
def create_booking_from_telegram(
    body: TelegramBookingCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_telegram_bot_secret),
):
    """
    Этот обработчик создаётся, чтобы:
    - создать запись в той же таблице bookings, что и сайт;
    - освободить слот по той же логике, что и запись от специалиста (user_id=NULL).
    """
    slot_stmt = select(Slot).where(Slot.id == body.slotId)
    slot = db.execute(slot_stmt).scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail={"detail": "Слот не найден.", "code": "NOT_FOUND"})
    if slot.status != "free":
        raise HTTPException(
            status_code=409,
            detail={"detail": "Слот уже занят. Выберите другое время.", "code": "SLOT_BUSY"},
        )

    booking = Booking(
        id=_next_booking_id(),
        slot_id=slot.id,
        specialist_id=slot.specialist_id,
        user_id=None,
        date=slot.date,
        time=slot.time,
        last_name=(body.lastName or "").strip() or "Пациент",
        first_name=(body.firstName or "").strip() or "Без имени",
        phone=(body.phone or "").strip() or None,
        status="active",
    )
    booking.cancel_token = _generate_cancel_token()
    slot.status = "busy"
    db.add(booking)
    db.add(slot)
    db.commit()
    db.refresh(booking)
    log.info(
        "booking_created_from_telegram",
        extra={
            "event": "booking_created_from_telegram",
            "booking_id": booking.id,
            "specialist_id": booking.specialist_id,
            "date": booking.date,
            "time": booking.time,
        },
    )
    # Этот блок создаётся, чтобы специалист получил то же оповещение, что и при записи с сайта (источник — Telegram).
    notify_specialist_new_booking(
        db,
        specialist_id=booking.specialist_id,
        first_name=booking.first_name,
        last_name=booking.last_name,
        phone=booking.phone,
        date=booking.date,
        time=booking.time,
        booking_id=booking.id,
        source_label="Telegram",
    )
    return {
        "id": booking.id,
        "specialistId": booking.specialist_id,
        "userId": booking.user_id,
        "date": booking.date,
        "time": booking.time,
        "lastName": booking.last_name,
        "firstName": booking.first_name,
        "phone": booking.phone,
        "status": booking.status,
        "cancelToken": booking.cancel_token,
    }
