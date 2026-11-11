"""Public catalogue routes — same paths, query parameters and payloads as Next.js.

Next.js validation failures return HTTP 400 (`validation_error`), not FastAPI's
default 422, so query parsing is explicit here to keep the contract identical.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi_app.core.db import get_db
from fastapi_app.core.errors import ApiError
from fastapi_app.domains.catalog import service
from fastapi_app.schemas.catalog import (
    CategoryListOut,
    ProductListOut,
    ProductOffersOut,
    ProductOut,
    ReviewHistogramOut,
    ReviewListOut,
)

router = APIRouter(prefix="/api", tags=["catalogue"])

Sort = Literal["relevance", "price_asc", "price_desc", "name_asc", "newest"]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]


class ProductListParams(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    q: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None
    category: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = None
    sort: Sort = "relevance"
    page: int = Field(1, ge=1, le=10_000)
    page_size: int = Field(12, ge=1, le=50, alias="pageSize")


def _parse_params(request: Request) -> ProductListParams:
    try:
        return ProductListParams.model_validate(dict(request.query_params))
    except ValidationError as error:
        first = error.errors()[0]
        field = ".".join(str(part) for part in first["loc"]) or None
        raise ApiError(400, "validation_error", first["msg"], field) from None


def _product_id(raw: str) -> str:
    value = raw.strip()
    if not value or len(value) > 100:
        raise ApiError(400, "validation_error", "String must contain at most 100 character(s)", "id")
    return value


@router.get("/categories", response_model=CategoryListOut, summary="List categories")
async def categories(db: AsyncSession = Depends(get_db)) -> CategoryListOut:
    return CategoryListOut(categories=await service.list_categories(db))


@router.get("/products", response_model=ProductListOut, summary="List products")
async def products(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ProductListOut:
    params = _parse_params(request)
    return await service.list_products(
        db,
        q=params.q,
        category=params.category,
        sort=params.sort,
        page=params.page,
        page_size=params.page_size,
    )


@router.get("/products/{product_id}", response_model=ProductOut, summary="Product detail")
async def product(product_id: str, db: AsyncSession = Depends(get_db)) -> ProductOut:
    return ProductOut(product=await service.get_product(db, _product_id(product_id)))


@router.get(
    "/products/{product_id}/offers",
    response_model=ProductOffersOut,
    summary="Product seller offers",
)
async def product_offers(product_id: str, db: AsyncSession = Depends(get_db)) -> ProductOffersOut:
    detail = await service.list_product_offers(db, _product_id(product_id))
    # The Next.js route duplicates offers at top level and inside `product`; preserved.
    return ProductOffersOut(product=detail, offers=detail.offers)


@router.get(
    "/products/{product_id}/reviews",
    response_model=ReviewListOut,
    summary="Product reviews (read only)",
)
async def product_reviews(product_id: str, db: AsyncSession = Depends(get_db)) -> ReviewListOut:
    # No legacy HTTP route exists; the contract is the existing
    # `listProductReviews` DTO used by the product page.
    return ReviewListOut(reviews=await service.list_product_reviews(db, _product_id(product_id)))


@router.get(
    "/products/{product_id}/rating",
    response_model=ReviewHistogramOut,
    summary="Product rating histogram (five buckets, 5★→1★)",
)
async def product_rating(product_id: str, db: AsyncSession = Depends(get_db)) -> ReviewHistogramOut:
    return ReviewHistogramOut(histogram=await service.review_histogram(db, _product_id(product_id)))
