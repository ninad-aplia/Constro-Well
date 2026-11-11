"""Session cookie, token hashing, password verification and role dependencies.

This is a direct port of `app/src/server/auth/session.ts` + `current.ts`: the
same `cw_session` opaque token, the same SHA-256 token digest, the same Session
table, bcrypt hashes verified as-is, and no sliding expiration. FastAPI never
issues or revokes sessions in this task — login/logout stay in Next.js.
"""

import hashlib
from datetime import datetime, timezone

import bcrypt
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from fastapi_app.core.db import get_db
from fastapi_app.core.errors import ApiError
from fastapi_app.models.identity import Session, User
from fastapi_app.models.seller import Driver, Seller

SESSION_COOKIE = "cw_session"
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

ROLES = ("customer", "seller", "driver", "admin")


def hash_session_token(token: str) -> str:
    """Same digest as Node's `createHash("sha256").update(token).digest("hex")`."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    """Prisma stores `timestamp(3)` (no tz); its values are UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def session_is_active(expires_at: datetime, now: datetime | None = None) -> bool:
    """Strictly future expiry, matching `isSessionActive` (no renewal)."""
    reference = now or datetime.now(timezone.utc)
    return _as_utc(expires_at) > _as_utc(reference)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a bcrypt digest produced by either bcryptjs or Python bcrypt."""
    if not password or not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed/foreign hash format: fail closed rather than raising.
        return False


def get_session_token(request: Request) -> str | None:
    return request.cookies.get(SESSION_COOKIE)


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    token = get_session_token(request)
    if not token:
        return None

    result = await db.execute(
        select(Session)
        .where(Session.token_hash == hash_session_token(token))
        .options(joinedload(Session.user))
    )
    session = result.scalar_one_or_none()
    if session is None or not session_is_active(session.expires_at):
        return None
    return session.user


async def require_user(user: User | None = Depends(get_current_user)) -> User:
    if user is None:
        raise ApiError(401, "unauthenticated", "Sign in to continue")
    return user


def require_role(*roles: str):
    """Mirrors `requireRole(...roles)`; the role column is authoritative."""

    async def dependency(user: User = Depends(require_user)) -> User:
        if user.role not in roles:
            raise ApiError(403, "forbidden", "You do not have permission to perform this action")
        return user

    return dependency


require_customer = require_role("customer")
require_admin = require_role("admin")


async def require_seller(
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> tuple[User, Seller]:
    if user.role != "seller":
        raise ApiError(403, "seller_profile_missing", "No seller profile is linked to this account")
    seller = await db.scalar(select(Seller).where(Seller.owner_user_id == user.id))
    if seller is None:
        raise ApiError(403, "seller_profile_missing", "No seller profile is linked to this account")
    return user, seller


async def require_driver(
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> tuple[User, Driver]:
    if user.role != "driver":
        raise ApiError(403, "driver_profile_missing", "No driver profile is linked to this account")
    driver = await db.scalar(select(Driver).where(Driver.user_id == user.id))
    if driver is None:
        raise ApiError(403, "driver_profile_missing", "No driver profile is linked to this account")
    return user, driver
