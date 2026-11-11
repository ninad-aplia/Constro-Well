"""Commission assessment tests: configurable policy, fail-closed (no policy),
decimal precision/rounding, and basis selection."""

from decimal import Decimal

import pytest
from httpx import AsyncClient

from fastapi_app.domains.finance.service import compute_commission


@pytest.mark.parametrize(
    "basis_amount, rate, expected",
    [
        ("999.99", "0.050000", "50.00"),  # 49.9995 -> half-up -> 50.00
        ("33.33", "0.050000", "1.67"),  # 1.6665 -> half-up -> 1.67
        ("100.00", "0.020000", "2.00"),
        ("100.00", "0.125000", "12.50"),
        ("0.01", "0.050000", "0.00"),  # 0.0005 -> half-up -> 0.01? (rounds to 0.00)
    ],
)
def test_compute_commission_precision(basis_amount, rate, expected):
    assert compute_commission(Decimal(basis_amount), Decimal(rate)) == Decimal(expected)


async def _shipment_collection(fdata, seller_id, expected="100.00"):
    order_user = await fdata.user("customer")
    order_id = await fdata.order(order_user)
    shipment_id = await fdata.shipment(order_id, seller_id, status="review")
    await fdata.collection(shipment_id, seller_id, expected=expected)
    return shipment_id


async def test_assess_fails_closed_without_policy(fdata, finance_client: AsyncClient, admin_auth):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    shipment_id = await _shipment_collection(fdata, seller_id, "100.00")

    response = await finance_client.post(
        f"/api/admin/finance/assessments/{shipment_id}", cookies=admin_auth["cookie"]
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "policy_not_configured"


async def test_assess_with_active_policy(fdata, finance_client: AsyncClient, admin_auth):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    shipment_id = await _shipment_collection(fdata, seller_id, "100.00")
    await fdata.policy(basis="order_value", rate="0.050000")

    response = await finance_client.post(
        f"/api/admin/finance/assessments/{shipment_id}", cookies=admin_auth["cookie"]
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["basis"] == "order_value"
    assert body["basisAmount"] == "100.00"
    assert body["rate"] == "0.050000"
    assert body["commissionAmount"] == "5.00"
    assert body["status"] == "assessed"


async def test_assess_uses_collected_cod_basis(fdata, finance_client: AsyncClient, admin_auth):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    order_user = await fdata.user("customer")
    order_id = await fdata.order(order_user)
    shipment_id = await fdata.shipment(order_id, seller_id, status="review")
    await fdata.collection(shipment_id, seller_id, expected="200.00", collected="180.00", status="confirmed")
    await fdata.policy(basis="collected_cod", rate="0.050000")

    response = await finance_client.post(
        f"/api/admin/finance/assessments/{shipment_id}", cookies=admin_auth["cookie"]
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["basis"] == "collected_cod"
    assert body["basisAmount"] == "180.00"
    assert body["commissionAmount"] == "9.00"


async def test_assess_collected_basis_requires_confirmed(fdata, finance_client: AsyncClient, admin_auth):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    shipment_id = await _shipment_collection(fdata, seller_id, "200.00")
    await fdata.policy(basis="collected_cod", rate="0.050000")

    response = await finance_client.post(
        f"/api/admin/finance/assessments/{shipment_id}", cookies=admin_auth["cookie"]
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "collection_unconfirmed"


async def test_assess_duplicate_is_conflict(fdata, finance_client: AsyncClient, admin_auth):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    shipment_id = await _shipment_collection(fdata, seller_id, "100.00")
    await fdata.policy(basis="order_value", rate="0.050000")

    first = await finance_client.post(
        f"/api/admin/finance/assessments/{shipment_id}", cookies=admin_auth["cookie"]
    )
    assert first.status_code == 200

    second = await finance_client.post(
        f"/api/admin/finance/assessments/{shipment_id}", cookies=admin_auth["cookie"]
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "assessment_exists"


async def test_assess_requires_admin(fdata, finance_client: AsyncClient, seller_auth):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    shipment_id = await _shipment_collection(fdata, seller_id, "100.00")
    await fdata.policy(basis="order_value", rate="0.050000")

    response = await finance_client.post(
        f"/api/admin/finance/assessments/{shipment_id}", cookies=seller_auth["cookie"]
    )
    assert response.status_code == 403
