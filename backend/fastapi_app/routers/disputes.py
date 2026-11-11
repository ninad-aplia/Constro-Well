"""Admin dispute/refund endpoints. Every read/write is audited; resolution is
transactional and admin-only. The seller/driver performs the cash refund; the
platform records and audits the adjustment and commission credit only."""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi_app.core.db import get_db
from fastapi_app.core.errors import ApiError
from fastapi_app.core.security import require_admin
from fastapi_app.domains.admin import service as admin_service
from fastapi_app.domains.disputes import service
from fastapi_app.models.identity import User
from fastapi_app.schemas.disputes import (
    DisputeDetailOut,
    DisputeListOut,
    DisputeResolveIn,
    DisputeResolveOut,
)

logger = logging.getLogger("constro_well.disputes")

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _page_params(page: int, page_size: int) -> tuple[int, int]:
    if page < 1 or page > 10_000:
        raise ApiError(400, "validation_error", "page must be between 1 and 10000", "page")
    if page_size < 1 or page_size > 50:
        raise ApiError(400, "validation_error", "pageSize must be between 1 and 50", "pageSize")
    return page, page_size


@router.get("/disputes", response_model=DisputeListOut, summary="Open delivery disputes")
async def list_disputes(
    page: int = Query(1),
    pageSize: int = Query(20),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> DisputeListOut:
    page, page_size = _page_params(page, pageSize)
    try:
        result = await service.list_disputes(db, page=page, page_size=page_size)
        await admin_service.record_admin_audit(
            db,
            actor_user_id=admin.id,
            action=service.ADMIN_DISPUTES_LIST,
            target_type="ShipmentIssue",
            metadata={"page": page, "pageSize": page_size, "total": result.pagination.total},
        )
        await db.commit()
    except ApiError:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception("admin_disputes_list_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None
    return result


@router.get("/disputes/{shipment_id}", response_model=DisputeDetailOut, summary="Dispute detail")
async def dispute_detail(
    shipment_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> DisputeDetailOut:
    sid = shipment_id.strip()
    if not sid or len(sid) > 100:
        raise ApiError(400, "validation_error", "Invalid shipment id", "id")
    try:
        detail = await service.get_dispute(db, sid)
        if detail is None:
            raise ApiError(404, "dispute_not_found", "Dispute not found")
        await admin_service.record_admin_audit(
            db,
            actor_user_id=admin.id,
            action=service.ADMIN_DISPUTE_DETAIL,
            target_type="Shipment",
            target_id=sid,
        )
        await db.commit()
    except ApiError:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception("admin_dispute_detail_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None
    return detail


@router.post(
    "/disputes/{shipment_id}/resolve",
    response_model=DisputeResolveOut,
    summary="Resolve a delivery dispute (full, partial or reject)",
)
async def resolve_dispute(
    shipment_id: str,
    payload: DisputeResolveIn,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> DisputeResolveOut:
    sid = shipment_id.strip()
    if not sid or len(sid) > 100:
        raise ApiError(400, "validation_error", "Invalid shipment id", "id")
    try:
        result = await service.resolve_dispute(
            db, shipment_id=sid, admin_user_id=admin.id, payload=payload
        )
        await db.commit()
    except ApiError:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception("admin_dispute_resolve_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None
    return result
