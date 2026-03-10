# routers/bookings.py — CRUD записей на приём
import uuid
from fastapi import APIRouter, HTTPException, Query, Header
from typing import Optional
from store import (
    slots,
    bookings,
    users,
    cancel_tokens,
    get_slot_by_id,
    get_booking_by_id,
    get_slot_by_specialist_date_time,
    mark_slot_busy,
    mark_slot_free,
)

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _generate_cancel_token(booking_id: str) -> str:
    """Генерирует токен отмены для записи"""
    token = uuid.uuid4().hex[:12]
    cancel_tokens[token] = booking_id
    return token


def _require_auth(x_user_id: Optional[str] = Header(None, alias="X-User-Id")) -> str:
    """Проверяет наличие авторизации"""
    if not x_user_id:
        raise HTTPException(
            status_code=401,
            detail={"detail": "Требуется авторизация.", "code": "UNAUTHORIZED"},
        )
    if x_user_id not in users:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Пользователь не найден.", "code": "USER_NOT_FOUND"},
        )
    return x_user_id


def _next_booking_id() -> str:
    return f"b-{int(__import__('time').time() * 1000)}"


@router.get("")
def list_bookings(
    userId: Optional[str] = Query(None),
    specialistId: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """Список записей: ?userId= — свои (пациент), ?specialistId= — расписание специалиста"""
    uid = _require_auth(x_user_id)
    u = users.get(uid)
    if userId:
        if u.get("role") != "user" or userId != uid:
            raise HTTPException(status_code=403, detail={"detail": "Можно просматривать только свои записи.", "code": "FORBIDDEN"})
        result = [b for b in bookings if b.get("userId") == userId and b.get("status") == "active"]
    elif specialistId:
        if u.get("role") != "specialist" or specialistId != uid:
            raise HTTPException(status_code=403, detail={"detail": "Можно просматривать только своё расписание.", "code": "FORBIDDEN"})
        result = [b for b in bookings if b.get("specialistId") == specialistId and b.get("status") == "active"]
    else:
        raise HTTPException(status_code=400, detail={"detail": "Укажите userId или specialistId.", "code": "BAD_REQUEST"})
    return [{"id": b["id"], "specialistId": b["specialistId"], "userId": b.get("userId"), "date": b["date"], "time": b["time"], "lastName": b["lastName"], "firstName": b["firstName"], "phone": b.get("phone"), "status": b["status"]} for b in result]


def _booking_to_response(b: dict) -> dict:
    """Добавляет cancelToken к ответу, если есть"""
    out = {**b}
    for tok, bid in cancel_tokens.items():
        if bid == b["id"]:
            out["cancelToken"] = tok
            break
    else:
        out["cancelToken"] = None
    return out


@router.post("", status_code=201)
def create_booking(
    body: dict,  # Union[BookingCreateByPatientRequest, BookingCreateBySpecialistRequest]
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """Создать запись: от пациента (с userId, slotId) или от специалиста (без userId)"""
    uid = _require_auth(x_user_id)
    u = users.get(uid)

    # Определяем тип запроса: по наличию userId и slotId
    is_patient = "userId" in body and "slotId" in body
    if is_patient:
        # Пациент записывается сам
        if u.get("role") != "user" or body.get("userId") != uid:
            raise HTTPException(status_code=403, detail={"detail": "Только пациент может записаться от своего имени.", "code": "FORBIDDEN"})
        slot = get_slot_by_id(body["slotId"])
        if not slot:
            raise HTTPException(status_code=404, detail={"detail": "Слот не найден.", "code": "NOT_FOUND"})
        if slot["status"] != "free":
            raise HTTPException(
                status_code=409,
                detail={"detail": "Слот уже занят. Выберите другое время.", "code": "SLOT_BUSY"},
            )
        if slot["specialistId"] != body.get("specialistId"):
            raise HTTPException(status_code=400, detail={"detail": "Слот не принадлежит указанному специалисту.", "code": "BAD_REQUEST"})
        booking = {
            "id": _next_booking_id(),
            "specialistId": slot["specialistId"],
            "userId": body["userId"],
            "date": slot["date"],
            "time": slot["time"],
            "lastName": (body.get("lastName") or "").strip() or "Пациент",
            "firstName": (body.get("firstName") or "").strip() or "Без имени",
            "phone": body.get("phone"),
            "status": "active",
        }
        mark_slot_busy(slot["id"])
    else:
        # Специалист записывает пациента
        if u.get("role") != "specialist" or body.get("specialistId") != uid:
            raise HTTPException(status_code=403, detail={"detail": "Только специалист может записывать пациентов.", "code": "FORBIDDEN"})
        slot = get_slot_by_specialist_date_time(body["specialistId"], body["date"], body["time"])
        if not slot:
            raise HTTPException(status_code=404, detail={"detail": "Слот не найден.", "code": "NOT_FOUND"})
        if slot["status"] != "free":
            raise HTTPException(
                status_code=409,
                detail={"detail": "Слот уже занят. Выберите другое время.", "code": "SLOT_BUSY"},
            )
        booking = {
            "id": _next_booking_id(),
            "specialistId": body["specialistId"],
            "userId": None,
            "date": body["date"],
            "time": body["time"],
            "lastName": (body.get("lastName") or "").strip() or "Пациент",
            "firstName": (body.get("firstName") or "").strip() or "Без имени",
            "phone": body.get("phone"),
            "status": "active",
        }
        mark_slot_busy(slot["id"])

    bookings.append(booking)
    token = _generate_cancel_token(booking["id"])
    return _booking_to_response({**booking, "cancelToken": token})


@router.patch("/{booking_id}/cancel")
def cancel_booking(booking_id: str, body: Optional[dict] = None, x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """Отменить запись — пациент (свою) или специалист"""
    uid = _require_auth(x_user_id)
    u = users.get(uid)
    b = get_booking_by_id(booking_id)
    if not b:
        raise HTTPException(status_code=404, detail={"detail": "Запись не найдена.", "code": "NOT_FOUND"})
    if b["status"] == "cancelled":
        return {"id": b["id"], "status": "cancelled"}
    # Пациент может отменить только свою запись; специалист — любую в своём расписании
    if u.get("role") == "user":
        if b.get("userId") != uid:
            raise HTTPException(status_code=403, detail={"detail": "Можно отменить только свою запись.", "code": "FORBIDDEN"})
    else:
        if b.get("specialistId") != uid:
            raise HTTPException(status_code=403, detail={"detail": "Можно отменить только запись в своём расписании.", "code": "FORBIDDEN"})
    b["status"] = "cancelled"
    mark_slot_free(b["specialistId"], b["date"], b["time"])
    return {"id": b["id"], "status": "cancelled"}


@router.get("/cancel/{token}")
def cancel_by_token(token: str):
    """Отмена по токену из ссылки — доступно любому (публичная ссылка)"""
    booking_id = cancel_tokens.get(token)
    if not booking_id:
        raise HTTPException(status_code=404, detail={"detail": "Недействительная ссылка отмены.", "code": "INVALID_TOKEN"})
    b = get_booking_by_id(booking_id)
    if not b:
        raise HTTPException(status_code=404, detail={"detail": "Запись не найдена.", "code": "NOT_FOUND"})
    if b["status"] == "cancelled":
        return {"success": True, "booking": {"id": b["id"], "status": "cancelled"}}
    b["status"] = "cancelled"
    mark_slot_free(b["specialistId"], b["date"], b["time"])
    return {"success": True, "booking": {"id": b["id"], "status": "cancelled"}}
