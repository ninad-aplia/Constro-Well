"""Admin routes — first vertical slice (`GET /api/admin/users`).

Authorization: `require_admin` (401 unauthenticated / 403 forbidden). The
paginated read and its AuditEvent row share one transaction: the request
commits only after both succeed, so a failed audit write can never produce a
successful unaudited response. Database errors are logged and returned as the
shared 500 envelope without internals.
"""

import logging
import math
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi_app.core.db import get_db
from fastapi_app.core.errors import ApiError
from fastapi_app.core.security import require_admin
from fastapi_app.domains.admin import service
from fastapi_app.models.identity import User
from fastapi_app.schemas.admin import (
    AdminActorActionCountOut,
    AdminActorDetailOut,
    AdminActorProfileOut,
    AdminActorSummaryOut,
    AdminAuditActorOption,
    AdminAuditFilterOptionsOut,
    AdminEscrowTypeOut,
    AdminKycPendingOut,
    AdminOrderCustomerOut,
    AdminOrderDayCount,
    AdminOrderDetailCustomerOut,
    AdminOrderDetailOut,
    AdminOrderDetailOrderOut,
    AdminOrderExistsOut,
    AdminOrderFinancialOut,
    AdminOrderLineOut,
    AdminOrderListOut,
    AdminOrderMoneyOut,
    AdminOrderOut,
    AdminOrderShipmentDetailOut,
    AdminOrderShipmentOut,
    AdminOrderStageCount,
    AdminShipmentListOut,
    AdminShipmentRowOut,
    AdminOverviewLast30,
    AdminOverviewOut,
    AdminOverviewTotals,
    AdminOverviewWindows,
    AdminPaginationOut,
    AdminShipmentStatusCount,
    AdminSellerAuditOut,
    AdminSellerDetailOut,
    AdminSellerListOut,
    AdminSellerOut,
    AdminSellerOwnerOut,
    AdminSellerProfileOut,
    AdminShipmentEventOut,
    AdminUserListOut,
    AdminUserOut,
    AuditActorOut,
    AuditEventListOut,
    AuditEventOut,
)

logger = logging.getLogger("constro_well.admin")

router = APIRouter(prefix="/api/admin", tags=["admin"])

MAX_PAGE = 10_000
MAX_PAGE_SIZE = 50


