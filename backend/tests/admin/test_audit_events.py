"""GET /api/admin/audit-events — authorization, ordering, safe metadata, audit."""

import json
from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text

from fastapi_app.domains.admin import service
from fastapi_app.models.audit import AuditEvent

ACTION = "admin.audit_events.list"
USER_ACTION = "admin.users.list"


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
    action: str = USER_ACTION,
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
    response = await admin_client.get("/api/admin/audit-events")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


async def test_invalid_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get(
        "/api/admin/audit-events", cookies=_cookie("not-a-session")
    )
    assert response.status_code == 401


@pytest.mark.parametrize("role", ["customer", "seller", "driver"])
async def test_non_admin_is_403(admin_client: AsyncClient, admin_data, role: str) -> None:
    _, token = await _token(admin_data, role)

    response = await admin_client.get("/api/admin/audit-events", cookies=_cookie(token))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_success_contract_and_newest_first(admin_client: AsyncClient, admin_data, admin_db) -> None:
    admin_id, token = await _token(admin_data)
    newest = datetime(2099, 1, 1, 12, 0, 0)
    older = datetime(2099, 1, 1, 11, 0, 0)
    await _insert_event(admin_db, event_id="test_audit_zzz", actor_id=admin_id, created_at=newest)
    await _insert_event(admin_db, event_id="test_audit_aaa", actor_id=admin_id, created_at=newest)
    await _insert_event(admin_db, event_id="test_audit_mmm", actor_id=admin_id, created_at=older)
    await admin_db.commit()

    response = await admin_client.get(
        "/api/admin/audit-events?page=1&pageSize=50", cookies=_cookie(token)
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"events", "pagination"}
    assert set(body["pagination"]) == {"page", "pageSize", "total", "totalPages"}
    event = body["events"][0]
    assert set(event) == {"id", "action", "actor", "targetType", "targetId", "metadata", "createdAt"}
    ids = [row["id"] for row in body["events"]]
    assert ids.index("test_audit_zzz") < ids.index("test_audit_aaa") < ids.index("test_audit_mmm")
    assert event["actor"] == {"id": admin_id, "name": "Admin Test admin"}
    assert event["action"] == USER_ACTION
    assert event["targetType"] == "User"


async def test_metadata_is_whitelisted(admin_client: AsyncClient, admin_data, admin_db) -> None:
    admin_id, token = await _token(admin_data)
    await _insert_event(
        admin_db,
        event_id="test_audit_metadata",
        actor_id=admin_id,
        created_at=datetime(2099, 1, 1, 13, 0, 0),
        metadata={
            "page": 2,
            "pageSize": 5,
            "total": 91,
            "password": "never",
            "token": "never",
            "nested": {"secret": True},
        },
    )
    await admin_db.commit()

    response = await admin_client.get(
        "/api/admin/audit-events?page=1&pageSize=1", cookies=_cookie(token)
    )

    assert response.status_code == 200
    assert response.json()["events"][0]["metadata"] == {"page": 2, "pageSize": 5, "total": 91}
    assert "never" not in response.text


async def test_pagination_defaults_and_bounds(admin_client: AsyncClient, admin_data) -> None:
    _, token = await _token(admin_data)

    first = await admin_client.get("/api/admin/audit-events", cookies=_cookie(token))
    assert first.status_code == 200
    assert first.json()["pagination"]["page"] == 1
    assert first.json()["pagination"]["pageSize"] == 20
    assert first.json()["pagination"]["total"] >= 1

    beyond = await admin_client.get(
        "/api/admin/audit-events?page=10000&pageSize=50", cookies=_cookie(token)
    )
    assert beyond.status_code == 200
    assert beyond.json()["events"] == []
    assert beyond.json()["pagination"]["total"] >= 1

    for query in ("page=0", "pageSize=0", "pageSize=51", "pageSize=abc"):
        bad = await admin_client.get(f"/api/admin/audit-events?{query}", cookies=_cookie(token))
        assert bad.status_code == 400
        assert bad.json()["error"]["code"] == "validation_error"


async def test_read_creates_exactly_one_list_audit_event(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    admin_id, token = await _token(admin_data)
    before = {
        row.id
        for row in (await admin_db.execute(select(AuditEvent).where(AuditEvent.action == ACTION))).scalars().all()
    }

    response = await admin_client.get(
        "/api/admin/audit-events?page=2&pageSize=5", cookies=_cookie(token)
    )

    assert response.status_code == 200
    rows = (
        await admin_db.execute(select(AuditEvent).where(AuditEvent.action == ACTION))
    ).scalars().all()
    created = [row for row in rows if row.id not in before]
    assert len(created) == 1
    event = created[0]
    assert event.actor_user_id == admin_id
    assert event.target_type == "AuditEvent"
    assert event.audit_metadata == {
        "page": 2,
        "pageSize": 5,
        "total": response.json()["pagination"]["total"],
    }
    # The new row is not part of the response it triggered.
    assert all(row["id"] != event.id for row in response.json()["events"])


async def test_audit_failure_returns_500_and_no_event(
    admin_client: AsyncClient, admin_data, admin_db, monkeypatch
) -> None:
    admin_id, token = await _token(admin_data)
    before = {
        row.id
        for row in (await admin_db.execute(select(AuditEvent).where(AuditEvent.action == ACTION))).scalars().all()
    }

    async def failing_audit(db, **kwargs):
        db.add(
            AuditEvent(
                id="test_audit_failure_row",
                actor_user_id=kwargs["actor_user_id"],
                action=kwargs["action"],
                target_type=kwargs["target_type"],
                audit_metadata=None,
            )
        )
        await db.flush()
        raise RuntimeError("simulated audit failure")

    monkeypatch.setattr(service, "record_admin_audit", failing_audit)

    response = await admin_client.get("/api/admin/audit-events", cookies=_cookie(token))

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "simulated audit failure" not in response.text
    rows = (
        await admin_db.execute(select(AuditEvent).where(AuditEvent.action == ACTION))
    ).scalars().all()
    assert {row.id for row in rows} == before


async def test_existing_audit_rows_are_not_modified(admin_client: AsyncClient, admin_data, admin_db) -> None:
    _, token = await _token(admin_data)
    before = (
        await admin_db.execute(
            select(AuditEvent.id, AuditEvent.action, AuditEvent.audit_metadata).where(
                AuditEvent.action == USER_ACTION
            )
        )
    ).all()

    response = await admin_client.get("/api/admin/audit-events", cookies=_cookie(token))
    assert response.status_code == 200

    after = (
        await admin_db.execute(
            select(AuditEvent.id, AuditEvent.action, AuditEvent.audit_metadata).where(
                AuditEvent.action == USER_ACTION
            )
        )
    ).all()
    assert before == after
