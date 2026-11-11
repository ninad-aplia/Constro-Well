"""Genuine concurrency test: two allocations racing for the same remittance
must not over-allocate.

This test uses two real database connections (the `finance_db` outer-transaction
fixture serializes savepoints and cannot exercise cross-connection locking). It
commits a small setup, races two `allocate` calls with `asyncio.gather`, and
cleans up every row it created (the append-only audit rows are removed during
teardown by temporarily disabling the trigger, which is re-enabled immediately).
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


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _setup():
    """Committed baseline: admin, seller, order, 2 shipments/assessments, one
    received remittance of 100.00. Returns (admin_id, seller_id, a1, a2, remittance)."""
    admin_id = _id("cadmin")
    seller_user = _id("cuser")
    seller_id = _id("cseller")
    order_id = _id("corder")
    ship1, ship2 = _id("cship"), _id("cship")
    a1, a2 = _id("cassess"), _id("cassess")
    remittance = _id("cremit")
    now = _now()

    session = get_session_factory()()
    try:
        for uid, role, name in ((admin_id, "admin", "Concurrency Admin"), (seller_user, "seller", "Concurrency Seller")):
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
            {"id": seller_id, "code": f"c-{seller_id[-8:]}", "owner": seller_user, "gstin": f"CG{_id('')[-10:].upper()}", "now": now},
        )
        await session.execute(
            text(
                'INSERT INTO "Order" (id, code, "userId", "itemValue", "deliveryFee", "grossTotal", '
                'stage, cancelled, "addressSnapshot", "financeModel", "createdAt", "updatedAt") '
                "VALUES (:id, :code, :user, 100, 0, 100, 'ordered'::\"OrderStage\", false, '{}'::jsonb, "
                'CAST(\'seller_collected\' AS "FinanceModel"), :now, :now)'
            ),
            {"id": order_id, "code": "BG-CONC", "user": seller_user, "now": now},
        )
        for ship in (ship1, ship2):
            await session.execute(
                text(
                    'INSERT INTO "Shipment" (id, code, "orderId", "sellerId", status) '
                    "VALUES (:id, :code, :order, :seller, 'review'::\"ShipmentStatus\")"
                ),
                {"id": ship, "code": f"BG-{ship[-6:].upper()}", "order": order_id, "seller": seller_id},
            )
        await session.execute(
            text(
                'INSERT INTO "CodCollection" (id, "shipmentId", "sellerId", "expectedAmount", status, "createdAt", "updatedAt") '
                "VALUES (:id, :ship, :seller, 100, 'pending'::\"CodCollectionStatus\", :now, :now)"
            ),
            {"id": _id("ccol"), "ship": ship1, "seller": seller_id, "now": now},
        )
        for aid, ship in ((a1, ship1), (a2, ship2)):
            await session.execute(
                text(
                    'INSERT INTO "CommissionAssessment" (id, "sellerId", "shipmentId", basis, "basisAmount", rate, '
                    '"commissionAmount", status, "assessedAt", "createdAt", "updatedAt") '
                    "VALUES (:id, :seller, :ship, 'order_value'::\"CommissionBasis\", 100, 0.050000, 100, "
                    "'assessed'::\"CommissionStatus\", :now, :now, :now)"
                ),
                {"id": aid, "seller": seller_id, "ship": ship, "now": now},
            )
        await session.execute(
            text(
                'INSERT INTO "Remittance" (id, "sellerId", amount, method, reference, status, "initiatedAt", "createdAt", "updatedAt") '
                "VALUES (:id, :seller, 100, 'bank_transfer', :ref, 'received'::\"RemittanceStatus\", :now, :now, :now)"
            ),
            {"id": remittance, "seller": seller_id, "ref": f"UTR-{remittance[-8:]}", "now": now},
        )
        await session.commit()
        return admin_id, seller_id, seller_user, a1, a2, remittance
    finally:
        await session.close()


async def _cleanup(seller_id: str, seller_user: str, admin_id: str):
    session = get_session_factory()()
    try:
        await session.execute(
            text('DELETE FROM "RemittanceAllocation" WHERE "remittanceId" IN (SELECT id FROM "Remittance" WHERE "sellerId" = :s)'),
            {"s": seller_id},
        )
        await session.execute(text('DELETE FROM "Remittance" WHERE "sellerId" = :s'), {"s": seller_id})
        await session.execute(text('DELETE FROM "CommissionAssessment" WHERE "sellerId" = :s'), {"s": seller_id})
        await session.execute(text('DELETE FROM "CodCollection" WHERE "sellerId" = :s'), {"s": seller_id})
        await session.execute(text('DELETE FROM "Shipment" WHERE "sellerId" = :s'), {"s": seller_id})
        await session.execute(text('DELETE FROM "Order" WHERE "userId" = :u'), {"u": seller_user})
        await session.execute(text('DELETE FROM "Seller" WHERE id = :s'), {"s": seller_id})

        # Remove this test's append-only audit rows (and their actor) so the DB
        # stays clean; the trigger is re-enabled immediately. This is test-scoped
        # teardown, not an assertion of the append-only guarantee.
        await session.execute(text('ALTER TABLE "AuditEvent" DISABLE TRIGGER "AuditEvent_append_only"'))
        await session.execute(text('ALTER TABLE "AuditEvent" DISABLE TRIGGER "AuditEvent_no_truncate"'))
        await session.execute(text('DELETE FROM "AuditEvent" WHERE "actorUserId" = :a'), {"a": admin_id})
        await session.execute(text('DELETE FROM "User" WHERE id IN (:u, :a)'), {"u": seller_user, "a": admin_id})
        await session.execute(text('ALTER TABLE "AuditEvent" ENABLE TRIGGER "AuditEvent_append_only"'))
        await session.execute(text('ALTER TABLE "AuditEvent" ENABLE TRIGGER "AuditEvent_no_truncate"'))

        await session.commit()
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_concurrent_allocation_no_over_allocation():
    if get_settings().sqlalchemy_url is None:
        pytest.skip("DATABASE_URL is not configured")

    admin_id, seller_id, seller_user, a1, a2, remittance = await _setup()

    async def allocate_or_error(session, assessment_id):
        try:
            await service.allocate(
                session,
                remittance_id=remittance,
                assessment_id=assessment_id,
                amount=Decimal("100.00"),
                admin_user_id=admin_id,
            )
            await session.commit()
            return "ok"
        except ApiError as exc:
            await session.rollback()
            return exc.code

    s1 = get_session_factory()()
    s2 = get_session_factory()()
    try:
        r1, r2 = await asyncio.gather(
            allocate_or_error(s1, a1),
            allocate_or_error(s2, a2),
        )
    finally:
        await s1.close()
        await s2.close()

    assert sorted([r1, r2]) == ["allocation_exceeds_remittance", "ok"]

    await _cleanup(seller_id, seller_user, admin_id)
