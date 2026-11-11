"""Concurrency tests for finance state transitions (real, committed connections).

`tests/finance/conftest.py` joins one outer transaction, which serializes
savepoints and cannot exercise cross-connection locking. These tests commit a
small isolated baseline, race two service calls on two engine sessions, and
delete every row they created — including the append-only audit rows (the
triggers are disabled only for that cleanup and re-enabled immediately).
"""

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text

from fastapi_app.core.config import get_settings
from fastapi_app.core.db import get_session_factory
from fastapi_app.core.errors import ApiError
from fastapi_app.domains.finance import service


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Baseline:
    """Committed records for one test, plus the ids needed to remove them."""

    def __init__(
        self, seller_id: str, seller_user: str, admin_id: str, customer_id: str, policy_id: str | None
    ):
        self.seller_id = seller_id
        self.seller_user = seller_user
        self.admin_id = admin_id
        self.customer_id = customer_id
        self.policy_id = policy_id


async def _create_baseline(*, with_policy: bool = False) -> Baseline:
    admin_id = _id("cadmin")
    seller_user = _id("cuser")
    customer_id = _id("ccustomer")
    seller_id = _id("cseller")
    now = _now()
    policy_id = _id("cpol") if with_policy else None

    session = get_session_factory()()
    try:
        for uid, role, name in (
            (admin_id, "admin", "Concurrency Admin"),
            (seller_user, "seller", "Concurrency Seller"),
            (customer_id, "customer", "Concurrency Customer"),
        ):
            await session.execute(
                text(
                    'INSERT INTO "User" (id, email, "passwordHash", role, name, "createdAt", "updatedAt") '
                    'VALUES (:id, :email, :hash, CAST(:role AS "Role"), :name, :now, :now)'
                ),
                {"id": uid, "email": f"{uid}@finance.test", "hash": "x", "role": role, "name": name, "now": now},
            )
        await session.execute(
            text(
                'INSERT INTO "Seller" (id, code, "ownerUserId", "storeName", gstin, phone, city, '
                '"pickupAddress", "bankRef", "kycGst", "kycPan", "kycCheque", "vacationMode", "freeAbove", fee, "createdAt", "updatedAt") '
                "VALUES (:id, :code, :owner, 'C Store', :gstin, '9', 'Pune', 'P', 'B', "
                'CAST(\'verified\' AS "KycStatus"), CAST(\'pending\' AS "KycStatus"), CAST(\'pending\' AS "KycStatus"), '
                "false, 0, 0, :now, :now)"
            ),
            {
                "id": seller_id,
                "code": f"c-{seller_id[-8:]}",
                "owner": seller_user,
                "gstin": f"CG{_id('')[-10:].upper()}",
                "now": now,
            },
        )
        if policy_id is not None:
            await session.execute(
                text(
                    'INSERT INTO "CommissionPolicy" (id, basis, rate, "isActive", "effectiveFrom", "createdAt") '
                    'VALUES (:id, \'order_value\'::"CommissionBasis", 0.050000, true, :now, :now)'
                ),
                {"id": policy_id, "now": now},
            )
        await session.commit()
        return Baseline(seller_id, seller_user, admin_id, customer_id, policy_id)
    finally:
        await session.close()


async def _add_collection(
    seller_id: str, customer_id: str, *, status: str = "pending", collected: str | None = None
) -> str:
    """One order + shipment + COD collection; returns the shipment id."""
    order_id = _id("corder")
    shipment_id = _id("cship")
    now = _now()
    session = get_session_factory()()
    try:
        await session.execute(
            text(
                'INSERT INTO "Order" (id, code, "userId", "itemValue", "deliveryFee", "grossTotal", '
                'stage, cancelled, "addressSnapshot", "financeModel", "createdAt", "updatedAt") '
                "VALUES (:id, :code, :user, 100, 0, 100, 'ordered'::\"OrderStage\", false, '{}'::jsonb, "
                'CAST(\'seller_collected\' AS "FinanceModel"), :now, :now)'
            ),
            {"id": order_id, "code": "BG-" + str(uuid4())[:6].upper(), "user": customer_id, "now": now},
        )
        await session.execute(
            text(
                'INSERT INTO "Shipment" (id, code, "orderId", "sellerId", status) '
                "VALUES (:id, :code, :order, :seller, 'review'::\"ShipmentStatus\")"
            ),
            {"id": shipment_id, "code": "BG-" + str(uuid4())[:6].upper(), "order": order_id, "seller": seller_id},
        )
        await session.execute(
            text(
                'INSERT INTO "CodCollection" (id, "shipmentId", "sellerId", "expectedAmount", "collectedAmount", '
                'status, "confirmedAt", "createdAt", "updatedAt") '
                "VALUES (:id, :ship, :seller, 100, :collected, CAST(:status AS \"CodCollectionStatus\"), "
                ":confirmed, :now, :now)"
            ),
            {
                "id": _id("ccol"),
                "ship": shipment_id,
                "seller": seller_id,
                "collected": collected,
                "status": status,
                "confirmed": now if status == "confirmed" else None,
                "now": now,
            },
        )
        await session.commit()
        return shipment_id
    finally:
        await session.close()


