# logger.py — настройка структурированного логирования в JSON-формате.
# Создаётся, чтобы все логи (запросы, ошибки, бизнес-события) выводились в JSON,
# удобном для парсинга системами мониторинга (Amvera logs, ELK, Grafana Loki).
import logging
import sys
from pythonjsonlogger import jsonlogger


def setup_logging(level: str = "INFO") -> logging.Logger:
    """
    Настраивает корневой логгер с JSON-форматом.
    Возвращает логгер приложения 'lfk_app' для использования в роутерах и middleware.
    """
    logger = logging.getLogger("lfk_app")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        # JSON-формат включает timestamp, level, message и все extra-поля
        formatter = jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    # Подавляем дублирование логов через корневой логгер
    logger.propagate = False
    return logger


def get_logger() -> logging.Logger:
    """Возвращает логгер приложения для использования в роутерах."""
    return logging.getLogger("lfk_app")
