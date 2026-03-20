# routers/slots.py — CRUD слотов (просмотр — авторизованные, управление — специалист)
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth_deps import RequireUser, RequireSpecialist
from db import get_db
from db_models import Slot
from models import SlotCreateRequest, SlotBatchCreateRequest, SlotResponse

router = APIRouter(prefix="/slots", tags=["slots"])


def _next_slot_id() -> str:
    """Генерация уникального идентификатора слота с префиксом s-."""
    return f"s-{int(__import__('time').time() * 1000)}"


@router.get("", response_model=list[SlotResponse])
def list_slots(
    current_user: RequireUser,
    specialistId: Optional[str] = Query(
        None,
        description="ID специалиста; если не указан, возвращаются слоты всех специалистов",
    ),
    date: Optional[str] = Query(None, description="Фильтр по дате YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """
    Этот обработчик создаётся, чтобы:
    - отдавать список слотов как по конкретному специалисту, так и по всем сразу;
    - позволить пациентам видеть расписание нескольких специалистов без дополнительных ручек;
    - опираться на JWT Clerk (RequireUser), а не на заголовок X-User-Id.
    """
    stmt = select(Slot)
    if specialistId:
        stmt = stmt.where(Slot.specialist_id == specialistId)
    if date:
        stmt = stmt.where(Slot.date == date)
    stmt = stmt.order_by(Slot.date, Slot.time)
    rows = db.execute(stmt).scalars().all()
    return [
        SlotResponse(
            id=s.id,
            specialistId=s.specialist_id,
            date=s.date,
            time=s.time,
            status=s.status,
        )
        for s in rows
    ]


@router.post("", response_model=SlotResponse, status_code=201)
def create_slot(
    body: SlotCreateRequest,
    current_user: RequireSpecialist,
    db: Session = Depends(get_db),
):
    """Добавить один слот — только специалист."""
    user = current_user
    if body.specialistId != user.id:
        raise HTTPException(
            status_code=403,
            detail={"detail": "Можно добавлять слоты только для своего аккаунта.", "code": "FORBIDDEN"},
        )
    # Проверка дубликата.
    dup_stmt = select(Slot).where(
        Slot.specialist_id == body.specialistId,
        Slot.date == body.date,
        Slot.time == body.time,
    )
    exists = db.execute(dup_stmt).scalar_one_or_none()
    if exists:
        raise HTTPException(
            status_code=409,
            detail={"detail": "Слот на это время уже существует.", "code": "SLOT_EXISTS"},
        )
    slot = Slot(
        id=_next_slot_id(),
        specialist_id=body.specialistId,
        date=body.date,
        time=body.time,
        status="free",
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return SlotResponse(
        id=slot.id,
        specialistId=slot.specialist_id,
        date=slot.date,
        time=slot.time,
        status=slot.status,
    )


@router.post("/batch", response_model=list[SlotResponse], status_code=201)
def create_slots_batch(
    body: SlotBatchCreateRequest,
    current_user: RequireSpecialist,
    db: Session = Depends(get_db),
):
    """Добавить несколько слотов — только специалист."""
    user = current_user
    if body.specialistId != user.id:
        raise HTTPException(
            status_code=403,
            detail={"detail": "Можно добавлять слоты только для своего аккаунта.", "code": "FORBIDDEN"},
        )
    existing_stmt = select(Slot.date, Slot.time).where(Slot.specialist_id == body.specialistId)
    existing_pairs = {(d, t) for d, t in db.execute(existing_stmt).all()}
    created: list[SlotResponse] = []
    for t in body.times:
        if (body.date, t) in existing_pairs:
            continue
        slot = Slot(
            id=f"{_next_slot_id()}-{len(created)}",
            specialist_id=body.specialistId,
            date=body.date,
            time=t,
            status="free",
        )
        db.add(slot)
        db.flush()
        created.append(
            SlotResponse(
                id=slot.id,
                specialistId=slot.specialist_id,
                date=slot.date,
                time=slot.time,
                status=slot.status,
            )
        )
        existing_pairs.add((body.date, t))
    db.commit()
    return created


@router.delete("/{slot_id}", status_code=204)
def delete_slot(
    slot_id: str,
    current_user: RequireSpecialist,
    db: Session = Depends(get_db),
):
    """Удалить слот (только свободный) — только специалист."""
    user = current_user
    stmt = select(Slot).where(Slot.id == slot_id, Slot.specialist_id == user.id)
    slot = db.execute(stmt).scalar_one_or_none()
    if not slot:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Слот не найден.", "code": "NOT_FOUND"},
        )
    if slot.status == "busy":
        raise HTTPException(
            status_code=409,
            detail={"detail": "Нельзя удалить занятый слот.", "code": "SLOT_BUSY"},
        )
    db.delete(slot)
    db.commit()
    return
