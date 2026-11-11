"""Contract equivalence: FastAPI catalogue responses vs the running Next.js API.

Runs against the local Next.js dev server when one is reachable (default
`http://127.0.0.1:64704`; override with `NEXT_API_URL`). Skipped otherwise, so
the suite never depends on another process being up.
"""

import os

import httpx
import pytest
from httpx import ASGITransport

from fastapi_app.main import app

NEXT_API_URL = os.environ.get("NEXT_API_URL", "http://127.0.0.1:3000").rstrip("/")

PATHS = [
    "/api/categories",
    "/api/products?pageSize=5",
    "/api/products?pageSize=5&page=2",
    "/api/products?q=cement&pageSize=5",
    "/api/products?category=Cement&pageSize=5",
    "/api/products?category=cement&pageSize=5",
    "/api/products?sort=price_asc&pageSize=5",
    "/api/products?sort=price_desc&pageSize=3",
    "/api/products?sort=newest&pageSize=3",
    "/api/products?pageSize=2&page=999",
    "/api/products/0",
    "/api/products/0/offers",
    "/api/products/10",
    "/api/products/10/offers",
]


def _normalize(value):
    if isinstance(value, dict):
        return {
            key: (sorted(item) if key == "serviceablePincodes" else _normalize(item))
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_normalize(item) for item in value]
    return value


async def _next_available() -> bool:
    try:
        async with httpx.AsyncClient(base_url=NEXT_API_URL, timeout=3) as client:
            return (await client.get("/api/categories")).status_code == 200
    except httpx.HTTPError:
        return False


@pytest.mark.parametrize("path", PATHS)
async def test_fastapi_matches_next_js_contract(path: str) -> None:
    if not await _next_available():
        pytest.skip(f"Next.js API not reachable at {NEXT_API_URL}")

    transport = ASGITransport(app=app)
    async with (
        httpx.AsyncClient(transport=transport, base_url="http://test") as fast,
        httpx.AsyncClient(base_url=NEXT_API_URL, timeout=30) as nxt,
    ):
        fast_response = await fast.get(path)
        next_response = await nxt.get(path)

    assert fast_response.status_code == next_response.status_code, path
    assert _normalize(fast_response.json()) == _normalize(next_response.json()), path
