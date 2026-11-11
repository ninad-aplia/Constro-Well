"""GET /api/admin/shipments — cross-seller shipment monitoring, status filter, audit."""

from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from fastapi_app.domains.admin import service
from fastapi_app.models.audit import AuditEvent
from fastapi_app.models.orders import Shipment
from fastapi_app.models.seller import Seller

ACTION = "admin.shipments.list"
SHIPMENT_KEYS = {
    "id", "code", "orderId", "orderCode", "sellerId", "sellerName", "status",
    "driverId", "driverName", "late", "deliveredAt", "reviewEnds", "createdAt",
}


def _cookie(token: str) -> dict[str, str]:
    return {"cw_session": token}


async def _admin_token(data) -> str:
    admin_id = await data.user(role="admin")
    return await data.session(admin_id)


async def _audit_rows(db):
    return (
        await db.execute(select(AuditEvent).where(AuditEvent.action == ACTION))
    ).scalars().all()


async def test_missing_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/shipments")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


async def test_invalid_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/shipments", cookies=_cookie("bad"))
    assert response.status_code == 401


@pytest.mark.parametrize("role", ["customer", "seller", "driver"])
async def test_non_admin_is_403(admin_client: AsyncClient, admin_data, role: str) -> None:
    user_id = await admin_data.user(role=role)
    token = await admin_data.session(user_id)

    response = await admin_client.get("/api/admin/shipments", cookies=_cookie(token))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_admin_success_contract_across_sellers(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    customer = await admin_data.user(role="customer", email="shipment-customer@admin.test")
    order_id = await admin_data.order(customer, created_at=datetime(2099, 5, 1, 9, 0, 0))
    sellers = (await admin_db.execute(select(Seller.id).limit(2))).scalars().all()
    assert len(sellers) == 2
    first = await admin_data.shipment(order_id, sellers[0], status="failed")
    second = await admin_data.shipment(order_id, sellers[1], status="dispatched")
    await admin_db.commit()
    token = await _admin_token(admin_data)

    response = await admin_client.get("/api/admin/shipments?page=1&pageSize=50", cookies=_cookie(token))

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"shipments", "pagination"}
    ids = {row["id"] for row in body["shipments"]}
    assert {first, second}.issubset(ids)
    row = next(row for row in body["shipments"] if row["id"] == first)
    assert set(row) == SHIPMENT_KEYS
    assert row["orderId"] == order_id
    assert row["status"] == "failed"
    assert row["driverId"] is None
    assert row["driverName"] is None
    assert "Sensitive Customer" not in response.text
    assert "Sensitive Street" not in response.text
    assert "Sensitive pickup address" not in response.text
    assert "SENSITIVE-BANK-REF" not in response.text


async def test_status_filter(admin_client: AsyncClient, admin_data, admin_db) -> None:
    customer = await admin_data.user(role="customer")
    order_id = await admin_data.order(customer)
    seller_id = (await admin_db.execute(select(Seller.id).limit(1))).scalar_one()
    failed = await admin_data.shipment(order_id, seller_id, status="failed")
    dispatched = await admin_data.shipment(order_id, seller_id, status="dispatched")
    await admin_db.commit()
    token = await _admin_token(admin_data)

    response = await admin_client.get(
        "/api/admin/shipments?status=failed&pageSize=50", cookies=_cookie(token)
    )

    assert response.status_code == 200
    ids = {row["id"] for row in response.json()["shipments"]}
    assert failed in ids
    assert dispatched not in ids
    assert all(row["status"] == "failed" for row in response.json()["shipments"])


async def test_unknown_status_is_400(admin_client: AsyncClient, admin_data) -> None:
    token = await _admin_token(admin_data)

    response = await admin_client.get("/api/admin/shipments?status=not_a_real_status", cookies=_cookie(token))

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"
    assert response.json()["error"]["field"] == "status"


