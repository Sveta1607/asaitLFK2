# logger.py — настройка структурированного логирования в JSON-формате.
# Создаётся, чтобы все логи (запросы, ошибки, бизнес-события) выводились в JSON,
# удобном для парсинга системами мониторинга (Amvera logs, ELK, Grafana Loki).
import logging
import sys

# Безопасный импорт — если пакет недоступен, используем обычный форматтер,
# чтобы приложение не падало при старте из-за отсутствия библиотеки логирования.
try:
    from pythonjsonlogger import jsonlogger
    _HAS_JSON_LOGGER = True
except ImportError:
    _HAS_JSON_LOGGER = False


def setup_logging(level: str = "INFO") -> logging.Logger:
    """
    Настраивает корневой логгер с JSON-форматом.
    Возвращает логгер приложения 'lfk_app' для использования в роутерах и middleware.
    """
    logger = logging.getLogger("lfk_app")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        if _HAS_JSON_LOGGER:
            formatter = jsonlogger.JsonFormatter(
                fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
                datefmt="%Y-%m-%dT%H:%M:%S",
            )
        else:
            formatter = logging.Formatter(
                fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
                datefmt="%Y-%m-%dT%H:%M:%S",
            )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    logger.propagate = False
    return logger


def get_logger() -> logging.Logger:
    """Возвращает логгер приложения для использования в роутерах."""
    return logging.getLogger("lfk_app")
