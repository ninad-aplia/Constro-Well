"""GET /api/admin/orders/{order_id} — detail, snapshots, events, escrow, audit."""

from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from fastapi_app.domains.admin import service
from fastapi_app.models.audit import AuditEvent
from fastapi_app.models.orders import EscrowEntry, Order, Shipment, ShipmentEvent
from fastapi_app.models.seller import Seller

DETAIL_ACTION = "admin.orders.detail"
ORDER_KEYS = {"id", "code", "stage", "cancelled", "paymentMethod", "paymentLabel", "createdAt", "updatedAt"}
CUSTOMER_KEYS = {"id", "name", "email"}
MONEY_KEYS = {"itemValue", "discount", "deliveryFee", "taxAmount", "grossTotal"}
LINE_KEYS = {"id", "name", "unit", "unitPrice", "qty", "lineValue", "sellerId", "sellerName"}
SHIPMENT_KEYS = {
    "id", "code", "sellerId", "sellerName", "status", "slot", "late", "deliveredAt",
    "deliveredQty", "reviewEnds", "createdAt", "updatedAt", "events",
}
EVENT_KEYS = {"id", "actor", "message", "at"}
FINANCIAL_KEYS = {"id", "type", "amount", "createdAt", "sellerId", "sellerName", "shipmentId"}


def _cookie(token: str) -> dict[str, str]:
    return {"cw_session": token}


async def _admin_token(data) -> str:
    admin_id = await data.user(role="admin")
    return await data.session(admin_id)


async def _detail_rows(db):
    return (
        await db.execute(select(AuditEvent).where(AuditEvent.action == DETAIL_ACTION))
    ).scalars().all()


async def _full_order(admin_data, admin_db):
    customer = await admin_data.user(role="customer", email="detail-customer@admin.test")
    order_id = await admin_data.order(customer, gross_total="1234.50")
    sellers = (await admin_db.execute(select(Seller.id).limit(2))).scalars().all()
    from fastapi_app.models.catalog import Product

    product_id = (await admin_db.execute(select(Product.id).limit(1))).scalar_one()
    await admin_data.line(
        order_id,
        sellers[0],
        product_id,
        name="Snapshot Cement",
        unit_price="390.00",
        qty=2,
        line_value="780.00",
    )
    first = await admin_data.shipment(order_id, sellers[0], status="dispatched")
    second = await admin_data.shipment(order_id, sellers[1], status="new")
    await admin_data.event(first, message="Dispatched", actor="vendor", at=datetime(2026, 1, 1, 9, 0, 0))
    await admin_data.event(first, message="Packed", actor="vendor", at=datetime(2026, 1, 1, 8, 0, 0))
    await admin_data.escrow(order_id=order_id, seller_id=sellers[0], amount="780.00", entry_type="held")
    await admin_db.commit()
    return order_id, customer, sellers, first, second


async def test_missing_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/orders/anything")
    assert response.status_code == 401


async def test_invalid_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/orders/anything", cookies=_cookie("bad"))
    assert response.status_code == 401


@pytest.mark.parametrize("role", ["customer", "seller", "driver"])
async def test_non_admin_is_403(admin_client: AsyncClient, admin_data, role: str) -> None:
    user_id = await admin_data.user(role=role)
    token = await admin_data.session(user_id)

    response = await admin_client.get("/api/admin/orders/anything", cookies=_cookie(token))

    assert response.status_code == 403


