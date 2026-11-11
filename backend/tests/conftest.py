import pytest
from fastapi.testclient import TestClient

from fastapi_app.core.config import get_settings
from fastapi_app.core.db import get_session_factory
from fastapi_app.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
async def db():
    if get_settings().sqlalchemy_url is None:
        pytest.skip("DATABASE_URL is not configured")
    async with get_session_factory()() as session:
        yield session


@pytest.fixture
async def api_client():
    from httpx import ASGITransport, AsyncClient

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
