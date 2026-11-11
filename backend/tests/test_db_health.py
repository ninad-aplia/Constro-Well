import pytest
from httpx import ASGITransport, AsyncClient

from fastapi_app.core.config import get_settings
from fastapi_app.main import app


async def test_health_db_reports_ok_against_configured_database() -> None:
    if get_settings().sqlalchemy_url is None:
        pytest.skip("DATABASE_URL is not configured")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health/db")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["latency_ms"] >= 0
