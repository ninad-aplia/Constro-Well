"""Authentication read-side endpoints.

Only `GET /api/auth/me` is migrated in this task. Login, registration, logout
and password flows remain owned by Next.js until the write-side migration.
"""

from fastapi import APIRouter, Depends

from fastapi_app.core.security import require_user
from fastapi_app.models.identity import User
from fastapi_app.schemas.auth import MeResponse, PublicUser

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=MeResponse, summary="Current session user")
async def me(user: User = Depends(require_user)) -> MeResponse:
    return MeResponse(
        user=PublicUser(
            id=user.id,
            email=user.email,
            name=user.name,
            phone=user.phone,
            role=user.role,
        )
    )
