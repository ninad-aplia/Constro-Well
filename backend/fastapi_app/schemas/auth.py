"""Pydantic response schemas for the authentication API."""

from typing import Literal

from pydantic import BaseModel

Role = Literal["customer", "seller", "driver", "admin"]


class PublicUser(BaseModel):
    """Exactly the shape the existing Next.js `/api/auth/me` returns."""

    id: str
    email: str
    name: str
    phone: str | None
    role: Role


class MeResponse(BaseModel):
    user: PublicUser