async def _cleanup(baseline: Baseline) -> None:
    seller_id, seller_user, admin_id = baseline.seller_id, baseline.seller_user, baseline.admin_id
    customer_id = baseline.customer_id
    session = get_session_factory()()
    try:
        # Safe to re-run: teardown deletes by ownership, so a partially failed
        # earlier cleanup cannot leave an active policy behind.
        await session.execute(
            text('DELETE FROM "RemittanceAllocation" WHERE "remittanceId" IN (SELECT id FROM "Remittance" WHERE "sellerId" = :s) OR "assessmentId" IN (SELECT id FROM "CommissionAssessment" WHERE "sellerId" = :s)'),
            {"s": seller_id},
        )
        await session.execute(text('DELETE FROM "Remittance" WHERE "sellerId" = :s'), {"s": seller_id})
        await session.execute(text('DELETE FROM "CommissionAssessment" WHERE "sellerId" = :s'), {"s": seller_id})
        await session.execute(text('DELETE FROM "CodCollection" WHERE "sellerId" = :s'), {"s": seller_id})
        await session.execute(
            text('DELETE FROM "ShipmentEvent" WHERE "shipmentId" IN (SELECT id FROM "Shipment" WHERE "sellerId" = :s)'),
            {"s": seller_id},
        )
        # Shipments reference orders with ON DELETE RESTRICT, so capture the order
        # ids, drop the shipments, then the orders.
        order_ids = (
            await session.execute(
                text('SELECT "orderId" FROM "Shipment" WHERE "sellerId" = :s'), {"s": seller_id}
            )
        ).scalars().all()
        await session.execute(text('DELETE FROM "Shipment" WHERE "sellerId" = :s'), {"s": seller_id})
        if order_ids:
            await session.execute(
                text('DELETE FROM "Order" WHERE id = ANY(:ids)'), {"ids": list(order_ids)}
            )
        await session.execute(text('DELETE FROM "Seller" WHERE id = :s'), {"s": seller_id})
        if baseline.policy_id:
            await session.execute(text('DELETE FROM "CommissionPolicy" WHERE id = :p'), {"p": baseline.policy_id})

        await session.execute(text('ALTER TABLE "AuditEvent" DISABLE TRIGGER "AuditEvent_append_only"'))
        await session.execute(text('ALTER TABLE "AuditEvent" DISABLE TRIGGER "AuditEvent_no_truncate"'))
        await session.execute(
            text('DELETE FROM "AuditEvent" WHERE "actorUserId" IN (:u, :a)'), {"u": seller_user, "a": admin_id}
        )
        await session.execute(
            text('DELETE FROM "User" WHERE id IN (:u, :a, :c)'),
            {"u": seller_user, "a": admin_id, "c": customer_id},
        )
        await session.execute(text('ALTER TABLE "AuditEvent" ENABLE TRIGGER "AuditEvent_append_only"'))
        await session.execute(text('ALTER TABLE "AuditEvent" ENABLE TRIGGER "AuditEvent_no_truncate"'))
        await session.commit()
    finally:
        await session.close()


def _skip_if_unconfigured() -> None:
    if get_settings().sqlalchemy_url is None:
        pytest.skip("DATABASE_URL is not configured")


@pytest.mark.asyncio
async def test_concurrent_assessment_runs_do_not_duplicate():
    _skip_if_unconfigured()
    baseline = await _create_baseline(with_policy=True)
    shipments = [await _add_collection(baseline.seller_id, baseline.customer_id, status="confirmed", collected="100") for _ in range(4)]

    async def run_once():
        session = get_session_factory()()
        try:
            result = await service.run_commission_assessments(
                session, admin_user_id=baseline.admin_id, limit=100
            )
            await session.commit()
            return result["created"]
        finally:
            await session.close()

    try:
        first, second = await asyncio.gather(run_once(), run_once())
        assert first + second == len(shipments)

        session = get_session_factory()()
        try:
            rows = (
                await session.execute(
                    text('SELECT "shipmentId" FROM "CommissionAssessment" WHERE "sellerId" = :s'),
                    {"s": baseline.seller_id},
                )
            ).scalars().all()
        finally:
            await session.close()
        assert len(rows) == len(shipments)
        assert sorted(rows) == sorted(shipments)
    finally:
        await _cleanup(baseline)


