"""Seller-collected COD finance routes.

Three routers share `domains.finance.service`:
  * `seller_router`  — seller-facing (collection confirm, remittance, statement)
  * `driver_router`  — assigned-driver collection confirmation (seller's agent)
  * `admin_router`   — admin oversight (assessment, verification, allocation,
                       adjustments, disputes) — every write and read is audited.

Conventions mirror `routers/admin.py`: the shared error envelope, transaction +
audit atomicity (the caller commits; the service never commits), and exact
decimal-string money. No bank details, credentials or private documents are ever
returned.
"""

import logging
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi_app.core.db import get_db
from fastapi_app.core.errors import ApiError
from fastapi_app.core.security import require_admin, require_driver, require_seller
from fastapi_app.domains.finance import service
from fastapi_app.models.identity import User
from fastapi_app.models.seller import Driver, Seller
from fastapi_app.schemas.finance import (
    AdjustmentListOut,
    AllocateIn,
    AssessmentListOut,
    AssessmentRunIn,
    AssessmentRunOut,
    AssessmentListOut,
    AssessmentRunIn,
    AssessmentRunOut,
    CodCollectionOut,
    CollectionListOut,
    CommissionAssessmentOut,
    ConfirmCollectionIn,
    CreateAdjustmentIn,
    CreatePolicyIn,
    InitiateRemittanceIn,
    NoteIn,
    RemittanceAllocationOut,
    RemittanceListOut,
    RemittanceOut,
    ReverseAdjustmentIn,
    SellerAdjustmentOut,
    SellerStatementOut,
)

logger = logging.getLogger("constro_well.finance")

seller_router = APIRouter(prefix="/api/seller/finance", tags=["finance"])
driver_router = APIRouter(prefix="/api/driver/finance", tags=["finance"])
admin_router = APIRouter(prefix="/api/admin/finance", tags=["finance"])


# --- serialization helpers ---------------------------------------------------


def _collection_out(c, store_name: str | None = None) -> CodCollectionOut:
    return CodCollectionOut(
        id=c.id,
        shipment_id=c.shipment_id,
        seller_id=c.seller_id,
        store_name=store_name,
        expected_amount=f"{c.expected_amount:.2f}",
        collected_amount=f"{c.collected_amount:.2f}" if c.collected_amount is not None else None,
        collected_by=c.collected_by,
        status=c.status,
        evidence_ref=c.evidence_ref,
        note=c.note,
        confirmed_at=c.confirmed_at,
        created_at=c.created_at,
    )


def _assessment_out(a, store_name: str | None = None) -> CommissionAssessmentOut:
    return CommissionAssessmentOut(
        id=a.id,
        seller_id=a.seller_id,
        store_name=store_name,
        shipment_id=a.shipment_id,
        basis=a.basis,
        basis_amount=f"{a.basis_amount:.2f}",
        rate=f"{a.rate:.6f}",
        commission_amount=f"{a.commission_amount:.2f}",
        status=a.status,
        assessed_at=a.assessed_at,
        created_at=a.created_at,
    )


def _remittance_out(r, store_name: str | None = None) -> RemittanceOut:
    return RemittanceOut(
        id=r.id,
        seller_id=r.seller_id,
        store_name=store_name,
        amount=f"{r.amount:.2f}",
        method=r.method,
        reference=r.reference,
        status=r.status,
        initiated_at=r.initiated_at,
        received_at=r.received_at,
        created_at=r.created_at,
    )


def _allocation_out(a) -> RemittanceAllocationOut:
    return RemittanceAllocationOut(
        id=a.id,
        remittance_id=a.remittance_id,
        assessment_id=a.assessment_id,
        amount=f"{a.amount:.2f}",
        kind=a.kind,
        reverses_id=a.reverses_id,
        created_at=a.created_at,
    )


