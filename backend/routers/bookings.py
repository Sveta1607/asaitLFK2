# routers/bookings.py — CRUD записей на приём
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Header, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from db import get_db
from db_models import User, Slot, Booking

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _generate_cancel_token() -> str:
    """Генерация токена отмены для записи."""
    return uuid.uuid4().hex[:12]


def _require_auth(
    db: Session,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
) -> User:
    """
    Эта функция создаётся, чтобы:
    - проверить авторизацию по X-User-Id;
    - вернуть пользователя из БД или выбросить ошибку.
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


def _next_booking_id() -> str:
    """Генерация строкового идентификатора записи с префиксом b-."""
    return f"b-{int(__import__('time').time() * 1000)}"


@router.get("")
def list_bookings(
    userId: Optional[str] = Query(None),
    specialistId: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """Список записей: ?userId= — свои (пациент), ?specialistId= — расписание специалиста."""
    user = _require_auth(db, x_user_id)
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
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """Создать запись: от пациента (с userId, slotId) или от специалиста (без userId)."""
    user = _require_auth(db, x_user_id)

    is_patient = "userId" in body and "slotId" in body
    if is_patient:
        # Пациент записывается сам.
        if user.role != "user" or body.get("userId") != user.id:
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
            user_id=body["userId"],
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
    body: Optional[dict] = None,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """Отменить запись — пациент (свою) или специалист."""
    user = _require_auth(db, x_user_id)
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
    return {"success": True, "booking": {"id": booking.id, "status": "cancelled"}}
