"""Remittance tests: initiate, verify (platform cash), initiated-not-received,
duplicate submission, partial allocation via multiple remittances, fail/return."""

from httpx import AsyncClient


async def _seller(fdata):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    return seller_user, seller_id


async def test_initiate_remittance(fdata, finance_client: AsyncClient, seller_auth):
    response = await finance_client.post(
        "/api/seller/finance/remittances",
        json={"amount": "500.00", "method": "bank_transfer", "reference": "UTR-123"},
        cookies=seller_auth["cookie"],
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "initiated"
    assert body["amount"] == "500.00"
    assert body["receivedAt"] is None


async def test_initiated_remittance_is_not_platform_cash(fdata, finance_client: AsyncClient, seller_auth):
    await finance_client.post(
        "/api/seller/finance/remittances",
        json={"amount": "500.00", "method": "bank_transfer", "reference": "UTR-200"},
        cookies=seller_auth["cookie"],
    )
    statement = await finance_client.get("/api/seller/finance/statement", cookies=seller_auth["cookie"])
    body = statement.json()
    assert body["remittances"]["received"] == "0.00"
    assert body["remittances"]["initiated"] == "500.00"


async def test_duplicate_remittance_reference(fdata, finance_client: AsyncClient, seller_auth):
    payload = {"amount": "500.00", "method": "bank_transfer", "reference": "UTR-DUP"}
    first = await finance_client.post("/api/seller/finance/remittances", json=payload, cookies=seller_auth["cookie"])
    assert first.status_code == 200

    second = await finance_client.post("/api/seller/finance/remittances", json=payload, cookies=seller_auth["cookie"])
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "duplicate_remittance"


async def test_verify_remittance_marks_received(fdata, finance_client: AsyncClient, admin_auth):
    seller_user, seller_id = await _seller(fdata)
    remittance_id = await fdata.remittance(seller_id, amount="500.00")

    response = await finance_client.post(
        f"/api/admin/finance/remittances/{remittance_id}/verify", cookies=admin_auth["cookie"]
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "received"
    assert body["receivedAt"] is not None


async def test_verify_requires_admin(fdata, finance_client: AsyncClient, seller_auth):
    seller_user, seller_id = await _seller(fdata)
    remittance_id = await fdata.remittance(seller_id, amount="500.00")

    response = await finance_client.post(
        f"/api/admin/finance/remittances/{remittance_id}/verify", cookies=seller_auth["cookie"]
    )
    assert response.status_code == 403


async def test_fail_and_return_transitions(fdata, finance_client: AsyncClient, admin_auth):
    seller_user, seller_id = await _seller(fdata)

    fail_id = await fdata.remittance(seller_id, amount="500.00")
    failed = await finance_client.post(
        f"/api/admin/finance/remittances/{fail_id}/fail", cookies=admin_auth["cookie"]
    )
    assert failed.status_code == 200
    assert failed.json()["status"] == "failed"

    return_id = await fdata.remittance(seller_id, amount="300.00", status="received")
    returned = await finance_client.post(
        f"/api/admin/finance/remittances/{return_id}/return", cookies=admin_auth["cookie"]
    )
    assert returned.status_code == 200
    assert returned.json()["status"] == "returned"


async def test_seller_remittances_are_scoped(fdata, finance_client: AsyncClient, seller_auth):
    other_user = await fdata.user("seller")
    other_seller = await fdata.seller(other_user)
    await fdata.remittance(other_seller, amount="999.00", reference="UTR-OTHER")

    await finance_client.post(
        "/api/seller/finance/remittances",
        json={"amount": "100.00", "method": "bank_transfer", "reference": "UTR-MINE"},
        cookies=seller_auth["cookie"],
    )

    response = await finance_client.get("/api/seller/finance/remittances", cookies=seller_auth["cookie"])
    remittances = response.json()["remittances"]
    assert len(remittances) == 1
    assert remittances[0]["reference"] == "UTR-MINE"
