"""Application configuration.

Reads the same environment contract as the Next.js app (`app/.env`), so the
FastAPI process and the existing Next.js process point at one PostgreSQL
database during the coexistence period. The connection string is never logged
or echoed.
"""

from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent

# Query parameters Prisma accepts but asyncpg does not. Dropping them keeps the
# shared connection string usable by both stacks without editing either .env.
_ASYNCPG_IGNORED_PARAMS = {"schema", "connection_limit", "pool_timeout", "pgbouncer", "socket_timeout"}


def to_asyncpg_url(raw: str) -> str:
    """Convert a Prisma-style PostgreSQL URL into an asyncpg URL."""
    parts = urlsplit(raw.strip())
    if parts.scheme not in {"postgres", "postgresql", "postgresql+asyncpg"}:
        raise ValueError("DATABASE_URL must be a PostgreSQL connection string")
    query = [(key, value) for key, value in parse_qsl(parts.query) if key not in _ASYNCPG_IGNORED_PARAMS]
    return urlunsplit(("postgresql+asyncpg", parts.netloc, parts.path, urlencode(query), parts.fragment))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / "app" / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Constro Well API"
    app_version: str = "0.1.0"
    environment: str = "development"
    log_level: str = "INFO"

    # Optional so the app can boot (and report an unhealthy DB) without a
    # connection string; every data endpoint must fail closed when it is absent.
    database_url: str | None = None

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def sqlalchemy_url(self) -> str | None:
        if not self.database_url:
            return None
        return to_asyncpg_url(self.database_url)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
