"""Read-only SQLAlchemy mappings for the existing Prisma identity tables.

Column names are the quoted camelCase fields Prisma created; table names are the
Prisma model names verbatim. These mappings never create or migrate schema —
Prisma remains the sole migration authority. Only the columns needed by the
authentication path are mapped; expand them when a task needs more.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    email: Mapped[str] = mapped_column(Text)
    # bcrypt digest. Never included in any response or log line.
    password_hash: Mapped[str] = mapped_column("passwordHash", Text)
    # PostgreSQL enum (Role). Read as text; never written by this service yet.
    role: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime)


class Session(Base):
    __tablename__ = "Session"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        "userId", Text, ForeignKey("User.id", ondelete="CASCADE")
    )
    # SHA-256 hex digest of the opaque cookie token; the token itself is never stored.
    token_hash: Mapped[str] = mapped_column("tokenHash", Text)
    expires_at: Mapped[datetime] = mapped_column("expiresAt", DateTime)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)

    user: Mapped[User] = relationship()
