"""Public catalogue reads — a faithful port of `app/src/server/catalog/service.ts`.

Money leaves this module as exact 2-decimal strings. Only public seller fields
cross the boundary. Queries are batched per request (products -> offers ->
reviews -> pincodes), never per product, so the list endpoint stays O(1) in
round trips as the catalogue grows.
"""

import math
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Text, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi_app.core.errors import ApiError
from fastapi_app.models.catalog import (
    Category,
    Product,
    Review,
    SellerOffer,
    SellerPincode,
)
from fastapi_app.models.identity import User
from fastapi_app.models.seller import Seller
from fastapi_app.schemas.catalog import (
    CategoryOut,
    OfferOut,
    ProductDetailOut,
    ProductListOut,
    ProductSummaryOut,
    PaginationOut,
    ReviewOut,
)

# Mirrors `publicOfferWhere` in the Next.js service. The status column is a
# PostgreSQL enum ("ProductStatus"), which has no implicit = varchar operator,
# so it is compared as text.
PUBLIC_OFFER_CONDITIONS = (
    cast(SellerOffer.status, Text) == "active",
    SellerOffer.stock >= 1,
    Seller.vacation_mode.is_(False),
)

SORTS = ("relevance", "price_asc", "price_desc", "name_asc", "newest")
PRICE_SORTS = ("price_asc", "price_desc")


def _money(value: Decimal) -> str:
    return f"{value:.2f}"


def _bulk_tiers(raw) -> list[list[int]]:
    """Matches `normalizeBulkTiers` in the Next.js pricing module."""
    if not isinstance(raw, list):
        return []
    seen: set[int] = set()
    tiers: list[list[int]] = []
    for entry in raw:
        if not isinstance(entry, (list, tuple)) or len(entry) != 2:
            continue
        qty, percent = entry
        if isinstance(qty, bool) or isinstance(percent, bool):
            continue
        if not isinstance(qty, int) or not (2 <= qty <= 100_000):
            continue
        if not isinstance(percent, int) or not (1 <= percent <= 90):
            continue
        if qty in seen:
            continue
        seen.add(qty)
        tiers.append([qty, percent])
    return sorted(tiers, key=lambda tier: tier[0])


def _slugify(value: str) -> str:
    return "-".join(part for part in ("".join(c if c.isalnum() else "-" for c in value.lower())).split("-") if part)


def _round1(value: float) -> float:
    # JS Math.round(x*10)/10 semantics (half away from zero for positives).
    return math.floor(value * 10 + 0.5) / 10


def _specs(raw: object) -> list[str]:
    return [item for item in raw if isinstance(item, str)] if isinstance(raw, list) else []


def _public_product_ids():
    return (
        select(SellerOffer.product_id)
        .join(Seller, Seller.id == SellerOffer.seller_id)
        .where(*PUBLIC_OFFER_CONDITIONS)
    )


async def list_categories(db: AsyncSession) -> list[CategoryOut]:
    product_count = (
        select(func.count(Product.id))
        .where(Product.category_id == Category.id, Product.id.in_(_public_product_ids()))
        .scalar_subquery()
    )
    rows = (
        await db.execute(
            select(Category.id, Category.name, product_count.label("product_count")).order_by(
                Category.name.asc()
            )
        )
    ).all()
    return [
        CategoryOut(id=row.id, name=row.name, slug=_slugify(row.name), product_count=row.product_count)
        for row in rows
    ]


async def _offers_by_product(
    db: AsyncSession, product_ids: list[str]
) -> dict[str, list[tuple[SellerOffer, Seller]]]:
    if not product_ids:
        return {}
    rows = (
        await db.execute(
            select(SellerOffer, Seller)
            .join(Seller, Seller.id == SellerOffer.seller_id)
            .where(SellerOffer.product_id.in_(product_ids), *PUBLIC_OFFER_CONDITIONS)
            # `id` breaks price ties deterministically: several sellers often quote
            # the same price, and without it the "cheapest offer" (and therefore the
            # displayed stock/offerId) varies between queries and between this
            # service and the Next.js/Prisma reader (contract test).
            .order_by(SellerOffer.price.asc(), SellerOffer.id.asc())
        )
    ).all()
    grouped: dict[str, list[tuple[SellerOffer, Seller]]] = {}
    for offer, seller in rows:
        grouped.setdefault(offer.product_id, []).append((offer, seller))
    return grouped


