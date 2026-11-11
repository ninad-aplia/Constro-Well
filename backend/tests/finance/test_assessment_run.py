"""Bulk commission assessment run (`POST /api/admin/finance/assessments/run`).

The run is an explicit admin action: it must be idempotent, must fail closed
without an active policy, must never guess a rate or schedule, and one bad row
must not abort the rest of the batch.
"""

from httpx import AsyncClient
from sqlalchemy import func, select, text

from fastapi_app.domains.finance import service
from fastapi_app.models.audit import AuditEvent
from fastapi_app.models.finance import CommissionAssessment


async def _confirmed(fdata, seller_id, *, expected="100.00", collected="100.00", status="confirmed"):
    order_id = await fdata.order(await fdata.user("customer"))
    shipment_id = await fdata.shipment(order_id, seller_id, status="review")
    await fdata.collection(shipment_id, seller_id, expected=expected, collected=collected, status=status)
    return shipment_id


async def _assessment_count(db) -> int:
    return int(await db.scalar(select(func.count()).select_from(CommissionAssessment)))


async def test_run_fails_closed_without_policy(fdata, finance_client: AsyncClient, admin_auth):
    seller_id = await fdata.seller(await fdata.user("seller"))
    await _confirmed(fdata, seller_id)

    response = await finance_client.post(
        "/api/admin/finance/assessments/run", json={"limit": 50}, cookies=admin_auth["cookie"]
    )
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "policy_not_configured"
    assert await _assessment_count(fdata.db) == 0
    run_audits = await fdata.db.scalar(
        select(func.count()).select_from(AuditEvent).where(AuditEvent.action == service.AUDIT_COMMISSION_RUN)
    )
    assert int(run_audits) == 0


