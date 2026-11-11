"""Isolated admin-test fixtures.

Every row is written inside one outer transaction and the session joins it with
savepoints, so the endpoint's `commit()` only releases a savepoint. The outer
rollback removes users, sessions and the (append-only) AuditEvent rows, leaving
the local database byte-identical after the suite. No triggers are disabled.
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


class AdminTestData:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def user(
        self,
        role: str = "customer",
        *,
        created_at: datetime | None = None,
        email: str | None = None,
        user_id: str | None = None,
    ) -> str:
        user_id = user_id or f"test_admin_{uuid4().hex}"
        email = email or f"{user_id}@admin.test"
        created = created_at or datetime.now(timezone.utc).replace(tzinfo=None)
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
                "name": f"Admin Test {role}",
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
                "id": f"test_admin_session_{uuid4().hex}",
                "user_id": user_id,
                "hash": hash_session_token(token),
                "expires": datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1),
            },
        )
        return token

    async def seller(
        self,
        owner_user_id: str,
        *,
        seller_id: str | None = None,
        store_name: str = "Admin Test Store",
        city: str = "Pune",
        created_at: datetime | None = None,
        kyc: tuple[str, str, str] = ("verified", "pending", "pending"),
        vacation_mode: bool = False,
    ) -> str:
        seller_id = seller_id or f"test_seller_{uuid4().hex}"
        created = created_at or datetime.now(timezone.utc).replace(tzinfo=None)
        await self.db.execute(
            text(
                'INSERT INTO "Seller" (id, code, "ownerUserId", "storeName", gstin, phone, city, '
                '"pickupAddress", "bankRef", "kycGst", "kycPan", "kycCheque", "vacationMode", '
                '"freeAbove", fee, "createdAt", "updatedAt") '
                "VALUES (:id, :code, :owner, :store, :gstin, :phone, :city, :pickup, :bank, "
                'CAST(:kyc_gst AS "KycStatus"), CAST(:kyc_pan AS "KycStatus"), CAST(:kyc_cheque AS "KycStatus"), '
                ":vacation, 0, 0, :created, :created)"
            ),
            {
                "id": seller_id,
                "code": f"test-{seller_id[-8:]}",
                "owner": owner_user_id,
                "store": store_name,
                "gstin": f"TESTS{seller_id[-10:].upper()}",
                "phone": "9000000000",
                "city": city,
                "pickup": "Sensitive pickup address",
                "bank": "SENSITIVE-BANK-REF",
                "kyc_gst": kyc[0],
                "kyc_pan": kyc[1],
                "kyc_cheque": kyc[2],
                "vacation": vacation_mode,
                "created": created,
            },
        )
        return seller_id

    async def order(
        self,
        user_id: str,
        *,
        order_id: str | None = None,
        created_at: datetime | None = None,
        gross_total: str = "100.00",
    ) -> str:
        order_id = order_id or f"test_order_{uuid4().hex}"
        created = created_at or datetime.now(timezone.utc).replace(tzinfo=None)
        await self.db.execute(
            text(
                'INSERT INTO "Order" (id, code, "userId", "itemValue", "deliveryFee", "grossTotal", '
                'stage, cancelled, "addressSnapshot", "createdAt", "updatedAt") '
                "VALUES (:id, :code, :user, 100, 0, :total, 'ordered'::\"OrderStage\", false, "
                'CAST(:address AS jsonb), :created, :created)'
            ),
            {
                "id": order_id,
                "code": "BG-" + str(uuid4())[:6].upper(),
                "user": user_id,
                "total": gross_total,
                "address": '{"name":"Sensitive Customer","line1":"Sensitive Street"}',
                "created": created,
            },
        )
        return order_id

    async def shipment(
        self,
        order_id: str,
        seller_id: str,
        *,
        shipment_id: str | None = None,
        status: str = "new",
    ) -> str:
        shipment_id = shipment_id or f"test_shipment_{uuid4().hex}"
        await self.db.execute(
            text(
                'INSERT INTO "Shipment" (id, code, "orderId", "sellerId", status) '
                'VALUES (:id, :code, :order, :seller, CAST(:status AS "ShipmentStatus"))'
            ),
            {
                "id": shipment_id,
                "code": "BG-" + str(uuid4())[:6].upper(),
                "order": order_id,
                "seller": seller_id,
                "status": status,
            },
        )
        return shipment_id

    async def line(
        self,
        order_id: str,
        seller_id: str,
        product_id: str,
        *,
        line_id: str | None = None,
        name: str = "Snapshot Product",
        unit: str = "50 kg bag",
        unit_price: str = "390.00",
        qty: int = 2,
        line_value: str = "780.00",
    ) -> str:
        line_id = line_id or f"test_line_{uuid4().hex}"
        await self.db.execute(
            text(
                'INSERT INTO "OrderLine" (id, "orderId", "productId", "sellerId", name, unit, '
                '"unitPrice", qty, "lineValue") '
                "VALUES (:id, :order, :product, :seller, :name, :unit, :price, :qty, :total)"
            ),
            {
                "id": line_id,
                "order": order_id,
                "product": product_id,
                "seller": seller_id,
                "name": name,
                "unit": unit,
                "price": unit_price,
                "qty": qty,
                "total": line_value,
            },
        )
        return line_id

    async def event(
        self,
        shipment_id: str,
        *,
        event_id: str | None = None,
        actor: str = "system",
        message: str = "Recorded event",
        at: datetime,
    ) -> str:
        event_id = event_id or f"test_event_{uuid4().hex}"
        await self.db.execute(
            text(
                'INSERT INTO "ShipmentEvent" (id, "shipmentId", actor, message, at) '
                'VALUES (:id, :shipment, CAST(:actor AS "ShipmentActor"), :message, :at)'
            ),
            {"id": event_id, "shipment": shipment_id, "actor": actor, "message": message, "at": at},
        )
        return event_id

    async def escrow(
        self,
        *,
        entry_id: str | None = None,
        order_id: str | None = None,
        shipment_id: str | None = None,
        seller_id: str | None = None,
        entry_type: str = "held",
        amount: str = "780.00",
        created_at: datetime | None = None,
    ) -> str:
        entry_id = entry_id or f"test_escrow_{uuid4().hex}"
        created = created_at or datetime.now(timezone.utc).replace(tzinfo=None)
        await self.db.execute(
            text(
                'INSERT INTO "EscrowEntry" (id, "orderId", "shipmentId", "sellerId", type, amount, note, "createdAt") '
                'VALUES (:id, :order, :shipment, :seller, CAST(:type AS "EscrowEntryType"), :amount, \'test\', :created)'
            ),
            {
                "id": entry_id,
                "order": order_id,
                "shipment": shipment_id,
                "seller": seller_id,
                "type": entry_type,
                "amount": amount,
                "created": created,
            },
        )
        return entry_id


@pytest.fixture
async def admin_db():
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
async def admin_data(admin_db: AsyncSession):
    return AdminTestData(admin_db)


@pytest.fixture
async def admin_client(admin_db: AsyncSession):
    async def override_get_db():
        yield admin_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_db, None)
