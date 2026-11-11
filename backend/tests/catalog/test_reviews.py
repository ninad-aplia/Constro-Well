"""Product review + rating histogram reads (FastAPI), checked against Postgres."""

import math
import re
from datetime import datetime, timezone

from httpx import AsyncClient
from sqlalchemy import select

from fastapi_app.domains.catalog.service import review_bucket, _percent
from fastapi_app.models.catalog import Product, Review

DATE_PATTERN = re.compile(r"^\d{1,2} [A-Z][a-z]+ \d{4}$")


async def _reviewed_product(db) -> tuple[str, str]:
    product_id = (await db.execute(select(Review.product_id).limit(1))).scalar_one()
    code = (
        await db.execute(select(Product.code).where(Product.id == product_id))
    ).scalar_one()
    return product_id, code


async def _empty_product(db) -> str:
    reviewed = select(Review.product_id)
    product_id = (
        await db.execute(select(Product.id).where(Product.id.not_in(reviewed)).limit(1))
    ).scalar_one()
    return product_id


async def test_reviews_contract_and_newest_first(api_client: AsyncClient, db) -> None:
    product_id, code = await _reviewed_product(db)
    expected = (
        await db.execute(
            select(Review.title)
            .where(Review.product_id == product_id)
            .order_by(Review.created_at.desc())
        )
    ).scalars().all()

    response = await api_client.get(f"/api/products/{code}/reviews")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"reviews"}
    assert [review["title"] for review in body["reviews"]] == list(expected)
    for review in body["reviews"]:
        assert set(review) == {"name", "stars", "title", "body", "postedOn"}
        assert 1 <= review["stars"] <= 5
        assert review["name"]
        assert DATE_PATTERN.match(review["postedOn"]), review["postedOn"]


async def test_reviews_empty_product(api_client: AsyncClient, db) -> None:
    product_id = await _empty_product(db)

    response = await api_client.get(f"/api/products/{product_id}/reviews")

    assert response.status_code == 200
    assert response.json() == {"reviews": []}


async def test_reviews_unknown_product_is_404(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/products/no-such-product/reviews")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "product_not_found"


async def test_reviews_invalid_id_is_400(api_client: AsyncClient) -> None:
    response = await api_client.get(f"/api/products/{'x' * 101}/reviews")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


async def test_histogram_matches_database(api_client: AsyncClient, db) -> None:
    product_id, code = await _reviewed_product(db)
    stars = (
        await db.execute(select(Review.stars).where(Review.product_id == product_id))
    ).scalars().all()
    counts = [0, 0, 0, 0, 0]
    for value in stars:
        counts[5 - value] += 1
    total = len(stars)
    expected = [math.floor((count / total) * 100 + 0.5) if total else 0 for count in counts]

    response = await api_client.get(f"/api/products/{code}/rating")

    assert response.status_code == 200
    assert response.json() == {"histogram": expected}
    assert len(expected) == 5


async def test_histogram_empty_product_is_all_zero(api_client: AsyncClient, db) -> None:
    product_id = await _empty_product(db)

    response = await api_client.get(f"/api/products/{product_id}/rating")

    assert response.status_code == 200
    assert response.json() == {"histogram": [0, 0, 0, 0, 0]}


async def test_histogram_unknown_product_is_404(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/products/no-such-product/rating")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "product_not_found"


def test_review_bucket_matches_prototype_scale() -> None:
    assert [review_bucket(stars) for stars in (5, 4, 3, 2, 1)] == [0, 1, 2, 3, 4]
    assert review_bucket(6) == 0
    assert review_bucket(0) == 4


def test_percent_uses_js_rounding() -> None:
    assert _percent(1, 2) == 50
    assert _percent(1, 3) == 33
    assert _percent(2, 3) == 67
    assert _percent(1, 6) == 17
    assert _percent(0, 0) == 0


def test_posted_on_uses_local_calendar_date() -> None:
    from fastapi_app.domains.catalog.service import _posted_on

    rendered = _posted_on(datetime(2026, 11, 5, 10, 0, tzinfo=timezone.utc).replace(tzinfo=None))
    assert DATE_PATTERN.match(rendered)
    assert "November 2026" in rendered
