"""GET /api/admin/sellers/{seller_id} — detail, KYC, history, audit."""

import json
from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, text

from fastapi_app.domains.admin import service
from fastapi_app.models.audit import AuditEvent
from fastapi_app.models.identity import User
from fastapi_app.models.seller import Seller

DETAIL_ACTION = "admin.sellers.detail"
SELLER_KEYS = {
    "id", "storeName", "city", "phone", "vacationMode",
    "kycGst", "kycPan", "kycCheque", "createdAt",
}
OWNER_KEYS = {"id", "name", "email", "createdAt"}
HISTORY_KEYS = {"id", "action", "actor", "createdAt"}


def _cookie(token: str) -> dict[str, str]:
    return {"cw_session": token}


async def _admin_token(data) -> str:
    admin_id = await data.user(role="admin")
    return await data.session(admin_id)


async def _detail_rows(db):
    return (
        await db.execute(select(AuditEvent).where(AuditEvent.action == DETAIL_ACTION))
    ).scalars().all()


async def _insert_history(db, event_id: str, actor_id: str, seller_id: str, created_at: datetime):
    await db.execute(
        text(
            'INSERT INTO "AuditEvent" (id, "actorUserId", action, "targetType", "targetId", metadata, "createdAt") '
            "VALUES (:id, :actor, :action, 'Seller', :target, CAST(:metadata AS jsonb), :created)"
        ),
        {
            "id": event_id,
            "actor": actor_id,
            "action": "admin.sellers.detail",
            "target": seller_id,
            "metadata": json.dumps({"page": 1}),
            "created": created_at,
        },
    )


async def test_missing_session_is_401(admin_client: AsyncClient, admin_data) -> None:
    response = await admin_client.get("/api/admin/sellers/anything")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


async def test_invalid_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/sellers/anything", cookies=_cookie("bad"))
    assert response.status_code == 401


@pytest.mark.parametrize("role", ["customer", "seller", "driver"])
async def test_non_admin_is_403(admin_client: AsyncClient, admin_data, role: str) -> None:
    user_id = await admin_data.user(role=role)
    token = await admin_data.session(user_id)

    response = await admin_client.get("/api/admin/sellers/anything", cookies=_cookie(token))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_admin_success_contract_and_no_sensitive_fields(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    owner = await admin_data.user(role="seller", email="detail-owner@admin.test")
    seller_id = await admin_data.seller(
        owner,
        seller_id="test_seller_detail",
        store_name="Detail Store",
        city="Nagpur",
        kyc=("verified", "verified", "pending"),
        vacation_mode=True,
    )
    await admin_db.commit()
    token = await _admin_token(admin_data)

    response = await admin_client.get(f"/api/admin/sellers/{seller_id}", cookies=_cookie(token))

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"seller", "owner", "auditHistory"}
    assert set(body["seller"]) == SELLER_KEYS
    assert set(body["owner"]) == OWNER_KEYS
    seller = body["seller"]
    assert seller["id"] == seller_id
    assert seller["storeName"] == "Detail Store"
    assert seller["city"] == "Nagpur"
    assert seller["vacationMode"] is True
    assert (seller["kycGst"], seller["kycPan"], seller["kycCheque"]) == ("verified", "verified", "pending")
    assert body["owner"]["id"] == owner
    assert body["owner"]["email"] == "detail-owner@admin.test"
    assert "SENSITIVE-BANK-REF" not in response.text
    assert "Sensitive pickup address" not in response.text
    assert "gstin" not in response.text.lower()
    assert "bankRef" not in response.text
    assert "pickupAddress" not in response.text


