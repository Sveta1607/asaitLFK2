"""
Этот модуль создаётся, чтобы:
- дать простой in-memory rate limit без внешних зависимостей;
- ограничивать частоту запросов к чувствительным эндпоинтам (логин/регистрация/привязки);
- возвращать 429 при превышении лимита.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock
from typing import Callable, Deque, Dict

from fastapi import HTTPException, Request, status


# Этот блок создаётся, чтобы хранить таймстемпы запросов по ключу "route:ip".
_hits: Dict[str, Deque[float]] = defaultdict(deque)
# Этот блок создаётся, чтобы синхронизировать доступ к in-memory хранилищу из нескольких потоков.
_hits_lock = Lock()


def _client_ip(request: Request) -> str:
    """
    Этот хелпер создаётся, чтобы:
    - аккуратно извлекать IP клиента из заголовков reverse-proxy;
    - иметь fallback на request.client.host.
    """
    xff = (request.headers.get("x-forwarded-for") or "").strip()
    if xff:
        return xff.split(",")[0].strip()
    xri = (request.headers.get("x-real-ip") or "").strip()
    if xri:
        return xri
    return request.client.host if request.client else "unknown"


def rate_limit_dependency(limit: int, window_seconds: int, scope: str) -> Callable[[Request], None]:
    """
    Этот фабричный блок создаётся, чтобы:
    - генерировать FastAPI dependency с настраиваемым лимитом;
    - переиспользовать один и тот же механизм на разных роутерах.
    """

    def _enforce(request: Request) -> None:
        # Этот блок создаётся, чтобы привязать лимит к конкретному endpoint и IP клиента.
        key = f"{scope}:{_client_ip(request)}"
        now = time.time()
        cutoff = now - window_seconds

        # Этот блок создаётся, чтобы очищать устаревшие записи и проверять текущий лимит.
        with _hits_lock:
            q = _hits[key]
            while q and q[0] <= cutoff:
                q.popleft()
            if len(q) >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Слишком много запросов. Повторите попытку позже.",
                )
            q.append(now)

    return _enforce

