"""SQLAlchemy mappings for the seller-collected COD finance tables.

These tables are created by Prisma migration
`20261110222135_add_seller_collected_cod_finance`. This module adds no DDL —
Prisma remains the sole migration authority. Every money column is
`Numeric(14, 2)` and every rate is `Numeric(7, 6)`; the finance service must use
`decimal.Decimal` throughout and never `float`.

PostgreSQL enum columns are mapped with `postgresql.ENUM(create_type=False)` so
writes bind against the existing Prisma-created enum types (a plain `Text`
mapping would emit `VARCHAR`, which asyncpg rejects on an enum column).
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Numeric, Text
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


def _enum(name: str, *values: str) -> ENUM:
    """A native PostgreSQL enum bound to an existing (Prisma-created) type.

    `create_type=False` prevents SQLAlchemy from emitting DDL (Prisma owns the
    schema); the values are supplied so reads validate against the real members.
    """
    return ENUM(*values, name=name, create_type=False)


class CodCollection(Base):
    __tablename__ = "CodCollection"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    shipment_id: Mapped[str] = mapped_column("shipmentId", Text)
    seller_id: Mapped[str] = mapped_column("sellerId", Text)
    expected_amount: Mapped[Decimal] = mapped_column("expectedAmount", Numeric(14, 2))
    collected_amount: Mapped[Decimal | None] = mapped_column("collectedAmount", Numeric(14, 2), nullable=True)
    collected_by: Mapped[str | None] = mapped_column(
        "collectedBy", _enum("CodCollector", "seller", "agent"), nullable=True
    )
    collector_user_id: Mapped[str | None] = mapped_column("collectorUserId", Text, nullable=True)
    status: Mapped[str] = mapped_column(
        "status", _enum("CodCollectionStatus", "pending", "confirmed", "disputed", "cancelled")
    )
    evidence_ref: Mapped[str | None] = mapped_column("evidenceRef", Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column("confirmedAt", DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime)


class CommissionAssessment(Base):
    __tablename__ = "CommissionAssessment"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    seller_id: Mapped[str] = mapped_column("sellerId", Text)
    shipment_id: Mapped[str] = mapped_column("shipmentId", Text)
    basis: Mapped[str] = mapped_column("basis", _enum("CommissionBasis", "order_value", "collected_cod"))
    basis_amount: Mapped[Decimal] = mapped_column("basisAmount", Numeric(14, 2))
    rate: Mapped[Decimal] = mapped_column("rate", Numeric(7, 6))
    commission_amount: Mapped[Decimal] = mapped_column("commissionAmount", Numeric(14, 2))
    status: Mapped[str] = mapped_column(
        "status", _enum("CommissionStatus", "assessed", "partially_remitted", "remitted", "waived")
    )
    assessed_by_user_id: Mapped[str | None] = mapped_column("assessedByUserId", Text, nullable=True)
    assessed_at: Mapped[datetime] = mapped_column("assessedAt", DateTime)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime)


class Remittance(Base):
    __tablename__ = "Remittance"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    seller_id: Mapped[str] = mapped_column("sellerId", Text)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    method: Mapped[str] = mapped_column(Text)
    reference: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        "status", _enum("RemittanceStatus", "initiated", "received", "allocated", "failed", "returned")
    )
    initiated_by_user_id: Mapped[str | None] = mapped_column("initiatedByUserId", Text, nullable=True)
    initiated_at: Mapped[datetime] = mapped_column("initiatedAt", DateTime)
    received_at: Mapped[datetime | None] = mapped_column("receivedAt", DateTime, nullable=True)
    verified_by_user_id: Mapped[str | None] = mapped_column("verifiedByUserId", Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime)


class RemittanceAllocation(Base):
    __tablename__ = "RemittanceAllocation"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    remittance_id: Mapped[str] = mapped_column("remittanceId", Text)
    assessment_id: Mapped[str] = mapped_column("assessmentId", Text)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    kind: Mapped[str] = mapped_column("kind", _enum("RemittanceAllocationKind", "allocation", "reversal"))
    reverses_id: Mapped[str | None] = mapped_column("reversesId", Text, nullable=True)
    created_by_user_id: Mapped[str | None] = mapped_column("createdByUserId", Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)


class SellerAdjustment(Base):
    __tablename__ = "SellerAdjustment"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    seller_id: Mapped[str] = mapped_column("sellerId", Text)
    shipment_id: Mapped[str | None] = mapped_column("shipmentId", Text, nullable=True)
    order_id: Mapped[str | None] = mapped_column("orderId", Text, nullable=True)
    type: Mapped[str] = mapped_column("type", _enum("SellerAdjustmentType", "customer_refund", "adjustment", "reversal"))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    reason: Mapped[str] = mapped_column(Text)
    evidence_ref: Mapped[str | None] = mapped_column("evidenceRef", Text, nullable=True)
    status: Mapped[str] = mapped_column("status", _enum("SellerAdjustmentStatus", "open", "applied"))
    created_by_user_id: Mapped[str | None] = mapped_column("createdByUserId", Text, nullable=True)
    applied_by_user_id: Mapped[str | None] = mapped_column("appliedByUserId", Text, nullable=True)
    applied_at: Mapped[datetime | None] = mapped_column("appliedAt", DateTime, nullable=True)
    reverses_id: Mapped[str | None] = mapped_column("reversesId", Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime)


class CommissionPolicy(Base):
    __tablename__ = "CommissionPolicy"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    basis: Mapped[str] = mapped_column("basis", _enum("CommissionBasis", "order_value", "collected_cod"))
    rate: Mapped[Decimal] = mapped_column(Numeric(7, 6))
    is_active: Mapped[bool] = mapped_column("isActive", Boolean)
    effective_from: Mapped[datetime] = mapped_column("effectiveFrom", DateTime)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)
