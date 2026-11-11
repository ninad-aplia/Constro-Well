"""Seller adjustment and financial statement tests: compensating reversals,
statement arithmetic, legacy escrow coexistence, seller isolation, admin
authorization, and audit/rollback atomicity."""

from httpx import AsyncClient


async def test_adjustment_create_apply_reverse(fdata, finance_client: AsyncClient, admin_auth):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)

    # Seller records a customer refund (open).
    response = await finance_client.post(
        "/api/seller/finance/adjustments",
        json={"type": "customer_refund", "amount": "25.00", "reason": "Customer returned goods", "evidenceRef": "RET-1"},
        cookies={"cw_session": await fdata.session(seller_user)},
    )
    assert response.status_code == 200, response.text
    adjustment_id = response.json()["id"]
    assert response.json()["status"] == "open"

    # Admin applies it.
    applied = await finance_client.post(
        f"/api/admin/finance/adjustments/{adjustment_id}/apply", cookies=admin_auth["cookie"]
    )
    assert applied.status_code == 200
    assert applied.json()["status"] == "applied"

    # Admin reverses it (compensating record).
    reversal = await finance_client.post(
        f"/api/admin/finance/adjustments/{adjustment_id}/reverse",
        json={"reason": "Refund was mistaken"},
        cookies=admin_auth["cookie"],
    )
    assert reversal.status_code == 200, reversal.text
    assert reversal.json()["type"] == "reversal"
    assert reversal.json()["reversesId"] == adjustment_id


async def test_seller_cannot_create_admin_adjustment(fdata, finance_client: AsyncClient, seller_auth):
    response = await finance_client.post(
        "/api/seller/finance/adjustments",
        json={"type": "adjustment", "amount": "10.00", "reason": "Penalty"},
        cookies=seller_auth["cookie"],
    )
    assert response.status_code == 403


async def test_statement_arithmetic(fdata, finance_client: AsyncClient, seller_auth):
    seller_id = seller_auth["seller_id"]
    order_user = await fdata.user("customer")
    order_id = await fdata.order(order_user)

    # Collections.
    s1 = await fdata.shipment(order_id, seller_id)
    await fdata.collection(s1, seller_id, expected="100.00")  # pending
    s2 = await fdata.shipment(order_id, seller_id)
    await fdata.collection(s2, seller_id, expected="200.00", collected="200.00", status="confirmed")
    s3 = await fdata.shipment(order_id, seller_id)
    await fdata.collection(s3, seller_id, expected="300.00", collected="250.00", status="confirmed")  # discrepancy
    s4 = await fdata.shipment(order_id, seller_id)
    await fdata.collection(s4, seller_id, expected="400.00", status="cancelled")  # excluded

    # Assessments (waived excluded from assessed).
    a1 = await fdata.assessment(seller_id, s2, commission="10.00")
    await fdata.assessment(seller_id, s3, commission="20.00")
    await fdata.assessment(seller_id, s1, commission="30.00", status="waived")

    # Allocation of 10.00 against a1, from a received remittance of 100.00.
    remittance_id = await fdata.remittance(seller_id, amount="100.00", status="received")
    await fdata.allocation(remittance_id, a1, amount="10.00")

    # Applied customer refund of 5.00.
    await fdata.adjustment(seller_id, type_="customer_refund", amount="5.00", status="applied")

    # Legacy escrow.
    await fdata.escrow(seller_id, entry_type="held", amount="500.00")
    await fdata.escrow(seller_id, entry_type="released", amount="300.00")

    response = await finance_client.get("/api/seller/finance/statement", cookies=seller_auth["cookie"])
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["collections"]["expectedCod"] == "600.00"  # 100 + 200 + 300
    assert body["collections"]["confirmedCod"] == "450.00"  # 200 + 250
    assert body["collections"]["pendingCount"] == 1
    assert body["collections"]["confirmedCount"] == 2
    assert body["collections"]["discrepancyCount"] == 1
    assert body["collections"]["discrepancyAmount"] == "-50.00"  # 250 - 300

    assert body["commission"]["assessed"] == "30.00"  # 10 + 20 (waived 30 excluded)
    assert body["commission"]["remitted"] == "10.00"
    assert body["commission"]["outstanding"] == "20.00"  # 30 - 10 (refunds stay separate)

    assert body["remittances"]["received"] == "100.00"
    assert body["remittances"]["unallocated"] == "90.00"
    assert body["remittances"]["initiated"] == "0.00"

    assert body["adjustments"]["net"] == "-5.00"

    assert body["legacyEscrow"]["held"] == "500.00"
    assert body["legacyEscrow"]["released"] == "300.00"
    assert body["legacyEscrow"]["withdrawn"] == "0.00"


