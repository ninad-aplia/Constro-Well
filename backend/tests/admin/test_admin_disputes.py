"""WP-2 admin dispute resolution: authorization, caps, COD gating, statuses,
commission credits, carry-forward, reversal and audit."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select, text

from fastapi_app.models.audit import AuditEvent
from fastapi_app.models.finance import SellerAdjustment


def _cookie(token: str) -> dict[str, str]:
    return {"cw_session": token}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _token(data, role: str = "admin") -> tuple[str, str]:
    user_id = await data.user(role=role)
    return user_id, await data.session(user_id)


async def _make_dispute(
    data,
    db,
    *,
    shipment_status: str = "disputed",
    claim: str | None = "40.00",
    issue_type: str = "short_quantity",
    expected: str = "100.00",
    collected: str | None = "100.00",
    collection_status: str = "confirmed",
    with_policy: bool = True,
    assessment_rate: str | None = None,
    commission: str = "4.00",
):
    seller_user = await data.user(role="seller")
    seller = await data.seller(seller_user)
    customer = await data.user(role="customer")
    order = await data.order(customer)
    product_id = await db.scalar(text('SELECT id FROM "Product" LIMIT 1'))
    await db.execute(
        text(
            'INSERT INTO "OrderLine" (id, "orderId", "productId", "sellerId", name, unit, "unitPrice", qty, "lineValue") '
            "VALUES (:id, :order, :product, :seller, 'Test cement', 'bag', 50, 2, 100)"
        ),
        {"id": f"line_{uuid4().hex}", "order": order, "product": product_id, "seller": seller},
    )
    shipment = await data.shipment(order, seller, status=shipment_status)
    await db.execute(
        text(
            'INSERT INTO "ShipmentIssue" (id, "shipmentId", type, note, claim, auto, "createdAt") '
            "VALUES (:id, :shipment, CAST(:type AS \"ShipmentIssueType\"), :note, :claim, true, :now)"
        ),
        {
            "id": f"issue_{uuid4().hex}",
            "shipment": shipment,
            "type": issue_type,
            "note": "Test dispute",
            "claim": claim,
            "now": _now(),
        },
    )
    await db.execute(
        text(
            'INSERT INTO "CodCollection" (id, "shipmentId", "sellerId", "expectedAmount", "collectedAmount", '
            '"collectedBy", "collectorUserId", status, "evidenceRef", "note", "confirmedAt", "createdAt", "updatedAt") '
            "VALUES (:id, :shipment, :seller, :expected, :collected, 'seller', NULL, "
            'CAST(:status AS "CodCollectionStatus"), NULL, NULL, :confirmed, :now, :now)'
        ),
        {
            "id": f"col_{uuid4().hex}",
            "shipment": shipment,
            "seller": seller,
            "expected": expected,
            "collected": collected,
            "status": collection_status,
            "confirmed": _now() if collection_status == "confirmed" else None,
            "now": _now(),
        },
    )
    if with_policy:
        await db.execute(
            text(
                'INSERT INTO "CommissionPolicy" (id, basis, rate, "isActive", "effectiveFrom", "createdAt") '
                "VALUES (:id, 'order_value'::\"CommissionBasis\", '0.050000', true, :now, :now)"
            ),
            {"id": f"pol_{uuid4().hex}", "now": _now()},
        )
    if assessment_rate is not None:
        await db.execute(
            text(
                'INSERT INTO "CommissionAssessment" (id, "sellerId", "shipmentId", basis, "basisAmount", rate, '
                '"commissionAmount", status, "assessedAt", "createdAt", "updatedAt") '
                "VALUES (:id, :seller, :shipment, 'order_value'::\"CommissionBasis\", 100, :rate, :commission, "
                "'assessed'::\"CommissionStatus\", :now, :now, :now)"
            ),
            {
                "id": f"assess_{uuid4().hex}",
                "seller": seller,
                "shipment": shipment,
                "rate": assessment_rate,
                "commission": commission,
                "now": _now(),
            },
        )
    await db.commit()
    return {"seller": seller, "seller_user": seller_user, "order": order, "shipment": shipment}


async def test_requires_admin(admin_client: AsyncClient, admin_data) -> None:
    missing = await admin_client.get("/api/admin/disputes")
    assert missing.status_code == 401
    _, token = await _token(admin_data, "customer")
    forbidden = await admin_client.get("/api/admin/disputes", cookies=_cookie(token))
    assert forbidden.status_code == 403


async def test_list_and_detail_contract_and_audit(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    dispute = await _make_dispute(admin_data, admin_db)
    _, token = await _token(admin_data)

    listing = await admin_client.get("/api/admin/disputes", cookies=_cookie(token))
    assert listing.status_code == 200
    body = listing.json()
    row = next((item for item in body["disputes"] if item["shipmentId"] == dispute["shipment"]), None)
    assert row is not None
    assert row["issueType"] == "short_quantity"
    assert row["claim"] == "40.00"
    assert row["codStatus"] == "confirmed"

    detail = await admin_client.get(f"/api/admin/disputes/{dispute['shipment']}", cookies=_cookie(token))
    assert detail.status_code == 200
    d = detail.json()
    assert d["maxRefund"] == "40.00"  # claim is below collected COD
    assert d["commissionSource"] == "policy"
    assert d["commissionRate"] == "0.050000"
    assert d["lines"]

    actions = (
        await admin_db.execute(
            select(AuditEvent.action).where(
                AuditEvent.action.in_(["admin.disputes.list", "admin.disputes.detail"])
            )
        )
    ).scalars().all()
    assert "admin.disputes.list" in actions
    assert "admin.disputes.detail" in actions


async def test_full_approval_credit_and_unassessed_carry_forward(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    dispute = await _make_dispute(admin_data, admin_db)
    _, token = await _token(admin_data)

    response = await admin_client.post(
        f"/api/admin/disputes/{dispute['shipment']}/resolve",
        cookies=_cookie(token),
        json={"decision": "approve", "approvedAmount": "40.00", "reason": "Shortfall confirmed", "evidenceRef": "TICKET-1"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["shipmentStatus"] == "refunded"
    assert body["refundAmount"] == "40.00"
    assert body["commissionReduction"] == "2.00"

    adjustments = (
        await admin_db.execute(
            select(SellerAdjustment).where(SellerAdjustment.shipment_id == dispute["shipment"])
        )
    ).scalars().all()
    by_type = {a.type: a for a in adjustments}
    assert by_type["customer_refund"].amount == 40
    assert by_type["commission_credit"].amount == 2
    assert by_type["customer_refund"].status == "applied"
    assert by_type["commission_credit"].status == "applied"

    seller_session = await admin_data.session(dispute["seller_user"])
    statement = await admin_client.get(
        "/api/seller/finance/statement", cookies=_cookie(seller_session)
    )
    assert statement.status_code == 200
    money = statement.json()["commission"]
    assert money["creditApplied"] == "2.00"
    assert money["outstanding"] == "0.00"
    assert money["creditBalance"] == "2.00"

    # Second resolution is rejected: the dispute is no longer open.
    again = await admin_client.post(
        f"/api/admin/disputes/{dispute['shipment']}/resolve",
        cookies=_cookie(token),
        json={"decision": "approve", "approvedAmount": "40.00", "reason": "Again", "evidenceRef": "TICKET-2"},
    )
    assert again.status_code == 409

    # The resolved dispute stays readable but leaves the open queue.
    detail_after = await admin_client.get(
        f"/api/admin/disputes/{dispute['shipment']}", cookies=_cookie(token)
    )
    assert detail_after.status_code == 200
    assert detail_after.json()["shipmentStatus"] == "refunded"
    queue = await admin_client.get("/api/admin/disputes", cookies=_cookie(token))
    assert all(item["shipmentId"] != dispute["shipment"] for item in queue.json()["disputes"])


async def test_partial_approval_and_rejection(admin_client: AsyncClient, admin_data, admin_db) -> None:
    partial = await _make_dispute(admin_data, admin_db)
    rejected = await _make_dispute(admin_data, admin_db)
    _, token = await _token(admin_data)

    partial_response = await admin_client.post(
        f"/api/admin/disputes/{partial['shipment']}/resolve",
        cookies=_cookie(token),
        json={"decision": "approve", "approvedAmount": "20.00", "reason": "Partial", "evidenceRef": "TICKET-P"},
    )
    assert partial_response.status_code == 200
    assert partial_response.json()["shipmentStatus"] == "settled"
    assert partial_response.json()["commissionReduction"] == "1.00"

    reject_response = await admin_client.post(
        f"/api/admin/disputes/{rejected['shipment']}/resolve",
        cookies=_cookie(token),
        json={"decision": "reject", "reason": "No evidence of damage"},
    )
    assert reject_response.status_code == 200
    assert reject_response.json()["shipmentStatus"] == "settled"
    assert reject_response.json()["refundAmount"] == "0.00"

    rejected_adjustments = (
        await admin_db.execute(
            select(SellerAdjustment).where(SellerAdjustment.shipment_id == rejected["shipment"])
        )
    ).scalars().all()
    assert rejected_adjustments == []


async def test_over_claim_rejected(admin_client: AsyncClient, admin_data, admin_db) -> None:
    dispute = await _make_dispute(admin_data, admin_db)
    _, token = await _token(admin_data)

    over = await admin_client.post(
        f"/api/admin/disputes/{dispute['shipment']}/resolve",
        cookies=_cookie(token),
        json={"decision": "approve", "approvedAmount": "40.01", "reason": "Too much", "evidenceRef": "TEST"},
    )
    assert over.status_code == 422
    assert over.json()["error"]["code"] == "refund_exceeds_cap"


async def test_pending_cod_blocks_resolution(admin_client: AsyncClient, admin_data, admin_db) -> None:
    dispute = await _make_dispute(admin_data, admin_db, collection_status="disputed", collected=None)
    _, token = await _token(admin_data)

    blocked = await admin_client.post(
        f"/api/admin/disputes/{dispute['shipment']}/resolve",
        cookies=_cookie(token),
        json={"decision": "approve", "approvedAmount": "10.00", "reason": "Pending", "evidenceRef": "TEST"},
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "collection_not_confirmed"


async def test_missing_policy_blocks_resolution(admin_client: AsyncClient, admin_data, admin_db) -> None:
    dispute = await _make_dispute(admin_data, admin_db, with_policy=False)
    # A dev database may already carry an active policy; the outer test
    # transaction rolls this deactivation back.
    await admin_db.execute(text('UPDATE "CommissionPolicy" SET "isActive"=false WHERE "isActive"=true'))
    await admin_db.commit()
    _, token = await _token(admin_data)

    blocked = await admin_client.post(
        f"/api/admin/disputes/{dispute['shipment']}/resolve",
        cookies=_cookie(token),
        json={"decision": "approve", "approvedAmount": "10.00", "reason": "No policy", "evidenceRef": "TEST"},
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "policy_not_configured"


async def test_rejection_allowed_when_cod_is_disputed(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    dispute = await _make_dispute(
        admin_data, admin_db, collection_status="disputed", collected=None, with_policy=False
    )
    _, token = await _token(admin_data)

    response = await admin_client.post(
        f"/api/admin/disputes/{dispute['shipment']}/resolve",
        cookies=_cookie(token),
        json={"decision": "reject", "reason": "Collection disputed, no refund"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["shipmentStatus"] == "settled"
    assert response.json()["refundAmount"] == "0.00"


async def test_damaged_goods_cap_uses_confirmed_cod(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    dispute = await _make_dispute(
        admin_data, admin_db, claim=None, issue_type="damaged_goods", collected="75.00"
    )
    _, token = await _token(admin_data)

    detail = await admin_client.get(
        f"/api/admin/disputes/{dispute['shipment']}", cookies=_cookie(token)
    )
    assert detail.status_code == 200
    assert detail.json()["maxRefund"] == "75.00"


async def test_assessed_allocated_credit_and_reversal(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    dispute = await _make_dispute(
        admin_data, admin_db, assessment_rate="0.050000", commission="5.00"
    )
    _, token = await _token(admin_data)

    # Allocate the full assessed commission through a received remittance.
    remittance_id = f"rem_{uuid4().hex}"
    await admin_db.execute(
        text(
            'INSERT INTO "Remittance" (id, "sellerId", amount, method, reference, status, "initiatedAt", "createdAt", "updatedAt") '
            "VALUES (:id, :seller, 5, 'bank_transfer', :ref, 'received'::\"RemittanceStatus\", :now, :now, :now)"
        ),
        {"id": remittance_id, "seller": dispute["seller"], "ref": f"UTR-{uuid4().hex[:8]}", "now": _now()},
    )
    assessment = (
        await admin_db.execute(
            text('SELECT id FROM "CommissionAssessment" WHERE "shipmentId" = :s'),
            {"s": dispute["shipment"]},
        )
    ).scalar_one()
    await admin_db.execute(
        text(
            'INSERT INTO "RemittanceAllocation" (id, "remittanceId", "assessmentId", amount, kind, "createdAt") '
            "VALUES (:id, :rem, :assess, 5, 'allocation'::\"RemittanceAllocationKind\", :now)"
        ),
        {"id": f"alloc_{uuid4().hex}", "rem": remittance_id, "assess": assessment, "now": _now()},
    )
    await admin_db.commit()

    resolved = await admin_client.post(
        f"/api/admin/disputes/{dispute['shipment']}/resolve",
        cookies=_cookie(token),
        json={"decision": "approve", "approvedAmount": "40.00", "reason": "Full", "evidenceRef": "TICKET-R"},
    )
    assert resolved.status_code == 200, resolved.text
    body = resolved.json()

    seller_session = await admin_data.session(dispute["seller_user"])
    statement = (
        await admin_client.get("/api/seller/finance/statement", cookies=_cookie(seller_session))
    ).json()["commission"]
    assert statement["assessed"] == "5.00"
    assert statement["remitted"] == "5.00"
    assert statement["creditApplied"] == "2.00"
    assert statement["outstanding"] == "0.00"
    assert statement["creditBalance"] == "2.00"  # allocated 5 + credit 2 - assessed 5

    reversed_response = await admin_client.post(
        f"/api/admin/finance/adjustments/{body['refundAdjustmentId']}/reverse",
        cookies=_cookie(token),
        json={"reason": "Refund reversed"},
    )
    assert reversed_response.status_code == 200, reversed_response.text
    statement_after = (
        await admin_client.get("/api/seller/finance/statement", cookies=_cookie(seller_session))
    ).json()["commission"]
    assert statement_after["creditApplied"] == "0.00"
    assert statement_after["outstanding"] == "0.00"
    assert statement_after["creditBalance"] == "0.00"


async def test_seller_request_requires_evidence(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    dispute = await _make_dispute(admin_data, admin_db)
    seller_token = await admin_data.session(dispute["seller_user"])

    missing = await admin_client.post(
        "/api/seller/finance/adjustments",
        cookies=_cookie(seller_token),
        json={
            "type": "customer_refund",
            "amount": "40.00",
            "reason": "Short delivery",
            "shipmentId": dispute["shipment"],
        },
    )
    assert missing.status_code == 422
    assert missing.json()["error"]["field"] == "evidenceRef"

    created = await admin_client.post(
        "/api/seller/finance/adjustments",
        cookies=_cookie(seller_token),
        json={
            "type": "customer_refund",
            "amount": "40.00",
            "reason": "Short delivery",
            "evidenceRef": "TICKET-SELLER",
            "shipmentId": dispute["shipment"],
        },
    )
    assert created.status_code == 200, created.text
    assert created.json()["status"] == "open"