class UserListParams(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    page: int = Field(1, ge=1, le=MAX_PAGE)
    page_size: int = Field(20, ge=1, le=MAX_PAGE_SIZE, alias="pageSize")


class ShipmentListParams(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    page: int = Field(1, ge=1, le=MAX_PAGE)
    page_size: int = Field(20, ge=1, le=MAX_PAGE_SIZE, alias="pageSize")
    status: str | None = Field(None, max_length=20)


class AuditFilterParams(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    action: str | None = Field(None, max_length=100)
    actor_id: str | None = Field(None, alias="actorId", max_length=100)
    from_: datetime | None = Field(None, alias="from")
    to: datetime | None = None


def _parse_audit_filters(request: Request) -> AuditFilterParams:
    try:
        return AuditFilterParams.model_validate(dict(request.query_params))
    except ValidationError as error:
        first = error.errors()[0]
        field = ".".join(str(part) for part in first["loc"]) or None
        raise ApiError(400, "validation_error", first["msg"], field) from None


def _utc_naive(value: datetime) -> datetime:
    """Normalize to naive UTC (Prisma stores timestamps without timezone)."""
    aware = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    return aware.replace(tzinfo=None)


def _parse_params(request: Request) -> UserListParams:
    try:
        return UserListParams.model_validate(dict(request.query_params))
    except ValidationError as error:
        first = error.errors()[0]
        field = ".".join(str(part) for part in first["loc"]) or None
        raise ApiError(400, "validation_error", first["msg"], field) from None


def _parse_shipment_params(request: Request) -> ShipmentListParams:
    try:
        params = ShipmentListParams.model_validate(dict(request.query_params))
    except ValidationError as error:
        first = error.errors()[0]
        field = ".".join(str(part) for part in first["loc"]) or None
        raise ApiError(400, "validation_error", first["msg"], field) from None
    if params.status is not None and params.status not in service.SHIPMENT_STATUSES:
        raise ApiError(400, "validation_error", "Unknown shipment status", "status")
    return params


@router.get("/users", response_model=AdminUserListOut, summary="Paginated user overview")
async def list_users(
    request: Request,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserListOut:
    params = _parse_params(request)
    try:
        users, total = await service.list_users(db, page=params.page, page_size=params.page_size)
        await service.record_admin_audit(
            db,
            actor_user_id=admin.id,
            action=service.ADMIN_USERS_LIST,
            target_type="User",
            metadata={"page": params.page, "pageSize": params.page_size, "total": total},
        )
        await db.commit()
    except Exception:
        await db.rollback()
        # Never expose database internals (or the failed audit cause) to the client.
        logger.exception("admin_users_list_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None

    return AdminUserListOut(
        users=[
            AdminUserOut(
                id=user.id,
                email=user.email,
                name=user.name,
                phone=user.phone,
                role=user.role,
                created_at=user.created_at,
            )
            for user in users
        ],
        pagination=AdminPaginationOut(
            page=params.page,
            page_size=params.page_size,
            total=total,
            total_pages=math.ceil(total / params.page_size),
        ),
    )


@router.get(
    "/audit-events/filters",
    response_model=AdminAuditFilterOptionsOut,
    summary="Audit action/actor filter options",
)
async def audit_filter_options(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminAuditFilterOptionsOut:
    actions, actors = await service.list_audit_filter_options(db)
    return AdminAuditFilterOptionsOut(
        actions=actions,
        actors=[AdminAuditActorOption(id=actor_id, name=name) for actor_id, name in actors],
    )


def _actor_id(raw: str) -> str:
    value = raw.strip()
    if not value or len(value) > 100:
        raise ApiError(400, "validation_error", "String must contain at most 100 character(s)", "id")
    return value


@router.get(
    "/actors/{actor_id}/exists",
    include_in_schema=False,
)
async def actor_exists(
    actor_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Lightweight existence check for the Next.js proxy (no audit row)."""
    if await service.get_admin_actor(db, _actor_id(actor_id)) is None:
        raise ApiError(404, "actor_not_found", "Administrator not found")
    return {"exists": True}


@router.get(
    "/actors/{actor_id}",
    response_model=AdminActorDetailOut,
    summary="Administrator audit drill-down",
)
async def actor_detail(
    actor_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminActorDetailOut:
    aid = _actor_id(actor_id)
    try:
        actor = await service.get_admin_actor(db, aid)
        if actor is None:
            raise ApiError(404, "actor_not_found", "Administrator not found")
        total, distinct_actions, first_seen, last_seen, actions, events = (
            await service.get_actor_activity(db, aid)
        )
        await service.record_admin_audit(
            db,
            actor_user_id=admin.id,
            action=service.ADMIN_ACTOR_DETAIL,
            target_type="User",
            target_id=aid,
            metadata={"total": total},
        )
        await db.commit()
    except ApiError:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception("admin_actor_detail_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None

    return AdminActorDetailOut(
        actor=AdminActorProfileOut(
            id=actor.id,
            name=actor.name,
            email=actor.email,
            role=actor.role,
            created_at=actor.created_at,
        ),
        summary=AdminActorSummaryOut(
            total_events=total,
            distinct_actions=distinct_actions,
            first_seen=first_seen,
            last_seen=last_seen,
        ),
        actions=[
            AdminActorActionCountOut(action=action, count=int(count))
            for action, count in actions
        ],
        events=[
            AuditEventOut(
                id=event.id,
                action=event.action,
                actor=AuditActorOut(id=actor_row.id, name=actor_row.name),
                target_type=event.target_type,
                target_id=event.target_id,
                metadata=service.safe_metadata(event.audit_metadata),
                created_at=event.created_at,
            )
            for event, actor_row in events
        ],
    )


@router.get(
    "/audit-events",
    response_model=AuditEventListOut,
    summary="Paginated audit activity",
)
async def list_audit_events(
    request: Request,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AuditEventListOut:
    params = _parse_params(request)
    filters = _parse_audit_filters(request)
    action = (filters.action or "").strip() or None
    actor_id = (filters.actor_id or "").strip() or None
    start = _utc_naive(filters.from_) if filters.from_ else None
    end = _utc_naive(filters.to) if filters.to else None
    if start is not None and end is not None and start >= end:
        raise ApiError(400, "validation_error", "from must be before to", "from")
    try:
        rows, total = await service.list_audit_events(
            db,
            page=params.page,
            page_size=params.page_size,
            action=action,
            actor_id=actor_id,
            start=start,
            end=end,
        )
        await service.record_admin_audit(
            db,
            actor_user_id=admin.id,
            action=service.ADMIN_AUDIT_EVENTS_LIST,
            target_type="AuditEvent",
            metadata={"page": params.page, "pageSize": params.page_size, "total": total},
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("admin_audit_events_list_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None

    return AuditEventListOut(
        events=[
            AuditEventOut(
                id=event.id,
                action=event.action,
                actor=AuditActorOut(id=actor.id, name=actor.name),
                target_type=event.target_type,
                target_id=event.target_id,
                metadata=service.safe_metadata(event.audit_metadata),
                created_at=event.created_at,
            )
            for event, actor in rows
        ],
        pagination=AdminPaginationOut(
            page=params.page,
            page_size=params.page_size,
            total=total,
            total_pages=math.ceil(total / params.page_size),
        ),
    )


@router.get(
    "/sellers",
    response_model=AdminSellerListOut,
    summary="Paginated seller overview with KYC status",
)
async def list_sellers(
    request: Request,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminSellerListOut:
    params = _parse_params(request)
    try:
        rows, total = await service.list_sellers(
            db, page=params.page, page_size=params.page_size
        )
        await service.record_admin_audit(
            db,
            actor_user_id=admin.id,
            action=service.ADMIN_SELLERS_LIST,
            target_type="Seller",
            metadata={"page": params.page, "pageSize": params.page_size, "total": total},
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("admin_sellers_list_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None

    return AdminSellerListOut(
        sellers=[
            AdminSellerOut(
                id=seller.id,
                store_name=seller.store_name,
                owner_user_id=seller.owner_user_id,
                owner_name=owner.name,
                city=seller.city,
                vacation_mode=seller.vacation_mode,
                kyc_gst=seller.kyc_gst,
                kyc_pan=seller.kyc_pan,
                kyc_cheque=seller.kyc_cheque,
                created_at=seller.created_at,
            )
            for seller, owner in rows
        ],
        pagination=AdminPaginationOut(
            page=params.page,
            page_size=params.page_size,
            total=total,
            total_pages=math.ceil(total / params.page_size),
        ),
    )


@router.get(
    "/sellers/{seller_id}/exists",
    include_in_schema=False,
)
async def seller_exists(
    seller_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Lightweight existence check for the Next.js proxy (no audit row)."""
    if await service.get_seller_detail(db, _seller_id(seller_id)) is None:
        raise ApiError(404, "seller_not_found", "Seller not found")
    return {"exists": True}


def _seller_id(raw: str) -> str:
    value = raw.strip()
    if not value or len(value) > 100:
        raise ApiError(400, "validation_error", "String must contain at most 100 character(s)", "id")
    return value


@router.get(
    "/sellers/{seller_id}",
    response_model=AdminSellerDetailOut,
    summary="Seller detail with stored KYC flags",
)
async def seller_detail(
    seller_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminSellerDetailOut:
    sid = _seller_id(seller_id)
    try:
        detail = await service.get_seller_detail(db, sid)
        if detail is None:
            raise ApiError(404, "seller_not_found", "Seller not found")
        seller, owner = detail
        # Bounded, explicit "what has been recorded against this seller" list;
        # only operations written with targetType='Seller' + targetId are shown.
        history = await service.list_seller_audit_history(db, sid)
        await service.record_admin_audit(
            db,
            actor_user_id=admin.id,
            action=service.ADMIN_SELLER_DETAIL,
            target_type="Seller",
            target_id=sid,
        )
        await db.commit()
    except ApiError:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception("admin_seller_detail_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None

    return AdminSellerDetailOut(
        seller=AdminSellerProfileOut(
            id=seller.id,
            store_name=seller.store_name,
            city=seller.city,
            phone=seller.phone,
            vacation_mode=seller.vacation_mode,
            kyc_gst=seller.kyc_gst,
            kyc_pan=seller.kyc_pan,
            kyc_cheque=seller.kyc_cheque,
            created_at=seller.created_at,
        ),
        owner=AdminSellerOwnerOut(
            id=owner.id,
            name=owner.name,
            email=owner.email,
            created_at=owner.created_at,
        ),
        audit_history=[
            AdminSellerAuditOut(
                id=event.id,
                action=event.action,
                actor=AuditActorOut(id=actor.id, name=actor.name),
                created_at=event.created_at,
            )
            for event, actor in history
        ],
    )


@router.get(
    "/orders",
    response_model=AdminOrderListOut,
    summary="Paginated order monitoring",
)
async def list_orders(
    request: Request,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminOrderListOut:
    params = _parse_params(request)
    try:
        rows, total, line_counts, shipments = await service.list_orders(
            db, page=params.page, page_size=params.page_size
        )
        await service.record_admin_audit(
            db,
            actor_user_id=admin.id,
            action=service.ADMIN_ORDERS_LIST,
            target_type="Order",
            metadata={"page": params.page, "pageSize": params.page_size, "total": total},
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("admin_orders_list_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None

    return AdminOrderListOut(
        orders=[
            AdminOrderOut(
                id=order.id,
                code=order.code,
                customer=AdminOrderCustomerOut(id=customer.id, name=customer.name),
                stage=order.stage,
                cancelled=order.cancelled,
                gross_total=f"{order.gross_total:.2f}",
                line_count=line_counts.get(order.id, 0),
                shipment_count=len(shipments.get(order.id, [])),
                shipments=[
                    AdminOrderShipmentOut(
                        code=shipment.code,
                        seller_name=seller.store_name,
                        status=shipment.status,
                    )
                    for shipment, seller in shipments.get(order.id, [])
                ],
                created_at=order.created_at,
            )
            for order, customer in rows
        ],
        pagination=AdminPaginationOut(
            page=params.page,
            page_size=params.page_size,
            total=total,
            total_pages=math.ceil(total / params.page_size),
        ),
    )


@router.get(
    "/shipments",
    response_model=AdminShipmentListOut,
    summary="Paginated cross-seller shipment monitoring",
)
async def list_shipments(
    request: Request,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminShipmentListOut:
    params = _parse_shipment_params(request)
    try:
        rows, total = await service.list_shipments(
            db, page=params.page, page_size=params.page_size, status=params.status
        )
        await service.record_admin_audit(
            db,
            actor_user_id=admin.id,
            action=service.ADMIN_SHIPMENTS_LIST,
            target_type="Shipment",
            metadata={"page": params.page, "pageSize": params.page_size, "total": total},
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("admin_shipments_list_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None

    return AdminShipmentListOut(
        shipments=[
            AdminShipmentRowOut(
                id=shipment.id,
                code=shipment.code,
                order_id=shipment.order_id,
                order_code=order.code,
                seller_id=shipment.seller_id,
                seller_name=seller.store_name,
                status=shipment.status,
                driver_id=shipment.driver_id,
                driver_name=driver.name if driver else None,
                late=shipment.late,
                delivered_at=shipment.delivered_at,
                review_ends=shipment.review_ends,
                created_at=shipment.created_at,
            )
            for shipment, seller, order, driver in rows
        ],
        pagination=AdminPaginationOut(
            page=params.page,
            page_size=params.page_size,
            total=total,
            total_pages=math.ceil(total / params.page_size),
        ),
    )


def _order_id(raw: str) -> str:
    value = raw.strip()
    if not value or len(value) > 100:
        raise ApiError(400, "validation_error", "String must contain at most 100 character(s)", "id")
    return value


@router.get(
    "/overview",
    response_model=AdminOverviewOut,
    summary="Admin overview metrics (read only)",
)
async def overview(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminOverviewOut:
    try:
        data = await service.get_overview(db)
        await service.record_admin_audit(
            db,
            actor_user_id=admin.id,
            action=service.ADMIN_OVERVIEW_READ,
            target_type="AdminOverview",
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("admin_overview_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None

    return AdminOverviewOut(**data)


@router.get(
    "/orders/{order_id}/exists",
    response_model=AdminOrderExistsOut,
    include_in_schema=False,
)
async def order_exists(
    order_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminOrderExistsOut:
    """Lightweight existence check for the Next.js Proxy (no audit row)."""
    if (await service.get_order_detail(db, _order_id(order_id))) is None:
        raise ApiError(404, "order_not_found", "Order not found")
    return AdminOrderExistsOut(exists=True)


@router.get(
    "/orders/{order_id}",
    response_model=AdminOrderDetailOut,
    summary="Order detail (read only)",
)
async def order_detail(
    order_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminOrderDetailOut:
    oid = _order_id(order_id)
    try:
        detail = await service.get_order_detail(db, oid)
        if detail is None:
            raise ApiError(404, "order_not_found", "Order not found")
        await service.record_admin_audit(
            db,
            actor_user_id=admin.id,
            action=service.ADMIN_ORDER_DETAIL,
            target_type="Order",
            target_id=oid,
        )
        await db.commit()
    except ApiError:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception("admin_order_detail_failed")
        raise ApiError(500, "internal_error", "Something went wrong") from None

    order = detail["order"]
    customer = detail["customer"]
    return AdminOrderDetailOut(
        order=AdminOrderDetailOrderOut(
            id=order.id,
            code=order.code,
            stage=order.stage,
            cancelled=order.cancelled,
            payment_method=order.payment_method,
            payment_label=order.payment_label,
            created_at=order.created_at,
            updated_at=order.updated_at,
        ),
        customer=AdminOrderDetailCustomerOut(
            id=customer.id,
            name=customer.name,
            email=customer.email,
        ),
        money=AdminOrderMoneyOut(
            item_value=f"{order.item_value:.2f}",
            discount=f"{order.discount:.2f}",
            delivery_fee=f"{order.delivery_fee:.2f}",
            tax_amount=f"{order.tax_amount:.2f}",
            gross_total=f"{order.gross_total:.2f}",
        ),
        lines=[
            AdminOrderLineOut(
                id=line.id,
                name=line.name,
                unit=line.unit,
                unit_price=f"{line.unit_price:.2f}",
                qty=line.qty,
                line_value=f"{line.line_value:.2f}",
                seller_id=line.seller_id,
                seller_name=seller.store_name,
            )
            for line, seller in detail["lines"]
        ],
        shipments=[
            AdminOrderShipmentDetailOut(
                id=shipment.id,
                code=shipment.code,
                seller_id=shipment.seller_id,
                seller_name=seller.store_name,
                status=shipment.status,
                slot=shipment.slot,
                late=shipment.late,
                delivered_at=shipment.delivered_at,
                delivered_qty=shipment.delivered_qty,
                review_ends=shipment.review_ends,
                created_at=shipment.created_at,
                updated_at=shipment.updated_at,
                events=[
                    AdminShipmentEventOut(
                        id=event.id,
                        actor=event.actor,
                        message=event.message,
                        at=event.at,
                    )
                    for event in detail["events"].get(shipment.id, [])
                ],
            )
            for shipment, seller in detail["shipments"]
        ],
        financial_records=[
            AdminOrderFinancialOut(
                id=entry.id,
                type=entry.type,
                amount=f"{entry.amount:.2f}",
                created_at=entry.created_at,
                seller_id=entry.seller_id,
                seller_name=seller.store_name if seller else None,
                shipment_id=entry.shipment_id,
            )
            for entry, seller in detail["escrow"]
        ],
    )
