"""GET /api/admin/audit-events filters — exact matching, ranges, options, audit."""

import json
from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from fastapi_app.domains.admin import service
from fastapi_app.models.audit import AuditEvent

READ_ACTION = "admin.audit_events.list"
ACTION_A = "test.filter.alpha"
ACTION_B = "test.filter.beta"


def _cookie(token: str) -> dict[str, str]:
    return {"cw_session": token}


async def _admin(data) -> tuple[str, str]:
    user_id = await data.user(role="admin")
    return user_id, await data.session(user_id)


async def _insert(db, event_id: str, actor_id: str, action: str, at: datetime, metadata: dict | None = None):
    await db.execute(
        text(
            'INSERT INTO "AuditEvent" (id, "actorUserId", action, "targetType", "targetId", metadata, "createdAt") '
            "VALUES (:id, :actor, :action, 'Test', NULL, CAST(:metadata AS jsonb), :at)"
        ),
        {
            "id": event_id,
            "actor": actor_id,
            "action": action,
            "metadata": json.dumps(metadata) if metadata else None,
            "at": at,
        },
    )


async def _read_rows(db):
    return (
        await db.execute(
            text(
                'SELECT id, action, "actorUserId" FROM "AuditEvent" '
                'WHERE action IN (:a, :b) ORDER BY id'
            ),
            {"a": ACTION_A, "b": ACTION_B},
        )
    ).all()


async def test_filters_require_admin(admin_client: AsyncClient, admin_data) -> None:
    assert (await admin_client.get("/api/admin/audit-events?action=x")).status_code == 401
    assert (
        await admin_client.get("/api/admin/audit-events?actorId=x", cookies=_cookie("bad"))
    ).status_code == 401

    customer = await admin_data.user(role="customer")
    token = await admin_data.session(customer)
    response = await admin_client.get("/api/admin/audit-events?action=x", cookies=_cookie(token))
    assert response.status_code == 403


async def test_action_filter_is_exact(admin_client: AsyncClient, admin_data, admin_db) -> None:
    actor, token = await _admin(admin_data)
    when = datetime(2099, 6, 1, 9, 0, 0)
    await _insert(admin_db, "test_filter_a1", actor, ACTION_A, when)
    await _insert(admin_db, "test_filter_a2", actor, ACTION_A, when + timedelta(hours=1))
    await _insert(admin_db, "test_filter_b1", actor, ACTION_B, when + timedelta(hours=2))
    await admin_db.commit()

    response = await admin_client.get(
        f"/api/admin/audit-events?action={ACTION_A}&pageSize=50", cookies=_cookie(token)
    )

    assert response.status_code == 200
    body = response.json()
    assert {row["action"] for row in body["events"]} == {ACTION_A}
    assert {"test_filter_a1", "test_filter_a2"} <= {row["id"] for row in body["events"]}
    assert body["pagination"]["total"] == 2


async def test_actor_filter_is_exact(admin_client: AsyncClient, admin_data, admin_db) -> None:
    actor_one, token = await _admin(admin_data)
    actor_two = await admin_data.user(role="admin")
    when = datetime(2099, 6, 2, 9, 0, 0)
    await _insert(admin_db, "test_filter_actor1", actor_one, ACTION_A, when)
    await _insert(admin_db, "test_filter_actor2", actor_two, ACTION_A, when + timedelta(minutes=1))
    await admin_db.commit()

    response = await admin_client.get(
        f"/api/admin/audit-events?actorId={actor_two}&pageSize=50", cookies=_cookie(token)
    )

    assert response.status_code == 200
    events = response.json()["events"]
    assert events
    assert {row["actor"]["id"] for row in events} == {actor_two}
    assert response.json()["pagination"]["total"] == 1


