#!/usr/bin/env python3
"""
Скрипт создаётся, чтобы:
- удалить из БД всех специалистов кроме одного — Светлана Головчанская;
- очистить слоты, записи на приём и новости, затем создать одну демо-запись к этому специалисту.

Откуда бот берёт список: GET /api/telegram/specialists читает таблицу users (role=specialist, approved=true).

Запуск (из папки backend, venv активирован):
  python reset_to_one_specialist.py
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import delete, select

BACKEND_ROOT = Path(__file__).resolve().parent
load_dotenv(BACKEND_ROOT / ".env")

from db import SessionLocal  # noqa: E402
from db_models import Booking, News, Slot, User  # noqa: E402

KEEP_FIRST = "Светлана"
KEEP_LAST = "Головчанская"
KEEP_EMAIL = "svetlana.golovchanskaya@lfk.local"


def _pick_email_for_keeper(session, keeper_id: str) -> str:
    """Подбирает уникальный email для специалиста, чтобы не нарушить unique на users.email."""
    clash = session.execute(
        select(User).where(User.email == KEEP_EMAIL, User.id != keeper_id)
    ).scalar_one_or_none()
    if clash:
        safe = keeper_id.replace("-", "")[:16] or "spec"
        return f"svetlana.{safe}@lfk.local"
    return KEEP_EMAIL


def main() -> None:
    session = SessionLocal()
    try:
        # Снимаем все записи, слоты и новости (зависят от специалистов).
        session.execute(delete(Booking))
        session.execute(delete(Slot))
        session.execute(delete(News))
        session.commit()

        specialists = list(
            session.execute(select(User).where(User.role == "specialist")).scalars().all()
        )

        keeper = None
        for u in specialists:
            ln = (u.last_name or "").lower()
            if "головчанск" in ln:
                keeper = u
                break
        if keeper is None and specialists:
            keeper = specialists[0]

        if keeper is None:
            keeper = User(
                id="spec1",
                role="specialist",
                email=KEEP_EMAIL,
                first_name=KEEP_FIRST,
                last_name=KEEP_LAST,
                approved=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(keeper)
            session.flush()
        else:
            for u in specialists:
                if u.id != keeper.id:
                    session.delete(u)
            session.flush()

        email = _pick_email_for_keeper(session, keeper.id)
        keeper.first_name = KEEP_FIRST
        keeper.last_name = KEEP_LAST
        keeper.role = "specialist"
        keeper.approved = True
        keeper.email = email
        keeper.updated_at = datetime.utcnow()

        ts = int(datetime.utcnow().timestamp() * 1000)
        slot_id = f"s-reset-{ts}"
        booking_id = f"b-reset-{ts}"
        demo_date = (datetime.utcnow() + timedelta(days=14)).strftime("%Y-%m-%d")
        cancel_tok = uuid.uuid4().hex[:12]

        slot = Slot(
            id=slot_id,
            specialist_id=keeper.id,
            date=demo_date,
            time="11:00",
            status="busy",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        booking = Booking(
            id=booking_id,
            slot_id=slot_id,
            specialist_id=keeper.id,
            user_id=None,
            date=demo_date,
            time="11:00",
            last_name="Демо",
            first_name="Пациент",
            phone=None,
            status="active",
            cancel_token=cancel_tok,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(slot)
        session.add(booking)
        session.commit()

        print(
            f"OK: один специалист {keeper.last_name} {keeper.first_name} (id={keeper.id}, email={keeper.email})"
        )
        print(f"OK: одна запись {booking_id} на {demo_date} 11:00")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
