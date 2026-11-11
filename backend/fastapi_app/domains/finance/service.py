"""Seller-collected COD finance domain (WP-1).

Business rules live here, not in route handlers. Every function runs inside the
caller's transaction (it never commits) so financial writes, their audit rows
and any state transitions succeed or fail together. Money is `decimal.Decimal`
throughout; the only rounding is `ROUND_HALF_UP` to 2 decimal places.

Accounting identities (all Decimal, per `SELLER_COLLECTED_COD_ARCHITECTURE.md`):
  * outstandingCommission = assessed − netAllocated
  * unallocatedRemittance = verifiedRemittances − netAllocations
  * a remittance is platform cash only after `received` (verified), never on
    `initiated`.
  * customer-refund adjustments are reported separately and do NOT reduce
    commission outstanding (no unapproved refund/accounting rule is assumed).
"""

from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from uuid import uuid4

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi_app.core.errors import ApiError
from fastapi_app.models.audit import AuditEvent
from fastapi_app.models.finance import (
    CodCollection,
    CommissionAssessment,
    CommissionPolicy,
    Remittance,
    RemittanceAllocation,
    SellerAdjustment,
)
from fastapi_app.models.orders import EscrowEntry, Shipment, ShipmentEvent
from fastapi_app.models.seller import Seller

TWO_PLACES = Decimal("0.01")
ZERO = Decimal("0")

# Audit action codes (all financial writes are audited).
AUDIT_COLLECTION_CONFIRM = "finance.collection.confirm"
AUDIT_COLLECTION_DISPUTE = "finance.collection.dispute"
AUDIT_COMMISSION_ASSESS = "finance.commission.assess"
AUDIT_COMMISSION_RUN = "finance.commission.run"
AUDIT_COMMISSION_WAIVE = "finance.commission.waive"
AUDIT_REMITTANCE_INITIATE = "finance.remittance.initiate"
AUDIT_REMITTANCE_VERIFY = "finance.remittance.verify"
AUDIT_REMITTANCE_FAIL = "finance.remittance.fail"
AUDIT_REMITTANCE_RETURN = "finance.remittance.return"
AUDIT_ALLOCATION_CREATE = "finance.allocation.create"
AUDIT_ALLOCATION_REVERSE = "finance.allocation.reverse"
AUDIT_ADJUSTMENT_CREATE = "finance.adjustment.create"
AUDIT_ADJUSTMENT_APPLY = "finance.adjustment.apply"
AUDIT_ADJUSTMENT_REVERSE = "finance.adjustment.reverse"
AUDIT_POLICY_CREATE = "finance.policy.create"


def utc_now() -> datetime:
    """Naive UTC timestamp, matching Prisma's `timestamp(3)` (no tz)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def money(value: Decimal) -> Decimal:
    """Quantize a monetary value to 2 decimal places (half-up)."""
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _must_exist(value, message: str = "Failed to reload record"):
    if value is None:
        raise ApiError(500, "internal_error", message)
    return value


def compute_commission(basis_amount: Decimal, rate: Decimal) -> Decimal:
    """Commission = basis × rate, rounded half-up to 2 decimal places."""
    return money(basis_amount * rate)


async def record_finance_audit(
    db: AsyncSession,
    *,
    actor_user_id: str,
    action: str,
    target_type: str,
    target_id: str | None = None,
    metadata: dict | None = None,
) -> AuditEvent:
    """Adds (and flushes) one audit row in the caller's transaction; never commits."""
    event = AuditEvent(
        id=new_id("audit"),
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        audit_metadata=metadata,
    )
    db.add(event)
    await db.flush()
    return event


# --- Commission policy ------------------------------------------------------


async def get_active_policy(db: AsyncSession) -> CommissionPolicy | None:
    """Most recently effective active commission policy, or None (fail closed)."""
    return await db.scalar(
        select(CommissionPolicy)
        .where(CommissionPolicy.is_active.is_(True))
        .order_by(CommissionPolicy.effective_from.desc(), CommissionPolicy.id.desc())
        .limit(1)
    )


async def create_policy(
    db: AsyncSession, *, basis: str, rate: Decimal, admin_user_id: str
) -> CommissionPolicy:
    policy = CommissionPolicy(
        id=new_id("pol"),
        basis=basis,
        rate=rate,
        is_active=True,
        effective_from=utc_now(),
        created_at=utc_now(),
    )
    db.add(policy)
    await record_finance_audit(
        db,
        actor_user_id=admin_user_id,
        action=AUDIT_POLICY_CREATE,
        target_type="CommissionPolicy",
        target_id=policy.id,
        metadata={"basis": basis, "rate": str(rate)},
    )
    await db.flush()
    return policy


# --- COD collection ---------------------------------------------------------


async def get_collection_for_shipment(db: AsyncSession, shipment_id: str) -> CodCollection | None:
    return await db.scalar(
        select(CodCollection).where(CodCollection.shipment_id == shipment_id)
    )


