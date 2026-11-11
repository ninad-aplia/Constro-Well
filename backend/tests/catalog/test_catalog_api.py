"""Catalogue endpoint behaviour and DTO-shape tests against real Postgres."""

from decimal import Decimal

import pytest
from httpx import AsyncClient

PRODUCT_SUMMARY_KEYS = {
    "id", "code", "name", "brand", "category", "unit", "mrp", "price", "offerCount",
    "leadTimeDays", "rating", "reviewCount", "bulkFlag", "imageUrl", "specs",
    "offerId", "stock", "minOrderQty", "purchasable",
}
OFFER_KEYS = {
    "id", "sellerName", "sellerCity", "price", "stock", "minOrderQty",
    "leadTimeDays", "verified", "rating", "serviceablePincodes", "purchasable",
}
PRIVATE_OFFER_KEYS = {"gstin", "bankRef", "phone", "ownerUserId", "passwordHash"}


async def test_categories_contract_and_order(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/categories")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"categories"}
    categories = body["categories"]
    assert categories
    assert set(categories[0]) == {"id", "name", "slug", "productCount"}
    names = [category["name"] for category in categories]
    assert names == sorted(names)
    for category in categories:
        assert category["slug"] == category["name"].lower().replace(" ", "-")
        assert isinstance(category["productCount"], int)
        assert category["productCount"] >= 0


async def test_product_list_contract_and_default_page_size(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/products")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"products", "pagination"}
    assert set(body["pagination"]) == {"page", "pageSize", "total", "totalPages"}
    assert body["pagination"]["page"] == 1
    assert body["pagination"]["pageSize"] == 12
    assert 0 < len(body["products"]) <= 12
    assert set(body["products"][0]) == PRODUCT_SUMMARY_KEYS


async def test_pagination_pages_are_disjoint(api_client: AsyncClient) -> None:
    first = (await api_client.get("/api/products?pageSize=3&page=1")).json()
    second = (await api_client.get("/api/products?pageSize=3&page=2")).json()

    assert first["pagination"]["page"] == 1
    assert second["pagination"]["page"] == 2
    first_ids = {product["id"] for product in first["products"]}
    second_ids = {product["id"] for product in second["products"]}
    assert first_ids.isdisjoint(second_ids)


async def test_search_matches_name_brand_or_category(api_client: AsyncClient) -> None:
    body = (await api_client.get("/api/products?q=cement&pageSize=50")).json()

    assert body["products"]
    for product in body["products"]:
        haystack = f"{product['name']} {product['brand'] or ''} {product['category']}".lower()
        assert "cement" in haystack


async def test_category_filter_accepts_id_and_name(api_client: AsyncClient) -> None:
    categories = (await api_client.get("/api/categories")).json()["categories"]
    target = next(category for category in categories if category["productCount"] > 0)

    by_id = (await api_client.get(f"/api/products?category={target['id']}&pageSize=50")).json()
    by_name = (await api_client.get(f"/api/products?category={target['name'].lower()}&pageSize=50")).json()

    assert [product["id"] for product in by_id["products"]] == [
        product["id"] for product in by_name["products"]
    ]
    assert all(product["category"] == target["name"] for product in by_id["products"])


@pytest.mark.parametrize("sort,reverse", [("price_asc", False), ("price_desc", True)])
async def test_price_sorting_matches_summary_price(api_client: AsyncClient, sort: str, reverse: bool) -> None:
    body = (await api_client.get(f"/api/products?sort={sort}&pageSize=50")).json()
    prices = [Decimal(product["price"]) for product in body["products"]]

    assert prices == sorted(prices, reverse=reverse)


async def test_newest_sort_returns_products(api_client: AsyncClient) -> None:
    body = (await api_client.get("/api/products?sort=newest&pageSize=5")).json()

    assert len(body["products"]) == 5


async def test_empty_search_returns_empty_page(api_client: AsyncClient) -> None:
    body = (await api_client.get("/api/products?q=zzzz-no-such-product")).json()

    assert body["products"] == []
    assert body["pagination"]["total"] == 0
    assert body["pagination"]["totalPages"] == 0


@pytest.mark.parametrize(
    "query",
    ["sort=bogus", "page=0", "pageSize=51", "pageSize=abc"],
)
async def test_invalid_query_returns_400_validation_error(api_client: AsyncClient, query: str) -> None:
    response = await api_client.get(f"/api/products?{query}")

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["message"]


async def test_unknown_product_returns_404(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/products/does-not-exist")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "product_not_found"


async def test_detail_lookup_by_id_and_code_agree(api_client: AsyncClient) -> None:
    listing = (await api_client.get("/api/products?pageSize=1")).json()["products"][0]

    by_id = (await api_client.get(f"/api/products/{listing['id']}")).json()["product"]
    by_code = (await api_client.get(f"/api/products/{listing['code']}")).json()["product"]

    assert by_id == by_code


async def test_detail_contract_offers_and_no_private_fields(api_client: AsyncClient) -> None:
    listing = (await api_client.get("/api/products?pageSize=5")).json()["products"]
    purchasable = next(product for product in listing if product["purchasable"])

    response = await api_client.get(f"/api/products/{purchasable['id']}")
    assert response.status_code == 200
    detail = response.json()["product"]
    assert set(detail) == PRODUCT_SUMMARY_KEYS | {"available", "offers"}
    assert detail["available"] is True
    assert detail["offers"]
    assert detail["offerId"] is not None
    assert detail["stock"] >= detail["minOrderQty"]

    for offer in detail["offers"]:
        assert set(offer) == OFFER_KEYS
        assert not (PRIVATE_OFFER_KEYS & set(offer))
        assert Decimal(offer["price"]).as_tuple().exponent == -2
        assert offer["purchasable"] is True
        assert isinstance(offer["serviceablePincodes"], list)


async def test_offers_endpoint_duplicates_offers_at_top_level(api_client: AsyncClient) -> None:
    listing = (await api_client.get("/api/products?pageSize=1")).json()["products"][0]

    body = (await api_client.get(f"/api/products/{listing['id']}/offers")).json()

    assert set(body) == {"product", "offers"}
    assert body["offers"] == body["product"]["offers"]


async def test_summary_offer_fields_are_internally_consistent(api_client: AsyncClient) -> None:
    products = (await api_client.get("/api/products?pageSize=50")).json()["products"]

    assert products
    for product in products:
        assert product["purchasable"] is (product["offerId"] is not None)
        if product["purchasable"]:
            assert product["stock"] >= product["minOrderQty"]
            assert Decimal(product["price"]) > 0
