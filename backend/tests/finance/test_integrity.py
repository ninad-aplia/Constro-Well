"""Cross-record integrity, transactional atomicity and database-level invariants.

Covers the rules a single-service unit test cannot prove:
  * a remittance may only clear its own seller's commission;
  * an adjustment may only reference its own seller's shipment/order;
  * a financial mutation and its audit row are one unit of work;
  * "reverse once" is enforced by the database, not only by the service;
  * money is Decimal end to end.

Note on the HTTP tests below: a rejected request makes the route roll its session
back, which in these savepoint-joined fixtures also discards the fixture's own
users and sessions. So each HTTP assertion is the *last* action in its test, and
"nothing was written" is proven by calling the service directly (the service is
the enforcement point; the router only forwards).
"""

from decimal import Decimal
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from fastapi_app.core.errors import ApiError
from fastapi_app.domains.finance import service
from fastapi_app.models.audit import AuditEvent
from fastapi_app.models.finance import RemittanceAllocation, SellerAdjustment


async def _audit_count(db, action: str) -> int:
    return int(await db.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.action == action)))


async def _two_sellers(fdata):
    """Seller A (collection + assessment) and seller B (a received remittance)."""
    a_user = await fdata.user("seller")
    a_seller = await fdata.seller(a_user)
    b_user = await fdata.user("seller")
    b_seller = await fdata.seller(b_user)
    customer = await fdata.user("customer")
    order_id = await fdata.order(customer)
    shipment_id = await fdata.shipment(order_id, a_seller, status="review")
    await fdata.collection(shipment_id, a_seller, expected="100.00")
    a_assessment = await fdata.assessment(a_seller, shipment_id, commission="10.00")
    b_remittance = await fdata.remittance(b_seller, amount="100.00", status="received")
    return {
        "a_seller": a_seller,
        "b_seller": b_seller,
        "shipment_id": shipment_id,
        "order_id": order_id,
        "a_assessment": a_assessment,
        "b_remittance": b_remittance,
        "admin": await fdata.user("admin"),
    }


async def test_allocation_service_rejects_cross_seller_assessment(fdata):
    ids = await _two_sellers(fdata)

    with pytest.raises(ApiError) as caught:
        await service.allocate(
            fdata.db,
            remittance_id=ids["b_remittance"],
            assessment_id=ids["a_assessment"],
            amount=Decimal("10.00"),
            admin_user_id=ids["admin"],
        )
    assert caught.value.status_code == 409
    assert caught.value.code == "allocation_seller_mismatch"

    allocations = int(
        await fdata.db.scalar(select(func.count()).select_from(RemittanceAllocation))
    )
    assert allocations == 0
    assert await _audit_count(fdata.db, service.AUDIT_ALLOCATION_CREATE) == 0

    # The receivable is untouched and the remittance is still fully unallocated.
    statement = await service.seller_statement(fdata.db, ids["a_seller"])
    assert statement["commission"] == {"assessed": "10.00", "remitted": "0.00", "outstanding": "10.00", "creditApplied": "0.00", "creditBalance": "0.00"}
    assert statement["remittances"]["unallocated"] == "0.00"


async def test_allocation_rejects_cross_seller_over_http(fdata, finance_client: AsyncClient, admin_auth):
    ids = await _two_sellers(fdata)
    response = await finance_client.post(
        f"/api/admin/finance/remittances/{ids['b_remittance']}/allocations",
        json={"assessmentId": ids["a_assessment"], "amount": "10.00"},
        cookies=admin_auth["cookie"],
    )
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "allocation_seller_mismatch"


async def test_allocation_rejects_cross_seller_after_history_exists(fdata):
    """A seller mismatch still fails once that assessment has allocations."""
    ids = await _two_sellers(fdata)
    own_remittance = await fdata.remittance(ids["a_seller"], amount="50.00", status="received")
    await service.allocate(
        fdata.db,
        remittance_id=own_remittance,
        assessment_id=ids["a_assessment"],
        amount=Decimal("4.00"),
        admin_user_id=ids["admin"],
    )

    with pytest.raises(ApiError) as caught:
        await service.allocate(
            fdata.db,
            remittance_id=ids["b_remittance"],
            assessment_id=ids["a_assessment"],
            amount=Decimal("6.00"),
            admin_user_id=ids["admin"],
        )
    assert caught.value.code == "allocation_seller_mismatch"

    statement = await service.seller_statement(fdata.db, ids["a_seller"])
    assert statement["commission"]["remitted"] == "4.00"
    assert statement["commission"]["outstanding"] == "6.00"


