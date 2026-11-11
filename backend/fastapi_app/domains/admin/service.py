"""Admin service (first vertical slice): paginated user overview + audit.

The audit writer never commits. The caller owns the transaction so the read and
its audit row succeed or fail together.
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import Date, Text, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi_app.models.audit import AuditEvent
from fastapi_app.models.identity import User
from fastapi_app.models.orders import (
    EscrowEntry,
    Order,
    OrderLine,
    Shipment,
    ShipmentEvent,
)
from fastapi_app.models.seller import Driver, Seller

ADMIN_USERS_LIST = "admin.users.list"
ADMIN_AUDIT_EVENTS_LIST = "admin.audit_events.list"
ADMIN_SELLERS_LIST = "admin.sellers.list"
ADMIN_SELLER_DETAIL = "admin.sellers.detail"
ADMIN_ORDERS_LIST = "admin.orders.list"
ADMIN_ORDER_DETAIL = "admin.orders.detail"
ADMIN_OVERVIEW_READ = "admin.overview.read"
ADMIN_SHIPMENTS_LIST = "admin.shipments.list"

ORDER_STAGES = ("ordered", "packed", "shipped", "out_for_delivery", "delivered")
SHIPMENT_STATUSES = (
    "new",
    "accepted",
    "packed",
    "dispatched",
    "failed",
    "review",
    "disputed",
    "settled",
    "rejected",
    "missed",
    "cancelled",
)

# Only deliberately whitelisted, non-sensitive metadata keys are exposed by the
# audit-log read. New writers must add keys here explicitly.
SAFE_METADATA_KEYS = ("page", "pageSize", "total")


def safe_metadata(raw: dict | None) -> dict:
    if not raw:
        return {}
    safe: dict = {}
    for key in SAFE_METADATA_KEYS:
        value = raw.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, str)) and len(str(value)) <= 120:
            safe[key] = value
    return safe


def audit_event_id() -> str:
    return f"audit_{uuid4().hex}"


async def list_users(
    db: AsyncSession, *, page: int, page_size: int
) -> tuple[list[User], int]:
    """Deterministic newest-first page plus the total count (2 queries, no N+1)."""
    total = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    rows = (
        await db.execute(
            select(User)
            .order_by(User.created_at.desc(), User.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return list(rows), int(total)


async def record_admin_audit(
    db: AsyncSession,
    *,
    actor_user_id: str,
    action: str,
    target_type: str,
    target_id: str | None = None,
    metadata: dict | None = None,
) -> AuditEvent:
    """Adds (and flushes) one audit row in the caller's transaction; never commits.

    `actor_user_id` must come from `require_admin`, never from request input.
    `metadata` must stay small and non-sensitive (no credentials, tokens,
    bodies or personal data beyond IDs).
    """
    event = AuditEvent(
        id=audit_event_id(),
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        audit_metadata=metadata,
    )
    db.add(event)
    await db.flush()
    return event


async def list_audit_events(
    db: AsyncSession,
    *,
    page: int,
    page_size: int,
    action: str | None = None,
    actor_id: str | None = None,
    start: "datetime | None" = None,
    end: "datetime | None" = None,
) -> tuple[list[tuple[AuditEvent, User]], int]:
    """Filtered newest-first page plus total. All filters apply before count/offset."""
    conditions = []
    if action:
        conditions.append(AuditEvent.action == action)
    if actor_id:
        conditions.append(AuditEvent.actor_user_id == actor_id)
    if start is not None:
        conditions.append(AuditEvent.created_at >= start)
    if end is not None:
        conditions.append(AuditEvent.created_at < end)

    total = (
        await db.execute(select(func.count()).select_from(AuditEvent).where(*conditions))
    ).scalar_one()
    rows = (
        await db.execute(
            select(AuditEvent, User)
            .join(User, User.id == AuditEvent.actor_user_id)
            .where(*conditions)
            .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return list(rows), int(total)


async def list_audit_filter_options(
    db: AsyncSession, *, limit: int = 200
) -> tuple[list[str], list[tuple[str, str]]]:
    """Bounded distinct action codes and actors that actually appear in audit rows."""
    actions = (
        await db.execute(
            select(AuditEvent.action)
            .distinct()
            .order_by(AuditEvent.action.asc())
            .limit(limit)
        )
    ).scalars().all()
    actors = (
        await db.execute(
            select(User.id, User.name)
            .join(AuditEvent, AuditEvent.actor_user_id == User.id)
            .distinct()
            .order_by(User.name.asc(), User.id.asc())
            .limit(limit)
        )
    ).all()
    return list(actions), [(row[0], row[1]) for row in actors]


async def list_sellers(
    db: AsyncSession, *, page: int, page_size: int
) -> tuple[list[tuple[Seller, User]], int]:
    """Newest-first sellers with their owning user (2 queries, no N+1)."""
    total = (await db.execute(select(func.count()).select_from(Seller))).scalar_one()
    rows = (
        await db.execute(
            select(Seller, User)
            .join(User, User.id == Seller.owner_user_id)
            .order_by(Seller.created_at.desc(), Seller.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return list(rows), int(total)


async def get_seller_detail(
    db: AsyncSession, seller_id: str
) -> tuple[Seller, User] | None:
    row = (
        await db.execute(
            select(Seller, User)
            .join(User, User.id == Seller.owner_user_id)
            .where(Seller.id == seller_id)
        )
    ).first()
    return (row[0], row[1]) if row else None


async def list_seller_audit_history(
    db: AsyncSession, seller_id: str, *, limit: int = 5
) -> list[tuple[AuditEvent, User]]:
    """Bounded seller-scoped audit rows (only operations written with targetId)."""
    rows = (
        await db.execute(
            select(AuditEvent, User)
            .join(User, User.id == AuditEvent.actor_user_id)
            .where(
                AuditEvent.target_type == "Seller",
                AuditEvent.target_id == seller_id,
            )
            .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
            .limit(limit)
        )
    ).all()
    return list(rows)


async def list_orders(
    db: AsyncSession, *, page: int, page_size: int
) -> tuple[list[tuple[Order, User]], int, dict[str, int], dict[str, list[tuple[Shipment, Seller]]]]:
    """Orders + customer, line counts and per-seller shipments (4 bounded queries)."""
    total = (await db.execute(select(func.count()).select_from(Order))).scalar_one()
    rows = (
        await db.execute(
            select(Order, User)
            .join(User, User.id == Order.user_id)
            .order_by(Order.created_at.desc(), Order.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    order_ids = [order.id for order, _ in rows]
    if not order_ids:
        return list(rows), int(total), {}, {}

    line_rows = (
        await db.execute(
            select(OrderLine.order_id, func.count(OrderLine.id))
            .where(OrderLine.order_id.in_(order_ids))
            .group_by(OrderLine.order_id)
        )
    ).all()
    line_counts = {order_id: int(count) for order_id, count in line_rows}

    shipment_rows = (
        await db.execute(
            select(Shipment, Seller)
            .join(Seller, Seller.id == Shipment.seller_id)
            .where(Shipment.order_id.in_(order_ids))
            .order_by(Shipment.created_at.asc(), Shipment.id.asc())
        )
    ).all()
    shipments: dict[str, list[tuple[Shipment, Seller]]] = {}
    for shipment, seller in shipment_rows:
        shipments.setdefault(shipment.order_id, []).append((shipment, seller))

    return list(rows), int(total), line_counts, shipments


async def list_shipments(
    db: AsyncSession, *, page: int, page_size: int, status: str | None
) -> tuple[list[tuple[Shipment, Seller, Order, Driver | None]], int]:
    """Cross-seller shipment monitoring (2 bounded queries): every shipment on the
    platform, optionally filtered to one status, newest first. Complements the
    per-order detail view (`get_order_detail`) which only shows one order's
    shipments at a time — this is the only place an admin can find, for
    example, every `failed`/`disputed`/`missed` shipment across all sellers
    without opening each order individually.
    """
    conditions = [Shipment.status == status] if status else []
    total = (
        await db.execute(select(func.count()).select_from(Shipment).where(*conditions))
    ).scalar_one()
    rows = (
        await db.execute(
            select(Shipment, Seller, Order, Driver)
            .join(Seller, Seller.id == Shipment.seller_id)
            .join(Order, Order.id == Shipment.order_id)
            .outerjoin(Driver, Driver.id == Shipment.driver_id)
            .where(*conditions)
            .order_by(Shipment.created_at.desc(), Shipment.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return list(rows), int(total)


async def get_order_detail(
    db: AsyncSession, order_id: str
):
    """Order + customer + lines + shipments + events + escrow rows (bounded to the order)."""
    row = (
        await db.execute(
            select(Order, User)
            .join(User, User.id == Order.user_id)
            .where(Order.id == order_id)
        )
    ).first()
    if row is None:
        return None
    order, customer = row

    lines = (
        await db.execute(
            select(OrderLine, Seller)
            .join(Seller, Seller.id == OrderLine.seller_id)
            .where(OrderLine.order_id == order_id)
            .order_by(OrderLine.id.asc())
        )
    ).all()
    shipments = (
        await db.execute(
            select(Shipment, Seller)
            .join(Seller, Seller.id == Shipment.seller_id)
            .where(Shipment.order_id == order_id)
            .order_by(Shipment.created_at.asc(), Shipment.id.asc())
        )
    ).all()
    shipment_ids = [shipment.id for shipment, _ in shipments]

    events: dict[str, list[ShipmentEvent]] = {}
    if shipment_ids:
        event_rows = (
            await db.execute(
                select(ShipmentEvent)
                .where(ShipmentEvent.shipment_id.in_(shipment_ids))
                .order_by(ShipmentEvent.at.asc(), ShipmentEvent.id.asc())
            )
        ).scalars().all()
        for event in event_rows:
            events.setdefault(event.shipment_id, []).append(event)

    escrow = (
        await db.execute(
            select(EscrowEntry, Seller)
            .outerjoin(Seller, Seller.id == EscrowEntry.seller_id)
            .where(
                (EscrowEntry.order_id == order_id)
                | (EscrowEntry.shipment_id.in_(shipment_ids) if shipment_ids else False)
            )
            .order_by(EscrowEntry.created_at.asc(), EscrowEntry.id.asc())
        )
    ).all()

    return {
        "order": order,
        "customer": customer,
        "lines": lines,
        "shipments": shipments,
        "events": events,
        "escrow": escrow,
    }


async def get_overview(db: AsyncSession, *, now: datetime | None = None) -> dict:
    """Aggregate admin metrics with explicit UTC boundaries (7 read queries)."""
    current = now or datetime.now(timezone.utc)
    current_naive = current.replace(tzinfo=None)
    start_30 = current_naive - timedelta(days=30)
    start_day = (current_naive - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)

    users_total, users_30 = (
        await db.execute(
            select(
                func.count(),
                func.count().filter(User.created_at >= start_30),
            )
        )
    ).one()

    sellers_row = (
        await db.execute(
            select(
                func.count(),
                func.count().filter(Seller.created_at >= start_30),
                func.count().filter(cast(Seller.kyc_gst, Text) == "pending"),
                func.count().filter(cast(Seller.kyc_pan, Text) == "pending"),
                func.count().filter(cast(Seller.kyc_cheque, Text) == "pending"),
            )
        )
    ).one()

    orders_total, orders_30, orders_cancelled = (
        await db.execute(
            select(
                func.count(),
                func.count().filter(Order.created_at >= start_30),
                func.count().filter(Order.cancelled.is_(True)),
            )
        )
    ).one()

    stage_rows = (
        await db.execute(
            select(Order.stage, func.count()).group_by(Order.stage)
        )
    ).all()
    stage_counts = {stage: 0 for stage in ORDER_STAGES}
    stage_counts.update({stage: int(count) for stage, count in stage_rows})

    shipment_rows = (
        await db.execute(
            select(Shipment.status, func.count()).group_by(Shipment.status)
        )
    ).all()
    shipment_counts = {status: 0 for status in SHIPMENT_STATUSES}
    shipment_counts.update({status: int(count) for status, count in shipment_rows})

    day_expression = cast(Order.created_at, Date)
    day_rows = (
        await db.execute(
            select(day_expression, func.count())
            .where(Order.created_at >= start_day)
            .group_by(day_expression)
            .order_by(day_expression)
        )
    ).all()
    by_day = {row[0].isoformat(): int(row[1]) for row in day_rows}
    days = [
        {
            "date": (start_day + timedelta(days=offset)).date().isoformat(),
            "count": by_day.get((start_day + timedelta(days=offset)).date().isoformat(), 0),
        }
        for offset in range(30)
    ]

    escrow_rows = (
        await db.execute(
            select(
                EscrowEntry.type,
                func.count(),
                func.sum(EscrowEntry.amount),
            )
            .group_by(EscrowEntry.type)
            .order_by(EscrowEntry.type.asc())
        )
    ).all()

    return {
        "generatedAt": current,
        "windows": {
            "last30DaysStart": start_30,
            "dailyStart": start_day,
        },
        "totals": {
            "users": int(users_total),
            "sellers": int(sellers_row[0]),
            "orders": int(orders_total),
            "cancelledOrders": int(orders_cancelled),
        },
        "last30Days": {
            "users": int(users_30),
            "sellers": int(sellers_row[1]),
            "orders": int(orders_30),
        },
        "orderStages": [
            {"stage": stage, "count": count} for stage, count in stage_counts.items()
        ],
        "shipmentsByStatus": [
            {"status": status, "count": count} for status, count in shipment_counts.items()
        ],
        "ordersPerDay": days,
        "escrowByType": [
            {"type": entry_type, "entries": int(count), "amount": f"{total:.2f}"}
            for entry_type, count, total in escrow_rows
        ],
        "kycPending": {
            "gst": int(sellers_row[2]),
            "pan": int(sellers_row[3]),
            "cheque": int(sellers_row[4]),
        },
    }