def _adjustment_out(a, store_name: str | None = None) -> SellerAdjustmentOut:
    return SellerAdjustmentOut(
        id=a.id,
        seller_id=a.seller_id,
        store_name=store_name,
        shipment_id=a.shipment_id,
        order_id=a.order_id,
        type=a.type,
        amount=f"{a.amount:.2f}",
        reason=a.reason,
        evidence_ref=a.evidence_ref,
        status=a.status,
        reverses_id=a.reverses_id,
        applied_at=a.applied_at,
        created_at=a.created_at,
    )


# --- seller routes -----------------------------------------------------------


@seller_router.get("/statement", response_model=SellerStatementOut, summary="Seller financial statement")
async def seller_statement(
    deps: tuple[User, Seller] = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
) -> SellerStatementOut:
    _, seller = deps
    data = await service.seller_statement(db, seller.id)
    return SellerStatementOut(**data)


@seller_router.get("/collections", response_model=CollectionListOut, summary="Seller COD collections")
async def seller_collections(
    deps: tuple[User, Seller] = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
) -> CollectionListOut:
    _, seller = deps
    rows = await service.list_seller_collections(db, seller.id)
    return CollectionListOut(collections=[_collection_out(c) for c in rows])


@seller_router.post(
    "/collections/{shipment_id}/confirm",
    response_model=CodCollectionOut,
    summary="Confirm COD collection (seller)",
)
async def seller_confirm_collection(
    shipment_id: str,
    body: ConfirmCollectionIn,
    deps: tuple[User, Seller] = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
) -> CodCollectionOut:
    user, seller = deps
    try:
        result = await service.confirm_collection_as_seller(
            db,
            shipment_id=shipment_id,
            seller_id=seller.id,
            user_id=user.id,
            collected_amount=body.collected_amount,
            evidence_ref=body.evidence_ref,
            note=body.note,
        )
        await db.commit()
    except ApiError:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception("seller_confirm_collection_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None
    return _collection_out(result)


@seller_router.get("/remittances", response_model=RemittanceListOut, summary="Seller remittances")
async def seller_remittances(
    deps: tuple[User, Seller] = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
) -> RemittanceListOut:
    _, seller = deps
    rows = await service.list_seller_remittances(db, seller.id)
    return RemittanceListOut(remittances=[_remittance_out(r) for r in rows])


@seller_router.post(
    "/remittances", response_model=RemittanceOut, summary="Initiate a remittance (seller)"
)
async def seller_initiate_remittance(
    body: InitiateRemittanceIn,
    deps: tuple[User, Seller] = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
) -> RemittanceOut:
    user, seller = deps
    try:
        result = await service.initiate_remittance(
            db,
            seller_id=seller.id,
            user_id=user.id,
            amount=body.amount,
            method=body.method,
            reference=body.reference,
            note=body.note,
        )
        await db.commit()
    except ApiError:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception("seller_initiate_remittance_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None
    return _remittance_out(result)


@seller_router.get("/adjustments", response_model=AdjustmentListOut, summary="Seller adjustments")
async def seller_adjustments(
    deps: tuple[User, Seller] = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
) -> AdjustmentListOut:
    _, seller = deps
    rows = await service.list_seller_adjustments(db, seller.id)
    return AdjustmentListOut(adjustments=[_adjustment_out(a) for a in rows])


@seller_router.post(
    "/adjustments", response_model=SellerAdjustmentOut, summary="Record a customer refund (seller)"
)
async def seller_create_adjustment(
    body: CreateAdjustmentIn,
    deps: tuple[User, Seller] = Depends(require_seller),
    db: AsyncSession = Depends(get_db),
) -> SellerAdjustmentOut:
    user, seller = deps
    if body.type != "customer_refund":
        raise ApiError(403, "forbidden", "Sellers may only record customer refunds")
    try:
        result = await service.create_adjustment(
            db,
            seller_id=seller.id,
            user_id=user.id,
            type_=body.type,
            amount=body.amount,
            reason=body.reason,
            evidence_ref=body.evidence_ref,
            shipment_id=body.shipment_id,
            order_id=body.order_id,
        )
        await db.commit()
    except ApiError:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception("seller_create_adjustment_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None
    return _adjustment_out(result)


# --- driver routes (seller's agent) -----------------------------------------


@driver_router.post(
    "/collections/{shipment_id}/confirm",
    response_model=CodCollectionOut,
    summary="Confirm COD collection (assigned driver, seller's agent)",
)
async def driver_confirm_collection(
    shipment_id: str,
    body: ConfirmCollectionIn,
    deps: tuple[User, Driver] = Depends(require_driver),
    db: AsyncSession = Depends(get_db),
) -> CodCollectionOut:
    user, driver = deps
    try:
        result = await service.confirm_collection_as_agent(
            db,
            shipment_id=shipment_id,
            driver_id=driver.id,
            seller_id=driver.seller_id,
            user_id=user.id,
            collected_amount=body.collected_amount,
            evidence_ref=body.evidence_ref,
            note=body.note,
        )
        await db.commit()
    except ApiError:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception("driver_confirm_collection_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None
    return _collection_out(result)


# --- admin routes ------------------------------------------------------------


async def _admin_write(fn, db: AsyncSession, failure_event: str):
    """Run a service write, commit, and map failures to the shared envelope."""
    try:
        result = await fn()
        await db.commit()
        return result
    except ApiError:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception(failure_event)
        raise ApiError(500, "internal_error", "Something went wrong") from None


@admin_router.get(
    "/collections/discrepancies",
    response_model=CollectionListOut,
    summary="COD collections with a confirmed amount differing from expected",
)
async def admin_collection_discrepancies(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> CollectionListOut:
    rows = await service.list_discrepant_collections(db)
    await service.record_finance_audit(
        db,
        actor_user_id=_admin.id,
        action="finance.collections.discrepancies.list",
        target_type="CodCollection",
    )
    await db.commit()
    return CollectionListOut(collections=[_collection_out(c) for c in rows])


@admin_router.get(
    "/collections",
    response_model=CollectionListOut,
    summary="All COD collections (optional status filter)",
)
async def admin_collections(
    status: str | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> CollectionListOut:
    rows = await service.list_admin_collections(db, status=status)
    await service.record_finance_audit(
        db,
        actor_user_id=admin.id,
        action="finance.collections.list",
        target_type="CodCollection",
    )
    await db.commit()
    return CollectionListOut(collections=[_collection_out(c, s.store_name) for c, s in rows])


@admin_router.get(
    "/remittances",
    response_model=RemittanceListOut,
    summary="All seller remittances (optional status filter)",
)
async def admin_remittances(
    status: str | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> RemittanceListOut:
    rows = await service.list_admin_remittances(db, status=status)
    await service.record_finance_audit(
        db,
        actor_user_id=admin.id,
        action="finance.remittances.list",
        target_type="Remittance",
    )
    await db.commit()
    return RemittanceListOut(remittances=[_remittance_out(r, s.store_name) for r, s in rows])


@admin_router.get(
    "/assessments",
    response_model=AssessmentListOut,
    summary="All commission assessments (optional status filter)",
)
async def admin_assessments(
    status: str | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AssessmentListOut:
    rows = await service.list_admin_assessments(db, status=status)
    await service.record_finance_audit(
        db,
        actor_user_id=admin.id,
        action="finance.assessments.list",
        target_type="CommissionAssessment",
    )
    await db.commit()
    return AssessmentListOut(assessments=[_assessment_out(a, s.store_name) for a, s in rows])


@admin_router.get(
    "/adjustments",
    response_model=AdjustmentListOut,
    summary="All seller adjustments (optional status filter)",
)
async def admin_adjustments(
    status: str | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdjustmentListOut:
    rows = await service.list_admin_adjustments(db, status=status)
    await service.record_finance_audit(
        db,
        actor_user_id=admin.id,
        action="finance.adjustments.list",
        target_type="SellerAdjustment",
    )
    await db.commit()
    return AdjustmentListOut(adjustments=[_adjustment_out(a, s.store_name) for a, s in rows])


@admin_router.post(
    "/collections/{collection_id}/dispute",
    response_model=CodCollectionOut,
    summary="Flag a COD collection as disputed",
)
async def admin_dispute_collection(
    collection_id: str,
    body: NoteIn | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> CodCollectionOut:
    result = await _admin_write(
        lambda: service.dispute_collection(
            db, collection_id=collection_id, admin_user_id=admin.id, note=body.note if body else None
        ),
        db,
        "admin_dispute_collection_failed",
    )
    return _collection_out(result)


@admin_router.post(
    "/assessments/run",
    response_model=AssessmentRunOut,
    summary="Assess commission for every confirmed, unassessed collection (idempotent)",
)
async def admin_run_assessments(
    body: AssessmentRunIn | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AssessmentRunOut:
    # Declared before `/assessments/{shipment_id}`: the literal path would
    # otherwise be captured as a shipment id.
    result = await _admin_write(
        lambda: service.run_commission_assessments(
            db, admin_user_id=admin.id, limit=body.limit if body else 200
        ),
        db,
        "admin_run_assessments_failed",
    )
    return AssessmentRunOut(**result)


@admin_router.post(
    "/assessments/{shipment_id}",
    response_model=CommissionAssessmentOut,
    summary="Assess commission for a shipment (active policy)",
)
async def admin_assess_commission(
    shipment_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> CommissionAssessmentOut:
    collection = await service.get_collection_for_shipment(db, shipment_id)
    if collection is None:
        raise ApiError(404, "collection_not_found", "No COD collection found for this shipment")
    result = await _admin_write(
        lambda: service.assess_commission(
            db,
            shipment_id=shipment_id,
            seller_id=collection.seller_id,
            assessed_by_user_id=admin.id,
        ),
        db,
        "admin_assess_commission_failed",
    )
    return _assessment_out(result)


@admin_router.post(
    "/assessments/{assessment_id}/waive",
    response_model=CommissionAssessmentOut,
    summary="Waive a commission assessment",
)
async def admin_waive_assessment(
    assessment_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> CommissionAssessmentOut:
    result = await _admin_write(
        lambda: service.waive_assessment(db, assessment_id=assessment_id, admin_user_id=admin.id),
        db,
        "admin_waive_assessment_failed",
    )
    return _assessment_out(result)


@admin_router.post(
    "/remittances/{remittance_id}/verify",
    response_model=RemittanceOut,
    summary="Verify a remittance receipt (platform cash)",
)
async def admin_verify_remittance(
    remittance_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> RemittanceOut:
    result = await _admin_write(
        lambda: service.verify_remittance(db, remittance_id=remittance_id, admin_user_id=admin.id),
        db,
        "admin_verify_remittance_failed",
    )
    return _remittance_out(result)


@admin_router.post(
    "/remittances/{remittance_id}/fail",
    response_model=RemittanceOut,
    summary="Mark an initiated remittance as failed",
)
async def admin_fail_remittance(
    remittance_id: str,
    body: NoteIn | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> RemittanceOut:
    result = await _admin_write(
        lambda: service.fail_remittance(
            db, remittance_id=remittance_id, admin_user_id=admin.id, note=body.note if body else None
        ),
        db,
        "admin_fail_remittance_failed",
    )
    return _remittance_out(result)


@admin_router.post(
    "/remittances/{remittance_id}/return",
    response_model=RemittanceOut,
    summary="Return a received (unallocated) remittance to the seller",
)
async def admin_return_remittance(
    remittance_id: str,
    body: NoteIn | None = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> RemittanceOut:
    result = await _admin_write(
        lambda: service.return_remittance(
            db, remittance_id=remittance_id, admin_user_id=admin.id, note=body.note if body else None
        ),
        db,
        "admin_return_remittance_failed",
    )
    return _remittance_out(result)


@admin_router.post(
    "/remittances/{remittance_id}/allocations",
    response_model=RemittanceAllocationOut,
    summary="Allocate a verified remittance against a commission assessment",
)
async def admin_allocate(
    remittance_id: str,
    body: AllocateIn,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> RemittanceAllocationOut:
    remittance = await service.get_remittance(db, remittance_id)
    if remittance is None:
        raise ApiError(404, "remittance_not_found", "Remittance not found")
    result = await _admin_write(
        lambda: service.allocate(
            db,
            remittance_id=remittance_id,
            assessment_id=body.assessment_id,
            amount=body.amount,
            admin_user_id=admin.id,
        ),
        db,
        "admin_allocate_failed",
    )
    return _allocation_out(result)


@admin_router.get(
    "/remittances/{remittance_id}/allocations",
    response_model=list[RemittanceAllocationOut],
    summary="List allocations for a remittance",
)
async def admin_list_allocations(
    remittance_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[RemittanceAllocationOut]:
    rows = await service.list_allocations_for_remittance(db, remittance_id)
    await service.record_finance_audit(
        db,
        actor_user_id=admin.id,
        action="finance.allocations.list",
        target_type="Remittance",
        target_id=remittance_id,
    )
    await db.commit()
    return [_allocation_out(a) for a in rows]


@admin_router.post(
    "/allocations/{allocation_id}/reverse",
    response_model=RemittanceAllocationOut,
    summary="Reverse an allocation (compensating record)",
)
async def admin_reverse_allocation(
    allocation_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> RemittanceAllocationOut:
    result = await _admin_write(
        lambda: service.reverse_allocation(db, allocation_id=allocation_id, admin_user_id=admin.id),
        db,
        "admin_reverse_allocation_failed",
    )
    return _allocation_out(result)


@admin_router.post(
    "/adjustments/{adjustment_id}/apply",
    response_model=SellerAdjustmentOut,
    summary="Apply a seller adjustment",
)
async def admin_apply_adjustment(
    adjustment_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SellerAdjustmentOut:
    result = await _admin_write(
        lambda: service.apply_adjustment(db, adjustment_id=adjustment_id, admin_user_id=admin.id),
        db,
        "admin_apply_adjustment_failed",
    )
    return _adjustment_out(result)


@admin_router.post(
    "/adjustments/{adjustment_id}/reverse",
    response_model=SellerAdjustmentOut,
    summary="Reverse an applied adjustment (compensating record)",
)
async def admin_reverse_adjustment(
    adjustment_id: str,
    body: ReverseAdjustmentIn,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SellerAdjustmentOut:
    result = await _admin_write(
        lambda: service.reverse_adjustment(
            db, adjustment_id=adjustment_id, admin_user_id=admin.id, reason=body.reason
        ),
        db,
        "admin_reverse_adjustment_failed",
    )
    return _adjustment_out(result)


@admin_router.post(
    "/policies", response_model=dict, summary="Create an active commission policy"
)
async def admin_create_policy(
    body: CreatePolicyIn,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await _admin_write(
        lambda: service.create_policy(
            db, basis=body.basis, rate=body.rate, admin_user_id=admin.id
        ),
        db,
        "admin_create_policy_failed",
    )
    return {"id": result.id, "basis": result.basis, "rate": f"{result.rate:.6f}", "isActive": result.is_active}


@admin_router.get(
    "/sellers/{seller_id}/statement",
    response_model=SellerStatementOut,
    summary="Admin view of a seller's financial statement",
)
async def admin_seller_statement(
    seller_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SellerStatementOut:
    data = await service.seller_statement(db, seller_id)
    await service.record_finance_audit(
        db,
        actor_user_id=admin.id,
        action="finance.statement.read",
        target_type="Seller",
        target_id=seller_id,
    )
    await db.commit()
    return SellerStatementOut(**data)