async def test_statement_seller_isolation(fdata, finance_client: AsyncClient, seller_auth):
    # A second seller with their own data.
    other_user = await fdata.user("seller")
    other_seller = await fdata.seller(other_user)
    order_user = await fdata.user("customer")
    order_id = await fdata.order(order_user)
    other_shipment = await fdata.shipment(order_id, other_seller)
    await fdata.collection(other_shipment, other_seller, expected="999.00")

    # The authenticated seller sees none of it.
    response = await finance_client.get("/api/seller/finance/statement", cookies=seller_auth["cookie"])
    assert response.status_code == 200
    assert response.json()["collections"]["expectedCod"] == "0.00"

    # ...and cannot read the other seller's collections list.
    collections = await finance_client.get("/api/seller/finance/collections", cookies=seller_auth["cookie"])
    assert collections.json()["collections"] == []


async def test_admin_endpoints_require_admin(fdata, finance_client: AsyncClient, seller_auth):
    # A seller cannot reach admin finance endpoints.
    response = await finance_client.get(
        "/api/admin/finance/collections/discrepancies", cookies=seller_auth["cookie"]
    )
    assert response.status_code == 403


async def test_admin_endpoints_require_auth(fdata, finance_client: AsyncClient):
    response = await finance_client.get("/api/admin/finance/collections/discrepancies")
    assert response.status_code == 401


async def test_failed_allocation_rolls_back(fdata, finance_client: AsyncClient, admin_auth):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    order_user = await fdata.user("customer")
    order_id = await fdata.order(order_user)
    shipment_id = await fdata.shipment(order_id, seller_id, status="review")
    await fdata.collection(shipment_id, seller_id, expected="100.00")
    assessment_id = await fdata.assessment(seller_id, shipment_id, commission="10.00")
    remittance_id = await fdata.remittance(seller_id, amount="5.00", status="received")

    # Commit the setup so the failed request's rollback only undoes that request.
    await fdata.db.commit()

    # This allocation exceeds the remittance, so it must fail and write nothing.
    response = await finance_client.post(
        f"/api/admin/finance/remittances/{remittance_id}/allocations",
        json={"assessmentId": assessment_id, "amount": "10.00"},
        cookies=admin_auth["cookie"],
    )
    assert response.status_code == 409

    allocations = await finance_client.get(
        f"/api/admin/finance/remittances/{remittance_id}/allocations", cookies=admin_auth["cookie"]
    )
    assert allocations.json() == []


async def test_admin_write_records_audit(fdata, finance_client: AsyncClient, admin_auth):
    from sqlalchemy import func, select

    from fastapi_app.models.audit import AuditEvent

    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    order_user = await fdata.user("customer")
    order_id = await fdata.order(order_user)
    shipment_id = await fdata.shipment(order_id, seller_id, status="review")
    await fdata.collection(shipment_id, seller_id, expected="100.00")
    await fdata.policy(basis="order_value", rate="0.050000")

    await finance_client.post(
        f"/api/admin/finance/assessments/{shipment_id}", cookies=admin_auth["cookie"]
    )
    count = await fdata.db.scalar(
        select(func.count()).select_from(AuditEvent).where(AuditEvent.action == "finance.commission.assess")
    )
    assert int(count) == 1


async def test_admin_list_endpoints_return_store_name(fdata, finance_client: AsyncClient, admin_auth):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    order_user = await fdata.user("customer")
    order_id = await fdata.order(order_user)
    shipment_id = await fdata.shipment(order_id, seller_id, status="review")
    await fdata.collection(shipment_id, seller_id, expected="100.00")
    await fdata.assessment(seller_id, shipment_id, commission="5.00")
    await fdata.remittance(seller_id, amount="100.00", status="initiated")
    await fdata.adjustment(seller_id, type_="customer_refund", amount="5.00", status="open")

    collections = await finance_client.get("/api/admin/finance/collections", cookies=admin_auth["cookie"])
    assert collections.status_code == 200
    assert collections.json()["collections"][0]["storeName"] == "Finance Test Store"

    remittances = await finance_client.get("/api/admin/finance/remittances", cookies=admin_auth["cookie"])
    assert remittances.status_code == 200
    assert remittances.json()["remittances"][0]["storeName"] == "Finance Test Store"

    assessments = await finance_client.get("/api/admin/finance/assessments", cookies=admin_auth["cookie"])
    assert assessments.status_code == 200
    assert assessments.json()["assessments"][0]["storeName"] == "Finance Test Store"

    adjustments = await finance_client.get("/api/admin/finance/adjustments", cookies=admin_auth["cookie"])
    assert adjustments.status_code == 200
    assert adjustments.json()["adjustments"][0]["storeName"] == "Finance Test Store"
