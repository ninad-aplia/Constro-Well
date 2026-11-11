"""Admin dispute investigation and resolution (WP-2).

Approved policy:
- sellers may record customer-refund requests; admin authorizes/applies;
- refunds are seller-funded cash actions (the platform never transfers the cash);
- approval is capped by the issue claim (or confirmed COD for damaged goods);
- COD must be confirmed before resolution;
- an approved refund creates a proportional commission credit (never mutating
  the original assessment); surplus becomes a carried seller credit.
"""

from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi_app.core.errors import ApiError
from fastapi_app.domains.admin import service as admin_service
from fastapi_app.domains.finance import service as finance_service
from fastapi_app.models.finance import CodCollection, CommissionAssessment, SellerAdjustment
from fastapi_app.models.identity import User
from fastapi_app.models.orders import Order, OrderLine, Shipment, ShipmentEvent, ShipmentIssue
from fastapi_app.models.seller import Seller
from fastapi_app.schemas.admin import AdminPaginationOut
from fastapi_app.schemas.disputes import (
    DisputeDetailOut,
    DisputeEventOut,
    DisputeLineOut,
    DisputeListOut,
    DisputeResolveIn,
    DisputeResolveOut,
    DisputeRowOut,
    RefundRequestOut,
)

ADMIN_DISPUTES_LIST = "admin.disputes.list"
ADMIN_DISPUTE_DETAIL = "admin.disputes.detail"
ADMIN_DISPUTE_RESOLVE = "admin.disputes.resolve"

ZERO = Decimal("0")
TWO_PLACES = Decimal("0.01")


def _money(value: Decimal | None) -> str | None:
    return f"{value:.2f}" if value is not None else None


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _row_out(
    issue: ShipmentIssue,
    shipment: Shipment,
    order: Order,
    customer: User,
    seller: Seller,
    collection: CodCollection | None,
) -> DisputeRowOut:
    return DisputeRowOut(
        shipment_id=shipment.id,
        shipment_code=shipment.code,
        shipment_status=str(shipment.status),
        order_id=order.id,
        order_code=order.code,
        seller_id=seller.id,
        seller_name=seller.store_name,
        customer_name=customer.name,
        issue_type=issue.type,
        issue_note=issue.note,
        claim=_money(issue.claim),
        auto=issue.auto,
        cod_status=collection.status if collection else None,
        expected_amount=_money(collection.expected_amount) if collection else "0.00",
        collected_amount=_money(collection.collected_amount) if collection else None,
        created_at=issue.created_at,
    )


def _dispute_query():
    # No status filter: a resolved dispute must stay readable for its detail page
    # and audit trail. The queue applies the open-dispute filter itself.
    return (
        select(ShipmentIssue, Shipment, Order, User, Seller, CodCollection)
        .join(Shipment, Shipment.id == ShipmentIssue.shipment_id)
        .join(Order, Order.id == Shipment.order_id)
        .join(User, User.id == Order.user_id)
        .join(Seller, Seller.id == Shipment.seller_id)
        .outerjoin(CodCollection, CodCollection.shipment_id == Shipment.id)
    )