@pytest.mark.asyncio
async def test_concurrent_reverse_of_one_allocation_succeeds_once():
    _skip_if_unconfigured()
    baseline = await _create_baseline()
    shipment_id = await _add_collection(baseline.seller_id, baseline.customer_id, status="confirmed", collected="100")

    session = get_session_factory()()
    try:
        now = _now()
        assessment_id = _id("cassess")
        remittance_id = _id("cremit")
        allocation_id = _id("calloc")
        await session.execute(
            text(
                'INSERT INTO "CommissionAssessment" (id, "sellerId", "shipmentId", basis, "basisAmount", rate, '
                '"commissionAmount", status, "assessedAt", "createdAt", "updatedAt") '
                "VALUES (:id, :seller, :ship, 'order_value'::\"CommissionBasis\", 100, 0.050000, 10, "
                "'assessed'::\"CommissionStatus\", :now, :now, :now)"
            ),
            {"id": assessment_id, "seller": baseline.seller_id, "ship": shipment_id, "now": now},
        )
        await session.execute(
            text(
                'INSERT INTO "Remittance" (id, "sellerId", amount, method, reference, status, "initiatedAt", "createdAt", "updatedAt") '
                "VALUES (:id, :seller, 100, 'bank_transfer', :ref, 'received'::\"RemittanceStatus\", :now, :now, :now)"
            ),
            {"id": remittance_id, "seller": baseline.seller_id, "ref": f"UTR-{remittance_id[-8:]}", "now": now},
        )
        await session.execute(
            text(
                'INSERT INTO "RemittanceAllocation" (id, "remittanceId", "assessmentId", amount, kind, "createdAt") '
                "VALUES (:id, :remit, :assess, 10, 'allocation'::\"RemittanceAllocationKind\", :now)"
            ),
            {"id": allocation_id, "remit": remittance_id, "assess": assessment_id, "now": now},
        )
        await session.commit()
    finally:
        await session.close()

    async def reverse_once():
        session = get_session_factory()()
        try:
            await service.reverse_allocation(
                session, allocation_id=allocation_id, admin_user_id=baseline.admin_id
            )
            await session.commit()
            return "ok"
        except ApiError as exc:
            await session.rollback()
            return exc.code
        finally:
            await session.close()

    try:
        results = await asyncio.gather(reverse_once(), reverse_once())
        assert sorted(results) == ["invalid_transition", "ok"]

        session = get_session_factory()()
        try:
            reversals = (
                await session.execute(
                    text(
                        'SELECT count(*) FROM "RemittanceAllocation" '
                        "WHERE \"reversesId\" = :a AND kind = 'reversal'"
                    ),
                    {"a": allocation_id},
                )
            ).scalar_one()
        finally:
            await session.close()
        assert int(reversals) == 1
    finally:
        await _cleanup(baseline)


@pytest.mark.asyncio
async def test_concurrent_confirm_of_one_collection_succeeds_once():
    _skip_if_unconfigured()
    baseline = await _create_baseline()
    shipment_id = await _add_collection(baseline.seller_id, baseline.customer_id)

    async def confirm_once():
        session = get_session_factory()()
        try:
            await service.confirm_collection_as_seller(
                session,
                shipment_id=shipment_id,
                seller_id=baseline.seller_id,
                user_id=baseline.seller_user,
                collected_amount=Decimal("100.00"),
                evidence_ref=None,
                note=None,
            )
            await session.commit()
            return "ok"
        except ApiError as exc:
            await session.rollback()
            return exc.code
        finally:
            await session.close()

    try:
        results = await asyncio.gather(confirm_once(), confirm_once())
        assert sorted(results) == ["invalid_transition", "ok"]

        session = get_session_factory()()
        try:
            row = (
                await session.execute(
                    text('SELECT status, "collectedAmount" FROM "CodCollection" WHERE "shipmentId" = :s'),
                    {"s": shipment_id},
                )
            ).one()
        finally:
            await session.close()
        assert row[0] == "confirmed"
        assert str(row[1]) == "100.00"
    finally:
        await _cleanup(baseline)
