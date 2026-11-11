"""Every admin finance operation must be refused server-side for non-admins.

The frontend hides admin screens, so authorization is proven by calling the API
directly with seller, driver, customer and anonymous sessions. Bodies are valid
and ids are deliberately non-existent, so a missing role check would surface as
a 404/200 instead of the required 401/403.
"""

import pytest
from httpx import AsyncClient

PLACEHOLDER = "does_not_exist"

ADMIN_ENDPOINTS: list[tuple[str, str, dict | None]] = [
    ("GET", "/api/admin/finance/collections", None),
    ("GET", "/api/admin/finance/collections/discrepancies", None),
    ("GET", "/api/admin/finance/remittances", None),
    ("GET", "/api/admin/finance/assessments", None),
    ("GET", "/api/admin/finance/adjustments", None),
    ("GET", f"/api/admin/finance/remittances/{PLACEHOLDER}/allocations", None),
    ("GET", f"/api/admin/finance/sellers/{PLACEHOLDER}/statement", None),
    ("POST", f"/api/admin/finance/collections/{PLACEHOLDER}/dispute", {"note": "x"}),
    ("POST", "/api/admin/finance/assessments/run", {"limit": 1}),
    ("POST", f"/api/admin/finance/assessments/{PLACEHOLDER}", None),
    ("POST", f"/api/admin/finance/assessments/{PLACEHOLDER}/waive", None),
    ("POST", f"/api/admin/finance/remittances/{PLACEHOLDER}/verify", None),
    ("POST", f"/api/admin/finance/remittances/{PLACEHOLDER}/fail", {"note": "x"}),
    ("POST", f"/api/admin/finance/remittances/{PLACEHOLDER}/return", {"note": "x"}),
    ("POST", f"/api/admin/finance/remittances/{PLACEHOLDER}/allocations", {"assessmentId": "a", "amount": "1.00"}),
    ("POST", f"/api/admin/finance/allocations/{PLACEHOLDER}/reverse", None),
    ("POST", f"/api/admin/finance/adjustments/{PLACEHOLDER}/apply", None),
    ("POST", f"/api/admin/finance/adjustments/{PLACEHOLDER}/reverse", {"reason": "x"}),
    ("POST", "/api/admin/finance/policies", {"basis": "order_value", "rate": "0.05"}),
]


def _case_id(method: str, path: str) -> str:
    return f"{method} {path}"


@pytest.mark.parametrize("method, path, body", ADMIN_ENDPOINTS, ids=[_case_id(m, p) for m, p, _ in ADMIN_ENDPOINTS])
async def test_seller_is_forbidden(method, path, body, finance_client: AsyncClient, seller_auth):
    response = await finance_client.request(method, path, json=body, cookies=seller_auth["cookie"])
    assert response.status_code == 403, response.text


@pytest.mark.parametrize("method, path, body", ADMIN_ENDPOINTS, ids=[_case_id(m, p) for m, p, _ in ADMIN_ENDPOINTS])
async def test_driver_is_forbidden(method, path, body, finance_client: AsyncClient, driver_auth):
    response = await finance_client.request(method, path, json=body, cookies=driver_auth["cookie"])
    assert response.status_code == 403, response.text


@pytest.mark.parametrize("method, path, body", ADMIN_ENDPOINTS, ids=[_case_id(m, p) for m, p, _ in ADMIN_ENDPOINTS])
async def test_customer_is_forbidden(method, path, body, finance_client: AsyncClient, fdata):
    customer = await fdata.user("customer")
    cookie = {"cw_session": await fdata.session(customer)}
    response = await finance_client.request(method, path, json=body, cookies=cookie)
    assert response.status_code == 403, response.text


@pytest.mark.parametrize("method, path, body", ADMIN_ENDPOINTS, ids=[_case_id(m, p) for m, p, _ in ADMIN_ENDPOINTS])
async def test_anonymous_is_unauthenticated(method, path, body, finance_client: AsyncClient):
    response = await finance_client.request(method, path, json=body)
    assert response.status_code == 401, response.text


@pytest.mark.parametrize("method, path, body", ADMIN_ENDPOINTS, ids=[_case_id(m, p) for m, p, _ in ADMIN_ENDPOINTS])
async def test_admin_passes_the_role_gate(method, path, body, finance_client: AsyncClient, admin_auth):
    """Control case: an admin reaches the handler (so the 403s above are role checks,
    not a blanket refusal). Not 401/403 — the outcome depends on the placeholder id."""
    response = await finance_client.request(method, path, json=body, cookies=admin_auth["cookie"])
    assert response.status_code not in (401, 403), response.text


async def test_seller_finance_routes_reject_non_sellers(finance_client: AsyncClient, admin_auth):
    for method, path in (
        ("GET", "/api/seller/finance/statement"),
        ("GET", "/api/seller/finance/collections"),
        ("GET", "/api/seller/finance/remittances"),
        ("GET", "/api/seller/finance/adjustments"),
    ):
        response = await finance_client.request(method, path, cookies=admin_auth["cookie"])
        assert response.status_code == 403, f"{path} -> {response.status_code}"


async def test_driver_collection_route_rejects_non_drivers(finance_client: AsyncClient, admin_auth, seller_auth):
    for auth in (admin_auth, seller_auth):
        response = await finance_client.post(
            f"/api/driver/finance/collections/{PLACEHOLDER}/confirm",
            json={"collectedAmount": "1.00"},
            cookies=auth["cookie"],
        )
        assert response.status_code == 403, response.text
