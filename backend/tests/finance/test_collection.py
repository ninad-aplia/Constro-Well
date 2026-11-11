"""COD collection tests: creation (read-back), confirmation (seller + agent),
discrepancy, unauthorized confirmation, duplicate/idempotency."""

from httpx import AsyncClient

from fastapi_app.domains.finance.service import (
    AUDIT_COLLECTION_CONFIRM,
)


async def _make_shipment(fdata, seller_id, *, user_id, status="review"):
    order_id = await fdata.order(user_id)
    return await fdata.shipment(order_id, seller_id, status=status)


async def test_collection_creation_is_readable(fdata, finance_client: AsyncClient, seller_auth):
    order_id = await fdata.order(seller_auth["user_id"])
    shipment_id = await fdata.shipment(order_id, seller_auth["seller_id"])
    await fdata.collection(shipment_id, seller_auth["seller_id"], expected="100.00")

    response = await finance_client.get("/api/seller/finance/collections", cookies=seller_auth["cookie"])
    assert response.status_code == 200
    collections = response.json()["collections"]
    assert len(collections) == 1
    assert collections[0]["shipmentId"] == shipment_id
    assert collections[0]["expectedAmount"] == "100.00"
    assert collections[0]["status"] == "pending"


async def test_seller_confirm_collection(fdata, finance_client: AsyncClient, seller_auth):
    shipment_id = await _make_shipment(fdata, seller_auth["seller_id"], user_id=seller_auth["user_id"])
    await fdata.collection(shipment_id, seller_auth["seller_id"], expected="100.00")

    response = await finance_client.post(
        f"/api/seller/finance/collections/{shipment_id}/confirm",
        json={"collectedAmount": "100.00", "evidenceRef": "RECEIPT-1"},
        cookies=seller_auth["cookie"],
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "confirmed"
    assert body["collectedAmount"] == "100.00"
    assert body["collectedBy"] == "seller"
    assert body["evidenceRef"] == "RECEIPT-1"


async def test_agent_confirm_collection_by_assigned_driver(fdata, finance_client: AsyncClient, driver_auth):
    order_user = await fdata.user("customer")
    order_id = await fdata.order(order_user)
    shipment_id = await fdata.shipment(order_id, driver_auth["seller_id"], status="review", driver_id=driver_auth["driver_id"])
    await fdata.collection(shipment_id, driver_auth["seller_id"], expected="100.00")

    response = await finance_client.post(
        f"/api/driver/finance/collections/{shipment_id}/confirm",
        json={"collectedAmount": "100.00"},
        cookies=driver_auth["cookie"],
    )
    assert response.status_code == 200, response.text
    assert response.json()["collectedBy"] == "agent"


async def test_agent_confirm_rejected_for_unassigned_driver(fdata, finance_client: AsyncClient, driver_auth):
    order_user = await fdata.user("customer")
    order_id = await fdata.order(order_user)
    # shipment assigned to a *different* driver (or none)
    shipment_id = await fdata.shipment(order_id, driver_auth["seller_id"], status="review")
    await fdata.collection(shipment_id, driver_auth["seller_id"], expected="100.00")

    response = await finance_client.post(
        f"/api/driver/finance/collections/{shipment_id}/confirm",
        json={"collectedAmount": "100.00"},
        cookies=driver_auth["cookie"],
    )
    assert response.status_code == 404


async def test_duplicate_confirm_is_conflict(fdata, finance_client: AsyncClient, seller_auth):
    shipment_id = await _make_shipment(fdata, seller_auth["seller_id"], user_id=seller_auth["user_id"])
    await fdata.collection(shipment_id, seller_auth["seller_id"], expected="100.00")

    first = await finance_client.post(
        f"/api/seller/finance/collections/{shipment_id}/confirm",
        json={"collectedAmount": "100.00"},
        cookies=seller_auth["cookie"],
    )
    assert first.status_code == 200

    second = await finance_client.post(
        f"/api/seller/finance/collections/{shipment_id}/confirm",
        json={"collectedAmount": "100.00"},
        cookies=seller_auth["cookie"],
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "invalid_transition"


async def test_unauthorized_seller_cannot_confirm_other_sellers_collection(
    fdata, finance_client: AsyncClient, seller_auth
):
    # Another seller owns the shipment.
    other_user = await fdata.user("seller")
    other_seller = await fdata.seller(other_user)
    order_user = await fdata.user("customer")
    order_id = await fdata.order(order_user)
    shipment_id = await fdata.shipment(order_id, other_seller)
    await fdata.collection(shipment_id, other_seller, expected="100.00")

    response = await finance_client.post(
        f"/api/seller/finance/collections/{shipment_id}/confirm",
        json={"collectedAmount": "100.00"},
        cookies=seller_auth["cookie"],
    )
    assert response.status_code == 404


async def test_non_seller_cannot_confirm(fdata, finance_client: AsyncClient, seller_auth):
    customer = await fdata.user("customer")
    token = await fdata.session(customer)
    shipment_id = await _make_shipment(fdata, seller_auth["seller_id"], user_id=customer)
    await fdata.collection(shipment_id, seller_auth["seller_id"], expected="100.00")

    response = await finance_client.post(
        f"/api/seller/finance/collections/{shipment_id}/confirm",
        json={"collectedAmount": "100.00"},
        cookies={"cw_session": token},
    )
    assert response.status_code == 403


async def test_collection_discrepancy_listing(fdata, finance_client: AsyncClient, admin_auth):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)

    order_user = await fdata.user("customer")
    order_id = await fdata.order(order_user)

    # Match: collected == expected
    s_match = await fdata.shipment(order_id, seller_id)
    await fdata.collection(s_match, seller_id, expected="300.00", collected="300.00", status="confirmed")

    # Discrepancy: collected != expected
    s_diff = await fdata.shipment(order_id, seller_id)
    await fdata.collection(s_diff, seller_id, expected="300.00", collected="250.00", status="confirmed")

    response = await finance_client.get(
        "/api/admin/finance/collections/discrepancies", cookies=admin_auth["cookie"]
    )
    assert response.status_code == 200
    items = response.json()["collections"]
    assert len(items) == 1
    assert items[0]["shipmentId"] == s_diff


async def test_confirm_writes_audit_event(fdata, finance_client: AsyncClient, seller_auth):
    from sqlalchemy import func, select

    from fastapi_app.models.audit import AuditEvent

    # Historical events may already exist in a dev database; assert the delta.
    before = int(
        await fdata.db.scalar(
            select(func.count())
            .select_from(AuditEvent)
            .where(AuditEvent.action == AUDIT_COLLECTION_CONFIRM)
        )
    )
    shipment_id = await _make_shipment(fdata, seller_auth["seller_id"], user_id=seller_auth["user_id"])
    await fdata.collection(shipment_id, seller_auth["seller_id"], expected="100.00")
    await finance_client.post(
        f"/api/seller/finance/collections/{shipment_id}/confirm",
        json={"collectedAmount": "100.00"},
        cookies=seller_auth["cookie"],
    )

    count = await fdata.db.scalar(
        select(func.count()).select_from(AuditEvent).where(AuditEvent.action == AUDIT_COLLECTION_CONFIRM)
    )
    assert int(count) == before + 1
