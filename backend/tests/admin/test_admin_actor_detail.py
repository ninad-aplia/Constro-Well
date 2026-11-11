"""GET /api/admin/actors/{id} - administrator audit drill-down.

Covers authorization, the admin-only actor scope, summary/actions/events
contract, newest-first ordering, metadata privacy, the single audited read and
fail-closed audit rollback, plus the non-auditing proxy existence endpoint.
"""

import json
from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text

from fastapi_app.domains.admin import service
from fastapi_app.models.audit import AuditEvent

ACTION = "admin.actors.detail"


def _cookie(token: str) -> dict[str, str]:
    return {"cw_session": token}


async def _token(data, role: str = "admin") -> tuple[str, str]:
    user_id = await data.user(role=role)
    return user_id, await data.session(user_id)


async def _insert_event(
    db,
    *,
    event_id: str,
    actor_id: str,
    created_at: datetime,
    action: str = "admin.users.list",
    target_type: str = "User",
    target_id: str | None = None,
    metadata: dict | None = None,
):
    await db.execute(
        text(
            'INSERT INTO "AuditEvent" (id, "actorUserId", action, "targetType", "targetId", metadata, "createdAt") '
            "VALUES (:id, :actor, :action, :target, :target_id, CAST(:metadata AS jsonb), :created)"
        ),
        {
            "id": event_id,
            "actor": actor_id,
            "action": action,
            "target": target_type,
            "target_id": target_id,
            "metadata": json.dumps(metadata) if metadata is not None else None,
            "created": created_at,
        },
    )


async def test_missing_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/actors/unknown")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


@pytest.mark.parametrize("role", ["customer", "seller", "driver"])
async def test_non_admin_is_403(admin_client: AsyncClient, admin_data, role: str) -> None:
    _, token = await _token(admin_data, role)

    response = await admin_client.get("/api/admin/actors/unknown", cookies=_cookie(token))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_unknown_actor_is_404(admin_client: AsyncClient, admin_data) -> None:
    _, token = await _token(admin_data)

    unknown = await admin_client.get(
        "/api/admin/actors/does-not-exist", cookies=_cookie(token)
    )
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "actor_not_found"


async def test_non_admin_actor_is_404(admin_client: AsyncClient, admin_data) -> None:
    _, token = await _token(admin_data)
    customer = await admin_data.user(role="customer")

    # Audit actors are administrators; a normal account cannot be probed here.
    ordinary = await admin_client.get(
        f"/api/admin/actors/{customer}", cookies=_cookie(token)
    )
    assert ordinary.status_code == 404
    assert ordinary.json()["error"]["code"] == "actor_not_found"


async def test_success_contract_counts_privacy_and_single_audit(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    requester, token = await _token(admin_data)
    actor_id = await admin_data.user(role="admin", email="audited-admin@admin.test")
    older = datetime(2099, 1, 1, 9, 0, 0)
    middle = datetime(2099, 1, 1, 10, 0, 0)
    newest = datetime(2099, 1, 1, 11, 0, 0)
    await _insert_event(admin_db, event_id="evt_a", actor_id=actor_id, created_at=older)
    await _insert_event(
        admin_db,
        event_id="evt_b",
        actor_id=actor_id,
        created_at=middle,
        action="admin.orders.list",
        metadata={"page": 1, "secret": "do-not-expose"},
    )
    await _insert_event(admin_db, event_id="evt_c", actor_id=actor_id, created_at=newest)
    await admin_db.commit()

    response = await admin_client.get(
        f"/api/admin/actors/{actor_id}", cookies=_cookie(token)
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"actor", "summary", "actions", "events"}
    assert body["actor"] == {
        "id": actor_id,
        "name": "Admin Test admin",
        "email": "audited-admin@admin.test",
        "role": "admin",
        "createdAt": body["actor"]["createdAt"],
    }
    assert body["summary"]["totalEvents"] == 3
    assert body["summary"]["distinctActions"] == 2
    assert body["summary"]["firstSeen"].startswith("2099-01-01T09:00")
    assert body["summary"]["lastSeen"].startswith("2099-01-01T11:00")
    assert [(row["action"], row["count"]) for row in body["actions"]] == [
        ("admin.users.list", 2),
        ("admin.orders.list", 1),
    ]
    assert [event["id"] for event in body["events"]] == ["evt_c", "evt_b", "evt_a"]
    assert body["events"][1]["metadata"] == {"page": 1}
    assert "passwordHash" not in response.text
    assert "secret" not in response.text

    audit = (
        await admin_db.execute(select(AuditEvent).where(AuditEvent.action == ACTION, AuditEvent.target_id == actor_id))
    ).scalars().all()
    assert len(audit) == 1
    assert audit[0].actor_user_id == requester
    assert audit[0].target_type == "User"
    assert audit[0].target_id == actor_id
    assert audit[0].audit_metadata == {"total": 3}


async def test_audit_failure_rolls_back(
    admin_client: AsyncClient, admin_data, admin_db, monkeypatch
) -> None:
    actor_id = await admin_data.user(role="admin", email="rollback-admin@admin.test")
    await _insert_event(
        admin_db,
        event_id="evt_rollback",
        actor_id=actor_id,
        created_at=datetime(2099, 2, 1, 9, 0, 0),
    )
    await admin_db.commit()
    _, token = await _token(admin_data)

    async def boom(*args, **kwargs):
        raise RuntimeError("audit store unavailable")

    monkeypatch.setattr(service, "record_admin_audit", boom)

    response = await admin_client.get(
        f"/api/admin/actors/{actor_id}", cookies=_cookie(token)
    )

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    rows = (
        await admin_db.execute(select(AuditEvent).where(AuditEvent.action == ACTION, AuditEvent.target_id == actor_id))
    ).scalars().all()
    assert rows == []


async def test_exists_endpoint_is_unauthenticated_safe_and_not_audited(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    actor_id = await admin_data.user(role="admin")
    _, token = await _token(admin_data)

    found = await admin_client.get(
        f"/api/admin/actors/{actor_id}/exists", cookies=_cookie(token)
    )
    missing = await admin_client.get(
        "/api/admin/actors/does-not-exist/exists", cookies=_cookie(token)
    )
    guest = await admin_client.get(f"/api/admin/actors/{actor_id}/exists")

    assert found.status_code == 200
    assert found.json() == {"exists": True}
    assert missing.status_code == 404
    assert guest.status_code == 401
    rows = (
        await admin_db.execute(select(AuditEvent).where(AuditEvent.action == ACTION, AuditEvent.target_id == actor_id))
    ).scalars().all()
    assert rows == []