async def _review_stats(db: AsyncSession, product_ids: list[str]) -> dict[str, tuple[int, float]]:
    if not product_ids:
        return {}
    rows = (
        await db.execute(
            select(Review.product_id, func.count(Review.id), func.avg(Review.stars))
            .where(Review.product_id.in_(product_ids))
            .group_by(Review.product_id)
        )
    ).all()
    return {row[0]: (int(row[1]), float(row[2])) for row in rows}


async def _pincodes_by_seller(db: AsyncSession, seller_ids: list[str]) -> dict[str, list[str]]:
    if not seller_ids:
        return {}
    rows = (
        await db.execute(
            select(SellerPincode.seller_id, SellerPincode.pin).where(
                SellerPincode.seller_id.in_(seller_ids)
            )
        )
    ).all()
    grouped: dict[str, list[str]] = {}
    for seller_id, pin in rows:
        grouped.setdefault(seller_id, []).append(pin)
    return grouped


def _eligible(pairs: list[tuple[SellerOffer, Seller]]) -> list[tuple[SellerOffer, Seller]]:
    return [pair for pair in pairs if pair[0].stock >= pair[0].min_order_qty]


def _summary(
    product: Product,
    category_name: str,
    pairs: list[tuple[SellerOffer, Seller]],
    stats: tuple[int, float] | None,
) -> ProductSummaryOut:
    eligible = _eligible(pairs)
    cheapest = min(eligible, key=lambda pair: pair[0].price)[0] if eligible else None
    review_count, average = stats if stats else (0, None)
    return ProductSummaryOut(
        id=product.id,
        code=product.code,
        name=product.name,
        brand=product.brand,
        category=category_name,
        unit=product.unit,
        mrp=_money(product.mrp),
        price=_money(cheapest.price) if cheapest else "0.00",
        offer_count=len(eligible),
        lead_time_days=min(pair[0].lead_time_days for pair in eligible) if eligible else 0,
        rating=_round1(average) if average is not None else None,
        review_count=review_count,
        bulk_flag=product.bulk_flag,
        image_url=product.image_url,
        specs=_specs(product.specs),
        offer_id=cheapest.id if cheapest else None,
        stock=cheapest.stock if cheapest else 0,
        min_order_qty=cheapest.min_order_qty if cheapest else 1,
        purchasable=bool(cheapest),
    )


def _offer(offer: SellerOffer, seller: Seller, pincodes: dict[str, list[str]]) -> OfferOut:
    return OfferOut(
        id=offer.id,
        seller_name=seller.store_name,
        seller_city=seller.city,
        price=_money(offer.price),
        stock=offer.stock,
        min_order_qty=offer.min_order_qty,
        lead_time_days=offer.lead_time_days,
        verified=offer.verified,
        rating=offer.rating,
        serviceable_pincodes=pincodes.get(seller.id, []),
        bulk_tiers=_bulk_tiers(offer.bulk_tiers),
        purchasable=offer.status == "active" and offer.stock >= offer.min_order_qty,
    )


def _product_query():
    return select(Product, Category.name.label("category_name")).join(
        Category, Category.id == Product.category_id
    )


async def list_products(
    db: AsyncSession,
    *,
    q: str | None,
    category: str | None,
    sort: str,
    page: int,
    page_size: int,
) -> ProductListOut:
    statement = _product_query().where(Product.id.in_(_public_product_ids()))
    if q:
        pattern = f"%{q}%"
        statement = statement.where(
            or_(
                Product.name.ilike(pattern),
                Product.brand.ilike(pattern),
                Category.name.ilike(pattern),
            )
        )
    if category:
        statement = statement.where(
            or_(Category.id == category, func.lower(Category.name) == category.lower())
        )

    skip = (page - 1) * page_size

    if sort in PRICE_SORTS:
        rows = (await db.execute(statement)).all()
        product_ids = [product.id for product, _ in rows]
        offers = await _offers_by_product(db, product_ids)
        stats = await _review_stats(db, product_ids)
        items = [
            summary
            for product, category_name in rows
            if (summary := _summary(product, category_name, offers.get(product.id, []), stats.get(product.id))).offer_count
        ]
        # Sort by id first, then price, so equal prices keep a stable order that
        # matches the Next.js reader (a reverse sort stays stable for ties).
        items.sort(key=lambda item: item.id)
        items.sort(key=lambda item: Decimal(item.price), reverse=sort == "price_desc")
        total = len(items)
        page_items = items[skip : skip + page_size]
    else:
        total = (
            await db.execute(select(func.count()).select_from(statement.subquery()))
        ).scalar_one()
        order = (
            (Product.created_at.desc(), Product.id.asc())
            if sort == "newest"
            else (Product.name.asc(), Product.id.asc())
        )
        rows = (await db.execute(statement.order_by(*order).offset(skip).limit(page_size))).all()
        product_ids = [product.id for product, _ in rows]
        offers = await _offers_by_product(db, product_ids)
        stats = await _review_stats(db, product_ids)
        page_items = [
            summary
            for product, category_name in rows
            if (summary := _summary(product, category_name, offers.get(product.id, []), stats.get(product.id))).offer_count
        ]

    return ProductListOut(
        products=page_items,
        pagination=PaginationOut(
            page=page,
            page_size=page_size,
            total=int(total),
            total_pages=math.ceil(total / page_size),
        ),
    )


