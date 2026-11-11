"""Health and readiness endpoints.

`/health` proves the process is up; `/health/db` proves PostgreSQL is reachable
from this process. Neither exposes connection details or credentials.
"""

import logging
import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from fastapi_app.core.config import get_settings
from fastapi_app.core.db import check_database

logger = logging.getLogger("constro_well.health")
router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness")
async def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }


@router.get("/health/db", summary="Database readiness")
async def health_db() -> JSONResponse:
    if get_settings().sqlalchemy_url is None:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "database": "not_configured"},
        )

    started = time.perf_counter()
    try:
        await check_database()
    except Exception:
        # Log the driver error internally; never echo it (it can include host/user).
        logger.exception("database_health_failed")
        return JSONResponse(status_code=503, content={"status": "error", "database": "unavailable"})

    latency_ms = round((time.perf_counter() - started) * 1000, 2)
    return JSONResponse(
        status_code=200,
        content={"status": "ok", "database": "ok", "latency_ms": latency_ms},
    )
