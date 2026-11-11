"""FastAPI application factory.

Foundation only: configuration, database connectivity, logging, error envelope
and health checks. Authentication, catalogue and business endpoints arrive in
later migration tasks (see `docs/architecture-assessment-2026-11-10/`).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi_app.core.config import get_settings
from fastapi_app.core.db import dispose_engine
from fastapi_app.core.errors import register_exception_handlers
from fastapi_app.core.logging import RequestLogMiddleware, configure_logging
from fastapi_app.routers import admin, auth, catalog, disputes, finance, health

DESCRIPTION = (
    "Authoritative backend for the Constro Well construction-materials marketplace. "
    "This is the FastAPI foundation (health, configuration, database connectivity); "
    "domain endpoints are migrated incrementally from the Next.js API."
)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        await dispose_engine()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=DESCRIPTION,
        lifespan=lifespan,
        openapi_tags=[
            {"name": "health", "description": "Liveness and database readiness."},
            {"name": "auth", "description": "Session-authenticated identity (read side)."},
            {"name": "catalogue", "description": "Public catalogue reads (categories, products, offers)."},
            {"name": "admin", "description": "Administrative reads (requires the admin role)."},
            {"name": "finance", "description": "Seller-collected COD finance (collections, commission, remittance, reconciliation)."},
        ],
    )

    app.add_middleware(RequestLogMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["x-request-id"],
    )

    register_exception_handlers(app)
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(catalog.router)
    app.include_router(admin.router)
    app.include_router(disputes.router)
    app.include_router(finance.seller_router)
    app.include_router(finance.driver_router)
    app.include_router(finance.admin_router)
    return app


app = create_app()