async def test_run_assesses_only_confirmed_unassessed_collections(
    fdata, finance_client: AsyncClient, admin_auth
):
    seller_id = await fdata.seller(await fdata.user("seller"))
    confirmed_one = await _confirmed(fdata, seller_id, expected="100.00", collected="100.00")
    confirmed_two = await _confirmed(fdata, seller_id, expected="250.00", collected="200.00")
    pending = await _confirmed(fdata, seller_id, status="pending", collected=None)
    await fdata.policy(basis="order_value", rate="0.025000")

    response = await finance_client.post(
        "/api/admin/finance/assessments/run", json={"limit": 100}, cookies=admin_auth["cookie"]
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["basis"] == "order_value"
    assert body["rate"] == "0.025000"
    assert body["attempted"] == 2
    assert body["created"] == 2
    assert body["skipped"] == 0
    assert body["failed"] == []

    rows = (
        await fdata.db.execute(select(CommissionAssessment).where(CommissionAssessment.seller_id == seller_id))
    ).scalars().all()
    by_shipment = {row.shipment_id: row for row in rows}
    assert set(by_shipment) == {confirmed_one, confirmed_two}
    assert pending not in by_shipment
    assert str(by_shipment[confirmed_one].commission_amount) == "2.50"
    assert str(by_shipment[confirmed_two].commission_amount) == "6.25"
    assert str(by_shipment[confirmed_one].rate) == "0.025000"


async def test_repeated_run_creates_nothing(fdata, finance_client: AsyncClient, admin_auth):
    seller_id = await fdata.seller(await fdata.user("seller"))
    await _confirmed(fdata, seller_id)
    await _confirmed(fdata, seller_id, expected="300.00", collected="300.00")
    await fdata.policy(basis="order_value", rate="0.050000")

    first = await finance_client.post(
        "/api/admin/finance/assessments/run", json={"limit": 100}, cookies=admin_auth["cookie"]
    )
    assert first.status_code == 200
    assert first.json()["created"] == 2

    second = await finance_client.post(
        "/api/admin/finance/assessments/run", json={"limit": 100}, cookies=admin_auth["cookie"]
    )
    assert second.status_code == 200
    assert second.json()["attempted"] == 0
    assert second.json()["created"] == 0
    assert second.json()["skipped"] == 0
    assert await _assessment_count(fdata.db) == 2


async def test_already_assessed_shipment_is_excluded_not_duplicated(
    fdata, finance_client: AsyncClient, admin_auth
):
    seller_id = await fdata.seller(await fdata.user("seller"))
    assessed = await _confirmed(fdata, seller_id)
    fresh = await _confirmed(fdata, seller_id, expected="200.00")
    await fdata.assessment(seller_id, assessed, commission="7.77")
    await fdata.policy(basis="order_value", rate="0.050000")

    response = await finance_client.post(
        "/api/admin/finance/assessments/run", json={"limit": 100}, cookies=admin_auth["cookie"]
    )
    assert response.status_code == 200, response.text
    assert response.json()["attempted"] == 1
    assert response.json()["created"] == 1

    rows = (
        await fdata.db.execute(select(CommissionAssessment).where(CommissionAssessment.shipment_id == assessed))
    ).scalars().all()
    assert len(rows) == 1
    assert str(rows[0].commission_amount) == "7.77"
    assert await _assessment_count(fdata.db) == 2
    assert (
        await fdata.db.scalar(
            select(CommissionAssessment.id).where(CommissionAssessment.shipment_id == fresh)
        )
        is not None
    )


async def test_run_respects_limit(fdata, finance_client: AsyncClient, admin_auth):
    seller_id = await fdata.seller(await fdata.user("seller"))
    for _ in range(3):
        await _confirmed(fdata, seller_id)
    await fdata.policy(basis="order_value", rate="0.050000")

    response = await finance_client.post(
        "/api/admin/finance/assessments/run", json={"limit": 1}, cookies=admin_auth["cookie"]
    )
    assert response.status_code == 200, response.text
    assert response.json()["attempted"] == 1
    assert response.json()["created"] == 1
    assert await _assessment_count(fdata.db) == 1


async def test_limit_bounds_are_validated(fdata, finance_client: AsyncClient, admin_auth):
    for bad in (0, 501):
        response = await finance_client.post(
            "/api/admin/finance/assessments/run", json={"limit": bad}, cookies=admin_auth["cookie"]
        )
        assert response.status_code == 422, response.text


async def test_partial_failure_does_not_abort_the_batch(
    fdata, finance_client: AsyncClient, admin_auth
):
    """A confirmed collection with no collected amount cannot be assessed on the
    collected-COD basis; it is reported in `failed` while the rest are created."""
    seller_id = await fdata.seller(await fdata.user("seller"))
    good = await _confirmed(fdata, seller_id, expected="200.00", collected="200.00")
    bad = await _confirmed(fdata, seller_id, expected="150.00", status="confirmed", collected=None)
    await fdata.policy(basis="collected_cod", rate="0.050000")

    response = await finance_client.post(
        "/api/admin/finance/assessments/run", json={"limit": 100}, cookies=admin_auth["cookie"]
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["created"] == 1
    assert body["failed"] == [{"shipmentId": bad, "code": "collection_unconfirmed"}]

    rows = (await fdata.db.execute(select(CommissionAssessment))).scalars().all()
    assert [row.shipment_id for row in rows] == [good]
    assert str(rows[0].commission_amount) == "10.00"


async def test_run_is_audited_once_with_counts(fdata, finance_client: AsyncClient, admin_auth):
    seller_id = await fdata.seller(await fdata.user("seller"))
    await _confirmed(fdata, seller_id)
    await fdata.policy(basis="order_value", rate="0.050000")

    await finance_client.post(
        "/api/admin/finance/assessments/run", json={"limit": 100}, cookies=admin_auth["cookie"]
    )

    events = (
        await fdata.db.execute(
            select(AuditEvent).where(AuditEvent.action == service.AUDIT_COMMISSION_RUN)
        )
    ).scalars().all()
    assert len(events) == 1
    assert events[0].actor_user_id == admin_auth["user_id"]
    assert events[0].audit_metadata["created"] == "1"
    assert events[0].audit_metadata["rate"] == "0.050000"


async def test_run_uses_the_active_policy_rate_not_a_default(
    fdata, finance_client: AsyncClient, admin_auth
):
    seller_id = await fdata.seller(await fdata.user("seller"))
    shipment_id = await _confirmed(fdata, seller_id, expected="100.00")
    # An older active policy and a deactivated one must both be ignored.
    older = await fdata.policy(basis="order_value", rate="0.200000")
    await fdata.db.execute(
        text('UPDATE "CommissionPolicy" SET "effectiveFrom" = now() - interval \'1 day\' WHERE id = :id'),
        {"id": older},
    )
    deactivated = await fdata.policy(basis="order_value", rate="0.300000")
    await fdata.db.execute(
        text('UPDATE "CommissionPolicy" SET "isActive" = false WHERE id = :id'), {"id": deactivated}
    )
    await fdata.policy(basis="order_value", rate="0.010000")

    response = await finance_client.post(
        "/api/admin/finance/assessments/run", json={"limit": 100}, cookies=admin_auth["cookie"]
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["rate"] == "0.010000"

    row = await fdata.db.scalar(
        select(CommissionAssessment).where(CommissionAssessment.shipment_id == shipment_id)
    )
    assert str(row.rate) == "0.010000"
    assert str(row.commission_amount) == "1.00"
