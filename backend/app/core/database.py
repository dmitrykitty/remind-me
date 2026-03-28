from __future__ import annotations

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


_engine = None
_SessionLocal: sessionmaker[Session] | None = None


def init_db() -> None:
    """Create engine, session factory and all tables."""
    global _engine, _SessionLocal

    settings = get_settings()
    _engine = create_engine(settings.db_url, echo=False)
    _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)

    # Import models so Base.metadata knows every table
    import app.models  # noqa: F401

    Base.metadata.create_all(_engine)
    logger.info("Database tables created / verified")


def get_session():
    """FastAPI Depends-compatible generator."""
    if _SessionLocal is None:
        init_db()
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_session_sync() -> Session:
    """Return a plain session (for use outside DI, e.g. WebSocket handler)."""
    if _SessionLocal is None:
        init_db()
    return _SessionLocal()