async def test_admin_success_full_contract(admin_client: AsyncClient, admin_data, admin_db) -> None:
    order_id, customer, sellers, first, second = await _full_order(admin_data, admin_db)
    token = await _admin_token(admin_data)

    response = await admin_client.get(f"/api/admin/orders/{order_id}", cookies=_cookie(token))

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"order", "customer", "money", "lines", "shipments", "financialRecords"}
    assert set(body["order"]) == ORDER_KEYS
    assert set(body["customer"]) == CUSTOMER_KEYS
    assert set(body["money"]) == MONEY_KEYS
    assert body["customer"] == {"id": customer, "name": "Admin Test customer", "email": "detail-customer@admin.test"}
    assert body["money"]["grossTotal"] == "1234.50"
    assert body["money"]["itemValue"] == "100.00"
    assert body["order"]["stage"] == "ordered"
    assert body["order"]["cancelled"] is False
    assert len(body["lines"]) == 1
    line = body["lines"][0]
    assert set(line) == LINE_KEYS
    assert line["name"] == "Snapshot Cement"
    assert line["qty"] == 2
    assert line["unitPrice"] == "390.00"
    assert line["lineValue"] == "780.00"
    assert line["sellerId"] == sellers[0]
    assert len(body["shipments"]) == 2
    assert {row["id"] for row in body["shipments"]} == {first, second}
    assert all(set(row) == SHIPMENT_KEYS for row in body["shipments"])
    dispatched = next(row for row in body["shipments"] if row["id"] == first)
    assert [event["message"] for event in dispatched["events"]] == ["Packed", "Dispatched"]
    assert all(set(event) == EVENT_KEYS for event in dispatched["events"])
    assert len(body["financialRecords"]) >= 1
    held = body["financialRecords"][0]
    assert set(held) == FINANCIAL_KEYS
    assert held["type"] == "held"
    assert held["amount"] == "780.00"
    assert "Sensitive Customer" not in response.text
    assert "Sensitive Street" not in response.text
    assert "addressSnapshot" not in response.text
    assert "SENSITIVE-BANK-REF" not in response.text


async def test_unknown_order_is_404_and_not_audited(admin_client: AsyncClient, admin_data, admin_db) -> None:
    token = await _admin_token(admin_data)
    before = {row.id for row in await _detail_rows(admin_db)}

    response = await admin_client.get("/api/admin/orders/no-such-order", cookies=_cookie(token))

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "order_not_found"
    assert {row.id for row in await _detail_rows(admin_db)} == before


async def test_detail_read_is_audited_once(admin_client: AsyncClient, admin_data, admin_db) -> None:
    order_id, *_ = await _full_order(admin_data, admin_db)
    admin_id = await admin_data.user(role="admin")
    token = await admin_data.session(admin_id)
    before = {row.id for row in await _detail_rows(admin_db)}

    response = await admin_client.get(f"/api/admin/orders/{order_id}", cookies=_cookie(token))

    assert response.status_code == 200
    created = [row for row in await _detail_rows(admin_db) if row.id not in before]
    assert len(created) == 1
    event = created[0]
    assert event.actor_user_id == admin_id
    assert event.target_type == "Order"
    assert event.target_id == order_id


async def test_audit_failure_rolls_back(
    admin_client: AsyncClient, admin_data, admin_db, monkeypatch
) -> None:
    order_id, *_ = await _full_order(admin_data, admin_db)
    token = await _admin_token(admin_data)
    before = {row.id for row in await _detail_rows(admin_db)}

    async def failing_audit(db, **kwargs):
        db.add(
            AuditEvent(
                id="test_order_detail_failure",
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

    response = await admin_client.get(f"/api/admin/orders/{order_id}", cookies=_cookie(token))

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert {row.id for row in await _detail_rows(admin_db)} == before


async def test_existing_records_unchanged(admin_client: AsyncClient, admin_data, admin_db) -> None:
    order_id, *_ = await _full_order(admin_data, admin_db)
    token = await _admin_token(admin_data)
    counts_before = {
        "orders": (await admin_db.execute(select(func.count()).select_from(Order))).scalar_one(),
        "shipments": (await admin_db.execute(select(func.count()).select_from(Shipment))).scalar_one(),
        "events": (await admin_db.execute(select(func.count()).select_from(ShipmentEvent))).scalar_one(),
        "escrow": (await admin_db.execute(select(func.count()).select_from(EscrowEntry))).scalar_one(),
    }

    response = await admin_client.get(f"/api/admin/orders/{order_id}", cookies=_cookie(token))
    assert response.status_code == 200

    assert (await admin_db.execute(select(func.count()).select_from(Order))).scalar_one() == counts_before["orders"]
    assert (await admin_db.execute(select(func.count()).select_from(Shipment))).scalar_one() == counts_before["shipments"]
    assert (await admin_db.execute(select(func.count()).select_from(ShipmentEvent))).scalar_one() == counts_before["events"]
    assert (await admin_db.execute(select(func.count()).select_from(EscrowEntry))).scalar_one() == counts_before["escrow"]