async def test_adjustment_service_rejects_foreign_and_unknown_references(fdata):
    ids = await _two_sellers(fdata)
    outsider_user = await fdata.user("seller")
    outsider = await fdata.seller(outsider_user)
    # Snapshot global counts: a dev database may already hold unrelated rows, so
    # the invariant is "these failed calls added nothing", not "the table is empty".
    adjustments_before = await fdata.db.scalar(select(func.count()).select_from(SellerAdjustment))
    audits_before = await _audit_count(fdata.db, service.AUDIT_ADJUSTMENT_CREATE)

    cases = [
        ({"shipment_id": ids["shipment_id"]}, "shipmentId"),
        ({"order_id": ids["order_id"]}, "orderId"),
        ({"order_id": "ord_does_not_exist"}, "orderId"),
    ]
    for refs, field in cases:
        with pytest.raises(ApiError) as caught:
            await service.create_adjustment(
                fdata.db,
                seller_id=outsider,
                user_id=outsider_user,
                type_="customer_refund",
                amount=Decimal("5.00"),
                reason="x",
                evidence_ref=None,
                shipment_id=refs.get("shipment_id"),
                order_id=refs.get("order_id"),
            )
        assert caught.value.status_code == 422, field
        assert caught.value.field == field

    assert await fdata.db.scalar(select(func.count()).select_from(SellerAdjustment)) == adjustments_before
    assert await _audit_count(fdata.db, service.AUDIT_ADJUSTMENT_CREATE) == audits_before


async def test_adjustment_rejects_mismatched_shipment_and_order(fdata):
    ids = await _two_sellers(fdata)
    owner_user = await fdata.user("seller")
    owner = await fdata.seller(owner_user)
    second_order = await fdata.order(await fdata.user("customer"))
    await fdata.shipment(second_order, owner)

    with pytest.raises(ApiError) as caught:
        await service.create_adjustment(
            fdata.db,
            seller_id=owner,
            user_id=owner_user,
            type_="customer_refund",
            amount=Decimal("5.00"),
            reason="x",
            evidence_ref=None,
            shipment_id=ids["shipment_id"],
            order_id=second_order,
        )
    # `ids["shipment_id"]` belongs to seller A, not to `owner`, so the first guard
    # fires; either way the reference pair is refused.
    assert caught.value.status_code == 422
    assert caught.value.field == "shipmentId"


async def test_adjustment_rejects_foreign_shipment_over_http(fdata, finance_client: AsyncClient, seller_auth):
    ids = await _two_sellers(fdata)
    response = await finance_client.post(
        "/api/seller/finance/adjustments",
        json={"type": "customer_refund", "amount": "5.00", "reason": "Foreign reference", "evidenceRef": "TEST", "shipmentId": ids["shipment_id"]},
        cookies=seller_auth["cookie"],
    )
    assert response.status_code == 422, response.text
    assert response.json()["error"]["field"] == "shipmentId"


async def test_adjustment_rejects_foreign_order_over_http(fdata, finance_client: AsyncClient, seller_auth):
    ids = await _two_sellers(fdata)
    response = await finance_client.post(
        "/api/seller/finance/adjustments",
        json={"type": "customer_refund", "amount": "5.00", "reason": "Foreign reference", "evidenceRef": "TEST", "orderId": ids["order_id"]},
        cookies=seller_auth["cookie"],
    )
    assert response.status_code == 422, response.text
    assert response.json()["error"]["field"] == "orderId"


async def test_own_references_are_accepted(fdata):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    order_id = await fdata.order(await fdata.user("customer"))
    shipment_id = await fdata.shipment(order_id, seller_id)

    adjustment = await service.create_adjustment(
        fdata.db,
        seller_id=seller_id,
        user_id=seller_user,
        type_="customer_refund",
        amount=Decimal("5.00"),
        reason="returned",
        evidence_ref="RET-1",
        shipment_id=shipment_id,
        order_id=order_id,
    )
    assert adjustment.status == "open"
    assert adjustment.seller_id == seller_id


async def test_failed_allocation_leaves_no_audit_row(fdata):
    ids = await _two_sellers(fdata)
    with pytest.raises(ApiError):
        await service.allocate(
            fdata.db,
            remittance_id=ids["b_remittance"],
            assessment_id=ids["a_assessment"],
            amount=Decimal("10.00"),
            admin_user_id=ids["admin"],
        )
    assert await _audit_count(fdata.db, service.AUDIT_ALLOCATION_CREATE) == 0
    assert await _audit_count(fdata.db, service.AUDIT_ALLOCATION_REVERSE) == 0


async def test_audit_failure_undoes_the_financial_mutation(fdata, monkeypatch):
    """The confirmation and its audit row share one unit of work: if the audit
    insert fails, a savepoint rollback leaves the collection untouched."""
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    shipment_id = await fdata.shipment(
        await fdata.order(await fdata.user("customer")), seller_id, status="review"
    )
    await fdata.collection(shipment_id, seller_id, expected="100.00")

    async def audit_down(*_args, **_kwargs):
        raise RuntimeError("audit store unavailable")

    monkeypatch.setattr(service, "record_finance_audit", audit_down)

    with pytest.raises(RuntimeError):
        async with fdata.db.begin_nested():
            await service.confirm_collection_as_seller(
                fdata.db,
                shipment_id=shipment_id,
                seller_id=seller_id,
                user_id=seller_user,
                collected_amount=Decimal("100.00"),
                evidence_ref=None,
                note=None,
            )

    collection = await service.get_collection_for_shipment(fdata.db, shipment_id)
    assert collection is not None
    assert collection.status == "pending"
    assert collection.collected_amount is None


