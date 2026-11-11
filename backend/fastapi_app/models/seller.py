"""Read-only mappings for seller/driver profiles used by role dependencies."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Seller(Base):
    __tablename__ = "Seller"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    code: Mapped[str] = mapped_column(Text)
    owner_user_id: Mapped[str] = mapped_column("ownerUserId", Text)
    store_name: Mapped[str] = mapped_column("storeName", Text)
    phone: Mapped[str] = mapped_column(Text)
    city: Mapped[str] = mapped_column(Text)
    # PostgreSQL enum (KycStatus: verified | pending), read as text.
    kyc_gst: Mapped[str] = mapped_column("kycGst", Text)
    kyc_pan: Mapped[str] = mapped_column("kycPan", Text)
    kyc_cheque: Mapped[str] = mapped_column("kycCheque", Text)
    vacation_mode: Mapped[bool] = mapped_column("vacationMode", Boolean)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)


class Driver(Base):
    __tablename__ = "Driver"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    seller_id: Mapped[str] = mapped_column("sellerId", Text)
    code: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    user_id: Mapped[str | None] = mapped_column("userId", Text, nullable=True)
