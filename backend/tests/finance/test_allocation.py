"""Remittance allocation tests: limits, repeated partial allocations, a later
remittance against a partially-allocated assessment, unallocated credit, and
reversal through compensating records."""

from httpx import AsyncClient


async def _setup(fdata, *, commission: str = "10.00", remittance_amount: str = "100.00"):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    order_user = await fdata.user("customer")
    order_id = await fdata.order(order_user)
    shipment_id = await fdata.shipment(order_id, seller_id, status="review")
    await fdata.collection(shipment_id, seller_id, expected="100.00")
    assessment_id = await fdata.assessment(seller_id, shipment_id, commission=commission)
    remittance_id = await fdata.remittance(seller_id, amount=remittance_amount, status="received")
    return seller_id, assessment_id, remittance_id


async def _admin_statement(finance_client, admin_auth, seller_id):
    response = await finance_client.get(
        f"/api/admin/finance/sellers/{seller_id}/statement", cookies=admin_auth["cookie"]
    )
    assert response.status_code == 200
    return response.json()


async def test_allocate_partial_remittance(fdata, finance_client: AsyncClient, admin_auth):
    seller_id, assessment_id, remittance_id = await _setup(fdata, commission="20.00", remittance_amount="10.00")

    response = await finance_client.post(
        f"/api/admin/finance/remittances/{remittance_id}/allocations",
        json={"assessmentId": assessment_id, "amount": "10.00"},
        cookies=admin_auth["cookie"],
    )
    assert response.status_code == 200, response.text
    assert response.json()["amount"] == "10.00"

    statement = await _admin_statement(finance_client, admin_auth, seller_id)
    assert statement["commission"]["remitted"] == "10.00"
    assert statement["commission"]["outstanding"] == "10.00"


