# routers/slots.py — CRUD слотов (просмотр — авторизованные, управление — специалист)
from fastapi import APIRouter, HTTPException, Query, Header
from typing import Optional
from store import slots, users
from models import SlotCreateRequest, SlotBatchCreateRequest, SlotResponse

router = APIRouter(prefix="/slots", tags=["slots"])


def _require_auth(x_user_id: Optional[str] = Header(None, alias="X-User-Id")) -> str:
    """Проверяет наличие авторизации"""
    if not x_user_id:
        raise HTTPException(
            status_code=401,
            detail={"detail": "Требуется авторизация для просмотра слотов.", "code": "UNAUTHORIZED"},
        )
    if x_user_id not in users:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Пользователь не найден.", "code": "USER_NOT_FOUND"},
        )
    return x_user_id


def _require_specialist(x_user_id: Optional[str] = Header(None, alias="X-User-Id")) -> str:
    """Проверяет, что пользователь — специалист"""
    uid = _require_auth(x_user_id)
    u = users.get(uid)
    if u.get("role") != "specialist":
        raise HTTPException(
            status_code=403,
            detail={"detail": "Управление слотами доступно только специалисту.", "code": "FORBIDDEN"},
        )
    return uid


def _next_slot_id() -> str:
    """Генерирует уникальный id слота"""
    return f"s-{int(__import__('time').time() * 1000)}"


@router.get("", response_model=list[SlotResponse])
def list_slots(
    specialistId: str = Query(..., description="ID специалиста"),
    date: Optional[str] = Query(None, description="Фильтр по дате YYYY-MM-DD"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """Список слотов — только для авторизованных (пациент/специалист)"""
    _require_auth(x_user_id)
    result = [s for s in slots if s["specialistId"] == specialistId]
    if date:
        result = [s for s in result if s["date"] == date]
    return [SlotResponse(**s) for s in sorted(result, key=lambda x: (x["date"], x["time"]))]


@router.post("", response_model=SlotResponse, status_code=201)
def create_slot(body: SlotCreateRequest, x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """Добавить один слот — только специалист"""
    uid = _require_specialist(x_user_id)
    if body.specialistId != uid:
        raise HTTPException(
            status_code=403,
            detail={"detail": "Можно добавлять слоты только для своего аккаунта.", "code": "FORBIDDEN"},
        )
    # Проверка дубликата
    for s in slots:
        if s["specialistId"] == body.specialistId and s["date"] == body.date and s["time"] == body.time:
            raise HTTPException(
                status_code=409,
                detail={"detail": "Слот на это время уже существует.", "code": "SLOT_EXISTS"},
            )
    slot = {
        "id": _next_slot_id(),
        "specialistId": body.specialistId,
        "date": body.date,
        "time": body.time,
        "status": "free",
    }
    slots.append(slot)
    return SlotResponse(**slot)


@router.post("/batch", response_model=list[SlotResponse], status_code=201)
def create_slots_batch(body: SlotBatchCreateRequest, x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """Добавить несколько слотов — только специалист"""
    uid = _require_specialist(x_user_id)
    if body.specialistId != uid:
        raise HTTPException(
            status_code=403,
            detail={"detail": "Можно добавлять слоты только для своего аккаунта.", "code": "FORBIDDEN"},
        )
    existing = {(s["date"], s["time"]) for s in slots if s["specialistId"] == body.specialistId}
    created = []
    for t in body.times:
        if (body.date, t) in existing:
            continue
        slot = {
            "id": f"{_next_slot_id()}-{len(created)}",
            "specialistId": body.specialistId,
            "date": body.date,
            "time": t,
            "status": "free",
        }
        slots.append(slot)
        created.append(SlotResponse(**slot))
        existing.add((body.date, t))
    return created


@router.delete("/{slot_id}", status_code=204)
def delete_slot(slot_id: str, x_user_id: Optional[str] = Header(None, alias="X-User-Id")):
    """Удалить слот (только свободный) — только специалист"""
    uid = _require_specialist(x_user_id)
    for i, s in enumerate(slots):
        if s["id"] == slot_id and s["specialistId"] == uid:
            if s["status"] == "busy":
                raise HTTPException(
                    status_code=409,
                    detail={"detail": "Нельзя удалить занятый слот.", "code": "SLOT_BUSY"},
                )
            slots.pop(i)
            return
    raise HTTPException(
        status_code=404,
        detail={"detail": "Слот не найден.", "code": "NOT_FOUND"},
    )