async def test_default_pagination_and_bounds(admin_client: AsyncClient, admin_data) -> None:
    token = await _admin_token(admin_data)

    first = await admin_client.get("/api/admin/shipments", cookies=_cookie(token))
    assert first.status_code == 200
    assert first.json()["pagination"]["page"] == 1
    assert first.json()["pagination"]["pageSize"] == 20

    beyond = await admin_client.get("/api/admin/shipments?page=10000&pageSize=50", cookies=_cookie(token))
    assert beyond.status_code == 200
    assert beyond.json()["shipments"] == []

    for query in ("page=0", "pageSize=0", "pageSize=51", "pageSize=abc"):
        bad = await admin_client.get(f"/api/admin/shipments?{query}", cookies=_cookie(token))
        assert bad.status_code == 400
        assert bad.json()["error"]["code"] == "validation_error"


async def test_ordering_and_tiebreak(admin_client: AsyncClient, admin_data, admin_db) -> None:
    customer = await admin_data.user(role="customer")
    order_id = await admin_data.order(customer)
    seller_id = (await admin_db.execute(select(Seller.id).limit(1))).scalar_one()
    zzz = await admin_data.shipment(order_id, seller_id, shipment_id="test_shipment_zzz")
    aaa = await admin_data.shipment(order_id, seller_id, shipment_id="test_shipment_aaa")
    await admin_db.commit()
    token = await _admin_token(admin_data)

    response = await admin_client.get("/api/admin/shipments?page=1&pageSize=2", cookies=_cookie(token))

    assert response.status_code == 200
    assert [row["id"] for row in response.json()["shipments"]] == [zzz, aaa]


async def test_read_is_audited_once(admin_client: AsyncClient, admin_data, admin_db) -> None:
    admin_id = await admin_data.user(role="admin")
    token = await admin_data.session(admin_id)
    before = {row.id for row in await _audit_rows(admin_db)}

    response = await admin_client.get("/api/admin/shipments?page=1&pageSize=5", cookies=_cookie(token))

    assert response.status_code == 200
    created = [row for row in await _audit_rows(admin_db) if row.id not in before]
    assert len(created) == 1
    event = created[0]
    assert event.actor_user_id == admin_id
    assert event.target_type == "Shipment"
    assert event.audit_metadata == {
        "page": 1,
        "pageSize": 5,
        "total": response.json()["pagination"]["total"],
    }


async def test_audit_failure_rolls_back(admin_client: AsyncClient, admin_data, admin_db, monkeypatch) -> None:
    token = await _admin_token(admin_data)
    before = {row.id for row in await _audit_rows(admin_db)}

    async def failing_audit(db, **kwargs):
        db.add(
            AuditEvent(
                id="test_shipment_audit_failure",
                actor_user_id=kwargs["actor_user_id"],
                action=kwargs["action"],
                target_type=kwargs["target_type"],
                audit_metadata=None,
            )
        )
        await db.flush()
        raise RuntimeError("simulated shipment audit failure")

    monkeypatch.setattr(service, "record_admin_audit", failing_audit)

    response = await admin_client.get("/api/admin/shipments", cookies=_cookie(token))

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "simulated shipment audit failure" not in response.text
    assert {row.id for row in await _audit_rows(admin_db)} == before


async def test_existing_records_unchanged(admin_client: AsyncClient, admin_data, admin_db) -> None:
    token = await _admin_token(admin_data)
    shipments_before = (await admin_db.execute(select(func.count()).select_from(Shipment))).scalar_one()
    committed = (
        await admin_db.execute(select(Shipment.id).where(Shipment.id.not_like("test_shipment_%")))
    ).scalars().all()

    response = await admin_client.get("/api/admin/shipments", cookies=_cookie(token))
    assert response.status_code == 200

    assert (await admin_db.execute(select(func.count()).select_from(Shipment))).scalar_one() == shipments_before
    after = (
        await admin_db.execute(select(Shipment.id).where(Shipment.id.not_like("test_shipment_%")))
    ).scalars().all()
    assert after == committed
