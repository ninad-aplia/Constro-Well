"""SQLAlchemy engine and session management.

Prisma remains the single schema-migration authority during the migration, so
this module only creates connections — it never creates, alters or migrates
tables. Models arrive in a later task.
"""

from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from .config import get_settings

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        url = get_settings().sqlalchemy_url
        if url is None:
            raise RuntimeError("DATABASE_URL is not configured")
        _engine = create_async_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one session per request, always closed."""
    async with get_session_factory()() as session:
        yield session


async def check_database() -> dict[str, Any]:
    """Executes a trivial query so /health/db proves the connection, not the config."""
    async with get_engine().connect() as connection:
        value = await connection.scalar(text("SELECT 1"))
    return {"select_one": value}


async def dispose_engine() -> None:
    """Release pooled connections (called from the app lifespan on shutdown)."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