async def list_disputes(db: AsyncSession, *, page: int, page_size: int) -> DisputeListOut:
    total = (
        await db.execute(
            select(func.count())
            .select_from(ShipmentIssue)
            .join(Shipment, Shipment.id == ShipmentIssue.shipment_id)
            .where(Shipment.status == "disputed")
        )
    ).scalar_one()
    rows = (
        await db.execute(
            _dispute_query()
            .where(Shipment.status == "disputed")
            .order_by(ShipmentIssue.created_at.desc(), ShipmentIssue.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return DisputeListOut(
        disputes=[_row_out(*row) for row in rows],
        pagination=AdminPaginationOut(
            page=page,
            page_size=page_size,
            total=int(total),
            total_pages=(int(total) + page_size - 1) // page_size,
        ),
    )


async def _rate_for_shipment(
    db: AsyncSession, shipment_id: str
) -> tuple[Decimal | None, str]:
    assessment = await db.scalar(
        select(CommissionAssessment).where(CommissionAssessment.shipment_id == shipment_id)
    )
    if assessment is not None:
        return Decimal(assessment.rate), "assessment"
    policy = await finance_service.get_active_policy(db)
    if policy is not None:
        return Decimal(policy.rate), "policy"
    return None, "none"


def _refund_cap(issue: ShipmentIssue, collection: CodCollection | None) -> Decimal | None:
    """None means COD is not confirmed. Zero means nothing is refundable."""
    if (
        collection is None
        or collection.status != "confirmed"
        or collection.collected_amount is None
    ):
        return None
    collected = Decimal(collection.collected_amount)
    if issue.claim is not None:
        return min(Decimal(issue.claim), collected)
    # Policy: a damaged-goods report without a recorded claim is capped by the
    # confirmed COD; any other issue type without a claim has no refund basis.
    return collected if issue.type == "damaged_goods" else ZERO


def _refund_request_out(row: SellerAdjustment) -> RefundRequestOut:
    return RefundRequestOut(
        id=row.id,
        amount=f"{row.amount:.2f}",
        reason=row.reason,
        evidence_ref=row.evidence_ref,
        status=row.status,
        created_at=row.created_at,
    )


async def get_dispute(db: AsyncSession, shipment_id: str) -> DisputeDetailOut | None:
    row = (await db.execute(_dispute_query().where(Shipment.id == shipment_id))).first()
    if row is None:
        return None
    issue, shipment, order, customer, seller, collection = row
    lines = (
        await db.execute(
            select(OrderLine)
            .where(OrderLine.order_id == order.id)
            .order_by(OrderLine.id.asc())
        )
    ).scalars().all()
    events = (
        await db.execute(
            select(ShipmentEvent)
            .where(ShipmentEvent.shipment_id == shipment.id)
            .order_by(ShipmentEvent.at.asc(), ShipmentEvent.id.asc())
        )
    ).scalars().all()
    request = await db.scalar(
        select(SellerAdjustment)
        .where(
            SellerAdjustment.shipment_id == shipment.id,
            SellerAdjustment.type == "customer_refund",
            SellerAdjustment.status == "open",
        )
        .order_by(SellerAdjustment.created_at.desc(), SellerAdjustment.id.desc())
        .limit(1)
    )
    rate, source = await _rate_for_shipment(db, shipment.id)
    cap = _refund_cap(issue, collection)
    base = _row_out(issue, shipment, order, customer, seller, collection)
    return DisputeDetailOut(
        **base.model_dump(),
        customer_email=customer.email,
        shipment_created_at=shipment.created_at,
        delivered_qty=shipment.delivered_qty,
        commission_rate=f"{rate:.6f}" if rate is not None else None,
        commission_source=source,
        max_refund=_money(cap),
        refund_request=_refund_request_out(request) if request else None,
        lines=[
            DisputeLineOut(
                name=line.name,
                unit=line.unit,
                qty=line.qty,
                unit_price=f"{line.unit_price:.2f}",
                line_value=f"{line.line_value:.2f}",
            )
            for line in lines
        ],
        events=[
            DisputeEventOut(actor=str(event.actor), message=event.message, at=event.at)
            for event in events
        ],
    )


async def resolve_dispute(
    db: AsyncSession,
    *,
    shipment_id: str,
    admin_user_id: str,
    payload: DisputeResolveIn,
) -> DisputeResolveOut:
    shipment = await db.scalar(
        select(Shipment).where(Shipment.id == shipment_id).with_for_update()
    )
    if shipment is None:
        raise ApiError(404, "dispute_not_found", "Dispute not found")
    if shipment.status != "disputed":
        raise ApiError(409, "dispute_resolved", "This shipment is not an open dispute")

    issue = await db.scalar(
        select(ShipmentIssue)
        .where(ShipmentIssue.shipment_id == shipment_id)
        .with_for_update()
    )
    if issue is None:
        raise ApiError(409, "dispute_missing", "No dispute issue is recorded for this shipment")

    collection = await db.scalar(
        select(CodCollection)
        .where(CodCollection.shipment_id == shipment_id)
        .with_for_update()
    )
    cap = _refund_cap(issue, collection)

    now = _now()
    refund_amount = ZERO
    commission_reduction = ZERO
    refund_adjustment_id: str | None = None
    commission_credit_id: str | None = None
    rate = ZERO

    if payload.decision == "approve":
        # COD and policy only gate approvals: a rejection must always be possible
        # so a stuck or disputed collection cannot leave the dispute open forever.
        if cap is None:
            raise ApiError(
                409,
                "collection_not_confirmed",
                "The COD collection must be confirmed before a refund can be resolved",
            )
        row_rate, _source = await _rate_for_shipment(db, shipment_id)
        if row_rate is None:
            raise ApiError(
                409,
                "policy_not_configured",
                "An active commission policy is required to calculate the commission credit",
            )
        rate = row_rate
        if payload.approved_amount is None:
            raise ApiError(422, "validation_error", "Approved amount is required", "approvedAmount")
        if not payload.evidence_ref:
            raise ApiError(422, "validation_error", "Evidence reference is required", "evidenceRef")
        refund_amount = Decimal(payload.approved_amount).quantize(TWO_PLACES)
        if refund_amount <= ZERO:
            raise ApiError(422, "validation_error", "Approved amount must be positive", "approvedAmount")
        if refund_amount > cap:
            raise ApiError(
                422,
                "refund_exceeds_cap",
                f"Approved amount cannot exceed {cap:.2f}",
                "approvedAmount",
            )
        duplicate = await db.scalar(
            select(SellerAdjustment).where(
                SellerAdjustment.shipment_id == shipment_id,
                SellerAdjustment.type == "commission_credit",
                SellerAdjustment.status == "applied",
            )
        )
        if duplicate is not None:
            raise ApiError(409, "commission_credit_exists", "A commission credit already exists for this dispute")

        refund = await finance_service.create_adjustment(
            db,
            seller_id=shipment.seller_id,
            user_id=admin_user_id,
            type_="customer_refund",
            amount=refund_amount,
            reason=payload.reason,
            evidence_ref=payload.evidence_ref,
            shipment_id=shipment_id,
            order_id=shipment.order_id,
        )
        applied_refund = await finance_service.apply_adjustment(
            db, adjustment_id=refund.id, admin_user_id=admin_user_id
        )
        refund_adjustment_id = applied_refund.id

        commission_reduction = (refund_amount * rate).quantize(TWO_PLACES, ROUND_HALF_UP)
        if commission_reduction > ZERO:
            credit = await finance_service.create_adjustment(
                db,
                seller_id=shipment.seller_id,
                user_id=admin_user_id,
                type_="commission_credit",
                amount=commission_reduction,
                reason=f"Commission credit on approved customer refund ({payload.reason})",
                evidence_ref=payload.evidence_ref,
                shipment_id=shipment_id,
                order_id=shipment.order_id,
            )
            applied_credit = await finance_service.apply_adjustment(
                db, adjustment_id=credit.id, admin_user_id=admin_user_id
            )
            commission_credit_id = applied_credit.id

        outcome = "refunded" if refund_amount == cap else "settled"
        message = (
            f"Admin approved a seller-funded refund of INR {refund_amount:.2f} "
            f"({outcome}); commission credit INR {commission_reduction:.2f} recorded. "
            "The platform did not transfer cash."
        )
    else:
        outcome = "settled"
        message = f"Admin rejected the refund claim: {payload.reason}. The dispute is closed without a refund."

    shipment.status = outcome
    db.add(
        ShipmentEvent(
            id=f"evt_{uuid4().hex}",
            shipment_id=shipment_id,
            actor="system",
            message=message,
            at=now,
        )
    )
    await admin_service.record_admin_audit(
        db,
        actor_user_id=admin_user_id,
        action=ADMIN_DISPUTE_RESOLVE,
        target_type="Shipment",
        target_id=shipment_id,
        metadata={
            "decision": payload.decision,
            "refund": f"{refund_amount:.2f}",
            "commissionCredit": f"{commission_reduction:.2f}",
        },
    )
    await db.flush()
    return DisputeResolveOut(
        shipment_id=shipment_id,
        shipment_status=outcome,
        decision=payload.decision,
        refund_amount=f"{refund_amount:.2f}",
        commission_reduction=f"{commission_reduction:.2f}",
        commission_rate=f"{rate:.6f}",
        refund_adjustment_id=refund_adjustment_id,
        commission_credit_id=commission_credit_id,
        message=message,
    )
