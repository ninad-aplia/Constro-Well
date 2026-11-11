"""Catalogue response schemas — the existing Next.js DTOs, camelCase on the wire."""

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CategoryOut(CamelModel):
    id: str
    name: str
    slug: str
    product_count: int


class CategoryListOut(CamelModel):
    categories: list[CategoryOut]


class ProductSummaryOut(CamelModel):
    id: str
    code: str
    name: str
    brand: str | None
    category: str
    unit: str
    mrp: str
    price: str
    offer_count: int
    lead_time_days: int
    rating: float | None
    review_count: int
    bulk_flag: bool
    image_url: str | None
    specs: list[str]
    offer_id: str | None
    stock: int
    min_order_qty: int
    purchasable: bool


class OfferOut(CamelModel):
    id: str
    seller_name: str
    seller_city: str
    price: str
    stock: int
    min_order_qty: int
    lead_time_days: int
    verified: bool
    rating: float | None
    serviceable_pincodes: list[str]
    bulk_tiers: list[list[int]]
    purchasable: bool


class ProductDetailOut(ProductSummaryOut):
    available: bool
    offers: list[OfferOut]


class PaginationOut(CamelModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class ProductListOut(CamelModel):
    products: list[ProductSummaryOut]
    pagination: PaginationOut


class ProductOut(CamelModel):
    product: ProductDetailOut


class ProductOffersOut(CamelModel):
    product: ProductDetailOut
    offers: list[OfferOut]


class ReviewOut(CamelModel):
    name: str
    stars: int
    title: str
    body: str
    posted_on: str


class ReviewListOut(CamelModel):
    reviews: list[ReviewOut]


class ReviewHistogramOut(CamelModel):
    """Five buckets, 5★ → 1★, as integer percentages (0–100)."""

    histogram: list[int]
