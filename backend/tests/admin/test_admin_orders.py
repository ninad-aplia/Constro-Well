"""GET /api/admin/orders — monitoring list, multi-seller, money, audit."""

from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from fastapi_app.domains.admin import service
from fastapi_app.models.audit import AuditEvent
from fastapi_app.models.identity import User
from fastapi_app.models.orders import Order, Shipment
from fastapi_app.models.seller import Seller

ACTION = "admin.orders.list"
ORDER_KEYS = {
    "id", "code", "customer", "stage", "cancelled", "grossTotal",
    "lineCount", "shipmentCount", "shipments", "createdAt",
}
SHIPMENT_KEYS = {"code", "sellerName", "status"}


def _cookie(token: str) -> dict[str, str]:
    return {"cw_session": token}


async def _admin_token(data) -> str:
    admin_id = await data.user(role="admin")
    return await data.session(admin_id)


async def _order_rows(db):
    return (
        await db.execute(select(AuditEvent).where(AuditEvent.action == ACTION))
    ).scalars().all()


async def test_missing_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/orders")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


async def test_invalid_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/orders", cookies=_cookie("bad"))
    assert response.status_code == 401


@pytest.mark.parametrize("role", ["customer", "seller", "driver"])
async def test_non_admin_is_403(admin_client: AsyncClient, admin_data, role: str) -> None:
    user_id = await admin_data.user(role=role)
    token = await admin_data.session(user_id)

    response = await admin_client.get("/api/admin/orders", cookies=_cookie(token))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_admin_success_contract_multi_seller_and_money(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    customer = await admin_data.user(role="customer", email="order-customer@admin.test")
    order_id = await admin_data.order(customer, gross_total="1234.50", created_at=datetime(2099, 5, 1, 9, 0, 0))
    seller_ids = (await admin_db.execute(select(Seller.id).limit(2))).scalars().all()
    assert len(seller_ids) == 2
    await admin_data.shipment(order_id, seller_ids[0], status="new")
    await admin_data.shipment(order_id, seller_ids[1], status="dispatched")
    await admin_db.commit()
    token = await _admin_token(admin_data)

    response = await admin_client.get("/api/admin/orders?page=1&pageSize=50", cookies=_cookie(token))

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"orders", "pagination"}
    order = next(row for row in body["orders"] if row["id"] == order_id)
    assert set(order) == ORDER_KEYS
    assert order["customer"] == {"id": customer, "name": "Admin Test customer"}
    assert order["stage"] == "ordered"
    assert order["cancelled"] is False
    assert order["grossTotal"] == "1234.50"
    assert order["lineCount"] == 0
    assert order["shipmentCount"] == 2
    assert len(order["shipments"]) == 2
    assert {row["status"] for row in order["shipments"]} == {"new", "dispatched"}
    assert all(set(row) == SHIPMENT_KEYS for row in order["shipments"])
    assert "Sensitive Customer" not in response.text
    assert "Sensitive Street" not in response.text
    assert "addressSnapshot" not in response.text


async def test_default_pagination_and_bounds(admin_client: AsyncClient, admin_data) -> None:
    token = await _admin_token(admin_data)

    first = await admin_client.get("/api/admin/orders", cookies=_cookie(token))
    assert first.status_code == 200
    assert first.json()["pagination"]["page"] == 1
    assert first.json()["pagination"]["pageSize"] == 20

    beyond = await admin_client.get("/api/admin/orders?page=10000&pageSize=50", cookies=_cookie(token))
    assert beyond.status_code == 200
    assert beyond.json()["orders"] == []

    for query in ("page=0", "pageSize=0", "pageSize=51", "pageSize=abc"):
        bad = await admin_client.get(f"/api/admin/orders?{query}", cookies=_cookie(token))
        assert bad.status_code == 400
        assert bad.json()["error"]["code"] == "validation_error"


async def test_ordering_and_tiebreak(admin_client: AsyncClient, admin_data, admin_db) -> None:
    customer = await admin_data.user(role="customer")
    when = datetime(2099, 5, 1, 12, 0, 0)
    await admin_data.order(customer, order_id="test_order_zzz", created_at=when)
    await admin_data.order(customer, order_id="test_order_aaa", created_at=when)
    await admin_db.commit()
    token = await _admin_token(admin_data)

    response = await admin_client.get("/api/admin/orders?page=1&pageSize=2", cookies=_cookie(token))

    assert response.status_code == 200
    assert [row["id"] for row in response.json()["orders"]] == ["test_order_zzz", "test_order_aaa"]


async def test_read_is_audited_once(admin_client: AsyncClient, admin_data, admin_db) -> None:
    admin_id = await admin_data.user(role="admin")
    token = await admin_data.session(admin_id)
    before = {row.id for row in await _order_rows(admin_db)}

    response = await admin_client.get("/api/admin/orders?page=1&pageSize=5", cookies=_cookie(token))

    assert response.status_code == 200
    created = [row for row in await _order_rows(admin_db) if row.id not in before]
    assert len(created) == 1
    event = created[0]
    assert event.actor_user_id == admin_id
    assert event.target_type == "Order"
    assert event.audit_metadata == {
        "page": 1,
        "pageSize": 5,
        "total": response.json()["pagination"]["total"],
    }


async def test_audit_failure_rolls_back(admin_client: AsyncClient, admin_data, admin_db, monkeypatch) -> None:
    token = await _admin_token(admin_data)
    before = {row.id for row in await _order_rows(admin_db)}

    async def failing_audit(db, **kwargs):
        db.add(
            AuditEvent(
                id="test_order_audit_failure",
                actor_user_id=kwargs["actor_user_id"],
                action=kwargs["action"],
                target_type=kwargs["target_type"],
                audit_metadata=None,
            )
        )
        await db.flush()
        raise RuntimeError("simulated order audit failure")

    monkeypatch.setattr(service, "record_admin_audit", failing_audit)

    response = await admin_client.get("/api/admin/orders", cookies=_cookie(token))

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "simulated order audit failure" not in response.text
    assert {row.id for row in await _order_rows(admin_db)} == before


async def test_existing_records_unchanged(admin_client: AsyncClient, admin_data, admin_db) -> None:
    token = await _admin_token(admin_data)
    orders_before = (await admin_db.execute(select(func.count()).select_from(Order))).scalar_one()
    shipments_before = (await admin_db.execute(select(func.count()).select_from(Shipment))).scalar_one()
    committed = (
        await admin_db.execute(select(Order.id).where(Order.id.not_like("test_order_%")))
    ).scalars().all()

    response = await admin_client.get("/api/admin/orders", cookies=_cookie(token))
    assert response.status_code == 200

    assert (await admin_db.execute(select(func.count()).select_from(Order))).scalar_one() == orders_before
    assert (await admin_db.execute(select(func.count()).select_from(Shipment))).scalar_one() == shipments_before
    after = (
        await admin_db.execute(select(Order.id).where(Order.id.not_like("test_order_%")))
    ).scalars().all()
    assert after == committed