async def test_unknown_seller_is_404_and_not_audited(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    token = await _admin_token(admin_data)
    before = {row.id for row in await _detail_rows(admin_db)}

    response = await admin_client.get("/api/admin/sellers/no-such-seller", cookies=_cookie(token))

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "seller_not_found"
    assert {row.id for row in await _detail_rows(admin_db)} == before


async def test_detail_read_is_audited_once_with_target(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    owner = await admin_data.user(role="seller")
    seller_id = await admin_data.seller(owner, seller_id="test_seller_audit_detail")
    await admin_db.commit()
    token = await _admin_token(admin_data)
    before = {row.id for row in await _detail_rows(admin_db)}

    response = await admin_client.get(f"/api/admin/sellers/{seller_id}", cookies=_cookie(token))

    assert response.status_code == 200
    created = [row for row in await _detail_rows(admin_db) if row.id not in before]
    assert len(created) == 1
    event = created[0]
    assert event.target_type == "Seller"
    assert event.target_id == seller_id
    assert event.audit_metadata is None
    # The response's own history excludes the row it just wrote.
    assert all(item["id"] != event.id for item in response.json()["auditHistory"])


async def test_audit_history_is_bounded_to_the_seller(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    owner = await admin_data.user(role="seller")
    seller_id = await admin_data.seller(owner, seller_id="test_seller_history")
    actor = await admin_data.user(role="admin")
    await admin_db.commit()
    for index in range(7):
        await _insert_history(
            admin_db,
            event_id=f"test_history_{index}",
            actor_id=actor,
            seller_id=seller_id,
            created_at=datetime(2099, 4, 1, 10, index, 0),
        )
    await _insert_history(
        admin_db,
        event_id="test_history_other",
        actor_id=actor,
        seller_id="test_seller_other",
        created_at=datetime(2099, 4, 2, 0, 0, 0),
    )
    await admin_db.commit()
    token = await _admin_token(admin_data)

    response = await admin_client.get(f"/api/admin/sellers/{seller_id}", cookies=_cookie(token))

    assert response.status_code == 200
    history = response.json()["auditHistory"]
    assert len(history) == 5
    assert [row["id"] for row in history] == [
        "test_history_6", "test_history_5", "test_history_4", "test_history_3", "test_history_2",
    ]
    assert all(set(row) == HISTORY_KEYS for row in history)
    assert all(row["action"] == DETAIL_ACTION for row in history)
    assert all(row["actor"]["id"] == actor for row in history)


async def test_audit_failure_rolls_back(
    admin_client: AsyncClient, admin_data, admin_db, monkeypatch
) -> None:
    owner = await admin_data.user(role="seller")
    seller_id = await admin_data.seller(owner, seller_id="test_seller_audit_fail")
    await admin_db.commit()
    token = await _admin_token(admin_data)
    before = {row.id for row in await _detail_rows(admin_db)}

    async def failing_audit(db, **kwargs):
        db.add(
            AuditEvent(
                id="test_detail_audit_failure",
                actor_user_id=kwargs["actor_user_id"],
                action=kwargs["action"],
                target_type=kwargs["target_type"],
                target_id=kwargs.get("target_id"),
                audit_metadata=None,
            )
        )
        await db.flush()
        raise RuntimeError("simulated detail audit failure")

    monkeypatch.setattr(service, "record_admin_audit", failing_audit)

    response = await admin_client.get(f"/api/admin/sellers/{seller_id}", cookies=_cookie(token))

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "simulated detail audit failure" not in response.text
    assert {row.id for row in await _detail_rows(admin_db)} == before


async def test_existing_records_unchanged(admin_client: AsyncClient, admin_data, admin_db) -> None:
    owner = await admin_data.user(role="seller")
    seller_id = await admin_data.seller(owner, seller_id="test_seller_unchanged")
    await admin_db.commit()
    token = await _admin_token(admin_data)
    users_before = (await admin_db.execute(select(func.count()).select_from(User))).scalar_one()
    sellers_before = (await admin_db.execute(select(func.count()).select_from(Seller))).scalar_one()
    committed = (
        await admin_db.execute(select(Seller.id).where(Seller.id.not_like("test_seller_%")))
    ).scalars().all()

    response = await admin_client.get(f"/api/admin/sellers/{seller_id}", cookies=_cookie(token))
    assert response.status_code == 200

    assert (await admin_db.execute(select(func.count()).select_from(User))).scalar_one() == users_before
    assert (await admin_db.execute(select(func.count()).select_from(Seller))).scalar_one() == sellers_before
    after = (
        await admin_db.execute(select(Seller.id).where(Seller.id.not_like("test_seller_%")))
    ).scalars().all()
    assert after == committed
