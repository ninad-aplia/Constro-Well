"""GET /api/admin/users — authorization, pagination, no-leak and audit tests."""

from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from fastapi_app.domains.admin import service
from fastapi_app.models.audit import AuditEvent
from fastapi_app.models.identity import User

USER_KEYS = {"id", "email", "name", "phone", "role", "createdAt"}
ACTION = "admin.users.list"


def _cookie(token: str) -> dict[str, str]:
    return {"cw_session": token}


async def _audit_rows(db, action: str = ACTION):
    return (
        await db.execute(select(AuditEvent).where(AuditEvent.action == action))
    ).scalars().all()


async def _admin_token(data, role: str = "admin") -> str:
    user_id = await data.user(role=role)
    return await data.session(user_id)


async def test_missing_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/users")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


async def test_invalid_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/users", cookies=_cookie("not-a-session"))

    assert response.status_code == 401


@pytest.mark.parametrize("role", ["customer", "seller", "driver"])
async def test_non_admin_roles_are_403(admin_client: AsyncClient, admin_data, role: str) -> None:
    token = await _admin_token(admin_data, role)

    response = await admin_client.get("/api/admin/users", cookies=_cookie(token))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_admin_gets_paginated_users_without_sensitive_fields(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    admin_id = await admin_data.user(role="admin")
    token = await admin_data.session(admin_id)

    response = await admin_client.get("/api/admin/users", cookies=_cookie(token))

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"users", "pagination"}
    assert set(body["pagination"]) == {"page", "pageSize", "total", "totalPages"}
    assert body["pagination"]["page"] == 1
    assert body["pagination"]["pageSize"] == 20
    assert body["pagination"]["total"] >= 1
    assert 1 <= len(body["users"]) <= 20
    for user in body["users"]:
        assert set(user) == USER_KEYS
    assert "passwordHash" not in response.text
    assert "tokenHash" not in response.text
    assert "password" not in response.text.lower()


async def test_deterministic_ordering_and_id_tiebreak(admin_client: AsyncClient, admin_data) -> None:
    admin_id = await admin_data.user(role="admin")
    token = await admin_data.session(admin_id)
    newest = datetime(2099, 1, 1, 12, 0, 0)
    older = datetime(2099, 1, 1, 11, 0, 0)
    await admin_data.user(created_at=newest, user_id="test_admin_zzz")
    await admin_data.user(created_at=newest, user_id="test_admin_aaa")
    await admin_data.user(created_at=older, user_id="test_admin_mmm")

    response = await admin_client.get(
        "/api/admin/users?page=1&pageSize=3", cookies=_cookie(token)
    )

    assert response.status_code == 200
    ids = [user["id"] for user in response.json()["users"]]
    assert ids == ["test_admin_zzz", "test_admin_aaa", "test_admin_mmm"]


async def test_page_beyond_last_returns_empty_page(admin_client: AsyncClient, admin_data) -> None:
    token = await _admin_token(admin_data)

    response = await admin_client.get(
        "/api/admin/users?page=10000&pageSize=50", cookies=_cookie(token)
    )

    assert response.status_code == 200
    body = response.json()
    assert body["users"] == []
    assert body["pagination"]["total"] >= 1


@pytest.mark.parametrize("query", ["page=0", "pageSize=0", "pageSize=51", "pageSize=abc"])
async def test_invalid_pagination_is_400(admin_client: AsyncClient, admin_data, query: str) -> None:
    token = await _admin_token(admin_data)

    response = await admin_client.get(f"/api/admin/users?{query}", cookies=_cookie(token))

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


async def test_success_creates_exactly_one_audit_event(admin_client: AsyncClient, admin_data, admin_db) -> None:
    admin_id = await admin_data.user(role="admin")
    token = await admin_data.session(admin_id)
    before = {row.id for row in await _audit_rows(admin_db)}

    response = await admin_client.get("/api/admin/users?page=2&pageSize=5", cookies=_cookie(token))

    assert response.status_code == 200
    rows = await _audit_rows(admin_db)
    created = [row for row in rows if row.id not in before]
    assert len(created) == 1
    event = created[0]
    assert event.actor_user_id == admin_id
    assert event.action == ACTION
    assert event.target_type == "User"
    assert event.target_id is None
    assert event.audit_metadata == {"page": 2, "pageSize": 5, "total": response.json()["pagination"]["total"]}


async def test_audit_failure_returns_500_and_leaves_no_event(
    admin_client: AsyncClient, admin_data, admin_db, monkeypatch
) -> None:
    admin_id = await admin_data.user(role="admin")
    token = await admin_data.session(admin_id)
    before = {row.id for row in await _audit_rows(admin_db)}

    async def failing_audit(db, **kwargs):
        db.add(
            AuditEvent(
                id="test_audit_failure_row",
                actor_user_id=kwargs["actor_user_id"],
                action=kwargs["action"],
                target_type=kwargs["target_type"],
                target_id=None,
                audit_metadata=None,
            )
        )
        await db.flush()
        raise RuntimeError("simulated audit failure")

    monkeypatch.setattr(service, "record_admin_audit", failing_audit)

    response = await admin_client.get("/api/admin/users", cookies=_cookie(token))

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "simulated audit failure" not in response.text
    assert {row.id for row in await _audit_rows(admin_db)} == before


async def test_read_does_not_modify_users(admin_client: AsyncClient, admin_data, admin_db) -> None:
    admin_id = await admin_data.user(role="admin")
    token = await admin_data.session(admin_id)
    before = (
        await admin_db.execute(
            select(User.email, User.name, User.role, User.phone).where(User.id == admin_id)
        )
    ).one()
    count_before = (await admin_db.execute(select(func.count()).select_from(User))).scalar_one()

    response = await admin_client.get("/api/admin/users", cookies=_cookie(token))
    assert response.status_code == 200

    after = (
        await admin_db.execute(
            select(User.email, User.name, User.role, User.phone).where(User.id == admin_id)
        )
    ).one()
    count_after = (await admin_db.execute(select(func.count()).select_from(User))).scalar_one()
    assert before == after
    assert count_before == count_after
