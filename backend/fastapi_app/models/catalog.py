"""Read-only mappings for the public catalogue tables (Prisma-owned schema)."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Category(Base):
    __tablename__ = "Category"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text)


class Product(Base):
    __tablename__ = "Product"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    code: Mapped[str] = mapped_column(Text)
    category_id: Mapped[str] = mapped_column("categoryId", Text)
    name: Mapped[str] = mapped_column(Text)
    brand: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit: Mapped[str] = mapped_column(Text)
    mrp: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    bulk_flag: Mapped[bool] = mapped_column("bulkFlag", Boolean)
    specs: Mapped[object] = mapped_column("specs", JSON)
    image_url: Mapped[str | None] = mapped_column("imageUrl", Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)


class SellerOffer(Base):
    __tablename__ = "SellerOffer"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    product_id: Mapped[str] = mapped_column("productId", Text)
    seller_id: Mapped[str] = mapped_column("sellerId", Text)
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    stock: Mapped[int] = mapped_column(Integer)
    min_order_qty: Mapped[int] = mapped_column("minOrderQty", Integer)
    status: Mapped[str] = mapped_column(Text)
    lead_time_days: Mapped[int] = mapped_column("leadTimeDays", Integer)
    verified: Mapped[bool] = mapped_column(Boolean)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)


class SellerPincode(Base):
    __tablename__ = "SellerPincode"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    seller_id: Mapped[str] = mapped_column("sellerId", Text)
    pin: Mapped[str] = mapped_column(Text)


class Review(Base):
    __tablename__ = "Review"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    product_id: Mapped[str] = mapped_column("productId", Text)
    user_id: Mapped[str] = mapped_column("userId", Text)
    stars: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime)
