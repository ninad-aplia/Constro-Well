"""Isolated seller-collected COD finance-test fixtures.

Mirrors `tests/admin/conftest.py`: every row is written inside one outer
transaction and the session joins it with savepoints, so an endpoint's `commit()`
only releases a savepoint. The outer rollback removes users, sessions, finance
rows and (append-only) AuditEvent rows, leaving the local database byte-identical
after the suite. No triggers are disabled.
"""

import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi_app.core.db import get_db, get_engine
from fastapi_app.core.security import hash_session_token
from fastapi_app.main import app


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class FinanceTestData:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def user(self, role: str, *, email: str | None = None, user_id: str | None = None) -> str:
        user_id = user_id or _id("tuser")
        email = email or f"{user_id}@finance.test"
        created = _now()
        await self.db.execute(
            text(
                'INSERT INTO "User" (id, email, "passwordHash", role, name, phone, "createdAt", "updatedAt") '
                'VALUES (:id, :email, :hash, CAST(:role AS "Role"), :name, NULL, :created, :created)'
            ),
            {
                "id": user_id,
                "email": email,
                "hash": "$2b$12$wi1PjdyJ.pppWbuSsIPbAOyHx8bDqskMqrBAscIpXTziE36.k1qAq",
                "role": role,
                "name": f"Finance {role}",
                "created": created,
            },
        )
        return user_id

    async def session(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        await self.db.execute(
            text(
                'INSERT INTO "Session" (id, "userId", "tokenHash", "expiresAt", "createdAt") '
                "VALUES (:id, :user_id, :hash, :expires, now())"
            ),
            {
                "id": _id("tsess"),
                "user_id": user_id,
                "hash": hash_session_token(token),
                "expires": _now() + timedelta(hours=1),
            },
        )
        return token

    async def seller(self, owner_user_id: str, *, seller_id: str | None = None) -> str:
        seller_id = seller_id or _id("tseller")
        created = _now()
        await self.db.execute(
            text(
                'INSERT INTO "Seller" (id, code, "ownerUserId", "storeName", gstin, phone, city, '
                '"pickupAddress", "bankRef", "kycGst", "kycPan", "kycCheque", "vacationMode", '
                '"freeAbove", fee, "createdAt", "updatedAt") '
                "VALUES (:id, :code, :owner, :store, :gstin, :phone, :city, :pickup, :bank, "
                'CAST(\'verified\' AS "KycStatus"), CAST(\'pending\' AS "KycStatus"), CAST(\'pending\' AS "KycStatus"), '
                "false, 0, 0, :created, :created)"
            ),
            {
                "id": seller_id,
                "code": f"fin-{seller_id[-8:]}",
                "owner": owner_user_id,
                "store": "Finance Test Store",
                "gstin": f"FINS{seller_id[-10:].upper()}",
                "phone": "9000000000",
                "city": "Pune",
                "pickup": "Pickup",
                "bank": "BANK-REF",
                "created": created,
            },
        )
        return seller_id

    async def driver(self, seller_id: str, *, user_id: str | None = None, driver_id: str | None = None) -> str:
        driver_id = driver_id or _id("tdriver")
        await self.db.execute(
            text(
                'INSERT INTO "Driver" (id, "sellerId", code, name, phone, "userId") '
                "VALUES (:id, :seller, :code, :name, :phone, :user)"
            ),
            {"id": driver_id, "seller": seller_id, "code": f"d-{driver_id[-6:]}", "name": "Finance Driver", "phone": "9000000001", "user": user_id},
        )
        return driver_id

    async def order(self, user_id: str, *, order_id: str | None = None, finance_model: str = "seller_collected") -> str:
        order_id = order_id or _id("torder")
        created = _now()
        await self.db.execute(
            text(
                'INSERT INTO "Order" (id, code, "userId", "itemValue", "deliveryFee", "grossTotal", '
                'stage, cancelled, "addressSnapshot", "financeModel", "createdAt", "updatedAt") '
                "VALUES (:id, :code, :user, 100, 0, 100, 'ordered'::\"OrderStage\", false, "
                'CAST(:address AS jsonb), CAST(:model AS "FinanceModel"), :created, :created)'
            ),
            {
                "id": order_id,
                "code": "BG-" + str(uuid4())[:6].upper(),
                "user": user_id,
                "address": '{"name":"Customer","line1":"Street"}',
                "model": finance_model,
                "created": created,
            },
        )
        return order_id

    async def shipment(
        self, order_id: str, seller_id: str, *, shipment_id: str | None = None, status: str = "review", driver_id: str | None = None
    ) -> str:
        shipment_id = shipment_id or _id("tship")
        await self.db.execute(
            text(
                'INSERT INTO "Shipment" (id, code, "orderId", "sellerId", status, "driverId") '
                'VALUES (:id, :code, :order, :seller, CAST(:status AS "ShipmentStatus"), :driver)'
            ),
            {"id": shipment_id, "code": "BG-" + str(uuid4())[:6].upper(), "order": order_id, "seller": seller_id, "status": status, "driver": driver_id},
        )
        return shipment_id

    async def collection(
        self,
        shipment_id: str,
        seller_id: str,
        *,
        expected: str = "100.00",
        collected: str | None = None,
        status: str = "pending",
        collected_by: str | None = None,
        collector_user_id: str | None = None,
        collection_id: str | None = None,
    ) -> str:
        collection_id = collection_id or _id("tcol")
        now = _now()
        await self.db.execute(
            text(
                'INSERT INTO "CodCollection" (id, "shipmentId", "sellerId", "expectedAmount", '
                '"collectedAmount", "collectedBy", "collectorUserId", status, "evidenceRef", "note", "confirmedAt", "createdAt", "updatedAt") '
                "VALUES (:id, :shipment, :seller, :expected, :collected, :by, :collector, "
                'CAST(:status AS "CodCollectionStatus"), NULL, NULL, :confirmed, :now, :now)'
            ),
            {
                "id": collection_id,
                "shipment": shipment_id,
                "seller": seller_id,
                "expected": expected,
                "collected": collected,
                "by": collected_by,
                "collector": collector_user_id,
                "status": status,
                "confirmed": now if status == "confirmed" else None,
                "now": now,
            },
        )
        return collection_id

    async def policy(self, *, basis: str = "order_value", rate: str = "0.050000", policy_id: str | None = None) -> str:
        policy_id = policy_id or _id("tpol")
        now = _now()
        await self.db.execute(
            text(
                'INSERT INTO "CommissionPolicy" (id, basis, rate, "isActive", "effectiveFrom", "createdAt") '
                "VALUES (:id, CAST(:basis AS \"CommissionBasis\"), :rate, true, :now, :now)"
            ),
            {"id": policy_id, "basis": basis, "rate": rate, "now": now},
        )
        return policy_id

    async def assessment(
        self,
        seller_id: str,
        shipment_id: str,
        *,
        commission: str = "5.00",
        basis: str = "order_value",
        basis_amount: str = "100.00",
        rate: str = "0.050000",
        status: str = "assessed",
        assessment_id: str | None = None,
    ) -> str:
        assessment_id = assessment_id or _id("tassess")
        now = _now()
        await self.db.execute(
            text(
                'INSERT INTO "CommissionAssessment" (id, "sellerId", "shipmentId", basis, "basisAmount", rate, '
                '"commissionAmount", status, "assessedAt", "createdAt", "updatedAt") '
                "VALUES (:id, :seller, :shipment, CAST(:basis AS \"CommissionBasis\"), :basis_amount, :rate, "
                ":commission, CAST(:status AS \"CommissionStatus\"), :now, :now, :now)"
            ),
            {
                "id": assessment_id,
                "seller": seller_id,
                "shipment": shipment_id,
                "basis": basis,
                "basis_amount": basis_amount,
                "rate": rate,
                "commission": commission,
                "status": status,
                "now": now,
            },
        )
        return assessment_id

    async def remittance(
        self,
        seller_id: str,
        *,
        amount: str = "100.00",
        method: str = "bank_transfer",
        reference: str | None = None,
        status: str = "initiated",
        remittance_id: str | None = None,
    ) -> str:
        remittance_id = remittance_id or _id("tremit")
        reference = reference or f"UTR-{remittance_id[-8:]}"
        now = _now()
        await self.db.execute(
            text(
                'INSERT INTO "Remittance" (id, "sellerId", amount, method, reference, status, '
                '"initiatedAt", "createdAt", "updatedAt") '
                "VALUES (:id, :seller, :amount, :method, :reference, CAST(:status AS \"RemittanceStatus\"), :now, :now, :now)"
            ),
            {"id": remittance_id, "seller": seller_id, "amount": amount, "method": method, "reference": reference, "status": status, "now": now},
        )
        return remittance_id

    async def escrow(
        self,
        seller_id: str,
        *,
        entry_type: str = "held",
        amount: str = "100.00",
        shipment_id: str | None = None,
        order_id: str | None = None,
    ) -> str:
        entry_id = _id("tescrow")
        await self.db.execute(
            text(
                'INSERT INTO "EscrowEntry" (id, "orderId", "shipmentId", "sellerId", type, amount, note, "createdAt") '
                "VALUES (:id, :order, :shipment, :seller, CAST(:type AS \"EscrowEntryType\"), :amount, 'legacy', now())"
            ),
            {"id": entry_id, "order": order_id, "shipment": shipment_id, "seller": seller_id, "type": entry_type, "amount": amount},
        )
        return entry_id

    async def allocation(
        self,
        remittance_id: str,
        assessment_id: str,
        *,
        amount: str = "10.00",
        kind: str = "allocation",
        reverses_id: str | None = None,
    ) -> str:
        allocation_id = _id("talloc")
        await self.db.execute(
            text(
                'INSERT INTO "RemittanceAllocation" (id, "remittanceId", "assessmentId", amount, kind, "reversesId", "createdAt") '
                "VALUES (:id, :remittance, :assessment, :amount, CAST(:kind AS \"RemittanceAllocationKind\"), :reverses, now())"
            ),
            {
                "id": allocation_id,
                "remittance": remittance_id,
                "assessment": assessment_id,
                "amount": amount,
                "kind": kind,
                "reverses": reverses_id,
            },
        )
        return allocation_id

    async def adjustment(
        self,
        seller_id: str,
        *,
        type_: str = "customer_refund",
        amount: str = "5.00",
        reason: str = "test",
        status: str = "applied",
        reverses_id: str | None = None,
        shipment_id: str | None = None,
    ) -> str:
        adjustment_id = _id("tadj")
        now = _now()
        await self.db.execute(
            text(
                'INSERT INTO "SellerAdjustment" (id, "sellerId", "shipmentId", type, amount, reason, status, "reversesId", "appliedAt", "createdAt", "updatedAt") '
                "VALUES (:id, :seller, :shipment, CAST(:type AS \"SellerAdjustmentType\"), :amount, :reason, "
                "CAST(:status AS \"SellerAdjustmentStatus\"), :reverses, :applied, :now, :now)"
            ),
            {
                "id": adjustment_id,
                "seller": seller_id,
                "shipment": shipment_id,
                "type": type_,
                "amount": amount,
                "reason": reason,
                "status": status,
                "reverses": reverses_id,
                "applied": now if status == "applied" else None,
                "now": now,
            },
        )
        return adjustment_id


@pytest.fixture
async def finance_db():
    async with get_engine().connect() as connection:
        outer = await connection.begin()
        session = AsyncSession(
            bind=connection,
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        )
        try:
            yield session
        finally:
            await session.close()
            await outer.rollback()


@pytest.fixture
async def fdata(finance_db: AsyncSession):
    return FinanceTestData(finance_db)


@pytest.fixture
async def finance_client(finance_db: AsyncSession):
    async def override_get_db():
        yield finance_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
async def seller_auth(fdata: FinanceTestData):
    """A seller user + profile + session cookie, plus the associated ids."""
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    token = await fdata.session(seller_user)
    return {"user_id": seller_user, "seller_id": seller_id, "cookie": {"cw_session": token}}


@pytest.fixture
async def admin_auth(fdata: FinanceTestData):
    admin_user = await fdata.user("admin")
    token = await fdata.session(admin_user)
    return {"user_id": admin_user, "cookie": {"cw_session": token}}


@pytest.fixture
async def driver_auth(fdata: FinanceTestData):
    driver_user = await fdata.user("driver")
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    driver_id = await fdata.driver(seller_id, user_id=driver_user)
    token = await fdata.session(driver_user)
    return {"user_id": driver_user, "seller_id": seller_id, "driver_id": driver_id, "cookie": {"cw_session": token}}
