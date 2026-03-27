#!/usr/bin/env python3
"""
Удаляет из БД всех пользователей с role=specialist и связанные данные:
записи (bookings), слоты (slots), новости (news).

Пациенты (user) и superuser не удаляются.

Запуск: cd backend && python purge_specialists.py
"""
from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import delete, select

BACKEND_ROOT = Path(__file__).resolve().parent
load_dotenv(BACKEND_ROOT / ".env")

from db import SessionLocal  # noqa: E402
from db_models import Booking, News, Slot, User  # noqa: E402


def main() -> None:
    session = SessionLocal()
    try:
        session.execute(delete(Booking))
        session.execute(delete(Slot))
        session.execute(delete(News))
        specs = session.execute(select(User).where(User.role == "specialist")).scalars().all()
        n = len(specs)
        for u in specs:
            session.delete(u)
        session.commit()
        print(f"OK: удалены новости, слоты, записи; специалистов удалено: {n}")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
