"""GET /api/auth/me — contract and session-lifecycle tests against real Postgres."""

import pytest
from httpx import AsyncClient

ROLES = ["customer", "seller", "driver", "admin"]


def _session_cookie(token: str) -> dict[str, str]:
    return {"cw_session": token}


async def test_valid_existing_session_returns_public_contract(api_client: AsyncClient, identities):
    user_id, email = await identities.user(role="customer")
    token, _ = await identities.session(user_id)

    response = await api_client.get("/api/auth/me", cookies=_session_cookie(token))

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"user"}
    assert set(body["user"]) == {"id", "email", "name", "phone", "role"}
    assert body["user"] == {
        "id": user_id,
        "email": email,
        "name": "Auth Test customer",
        "phone": None,
        "role": "customer",
    }
    # Never leak secrets, even indirectly.
    assert "passwordHash" not in response.text
    assert token not in response.text


async def test_missing_session_cookie_is_401(api_client: AsyncClient):
    response = await api_client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


async def test_invalid_token_is_401(api_client: AsyncClient):
    response = await api_client.get("/api/auth/me", cookies=_session_cookie("not-a-real-token"))

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


async def test_expired_session_is_rejected(api_client: AsyncClient, identities):
    from datetime import timedelta

    user_id, _ = await identities.user()
    token, _ = await identities.session(user_id, expires_in=-timedelta(seconds=1))

    response = await api_client.get("/api/auth/me", cookies=_session_cookie(token))

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


async def test_revoked_session_is_rejected(api_client: AsyncClient, identities):
    """Deleting the Session row (what Next.js logout does) invalidates the token here too."""
    from sqlalchemy import text

    user_id, _ = await identities.user()
    token, session_id = await identities.session(user_id)

    first = await api_client.get("/api/auth/me", cookies=_session_cookie(token))
    assert first.status_code == 200

    await identities.db.execute(text('DELETE FROM "Session" WHERE id = :id'), {"id": session_id})
    await identities.db.commit()

    second = await api_client.get("/api/auth/me", cookies=_session_cookie(token))
    assert second.status_code == 401


@pytest.mark.parametrize("role", ROLES)
async def test_each_role_resolves(api_client: AsyncClient, identities, role: str):
    user_id, _ = await identities.user(role=role)
    token, _ = await identities.session(user_id)

    response = await api_client.get("/api/auth/me", cookies=_session_cookie(token))

    assert response.status_code == 200
    assert response.json()["user"]["role"] == role


async def test_token_without_session_row_is_401(api_client: AsyncClient, identities):
    await identities.user()
    response = await api_client.get("/api/auth/me", cookies=_session_cookie("a" * 43))

    assert response.status_code == 401
