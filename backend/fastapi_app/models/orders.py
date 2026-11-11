"""Read-only mappings for admin order monitoring and detail."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Order(Base):
    __tablename__ = "Order"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    code: Mapped[str] = mapped_column(Text)
    user_id: Mapped[str] = mapped_column("userId", Text)
    item_value: Mapped[Decimal] = mapped_column("itemValue", Numeric(14, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    delivery_fee: Mapped[Decimal] = mapped_column("deliveryFee", Numeric(14, 2))
    tax_amount: Mapped[Decimal] = mapped_column("taxAmount", Numeric(14, 2))
    gross_total: Mapped[Decimal] = mapped_column("grossTotal", Numeric(14, 2))
    payment_method: Mapped[str] = mapped_column("paymentMethod", Text)
    payment_label: Mapped[str] = mapped_column("paymentLabel", Text)
    stage: Mapped[str] = mapped_column(Text)
    cancelled: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime)


class OrderLine(Base):
    __tablename__ = "OrderLine"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    order_id: Mapped[str] = mapped_column("orderId", Text)
    product_id: Mapped[str] = mapped_column("productId", Text)
    seller_id: Mapped[str] = mapped_column("sellerId", Text)
    name: Mapped[str] = mapped_column(Text)
    unit: Mapped[str] = mapped_column(Text)
    unit_price: Mapped[Decimal] = mapped_column("unitPrice", Numeric(14, 2))
    qty: Mapped[int] = mapped_column(Integer)
    line_value: Mapped[Decimal] = mapped_column("lineValue", Numeric(14, 2))


class Shipment(Base):
    __tablename__ = "Shipment"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    code: Mapped[str] = mapped_column(Text)
    order_id: Mapped[str] = mapped_column("orderId", Text)
    seller_id: Mapped[str] = mapped_column("sellerId", Text)
    # A plain Text mapping emits VARCHAR, which Postgres' `=` operator rejects
    # against the native enum column (asyncpg: "operator does not exist:
    # ShipmentStatus = character varying") the moment a filter compares against
    # it — same fix as `fastapi_app/models/finance.py`'s enum columns.
    status: Mapped[str] = mapped_column(
        ENUM(
            "new", "accepted", "packed", "dispatched", "failed", "review",
            "disputed", "settled", "rejected", "missed", "cancelled", "refunded",
            name="ShipmentStatus", create_type=False,
        )
    )
    slot: Mapped[str | None] = mapped_column(Text, nullable=True)
    driver_id: Mapped[str | None] = mapped_column("driverId", Text, nullable=True)
    late: Mapped[bool] = mapped_column(Boolean)
    delivered_at: Mapped[datetime | None] = mapped_column("deliveredAt", DateTime, nullable=True)
    delivered_qty: Mapped[int | None] = mapped_column("deliveredQty", Integer, nullable=True)
    review_ends: Mapped[datetime | None] = mapped_column("reviewEnds", DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime)


class ShipmentEvent(Base):
    __tablename__ = "ShipmentEvent"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    shipment_id: Mapped[str] = mapped_column("shipmentId", Text)
    actor: Mapped[str] = mapped_column(
        "actor", ENUM("vendor", "driver", "customer", "system", name="ShipmentActor", create_type=False)
    )
    message: Mapped[str] = mapped_column(Text)
    at: Mapped[datetime] = mapped_column("at", DateTime)


class EscrowEntry(Base):
    __tablename__ = "EscrowEntry"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    order_id: Mapped[str | None] = mapped_column("orderId", Text, nullable=True)
    shipment_id: Mapped[str | None] = mapped_column("shipmentId", Text, nullable=True)
    seller_id: Mapped[str | None] = mapped_column("sellerId", Text, nullable=True)
    type: Mapped[str] = mapped_column(Text)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)
