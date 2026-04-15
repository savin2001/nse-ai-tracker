"""
Centralised structlog configuration for all NSE AI workers.

Call configure_logging() once at the top of each worker entry point.

Output:
  - production (LOG_FORMAT=json or default): JSON lines to stdout
  - development (LOG_FORMAT=pretty): coloured key=value output

Usage:
    from services.logging import configure_logging, get_logger
    configure_logging()
    log = get_logger(__name__)
    log.info("price_fetch_complete", ticker="SCOM", rows=365)
    log.error("db_error", exc_info=True, ticker="EQTY")
"""
import logging
import os
import sys

import structlog


def configure_logging() -> None:
    """Configure structlog once at process startup."""
    log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)
    log_format = os.getenv("LOG_FORMAT", "json").lower()  # "json" | "pretty"

    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.ExceptionRenderer(),
    ]

    if log_format == "pretty":
        renderer = structlog.dev.ConsoleRenderer(colors=True)
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=shared_processors + [renderer],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(sys.stdout),
        cache_logger_on_first_use=True,
    )

    # Also bridge stdlib logging (e.g. from httpx, supabase) through structlog
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("supabase").setLevel(logging.WARNING)


def get_logger(name: str = "worker") -> structlog.BoundLogger:
    """Return a bound structlog logger with the module name pre-bound."""
    return structlog.get_logger(name)