async def test_allocate_beyond_assessment_rejected(fdata, finance_client: AsyncClient, admin_auth):
    _, assessment_id, remittance_id = await _setup(fdata, commission="10.00", remittance_amount="100.00")

    response = await finance_client.post(
        f"/api/admin/finance/remittances/{remittance_id}/allocations",
        json={"assessmentId": assessment_id, "amount": "11.00"},
        cookies=admin_auth["cookie"],
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "allocation_exceeds_assessment"


async def test_allocate_beyond_remittance_rejected(fdata, finance_client: AsyncClient, admin_auth):
    _, assessment_id, remittance_id = await _setup(fdata, commission="100.00", remittance_amount="50.00")

    response = await finance_client.post(
        f"/api/admin/finance/remittances/{remittance_id}/allocations",
        json={"assessmentId": assessment_id, "amount": "50.01"},
        cookies=admin_auth["cookie"],
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "allocation_exceeds_remittance"


async def test_repeated_partial_allocations_to_same_pair(fdata, finance_client: AsyncClient, admin_auth):
    """The same remittance may allocate to the same assessment more than once."""
    seller_id, assessment_id, remittance_id = await _setup(fdata, commission="50.00", remittance_amount="100.00")

    for _ in range(2):
        response = await finance_client.post(
            f"/api/admin/finance/remittances/{remittance_id}/allocations",
            json={"assessmentId": assessment_id, "amount": "10.00"},
            cookies=admin_auth["cookie"],
        )
        assert response.status_code == 200, response.text

    statement = await _admin_statement(finance_client, admin_auth, seller_id)
    assert statement["commission"]["remitted"] == "20.00"
    assert statement["commission"]["outstanding"] == "30.00"
    assert statement["remittances"]["unallocated"] == "80.00"


async def test_later_remittance_to_partially_allocated_assessment(fdata, finance_client: AsyncClient, admin_auth):
    """An assessment that received a partial allocation can be topped up by a
    different, later remittance."""
    seller_id, assessment_id, r1 = await _setup(fdata, commission="50.00", remittance_amount="30.00")

    first = await finance_client.post(
        f"/api/admin/finance/remittances/{r1}/allocations",
        json={"assessmentId": assessment_id, "amount": "30.00"},
        cookies=admin_auth["cookie"],
    )
    assert first.status_code == 200

    r2 = await fdata.remittance(seller_id, amount="40.00", status="received")
    second = await finance_client.post(
        f"/api/admin/finance/remittances/{r2}/allocations",
        json={"assessmentId": assessment_id, "amount": "20.00"},
        cookies=admin_auth["cookie"],
    )
    assert second.status_code == 200, second.text

    statement = await _admin_statement(finance_client, admin_auth, seller_id)
    assert statement["commission"]["remitted"] == "50.00"
    assert statement["commission"]["outstanding"] == "0.00"


async def test_unallocated_remittance_credit(fdata, finance_client: AsyncClient, admin_auth):
    seller_id, assessment_id, remittance_id = await _setup(fdata, commission="10.00", remittance_amount="100.00")

    await finance_client.post(
        f"/api/admin/finance/remittances/{remittance_id}/allocations",
        json={"assessmentId": assessment_id, "amount": "10.00"},
        cookies=admin_auth["cookie"],
    )
    statement = await _admin_statement(finance_client, admin_auth, seller_id)
    assert statement["remittances"]["received"] == "100.00"
    assert statement["remittances"]["unallocated"] == "90.00"


async def test_returned_remittance_not_in_platform_cash(fdata, finance_client: AsyncClient, admin_auth):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    remittance_id = await fdata.remittance(seller_id, amount="200.00", status="received")

    returned = await finance_client.post(
        f"/api/admin/finance/remittances/{remittance_id}/return", cookies=admin_auth["cookie"]
    )
    assert returned.status_code == 200
    assert returned.json()["status"] == "returned"

    statement = await _admin_statement(finance_client, admin_auth, seller_id)
    assert statement["remittances"]["received"] == "0.00"
    assert statement["remittances"]["unallocated"] == "0.00"


async def test_reverse_allocation_compensating_record(fdata, finance_client: AsyncClient, admin_auth):
    seller_id, assessment_id, remittance_id = await _setup(fdata, commission="10.00", remittance_amount="100.00")

    alloc = await finance_client.post(
        f"/api/admin/finance/remittances/{remittance_id}/allocations",
        json={"assessmentId": assessment_id, "amount": "10.00"},
        cookies=admin_auth["cookie"],
    )
    allocation_id = alloc.json()["id"]

    reversal = await finance_client.post(
        f"/api/admin/finance/allocations/{allocation_id}/reverse", cookies=admin_auth["cookie"]
    )
    assert reversal.status_code == 200, reversal.text
    assert reversal.json()["kind"] == "reversal"
    assert reversal.json()["reversesId"] == allocation_id

    statement = await _admin_statement(finance_client, admin_auth, seller_id)
    assert statement["commission"]["remitted"] == "0.00"
    assert statement["commission"]["outstanding"] == "10.00"
    assert statement["remittances"]["unallocated"] == "100.00"


async def test_reverse_single_partial_allocation(fdata, finance_client: AsyncClient, admin_auth):
    """Reversing one partial allocation leaves the other intact."""
    seller_id, assessment_id, remittance_id = await _setup(fdata, commission="50.00", remittance_amount="100.00")

    first = await finance_client.post(
        f"/api/admin/finance/remittances/{remittance_id}/allocations",
        json={"assessmentId": assessment_id, "amount": "10.00"},
        cookies=admin_auth["cookie"],
    )
    await finance_client.post(
        f"/api/admin/finance/remittances/{remittance_id}/allocations",
        json={"assessmentId": assessment_id, "amount": "20.00"},
        cookies=admin_auth["cookie"],
    )

    reversal = await finance_client.post(
        f"/api/admin/finance/allocations/{first.json()['id']}/reverse", cookies=admin_auth["cookie"]
    )
    assert reversal.status_code == 200

    statement = await _admin_statement(finance_client, admin_auth, seller_id)
    assert statement["commission"]["remitted"] == "20.00"
    assert statement["commission"]["outstanding"] == "30.00"


async def test_allocate_requires_verified_remittance(fdata, finance_client: AsyncClient, admin_auth):
    seller_user = await fdata.user("seller")
    seller_id = await fdata.seller(seller_user)
    order_user = await fdata.user("customer")
    order_id = await fdata.order(order_user)
    shipment_id = await fdata.shipment(order_id, seller_id, status="review")
    await fdata.collection(shipment_id, seller_id, expected="100.00")
    assessment_id = await fdata.assessment(seller_id, shipment_id, commission="10.00")
    remittance_id = await fdata.remittance(seller_id, amount="100.00", status="initiated")

    response = await finance_client.post(
        f"/api/admin/finance/remittances/{remittance_id}/allocations",
        json={"assessmentId": assessment_id, "amount": "10.00"},
        cookies=admin_auth["cookie"],
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "invalid_transition"