async def test_from_is_inclusive_and_to_is_exclusive(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    actor, token = await _admin(admin_data)
    boundary = datetime(2099, 6, 3, 12, 0, 0)
    await _insert(admin_db, "test_filter_before", actor, ACTION_A, boundary - timedelta(seconds=1))
    await _insert(admin_db, "test_filter_at", actor, ACTION_A, boundary)
    await _insert(admin_db, "test_filter_after", actor, ACTION_A, boundary + timedelta(seconds=1))
    await admin_db.commit()

    at = boundary.isoformat()
    response = await admin_client.get(
        f"/api/admin/audit-events?action={ACTION_A}&from={at}&to={(boundary + timedelta(seconds=1)).isoformat()}",
        cookies=_cookie(token),
    )

    assert response.status_code == 200
    ids = {row["id"] for row in response.json()["events"]}
    assert ids == {"test_filter_at"}


async def test_combined_filters_and_empty_result(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    actor, token = await _admin(admin_data)
    other = await admin_data.user(role="admin")
    when = datetime(2099, 6, 4, 10, 0, 0)
    await _insert(admin_db, "test_filter_combined", actor, ACTION_A, when)
    await _insert(admin_db, "test_filter_other_actor", other, ACTION_A, when)
    await _insert(admin_db, "test_filter_other_action", actor, ACTION_B, when)
    await admin_db.commit()

    response = await admin_client.get(
        f"/api/admin/audit-events?action={ACTION_A}&actorId={actor}"
        f"&from={(when - timedelta(minutes=1)).isoformat()}&to={(when + timedelta(minutes=1)).isoformat()}",
        cookies=_cookie(token),
    )

    assert response.status_code == 200
    assert [row["id"] for row in response.json()["events"]] == ["test_filter_combined"]

    empty = await admin_client.get(
        "/api/admin/audit-events?action=no.such.action", cookies=_cookie(token)
    )
    assert empty.status_code == 200
    assert empty.json()["events"] == []
    assert empty.json()["pagination"]["total"] == 0


async def test_invalid_dates_and_reversed_range(admin_client: AsyncClient, admin_data) -> None:
    _, token = await _admin(admin_data)

    for query in ("from=not-a-date", "to=nope", "from=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z"):
        response = await admin_client.get(f"/api/admin/audit-events?{query}", cookies=_cookie(token))
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "validation_error"


async def test_pagination_and_stable_ordering_with_filters(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    actor, token = await _admin(admin_data)
    when = datetime(2099, 6, 5, 10, 0, 0)
    for suffix in ("zzz", "aaa", "mmm"):
        await _insert(admin_db, f"test_filter_{suffix}", actor, ACTION_A, when)
    await admin_db.commit()

    first = await admin_client.get(
        f"/api/admin/audit-events?action={ACTION_A}&page=1&pageSize=2", cookies=_cookie(token)
    )
    second = await admin_client.get(
        f"/api/admin/audit-events?action={ACTION_A}&page=2&pageSize=2", cookies=_cookie(token)
    )

    assert first.status_code == second.status_code == 200
    assert first.json()["pagination"]["total"] == 3
    assert [row["id"] for row in first.json()["events"]] == ["test_filter_zzz", "test_filter_mmm"]
    assert [row["id"] for row in second.json()["events"]] == ["test_filter_aaa"]


async def test_filter_options_come_from_stored_rows(admin_client: AsyncClient, admin_data, admin_db) -> None:
    actor, token = await _admin(admin_data)
    await _insert(admin_db, "test_filter_options", actor, ACTION_A, datetime(2099, 6, 6, 9, 0, 0))
    await admin_db.commit()

    response = await admin_client.get("/api/admin/audit-events/filters", cookies=_cookie(token))

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"actions", "actors"}
    assert ACTION_A in body["actions"]
    actor_entry = next(row for row in body["actors"] if row["id"] == actor)
    assert actor_entry["name"] == "Admin Test admin"
    assert "email" not in response.text


async def test_read_is_audited_once_with_filters(admin_client: AsyncClient, admin_data, admin_db) -> None:
    actor, token = await _admin(admin_data)
    before = (
        await admin_db.execute(
            text('SELECT count(*) FROM "AuditEvent" WHERE action = :action AND "actorUserId" = :actor'),
            {"action": READ_ACTION, "actor": actor},
        )
    ).scalar_one()

    response = await admin_client.get(
        f"/api/admin/audit-events?action={ACTION_A}", cookies=_cookie(token)
    )

    assert response.status_code == 200
    after = (
        await admin_db.execute(
            text('SELECT count(*) FROM "AuditEvent" WHERE action = :action AND "actorUserId" = :actor'),
            {"action": READ_ACTION, "actor": actor},
        )
    ).scalar_one()
    assert after == before + 1
    assert response.json()["pagination"]["total"] == 0  # no matching rows yet


async def test_audit_failure_rolls_back(admin_client: AsyncClient, admin_data, admin_db, monkeypatch) -> None:
    actor, token = await _admin(admin_data)
    before = (
        await admin_db.execute(
            text('SELECT count(*) FROM "AuditEvent" WHERE action = :action AND "actorUserId" = :actor'),
            {"action": READ_ACTION, "actor": actor},
        )
    ).scalar_one()

    async def failing_audit(db, **kwargs):
        db.add(
            AuditEvent(
                id="test_filter_audit_failure",
                actor_user_id=kwargs["actor_user_id"],
                action=kwargs["action"],
                target_type=kwargs["target_type"],
                audit_metadata=None,
            )
        )
        await db.flush()
        raise RuntimeError("simulated filter audit failure")

    monkeypatch.setattr(service, "record_admin_audit", failing_audit)

    response = await admin_client.get("/api/admin/audit-events?action=x", cookies=_cookie(token))

    assert response.status_code == 500
    after = (
        await admin_db.execute(
            text('SELECT count(*) FROM "AuditEvent" WHERE action = :action AND "actorUserId" = :actor'),
            {"action": READ_ACTION, "actor": actor},
        )
    ).scalar_one()
    assert after == before
