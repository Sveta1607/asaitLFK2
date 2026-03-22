# routers/bookings.py — CRUD записей на приём.
# Также логирует бизнес-события: создание и отмена записей.
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth_deps import RequireUser, RequireSpecialist
from db import get_db
from db_models import Slot, Booking
from logger import get_logger

router = APIRouter(prefix="/bookings", tags=["bookings"])
log = get_logger()


def _generate_cancel_token() -> str:
    """Генерация токена отмены для записи."""
    return uuid.uuid4().hex[:12]


def _next_booking_id() -> str:
    """Генерация строкового идентификатора записи с префиксом b-."""
    return f"b-{int(__import__('time').time() * 1000)}"


@router.get("")
def list_bookings(
    current_user: RequireUser,
    userId: Optional[str] = Query(None),
    specialistId: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Список записей: ?userId= — свои (пациент), ?specialistId= — расписание специалиста."""
    user = current_user
    stmt = select(Booking)
    if userId:
        if user.role != "user" or userId != user.id:
            raise HTTPException(
                status_code=403,
                detail={"detail": "Можно просматривать только свои записи.", "code": "FORBIDDEN"},
            )
        stmt = stmt.where(Booking.user_id == userId, Booking.status == "active")
    elif specialistId:
        if user.role != "specialist" or specialistId != user.id:
            raise HTTPException(
                status_code=403,
                detail={"detail": "Можно просматривать только своё расписание.", "code": "FORBIDDEN"},
            )
        stmt = stmt.where(Booking.specialist_id == specialistId, Booking.status == "active")
    else:
        raise HTTPException(
            status_code=400,
            detail={"detail": "Укажите userId или specialistId.", "code": "BAD_REQUEST"},
        )
    stmt = stmt.order_by(Booking.date, Booking.time)
    rows = db.execute(stmt).scalars().all()
    # Этот блок создаётся, чтобы:
    # - дополнительно вернуть ФИО специалиста для каждой записи;
    # - не ломать текущий фронтенд, сохранив предыдущие поля ответа.
    result: list[dict] = []
    for b in rows:
        specialist = b.specialist
        result.append(
            {
                "id": b.id,
                "specialistId": b.specialist_id,
                "userId": b.user_id,
                "date": b.date,
                "time": b.time,
                "lastName": b.last_name,
                "firstName": b.first_name,
                "phone": b.phone,
                "status": b.status,
                "specialistLastName": getattr(specialist, "last_name", None) if specialist else None,
                "specialistFirstName": getattr(specialist, "first_name", None) if specialist else None,
            }
        )
    return result


@router.post("", status_code=201)
def create_booking(
    body: dict,  # Union[BookingCreateByPatientRequest, BookingCreateBySpecialistRequest]
    current_user: RequireUser,
    db: Session = Depends(get_db),
):
    """Создать запись: от пациента (с slotId) или от специалиста (без slotId)."""
    user = current_user

    # Пациент отправляет slotId; специалист — date, time, specialistId без slotId.
    is_patient = "slotId" in body
    if is_patient:
        # Пациент записывается сам. userId берём из JWT, не из тела.
        if user.role != "user":
            raise HTTPException(
                status_code=403,
                detail={"detail": "Только пациент может записаться от своего имени.", "code": "FORBIDDEN"},
            )
        # Проверяем слот по id.
        slot_stmt = select(Slot).where(Slot.id == body["slotId"])
        slot = db.execute(slot_stmt).scalar_one_or_none()
        if not slot:
            raise HTTPException(status_code=404, detail={"detail": "Слот не найден.", "code": "NOT_FOUND"})
        if slot.status != "free":
            raise HTTPException(
                status_code=409,
                detail={"detail": "Слот уже занят. Выберите другое время.", "code": "SLOT_BUSY"},
            )
        if slot.specialist_id != body.get("specialistId"):
            raise HTTPException(
                status_code=400,
                detail={"detail": "Слот не принадлежит указанному специалисту.", "code": "BAD_REQUEST"},
            )
        booking = Booking(
            id=_next_booking_id(),
            slot_id=slot.id,
            specialist_id=slot.specialist_id,
            user_id=user.id,
            date=slot.date,
            time=slot.time,
            last_name=(body.get("lastName") or "").strip() or "Пациент",
            first_name=(body.get("firstName") or "").strip() or "Без имени",
            phone=body.get("phone"),
            status="active",
        )
        slot.status = "busy"
    else:
        # Специалист записывает пациента.
        if user.role != "specialist" or body.get("specialistId") != user.id:
            raise HTTPException(
                status_code=403,
                detail={"detail": "Только специалист может записывать пациентов.", "code": "FORBIDDEN"},
            )
        # Ищем слот по specialistId, date, time.
        slot_stmt = select(Slot).where(
            Slot.specialist_id == body["specialistId"],
            Slot.date == body["date"],
            Slot.time == body["time"],
        )
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
            specialist_id=body["specialistId"],
            user_id=None,
            date=body["date"],
            time=body["time"],
            last_name=(body.get("lastName") or "").strip() or "Пациент",
            first_name=(body.get("firstName") or "").strip() or "Без имени",
            phone=body.get("phone"),
            status="active",
        )
        slot.status = "busy"

    booking.cancel_token = _generate_cancel_token()
    db.add(booking)
    db.add(slot)
    db.commit()
    db.refresh(booking)
    log.info("booking_created", extra={
        "event": "booking_created",
        "booking_id": booking.id,
        "specialist_id": booking.specialist_id,
        "user_id": booking.user_id,
        "date": booking.date,
        "time": booking.time,
        "created_by": "patient" if is_patient else "specialist",
    })
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


@router.patch("/{booking_id}/cancel")
def cancel_booking(
    booking_id: str,
    current_user: RequireUser,
    body: Optional[dict] = None,
    db: Session = Depends(get_db),
):
    """Отменить запись — пациент (свою) или специалист."""
    user = current_user
    stmt = select(Booking).where(Booking.id == booking_id)
    booking = db.execute(stmt).scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail={"detail": "Запись не найдена.", "code": "NOT_FOUND"})
    if booking.status == "cancelled":
        return {"id": booking.id, "status": "cancelled"}

    # Пациент может отменить только свою запись; специалист — любую в своём расписании.
    if user.role == "user":
        if booking.user_id != user.id:
            raise HTTPException(
                status_code=403,
                detail={"detail": "Можно отменить только свою запись.", "code": "FORBIDDEN"},
            )
    else:
        if booking.specialist_id != user.id:
            raise HTTPException(
                status_code=403,
                detail={"detail": "Можно отменить только запись в своём расписании.", "code": "FORBIDDEN"},
            )
    # Освобождаем слот и помечаем запись как отменённую.
    slot_stmt = select(Slot).where(
        Slot.specialist_id == booking.specialist_id,
        Slot.date == booking.date,
        Slot.time == booking.time,
    )
    slot = db.execute(slot_stmt).scalar_one_or_none()
    if slot:
        slot.status = "free"
        db.add(slot)
    booking.status = "cancelled"
    db.add(booking)
    db.commit()
    log.info("booking_cancelled", extra={
        "event": "booking_cancelled",
        "booking_id": booking.id,
        "cancelled_by": user.id,
        "role": user.role,
    })
    return {"id": booking.id, "status": "cancelled"}


@router.get("/cancel/{token}")
def cancel_by_token(token: str, db: Session = Depends(get_db)):
    """Отмена по токену из ссылки — доступно любому (публичная ссылка)."""
    stmt = select(Booking).where(Booking.cancel_token == token)
    booking = db.execute(stmt).scalar_one_or_none()
    if not booking:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Недействительная ссылка отмены.", "code": "INVALID_TOKEN"},
        )
    if booking.status == "cancelled":
        return {"success": True, "booking": {"id": booking.id, "status": "cancelled"}}
    # Освобождаем слот и помечаем запись как отменённую.
    slot_stmt = select(Slot).where(
        Slot.specialist_id == booking.specialist_id,
        Slot.date == booking.date,
        Slot.time == booking.time,
    )
    slot = db.execute(slot_stmt).scalar_one_or_none()
    if slot:
        slot.status = "free"
        db.add(slot)
    booking.status = "cancelled"
    db.add(booking)
    db.commit()
    log.info("booking_cancelled_by_token", extra={
        "event": "booking_cancelled_by_token",
        "booking_id": booking.id,
    })
    return {"success": True, "booking": {"id": booking.id, "status": "cancelled"}}
