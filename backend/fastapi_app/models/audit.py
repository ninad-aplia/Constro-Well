"""Read-only/write-only mapping for the existing append-only AuditEvent table.

The table and its triggers are created by Prisma migration
`20261110201000_add_audit_event`. This module adds no DDL and must never emit
UPDATE/DELETE — the database rejects both.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class AuditEvent(Base):
    __tablename__ = "AuditEvent"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    actor_user_id: Mapped[str] = mapped_column(
        "actorUserId",
        Text,
        ForeignKey("User.id", ondelete="RESTRICT", onupdate="RESTRICT"),
    )
    action: Mapped[str] = mapped_column(Text)
    target_type: Mapped[str] = mapped_column("targetType", Text)
    target_id: Mapped[str | None] = mapped_column("targetId", Text, nullable=True)
    # `metadata` is reserved on SQLAlchemy declarative classes; the column name is
    # still "metadata" in PostgreSQL.
    audit_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