async def _confirm_collection(
    db: AsyncSession,
    collection: CodCollection,
    *,
    collected_by: str,
    collector_user_id: str,
    collected_amount: Decimal,
    evidence_ref: str | None,
    note: str | None,
    event_actor: str,
    event_message: str,
) -> CodCollection:
    if collection.status != "pending":
        raise ApiError(409, "invalid_transition", "Collection has already been recorded")
    if collected_amount <= ZERO:
        raise ApiError(422, "validation_error", "Collected amount must be positive", "collectedAmount")

    now = utc_now()
    result = await db.execute(
        update(CodCollection)
        .where(CodCollection.id == collection.id, CodCollection.status == "pending")
        .values(
            collected_amount=money(collected_amount),
            collected_by=collected_by,
            collector_user_id=collector_user_id,
            status="confirmed",
            evidence_ref=evidence_ref,
            note=note,
            confirmed_at=now,
        )
    )
    if result.rowcount == 0:
        raise ApiError(409, "invalid_transition", "Collection has already been recorded")

    # Distinct financial event, separate from delivery OTP verification.
    db.add(
        ShipmentEvent(
            id=new_id("evt"),
            shipment_id=collection.shipment_id,
            actor=event_actor,
            message=event_message,
            at=now,
        )
    )
    await db.flush()
    fresh = await get_collection_for_shipment(db, collection.shipment_id)
    return _must_exist(fresh)


async def confirm_collection_as_seller(
    db: AsyncSession,
    *,
    shipment_id: str,
    seller_id: str,
    user_id: str,
    collected_amount: Decimal,
    evidence_ref: str | None,
    note: str | None,
) -> CodCollection:
    collection = await get_collection_for_shipment(db, shipment_id)
    if collection is None or collection.seller_id != seller_id:
        raise ApiError(404, "collection_not_found", "No COD collection found for this shipment")
    result = await _confirm_collection(
        db,
        collection,
        collected_by="seller",
        collector_user_id=user_id,
        collected_amount=collected_amount,
        evidence_ref=evidence_ref,
        note=note,
        event_actor="vendor",
        event_message="COD collected by seller",
    )
    await record_finance_audit(
        db,
        actor_user_id=user_id,
        action=AUDIT_COLLECTION_CONFIRM,
        target_type="CodCollection",
        target_id=result.id,
        metadata={"shipmentId": shipment_id, "amount": str(collected_amount)},
    )
    return result


async def confirm_collection_as_agent(
    db: AsyncSession,
    *,
    shipment_id: str,
    driver_id: str,
    seller_id: str,
    user_id: str,
    collected_amount: Decimal,
    evidence_ref: str | None,
    note: str | None,
) -> CodCollection:
    # The driver must be the shipment's assigned driver (the seller's agent).
    shipment = await db.scalar(
        select(Shipment).where(Shipment.id == shipment_id, Shipment.driver_id == driver_id)
    )
    if shipment is None:
        raise ApiError(404, "collection_not_found", "No assigned shipment found for this driver")
    collection = await get_collection_for_shipment(db, shipment_id)
    if collection is None or collection.seller_id != seller_id:
        raise ApiError(404, "collection_not_found", "No COD collection found for this shipment")
    result = await _confirm_collection(
        db,
        collection,
        collected_by="agent",
        collector_user_id=user_id,
        collected_amount=collected_amount,
        evidence_ref=evidence_ref,
        note=note,
        event_actor="driver",
        event_message="COD collected by assigned driver (seller's agent)",
    )
    await record_finance_audit(
        db,
        actor_user_id=user_id,
        action=AUDIT_COLLECTION_CONFIRM,
        target_type="CodCollection",
        target_id=result.id,
        metadata={"shipmentId": shipment_id, "amount": str(collected_amount)},
    )
    return result


async def dispute_collection(
    db: AsyncSession, *, collection_id: str, admin_user_id: str, note: str | None
) -> CodCollection:
    collection = await db.scalar(select(CodCollection).where(CodCollection.id == collection_id))
    if collection is None:
        raise ApiError(404, "collection_not_found", "COD collection not found")
    if collection.status not in ("pending", "confirmed"):
        raise ApiError(409, "invalid_transition", "Only a pending or confirmed collection can be disputed")
    result = await db.execute(
        update(CodCollection)
        .where(CodCollection.id == collection.id, CodCollection.status.in_(("pending", "confirmed")))
        .values(status="disputed", note=note)
    )
    if result.rowcount == 0:
        raise ApiError(409, "invalid_transition", "Collection state changed concurrently")
    await record_finance_audit(
        db,
        actor_user_id=admin_user_id,
        action=AUDIT_COLLECTION_DISPUTE,
        target_type="CodCollection",
        target_id=collection.id,
    )
    fresh = await db.scalar(select(CodCollection).where(CodCollection.id == collection_id))
    return _must_exist(fresh)


async def list_seller_collections(db: AsyncSession, seller_id: str) -> list[CodCollection]:
    rows = (
        await db.execute(
            select(CodCollection)
            .where(CodCollection.seller_id == seller_id)
            .order_by(CodCollection.created_at.desc(), CodCollection.id.desc())
        )
    ).scalars().all()
    return list(rows)


# --- Commission assessment --------------------------------------------------