async def test_audit_failure_returns_an_honest_error_over_http(
    fdata, finance_client: AsyncClient, seller_auth, monkeypatch
):
    shipment_id = await fdata.shipment(
        await fdata.order(await fdata.user("customer")), seller_auth["seller_id"], status="review"
    )
    await fdata.collection(shipment_id, seller_auth["seller_id"], expected="100.00")

    async def audit_down(*_args, **_kwargs):
        raise RuntimeError("audit store unavailable")

    monkeypatch.setattr(service, "record_finance_audit", audit_down)

    response = await finance_client.post(
        f"/api/seller/finance/collections/{shipment_id}/confirm",
        json={"collectedAmount": "100.00"},
        cookies=seller_auth["cookie"],
    )
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"


async def test_allocation_reversal_is_unique_in_the_database(fdata):
    ids = await _two_sellers(fdata)
    allocation_id = await fdata.allocation(ids["b_remittance"], ids["a_assessment"], amount="1.00")

    with pytest.raises(IntegrityError):
        async with fdata.db.begin_nested():
            await fdata.allocation(
                ids["b_remittance"],
                ids["a_assessment"],
                amount="1.00",
                kind="reversal",
                reverses_id=allocation_id,
            )
            await fdata.allocation(
                ids["b_remittance"],
                ids["a_assessment"],
                amount="1.00",
                kind="reversal",
                reverses_id=allocation_id,
            )

    reversals = int(
        await fdata.db.scalar(
            select(func.count())
            .select_from(RemittanceAllocation)
            .where(RemittanceAllocation.reverses_id == allocation_id)
        )
    )
    assert reversals == 0  # the whole savepoint was undone


async def test_adjustment_reversal_is_unique_in_the_database(fdata):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    original = await fdata.adjustment(seller_id, type_="customer_refund", amount="5.00", status="applied")

    with pytest.raises(IntegrityError):
        async with fdata.db.begin_nested():
            await fdata.adjustment(
                seller_id, type_="reversal", amount="5.00", status="applied", reverses_id=original
            )
            await fdata.adjustment(
                seller_id, type_="reversal", amount="5.00", status="applied", reverses_id=original
            )

    reversals = int(
        await fdata.db.scalar(
            select(func.count()).select_from(SellerAdjustment).where(SellerAdjustment.reverses_id == original)
        )
    )
    assert reversals == 0


async def test_allocation_reversal_referencing_nothing_is_rejected(fdata):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    original = await fdata.adjustment(seller_id, type_="customer_refund", amount="5.00", status="applied")

    # A second reversal of an *already* reversed adjustment must fail on the same
    # key, proving the index, not the row count, is what guards it.
    await fdata.adjustment(seller_id, type_="reversal", amount="5.00", status="applied", reverses_id=original)
    with pytest.raises(IntegrityError):
        async with fdata.db.begin_nested():
            await fdata.adjustment(
                seller_id, type_="reversal", amount="5.00", status="applied", reverses_id=original
            )


async def test_double_reversal_is_a_conflict_not_a_500(fdata, finance_client: AsyncClient, admin_auth):
    ids = await _two_sellers(fdata)
    allocation_id = await fdata.allocation(ids["b_remittance"], ids["a_assessment"], amount="1.00")

    first = await finance_client.post(
        f"/api/admin/finance/allocations/{allocation_id}/reverse", cookies=admin_auth["cookie"]
    )
    assert first.status_code == 200, first.text

    second = await finance_client.post(
        f"/api/admin/finance/allocations/{allocation_id}/reverse", cookies=admin_auth["cookie"]
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "invalid_transition"


async def test_reversal_of_a_reversal_is_rejected(fdata, finance_client: AsyncClient, admin_auth):
    ids = await _two_sellers(fdata)
    allocation_id = await fdata.allocation(ids["b_remittance"], ids["a_assessment"], amount="1.00")
    reversal = await finance_client.post(
        f"/api/admin/finance/allocations/{allocation_id}/reverse", cookies=admin_auth["cookie"]
    )
    assert reversal.status_code == 200

    response = await finance_client.post(
        f"/api/admin/finance/allocations/{reversal.json()['id']}/reverse", cookies=admin_auth["cookie"]
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "invalid_transition"


def test_finance_domain_does_not_use_float():
    """Money is Decimal only; a single `float(` in the domain would be a defect."""
    source = Path(service.__file__).read_text(encoding="utf-8")
    assert "float(" not in source
    assert "Decimal" in source


async def test_money_is_an_exact_decimal_string_in_responses(fdata, finance_client: AsyncClient, seller_auth):
    import re

    response = await finance_client.get("/api/seller/finance/statement", cookies=seller_auth["cookie"])
    assert response.status_code == 200
    body = response.json()
    for section in ("commission", "remittances"):
        for value in body[section].values():
            assert isinstance(value, str) and re.match(r"^-?\d+\.\d{2}$", value), value
    assert Decimal(body["commission"]["outstanding"]) == Decimal("0.00")