async def get_product(db: AsyncSession, product_id: str) -> ProductDetailOut:
    row = (
        await db.execute(
            _product_query().where(or_(Product.id == product_id, Product.code == product_id))
        )
    ).first()
    if row is None:
        raise ApiError(404, "product_not_found", "Product not found")

    product, category_name = row
    offers = await _offers_by_product(db, [product.id])
    pairs = offers.get(product.id, [])
    stats = await _review_stats(db, [product.id])
    pincodes = await _pincodes_by_seller(db, [seller.id for _, seller in pairs])
    summary = _summary(product, category_name, pairs, stats.get(product.id))
    eligible = _eligible(pairs)

    return ProductDetailOut(
        **summary.model_dump(),
        available=bool(eligible),
        offers=[_offer(offer, seller, pincodes) for offer, seller in eligible],
    )


async def list_product_offers(db: AsyncSession, product_id: str) -> ProductDetailOut:
    return await get_product(db, product_id)


# ---------------------------------------------------------------------------
# Reviews + rating histogram (read only). Mirrors
# `listProductReviews` / `getReviewHistogram` in the Next.js service exactly,
# including the en-IN date rendering and the 5★→1★ percentage buckets.
# ---------------------------------------------------------------------------

_MONTHS = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)


def _posted_on(value: datetime) -> str:
    """`new Date(...).toLocaleDateString("en-IN", {day:"numeric",month:"long",year:"numeric"})`."""
    local = value.replace(tzinfo=timezone.utc).astimezone()
    return f"{local.day} {_MONTHS[local.month - 1]} {local.year}"


def review_bucket(stars: int) -> int:
    """5★ → index 0 … 1★ → index 4, matching `5 - Math.round(stars)`."""
    return min(4, max(0, 5 - round(stars)))


def _percent(count: int, total: int) -> int:
    # JS Math.round (half away from zero) for the non-negative values used here.
    return math.floor((count / total) * 100 + 0.5) if total else 0


async def _product_id_for(db: AsyncSession, identifier: str) -> str:
    product_id = (
        await db.execute(
            select(Product.id).where(or_(Product.id == identifier, Product.code == identifier))
        )
    ).scalar_one_or_none()
    if product_id is None:
        raise ApiError(404, "product_not_found", "Product not found")
    return product_id


async def list_product_reviews(db: AsyncSession, identifier: str) -> list[ReviewOut]:
    product_id = await _product_id_for(db, identifier)
    rows = (
        await db.execute(
            select(Review, User.name)
            .join(User, User.id == Review.user_id)
            .where(Review.product_id == product_id)
            .order_by(Review.created_at.desc())
        )
    ).all()
    return [
        ReviewOut(
            name=name,
            stars=review.stars,
            title=review.title,
            body=review.body,
            posted_on=_posted_on(review.created_at),
        )
        for review, name in rows
    ]


async def review_histogram(db: AsyncSession, identifier: str) -> list[int]:
    product_id = await _product_id_for(db, identifier)
    stars = (
        await db.execute(select(Review.stars).where(Review.product_id == product_id))
    ).scalars().all()
    counts = [0, 0, 0, 0, 0]
    for value in stars:
        counts[review_bucket(value)] += 1
    total = len(stars)
    return [_percent(count, total) for count in counts]

