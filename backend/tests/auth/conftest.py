"""Disposable identity fixtures.

Rows are created with unique ids/emails and removed in teardown — real user
accounts and sessions are never touched. Every test that uses these fixtures
requires the local PostgreSQL from `DATABASE_URL`.
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi_app.core.config import get_settings
from fastapi_app.core.db import get_session_factory
from fastapi_app.core.security import hash_session_token


def _id(prefix: str) -> str:
    return f"test_{prefix}_{uuid.uuid4().hex}"


class IdentityFactory:
    def __init__(self, session: AsyncSession):
        self.db = session
        self.user_ids: list[str] = []
        self.seller_ids: list[str] = []
        self.driver_ids: list[str] = []
        self.session_ids: list[str] = []

    async def user(self, role: str = "customer", email: str | None = None) -> tuple[str, str]:
        user_id = _id("user")
        email = email or f"{user_id}@auth.test"
        await self.db.execute(
            text(
                'INSERT INTO "User" (id, email, "passwordHash", role, name, phone, "createdAt", "updatedAt") '
                'VALUES (:id, :email, :hash, CAST(:role AS "Role"), :name, NULL, now(), now())'
            ),
            {
                "id": user_id,
                "email": email,
                # A fixed bcrypt digest of "constrowell-demo" (cost 12, bcryptjs).
                "hash": "$2b$12$wi1PjdyJ.pppWbuSsIPbAOyHx8bDqskMqrBAscIpXTziE36.k1qAq",
                "role": role,
                "name": f"Auth Test {role}",
            },
        )
        self.user_ids.append(user_id)
        await self.db.commit()
        return user_id, email

    async def session(
        self,
        user_id: str,
        *,
        token: str | None = None,
        expires_in: timedelta = timedelta(days=1),
    ) -> tuple[str, str]:
        token = token or secrets.token_urlsafe(32)
        session_id = _id("session")
        expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + expires_in
        await self.db.execute(
            text(
                'INSERT INTO "Session" (id, "userId", "tokenHash", "expiresAt", "createdAt") '
                "VALUES (:id, :user_id, :token_hash, :expires_at, now())"
            ),
            {
                "id": session_id,
                "user_id": user_id,
                "token_hash": hash_session_token(token),
                "expires_at": expires_at,
            },
        )
        self.session_ids.append(session_id)
        await self.db.commit()
        return token, session_id

    async def seller(self, owner_user_id: str, city: str = "Pune") -> str:
        seller_id = _id("seller")
        await self.db.execute(
            text(
                'INSERT INTO "Seller" (id, code, "ownerUserId", "storeName", gstin, phone, city, '
                '"pickupAddress", "bankRef", "kycGst", "kycPan", "kycCheque", "vacationMode", '
                '"freeAbove", fee, "createdAt", "updatedAt") '
                'VALUES (:id, :code, :owner, :store, :gstin, :phone, :city, :pickup, :bank, '
                'CAST(:kyc AS "KycStatus"), CAST(:kyc AS "KycStatus"), CAST(:kyc AS "KycStatus"), false, '
                '0, 0, now(), now())'
            ),
            {
                "id": seller_id,
                "code": f"test-{seller_id[-8:]}",
                "owner": owner_user_id,
                "store": "Auth Test Store",
                "gstin": f"TEST{seller_id[-10:].upper()}",
                "phone": "9000000000",
                "city": city,
                "pickup": "Test pickup address",
                "bank": "TESTBANK",
                "kyc": "verified",
            },
        )
        self.seller_ids.append(seller_id)
        await self.db.commit()
        return seller_id

    async def driver(self, seller_id: str, user_id: str) -> str:
        driver_id = _id("driver")
        await self.db.execute(
            text(
                'INSERT INTO "Driver" (id, "sellerId", code, name, phone, "userId") '
                "VALUES (:id, :seller_id, :code, :name, :phone, :user_id)"
            ),
            {
                "id": driver_id,
                "seller_id": seller_id,
                "code": f"test-d-{driver_id[-6:]}",
                "name": "Auth Test Driver",
                "phone": "9000000001",
                "user_id": user_id,
            },
        )
        self.driver_ids.append(driver_id)
        await self.db.commit()
        return driver_id

    async def cleanup(self) -> None:
        for driver_id in self.driver_ids:
            await self.db.execute(text('DELETE FROM "Driver" WHERE id = :id'), {"id": driver_id})
        for seller_id in self.seller_ids:
            await self.db.execute(text('DELETE FROM "Seller" WHERE id = :id'), {"id": seller_id})
        for session_id in self.session_ids:
            await self.db.execute(text('DELETE FROM "Session" WHERE id = :id'), {"id": session_id})
        for user_id in self.user_ids:
            await self.db.execute(text('DELETE FROM "User" WHERE id = :id'), {"id": user_id})
        await self.db.commit()


@pytest.fixture
async def identities(db):
    factory = IdentityFactory(db)
    yield factory
    await factory.cleanup()