async def assess_commission(
    db: AsyncSession,
    *,
    shipment_id: str,
    seller_id: str,
    assessed_by_user_id: str,
    policy: CommissionPolicy | None = None,
) -> CommissionAssessment:
    policy = policy or await get_active_policy(db)
    if policy is None:
        raise ApiError(409, "policy_not_configured", "No active commission policy is configured")

    collection = await get_collection_for_shipment(db, shipment_id)
    if collection is None or collection.seller_id != seller_id:
        raise ApiError(404, "collection_not_found", "No COD collection found for this shipment")

    if policy.basis == "collected_cod":
        if collection.collected_amount is None:
            raise ApiError(409, "collection_unconfirmed", "Commission basis requires a confirmed collection")
        basis_amount = collection.collected_amount
    else:
        basis_amount = collection.expected_amount

    commission = compute_commission(basis_amount, policy.rate)
    now = utc_now()
    assessment = CommissionAssessment(
        id=new_id("cm"),
        seller_id=seller_id,
        shipment_id=shipment_id,
        basis=policy.basis,
        basis_amount=money(basis_amount),
        rate=policy.rate,
        commission_amount=commission,
        status="assessed",
        assessed_by_user_id=assessed_by_user_id,
        assessed_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(assessment)
    try:
        await db.flush()
    except IntegrityError as exc:  # unique(shipmentId) -> already assessed
        raise ApiError(409, "assessment_exists", "Commission already assessed for this shipment") from exc

    await record_finance_audit(
        db,
        actor_user_id=assessed_by_user_id,
        action=AUDIT_COMMISSION_ASSESS,
        target_type="CommissionAssessment",
        target_id=assessment.id,
        metadata={
            "shipmentId": shipment_id,
            "basis": policy.basis,
            "rate": str(policy.rate),
            "commission": str(commission),
        },
    )
    return assessment


async def run_commission_assessments(
    db: AsyncSession, *, admin_user_id: str, limit: int = 200
) -> dict:
    """Assess commission for every confirmed collection that has none yet.

    Idempotent and fail-closed:
      * no active policy -> raise before writing anything (never guess a rate);
      * only confirmed collections with no assessment are selected, and the
        unique `CommissionAssessment.shipmentId` index is the final guard, so
        re-running the same run creates nothing;
      * `FOR UPDATE ... SKIP LOCKED` keeps two concurrent runs from processing
        the same collection;
      * a per-row SAVEPOINT means one bad row cannot abort the whole run.

    This is an explicit admin action, not a scheduler: no assessment cadence is
    assumed. A caller that wants automation may invoke it repeatedly.
    """
    policy = await get_active_policy(db)
    if policy is None:
        raise ApiError(409, "policy_not_configured", "No active commission policy is configured")

    rows = (
        await db.execute(
            select(CodCollection)
            .outerjoin(
                CommissionAssessment,
                CommissionAssessment.shipment_id == CodCollection.shipment_id,
            )
            .where(
                CodCollection.status == "confirmed",
                CommissionAssessment.id.is_(None),
            )
            .order_by(CodCollection.created_at.asc(), CodCollection.id.asc())
            .limit(limit)
            .with_for_update(of=CodCollection, skip_locked=True)
        )
    ).scalars().all()

    created = 0
    skipped = 0
    failed: list[dict[str, str]] = []
    for collection in rows:
        try:
            async with db.begin_nested():
                await assess_commission(
                    db,
                    shipment_id=collection.shipment_id,
                    seller_id=collection.seller_id,
                    assessed_by_user_id=admin_user_id,
                    policy=policy,
                )
            created += 1
        except ApiError as exc:
            if exc.code == "assessment_exists":
                skipped += 1
            else:
                failed.append({"shipmentId": collection.shipment_id, "code": exc.code})

    await record_finance_audit(
        db,
        actor_user_id=admin_user_id,
        action=AUDIT_COMMISSION_RUN,
        target_type="CommissionAssessment",
        metadata={
            "policyId": policy.id,
            "basis": policy.basis,
            "rate": str(policy.rate),
            "created": str(created),
            "skipped": str(skipped),
            "failed": str(len(failed)),
        },
    )
    return {
        "policyId": policy.id,
        "basis": policy.basis,
        "rate": str(policy.rate),
        "attempted": len(rows),
        "created": created,
        "skipped": skipped,
        "failed": failed,
    }


async def waive_assessment(
    db: AsyncSession, *, assessment_id: str, admin_user_id: str
) -> CommissionAssessment:
    assessment = await db.scalar(
        select(CommissionAssessment).where(CommissionAssessment.id == assessment_id)
    )
    if assessment is None:
        raise ApiError(404, "assessment_not_found", "Commission assessment not found")
    if assessment.status != "assessed":
        raise ApiError(409, "invalid_transition", "Only an unallocated assessment can be waived")
    result = await db.execute(
        update(CommissionAssessment)
        .where(CommissionAssessment.id == assessment_id, CommissionAssessment.status == "assessed")
        .values(status="waived")
    )
    if result.rowcount == 0:
        raise ApiError(409, "invalid_transition", "Assessment state changed concurrently")
    await record_finance_audit(
        db,
        actor_user_id=admin_user_id,
        action=AUDIT_COMMISSION_WAIVE,
        target_type="CommissionAssessment",
        target_id=assessment_id,
    )
    fresh = await db.scalar(
        select(CommissionAssessment).where(CommissionAssessment.id == assessment_id)
    )
    return _must_exist(fresh)


# --- Remittance -------------------------------------------------------------


async def initiate_remittance(
    db: AsyncSession,
    *,
    seller_id: str,
    user_id: str,
    amount: Decimal,
    method: str,
    reference: str,
    note: str | None,
) -> Remittance:
    if amount <= ZERO:
        raise ApiError(422, "validation_error", "Remittance amount must be positive", "amount")
    remittance = Remittance(
        id=new_id("rm"),
        seller_id=seller_id,
        amount=money(amount),
        method=method,
        reference=reference,
        status="initiated",
        initiated_by_user_id=user_id,
        initiated_at=utc_now(),
        note=note,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(remittance)
    try:
        await db.flush()
    except IntegrityError as exc:  # unique(sellerId, reference) -> duplicate submission
        raise ApiError(409, "duplicate_remittance", "A remittance with this reference already exists") from exc

    await record_finance_audit(
        db,
        actor_user_id=user_id,
        action=AUDIT_REMITTANCE_INITIATE,
        target_type="Remittance",
        target_id=remittance.id,
        metadata={"amount": str(amount), "method": method},
    )
    return remittance


async def get_remittance(db: AsyncSession, remittance_id: str) -> Remittance | None:
    return await db.scalar(select(Remittance).where(Remittance.id == remittance_id))


async def verify_remittance(
    db: AsyncSession, *, remittance_id: str, admin_user_id: str
) -> Remittance:
    remittance = await get_remittance(db, remittance_id)
    if remittance is None:
        raise ApiError(404, "remittance_not_found", "Remittance not found")
    if remittance.status != "initiated":
        raise ApiError(409, "invalid_transition", "Only an initiated remittance can be verified")
    result = await db.execute(
        update(Remittance)
        .where(Remittance.id == remittance_id, Remittance.status == "initiated")
        .values(status="received", received_at=utc_now(), verified_by_user_id=admin_user_id)
    )
    if result.rowcount == 0:
        raise ApiError(409, "invalid_transition", "Remittance state changed concurrently")
    await record_finance_audit(
        db,
        actor_user_id=admin_user_id,
        action=AUDIT_REMITTANCE_VERIFY,
        target_type="Remittance",
        target_id=remittance_id,
    )
    fresh = await get_remittance(db, remittance_id)
    return _must_exist(fresh)


async def fail_remittance(
    db: AsyncSession, *, remittance_id: str, admin_user_id: str, note: str | None
) -> Remittance:
    remittance = await get_remittance(db, remittance_id)
    if remittance is None:
        raise ApiError(404, "remittance_not_found", "Remittance not found")
    if remittance.status != "initiated":
        raise ApiError(409, "invalid_transition", "Only an initiated remittance can be failed")
    result = await db.execute(
        update(Remittance)
        .where(Remittance.id == remittance_id, Remittance.status == "initiated")
        .values(status="failed", note=note)
    )
    if result.rowcount == 0:
        raise ApiError(409, "invalid_transition", "Remittance state changed concurrently")
    await record_finance_audit(
        db,
        actor_user_id=admin_user_id,
        action=AUDIT_REMITTANCE_FAIL,
        target_type="Remittance",
        target_id=remittance_id,
    )
    fresh = await get_remittance(db, remittance_id)
    return _must_exist(fresh)


async def return_remittance(
    db: AsyncSession, *, remittance_id: str, admin_user_id: str, note: str | None
) -> Remittance:
    # Lock the remittance first: otherwise an allocation could be inserted between
    # the balance check below and the status update, returning money that is
    # already (partly) allocated to commission.
    remittance = await db.scalar(
        select(Remittance).where(Remittance.id == remittance_id).with_for_update()
    )
    if remittance is None:
        raise ApiError(404, "remittance_not_found", "Remittance not found")
    if remittance.status != "received":
        raise ApiError(409, "invalid_transition", "Only a received (unallocated) remittance can be returned")
    allocated = await _net_allocation_for_remittance(db, remittance_id)
    if allocated > ZERO:
        raise ApiError(409, "invalid_transition", "An allocated remittance cannot be returned")
    result = await db.execute(
        update(Remittance)
        .where(Remittance.id == remittance_id, Remittance.status == "received")
        .values(status="returned", note=note)
    )
    if result.rowcount == 0:
        raise ApiError(409, "invalid_transition", "Remittance state changed concurrently")
    await record_finance_audit(
        db,
        actor_user_id=admin_user_id,
        action=AUDIT_REMITTANCE_RETURN,
        target_type="Remittance",
        target_id=remittance_id,
    )
    fresh = await get_remittance(db, remittance_id)
    return _must_exist(fresh)


async def list_seller_remittances(db: AsyncSession, seller_id: str) -> list[Remittance]:
    rows = (
        await db.execute(
            select(Remittance)
            .where(Remittance.seller_id == seller_id)
            .order_by(Remittance.created_at.desc(), Remittance.id.desc())
        )
    ).scalars().all()
    return list(rows)


# --- Remittance allocation --------------------------------------------------


async def _net_allocation_for_remittance(db: AsyncSession, remittance_id: str) -> Decimal:
    rows = await db.execute(
        select(RemittanceAllocation.amount, RemittanceAllocation.kind).where(
            RemittanceAllocation.remittance_id == remittance_id
        )
    )
    net = ZERO
    for amount, kind in rows:
        net += amount if kind == "allocation" else -amount
    return net


async def _net_allocation_for_assessment(db: AsyncSession, assessment_id: str) -> Decimal:
    rows = await db.execute(
        select(RemittanceAllocation.amount, RemittanceAllocation.kind).where(
            RemittanceAllocation.assessment_id == assessment_id
        )
    )
    net = ZERO
    for amount, kind in rows:
        net += amount if kind == "allocation" else -amount
    return net


async def allocate(
    db: AsyncSession,
    *,
    remittance_id: str,
    assessment_id: str,
    amount: Decimal,
    admin_user_id: str,
) -> RemittanceAllocation:
    if amount <= ZERO:
        raise ApiError(422, "validation_error", "Allocation amount must be positive", "amount")
    amount = money(amount)

    remittance = await db.scalar(
        select(Remittance).where(Remittance.id == remittance_id).with_for_update()
    )
    if remittance is None:
        raise ApiError(404, "remittance_not_found", "Remittance not found")
    if remittance.status not in ("received", "allocated"):
        raise ApiError(409, "invalid_transition", "Only a verified remittance can be allocated")

    assessment = await db.scalar(
        select(CommissionAssessment).where(CommissionAssessment.id == assessment_id).with_for_update()
    )
    if assessment is None:
        raise ApiError(404, "assessment_not_found", "Commission assessment not found")
    # A remittance settles only its own seller's commission. Without this check an
    # admin (or a forged assessmentId) could clear another seller's receivable with
    # someone else's cash and corrupt both statements.
    if assessment.seller_id != remittance.seller_id:
        raise ApiError(
            409,
            "allocation_seller_mismatch",
            "The assessment belongs to a different seller than the remittance",
        )
    if assessment.status not in ("assessed", "partially_remitted"):
        raise ApiError(409, "invalid_transition", "Assessment is not open for allocation")

    remittance_used = await _net_allocation_for_remittance(db, remittance_id)
    assessment_used = await _net_allocation_for_assessment(db, assessment_id)

    if amount > remittance.amount - remittance_used:
        raise ApiError(
            409,
            "allocation_exceeds_remittance",
            "Allocation exceeds the remittance's unallocated balance",
        )
    if amount > assessment.commission_amount - assessment_used:
        raise ApiError(
            409,
            "allocation_exceeds_assessment",
            "Allocation exceeds the assessment's remaining commission",
        )

    now = utc_now()
    allocation = RemittanceAllocation(
        id=new_id("al"),
        remittance_id=remittance_id,
        assessment_id=assessment_id,
        amount=amount,
        kind="allocation",
        created_by_user_id=admin_user_id,
        created_at=now,
    )
    db.add(allocation)
    await db.flush()

    # Recompute statuses from the locked rows (net allocations now include this one).
    new_assessment_used = assessment_used + amount
    if new_assessment_used >= assessment.commission_amount:
        await db.execute(
            update(CommissionAssessment)
            .where(CommissionAssessment.id == assessment_id)
            .values(status="remitted")
        )
    else:
        await db.execute(
            update(CommissionAssessment)
            .where(CommissionAssessment.id == assessment_id)
            .values(status="partially_remitted")
        )

    new_remittance_used = remittance_used + amount
    if new_remittance_used >= remittance.amount:
        await db.execute(
            update(Remittance).where(Remittance.id == remittance_id).values(status="allocated")
        )

    await record_finance_audit(
        db,
        actor_user_id=admin_user_id,
        action=AUDIT_ALLOCATION_CREATE,
        target_type="RemittanceAllocation",
        target_id=allocation.id,
        metadata={"remittanceId": remittance_id, "assessmentId": assessment_id, "amount": str(amount)},
    )
    return allocation


async def reverse_allocation(
    db: AsyncSession, *, allocation_id: str, admin_user_id: str
) -> RemittanceAllocation:
    allocation = await db.scalar(
        select(RemittanceAllocation).where(RemittanceAllocation.id == allocation_id).with_for_update()
    )
    if allocation is None:
        raise ApiError(404, "allocation_not_found", "Allocation not found")
    if allocation.kind != "allocation":
        raise ApiError(409, "invalid_transition", "Only an allocation can be reversed")

    # Guard against double-reversal (a reversal referencing this allocation).
    already = await db.scalar(
        select(RemittanceAllocation).where(RemittanceAllocation.reverses_id == allocation_id)
    )
    if already is not None:
        raise ApiError(409, "invalid_transition", "Allocation is already reversed")

    remittance = await db.scalar(
        select(Remittance).where(Remittance.id == allocation.remittance_id).with_for_update()
    )
    assessment = await db.scalar(
        select(CommissionAssessment)
        .where(CommissionAssessment.id == allocation.assessment_id)
        .with_for_update()
    )
    if remittance is None or assessment is None:
        raise ApiError(404, "allocation_not_found", "Allocation references a missing record")

    reversal = RemittanceAllocation(
        id=new_id("al"),
        remittance_id=allocation.remittance_id,
        assessment_id=allocation.assessment_id,
        amount=allocation.amount,
        kind="reversal",
        reverses_id=allocation.id,
        created_by_user_id=admin_user_id,
        created_at=utc_now(),
    )
    db.add(reversal)
    await db.flush()

    # Demote statuses to reflect the compensating record.
    net_assessment = await _net_allocation_for_assessment(db, assessment.id)
    if net_assessment <= ZERO:
        new_status = "assessed"
    elif net_assessment >= assessment.commission_amount:
        new_status = "remitted"
    else:
        new_status = "partially_remitted"
    await db.execute(
        update(CommissionAssessment)
        .where(CommissionAssessment.id == assessment.id)
        .values(status=new_status)
    )

    net_remittance = await _net_allocation_for_remittance(db, remittance.id)
    if net_remittance < remittance.amount and remittance.status == "allocated":
        await db.execute(
            update(Remittance).where(Remittance.id == remittance.id).values(status="received")
        )

    await record_finance_audit(
        db,
        actor_user_id=admin_user_id,
        action=AUDIT_ALLOCATION_REVERSE,
        target_type="RemittanceAllocation",
        target_id=reversal.id,
        metadata={"reversesId": allocation_id, "amount": str(allocation.amount)},
    )
    return reversal


async def list_allocations_for_remittance(
    db: AsyncSession, remittance_id: str
) -> list[RemittanceAllocation]:
    rows = (
        await db.execute(
            select(RemittanceAllocation)
            .where(RemittanceAllocation.remittance_id == remittance_id)
            .order_by(RemittanceAllocation.created_at.asc(), RemittanceAllocation.id.asc())
        )
    ).scalars().all()
    return list(rows)


# --- Seller adjustments -----------------------------------------------------


async def _assert_references_belong_to_seller(
    db: AsyncSession,
    *,
    seller_id: str,
    shipment_id: str | None,
    order_id: str | None,
) -> None:
    """Reject adjustment references the seller does not own.

    Foreign keys alone only prove an id exists, so an admin request could
    otherwise attach seller A's adjustment to seller B's shipment/order and skew
    both statements. Missing and foreign ids return the same validation error so
    the response cannot be used to probe other sellers' ids.
    """
    shipment = None
    if shipment_id is not None:
        shipment = await db.scalar(select(Shipment).where(Shipment.id == shipment_id))
        if shipment is None or shipment.seller_id != seller_id:
            raise ApiError(
                422, "validation_error", "Unknown shipment for this seller", "shipmentId"
            )
    if order_id is not None:
        owned = await db.scalar(
            select(Shipment.id).where(
                Shipment.order_id == order_id, Shipment.seller_id == seller_id
            )
        )
        if owned is None:
            raise ApiError(422, "validation_error", "Unknown order for this seller", "orderId")
        if shipment is not None and shipment.order_id != order_id:
            raise ApiError(
                422,
                "validation_error",
                "Shipment does not belong to the given order",
                "orderId",
            )


async def create_adjustment(
    db: AsyncSession,
    *,
    seller_id: str,
    user_id: str,
    type_: str,
    amount: Decimal,
    reason: str,
    evidence_ref: str | None,
    shipment_id: str | None,
    order_id: str | None,
) -> SellerAdjustment:
    if amount <= ZERO:
        raise ApiError(422, "validation_error", "Adjustment amount must be positive", "amount")
    await _assert_references_belong_to_seller(
        db, seller_id=seller_id, shipment_id=shipment_id, order_id=order_id
    )
    now = utc_now()
    adjustment = SellerAdjustment(
        id=new_id("adj"),
        seller_id=seller_id,
        shipment_id=shipment_id,
        order_id=order_id,
        type=type_,
        amount=money(amount),
        reason=reason,
        evidence_ref=evidence_ref,
        status="open",
        created_by_user_id=user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(adjustment)
    await db.flush()
    await record_finance_audit(
        db,
        actor_user_id=user_id,
        action=AUDIT_ADJUSTMENT_CREATE,
        target_type="SellerAdjustment",
        target_id=adjustment.id,
        metadata={"type": type_, "amount": str(amount)},
    )
    return adjustment


async def apply_adjustment(
    db: AsyncSession, *, adjustment_id: str, admin_user_id: str
) -> SellerAdjustment:
    adjustment = await db.scalar(
        select(SellerAdjustment).where(SellerAdjustment.id == adjustment_id)
    )
    if adjustment is None:
        raise ApiError(404, "adjustment_not_found", "Adjustment not found")
    if adjustment.status != "open":
        raise ApiError(409, "invalid_transition", "Only an open adjustment can be applied")
    result = await db.execute(
        update(SellerAdjustment)
        .where(SellerAdjustment.id == adjustment_id, SellerAdjustment.status == "open")
        .values(status="applied", applied_by_user_id=admin_user_id, applied_at=utc_now())
    )
    if result.rowcount == 0:
        raise ApiError(409, "invalid_transition", "Adjustment state changed concurrently")
    await record_finance_audit(
        db,
        actor_user_id=admin_user_id,
        action=AUDIT_ADJUSTMENT_APPLY,
        target_type="SellerAdjustment",
        target_id=adjustment_id,
    )
    fresh = await db.scalar(select(SellerAdjustment).where(SellerAdjustment.id == adjustment_id))
    return _must_exist(fresh)


async def reverse_adjustment(
    db: AsyncSession, *, adjustment_id: str, admin_user_id: str, reason: str
) -> SellerAdjustment:
    original = await db.scalar(
        select(SellerAdjustment).where(SellerAdjustment.id == adjustment_id).with_for_update()
    )
    if original is None:
        raise ApiError(404, "adjustment_not_found", "Adjustment not found")
    if original.type not in ("customer_refund", "adjustment"):
        raise ApiError(409, "invalid_transition", "Only a refund or adjustment can be reversed")
    if original.status != "applied":
        raise ApiError(409, "invalid_transition", "Only an applied adjustment can be reversed")

    already = await db.scalar(
        select(SellerAdjustment).where(SellerAdjustment.reverses_id == adjustment_id)
    )
    if already is not None:
        raise ApiError(409, "invalid_transition", "Adjustment is already reversed")

    now = utc_now()
    reversal = SellerAdjustment(
        id=new_id("adj"),
        seller_id=original.seller_id,
        shipment_id=original.shipment_id,
        order_id=original.order_id,
        type="reversal",
        amount=original.amount,
        reason=reason,
        status="applied",
        created_by_user_id=admin_user_id,
        applied_by_user_id=admin_user_id,
        applied_at=now,
        reverses_id=original.id,
        created_at=now,
        updated_at=now,
    )
    db.add(reversal)
    await db.flush()
    await record_finance_audit(
        db,
        actor_user_id=admin_user_id,
        action=AUDIT_ADJUSTMENT_REVERSE,
        target_type="SellerAdjustment",
        target_id=reversal.id,
        metadata={"reversesId": adjustment_id, "amount": str(original.amount)},
    )
    return reversal


async def list_seller_adjustments(db: AsyncSession, seller_id: str) -> list[SellerAdjustment]:
    rows = (
        await db.execute(
            select(SellerAdjustment)
            .where(SellerAdjustment.seller_id == seller_id)
            .order_by(SellerAdjustment.created_at.asc(), SellerAdjustment.id.asc())
        )
    ).scalars().all()
    return list(rows)


# --- Statement --------------------------------------------------------------


def _net_adjustment(rows: list[SellerAdjustment]) -> Decimal:
    """Resolve applied adjustments (debit +, credit −, reversal negates)."""
    by_id = {row.id: row for row in rows}
    net = ZERO
    for row in rows:
        if row.type == "customer_refund":
            net -= row.amount
        elif row.type == "adjustment":
            net += row.amount
        elif row.type == "reversal":
            ref = by_id.get(row.reverses_id)
            if ref is not None and ref.type == "customer_refund":
                net += row.amount
            elif ref is not None and ref.type == "adjustment":
                net -= row.amount
    return net


async def seller_statement(db: AsyncSession, seller_id: str) -> dict:
    # Admin can address any seller by id, so verify it exists instead of returning
    # an all-zero statement that looks like real financial data.
    if await db.scalar(select(Seller.id).where(Seller.id == seller_id)) is None:
        raise ApiError(404, "seller_not_found", "Seller not found")
    # Collections.
    expected_cod = await db.scalar(
        select(func.coalesce(func.sum(CodCollection.expected_amount), 0)).where(
            CodCollection.seller_id == seller_id, CodCollection.status != "cancelled"
        )
    )
    confirmed_row = (
        await db.execute(
            select(
                func.coalesce(func.sum(CodCollection.collected_amount), 0),
                func.count(),
            ).where(CodCollection.seller_id == seller_id, CodCollection.status == "confirmed")
        )
    ).one()
    confirmed_cod, confirmed_count = confirmed_row[0], int(confirmed_row[1])

    pending_count = await db.scalar(
        select(func.count()).where(
            CodCollection.seller_id == seller_id, CodCollection.status == "pending"
        )
    )
    disputed_count = await db.scalar(
        select(func.count()).where(
            CodCollection.seller_id == seller_id, CodCollection.status == "disputed"
        )
    )
    discrepancy_row = (
        await db.execute(
            select(
                func.count(),
                func.coalesce(func.sum(CodCollection.collected_amount - CodCollection.expected_amount), 0),
            ).where(
                CodCollection.seller_id == seller_id,
                CodCollection.status == "confirmed",
                CodCollection.collected_amount != CodCollection.expected_amount,
            )
        )
    ).one()
    discrepancy_count, discrepancy_amount = int(discrepancy_row[0]), discrepancy_row[1]

    # Commission.
    assessed = await db.scalar(
        select(func.coalesce(func.sum(CommissionAssessment.commission_amount), 0)).where(
            CommissionAssessment.seller_id == seller_id,
            CommissionAssessment.status != "waived",
        )
    )
    net_allocated = await _seller_net_allocated(db, seller_id)
    adjustments = await list_seller_adjustments(db, seller_id)
    applied = [a for a in adjustments if a.status == "applied"]
    adjustment_net = _net_adjustment(applied)

    # Commission outstanding is purely assessed minus remitted. Customer-refund
    # adjustments are the seller's own cash actions (refunding a customer) and are
    # kept separately visible — no unapproved accounting rule is assumed to make
    # them reduce commission owed.
    outstanding = money(assessed) - money(net_allocated)

    # Remittances.
    received = await db.scalar(
        select(func.coalesce(func.sum(Remittance.amount), 0)).where(
            Remittance.seller_id == seller_id, Remittance.status.in_(("received", "allocated"))
        )
    )
    initiated = await db.scalar(
        select(func.coalesce(func.sum(Remittance.amount), 0)).where(
            Remittance.seller_id == seller_id, Remittance.status == "initiated"
        )
    )
    remittance_net = await _seller_remittance_net_allocated(db, seller_id)
    unallocated = money(received) - money(remittance_net)

    # Legacy escrow (historical, read-only, labelled separately).
    escrow_rows = (
        await db.execute(
            select(EscrowEntry.type, func.sum(EscrowEntry.amount))
            .where(EscrowEntry.seller_id == seller_id)
            .group_by(EscrowEntry.type)
        )
    ).all()
    escrow = {entry_type: ZERO for entry_type in ("held", "commission", "penalty", "refund", "released", "withdrawn")}
    for entry_type, total in escrow_rows:
        escrow[entry_type] = total

    return {
        "sellerId": seller_id,
        "generatedAt": utc_now(),
        "collections": {
            "expectedCod": str(money(expected_cod)),
            "confirmedCod": str(money(confirmed_cod)),
            "pendingCount": int(pending_count),
            "confirmedCount": confirmed_count,
            "disputedCount": int(disputed_count),
            "discrepancyCount": discrepancy_count,
            "discrepancyAmount": str(money(discrepancy_amount)),
        },
        "commission": {
            "assessed": str(money(assessed)),
            "remitted": str(money(net_allocated)),
            "outstanding": str(outstanding),
        },
        "remittances": {
            "received": str(money(received)),
            "unallocated": str(unallocated),
            "initiated": str(money(initiated)),
        },
        "adjustments": {"net": str(adjustment_net)},
        "legacyEscrow": {key: str(money(value)) for key, value in escrow.items()},
    }


async def _seller_net_allocated(db: AsyncSession, seller_id: str) -> Decimal:
    rows = await db.execute(
        select(RemittanceAllocation.amount, RemittanceAllocation.kind)
        .join(CommissionAssessment, CommissionAssessment.id == RemittanceAllocation.assessment_id)
        .where(CommissionAssessment.seller_id == seller_id)
    )
    net = ZERO
    for amount, kind in rows:
        net += amount if kind == "allocation" else -amount
    return net


async def _seller_remittance_net_allocated(db: AsyncSession, seller_id: str) -> Decimal:
    rows = await db.execute(
        select(RemittanceAllocation.amount, RemittanceAllocation.kind)
        .join(Remittance, Remittance.id == RemittanceAllocation.remittance_id)
        .where(Remittance.seller_id == seller_id, Remittance.status.in_(("received", "allocated")))
    )
    net = ZERO
    for amount, kind in rows:
        net += amount if kind == "allocation" else -amount
    return net


# --- Admin monitoring helpers -----------------------------------------------


async def list_discrepant_collections(db: AsyncSession) -> list[CodCollection]:
    """Confirmed collections whose collected amount differs from expected."""
    rows = (
        await db.execute(
            select(CodCollection)
            .where(
                CodCollection.status == "confirmed",
                CodCollection.collected_amount != CodCollection.expected_amount,
            )
            .order_by(CodCollection.created_at.desc(), CodCollection.id.desc())
        )
    ).scalars().all()
    return list(rows)


async def list_admin_collections(
    db: AsyncSession, *, status: str | None = None, limit: int = 200
) -> list[tuple[CodCollection, Seller]]:
    """All COD collections (optionally by status) with their seller, newest first."""
    conditions = []
    if status:
        conditions.append(CodCollection.status == status)
    rows = (
        await db.execute(
            select(CodCollection, Seller)
            .join(Seller, Seller.id == CodCollection.seller_id)
            .where(*conditions)
            .order_by(CodCollection.created_at.desc(), CodCollection.id.desc())
            .limit(limit)
        )
    ).all()
    return list(rows)


async def list_admin_remittances(
    db: AsyncSession, *, status: str | None = None, limit: int = 200
) -> list[tuple[Remittance, Seller]]:
    """All remittances (optionally by status) with their seller, newest first."""
    conditions = []
    if status:
        conditions.append(Remittance.status == status)
    rows = (
        await db.execute(
            select(Remittance, Seller)
            .join(Seller, Seller.id == Remittance.seller_id)
            .where(*conditions)
            .order_by(Remittance.created_at.desc(), Remittance.id.desc())
            .limit(limit)
        )
    ).all()
    return list(rows)


async def list_admin_assessments(
    db: AsyncSession, *, status: str | None = None, limit: int = 200
) -> list[tuple[CommissionAssessment, Seller]]:
    """All commission assessments (optionally by status) with their seller."""
    conditions = []
    if status:
        conditions.append(CommissionAssessment.status == status)
    rows = (
        await db.execute(
            select(CommissionAssessment, Seller)
            .join(Seller, Seller.id == CommissionAssessment.seller_id)
            .where(*conditions)
            .order_by(CommissionAssessment.created_at.desc(), CommissionAssessment.id.desc())
            .limit(limit)
        )
    ).all()
    return list(rows)


async def list_admin_adjustments(
    db: AsyncSession, *, status: str | None = None, limit: int = 200
) -> list[tuple[SellerAdjustment, Seller]]:
    """All seller adjustments (optionally by status) with their seller."""
    conditions = []
    if status:
        conditions.append(SellerAdjustment.status == status)
    rows = (
        await db.execute(
            select(SellerAdjustment, Seller)
            .join(Seller, Seller.id == SellerAdjustment.seller_id)
            .where(*conditions)
            .order_by(SellerAdjustment.created_at.desc(), SellerAdjustment.id.desc())
            .limit(limit)
        )
    ).all()
    return list(rows)
