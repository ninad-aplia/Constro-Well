"""GET /api/admin/overview — aggregate metrics, windows, audit."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import Text, cast, func, select

from fastapi_app.domains.admin import service
from fastapi_app.models.audit import AuditEvent
from fastapi_app.models.identity import User
from fastapi_app.models.orders import EscrowEntry, Order, Shipment
from fastapi_app.models.seller import Seller

ACTION = "admin.overview.read"


def _cookie(token: str) -> dict[str, str]:
    return {"cw_session": token}


async def _admin_token(data) -> str:
    admin_id = await data.user(role="admin")
    return await data.session(admin_id)


async def _overview_rows(db):
    return (
        await db.execute(select(AuditEvent).where(AuditEvent.action == ACTION))
    ).scalars().all()


async def test_missing_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/overview")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


async def test_invalid_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/overview", cookies=_cookie("bad"))
    assert response.status_code == 401


@pytest.mark.parametrize("role", ["customer", "seller", "driver"])
async def test_non_admin_is_403(admin_client: AsyncClient, admin_data, role: str) -> None:
    user_id = await admin_data.user(role=role)
    token = await admin_data.session(user_id)

    response = await admin_client.get("/api/admin/overview", cookies=_cookie(token))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_admin_success_matches_database(admin_client: AsyncClient, admin_data, admin_db) -> None:
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=30)).replace(tzinfo=None)
    await admin_data.user(created_at=(now - timedelta(days=10)).replace(tzinfo=None))
    await admin_data.user(created_at=(now - timedelta(days=40)).replace(tzinfo=None))
    owner = await admin_data.user(role="seller", created_at=(now - timedelta(days=5)).replace(tzinfo=None))
    seller_id = await admin_data.seller(owner)
    customer = await admin_data.user(role="customer")
    await admin_data.order(customer, gross_total="999.99")
    await admin_data.escrow(seller_id=seller_id, entry_type="held", amount="100.10")
    await admin_data.escrow(seller_id=seller_id, entry_type="released", amount="50.05")
    await admin_db.commit()
    token = await _admin_token(admin_data)

    response = await admin_client.get("/api/admin/overview", cookies=_cookie(token))

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "generatedAt", "windows", "totals", "last30Days", "orderStages",
        "shipmentsByStatus", "ordersPerDay", "escrowByType", "kycPending",
    }
    assert set(body["totals"]) == {"users", "sellers", "orders", "cancelledOrders"}
    assert set(body["last30Days"]) == {"users", "sellers", "orders"}
    assert set(body["windows"]) == {"last30DaysStart", "dailyStart"}

    users_total = (await admin_db.execute(select(func.count()).select_from(User))).scalar_one()
    sellers_total = (await admin_db.execute(select(func.count()).select_from(Seller))).scalar_one()
    orders_total = (await admin_db.execute(select(func.count()).select_from(Order))).scalar_one()
    users_30 = (
        await admin_db.execute(select(func.count()).select_from(User).where(User.created_at >= cutoff))
    ).scalar_one()
    sellers_30 = (
        await admin_db.execute(select(func.count()).select_from(Seller).where(Seller.created_at >= cutoff))
    ).scalar_one()
    orders_30 = (
        await admin_db.execute(select(func.count()).select_from(Order).where(Order.created_at >= cutoff))
    ).scalar_one()
    cancelled = (
        await admin_db.execute(select(func.count()).select_from(Order).where(Order.cancelled.is_(True)))
    ).scalar_one()

    assert body["totals"] == {
        "users": users_total,
        "sellers": sellers_total,
        "orders": orders_total,
        "cancelledOrders": cancelled,
    }
    assert body["last30Days"] == {
        "users": users_30,
        "sellers": sellers_30,
        "orders": orders_30,
    }
    assert users_30 < users_total  # the 40-day-old fixture is excluded

    stage_map = {row["stage"]: row["count"] for row in body["orderStages"]}
    assert stage_map["ordered"] >= 1
    assert set(stage_map) == {"ordered", "packed", "shipped", "out_for_delivery", "delivered"}

    shipment_map = {row["status"]: row["count"] for row in body["shipmentsByStatus"]}
    assert shipment_map["new"] >= 1
    assert len(shipment_map) == 11

    assert len(body["ordersPerDay"]) == 30
    assert all(set(day) == {"date", "count"} for day in body["ordersPerDay"])
    assert sum(day["count"] for day in body["ordersPerDay"]) >= 1

    escrow_map = {row["type"]: row for row in body["escrowByType"]}
    held_sum = await admin_db.scalar(
        select(func.sum(EscrowEntry.amount)).where(cast(EscrowEntry.type, Text) == "held")
    )
    assert escrow_map["held"]["amount"] == f"{held_sum:.2f}"
    held_count = await admin_db.scalar(
        select(func.count()).select_from(EscrowEntry).where(cast(EscrowEntry.type, Text) == "held")
    )
    assert escrow_map["held"]["entries"] == held_count

    pending_gst = await admin_db.scalar(
        select(func.count()).select_from(Seller).where(cast(Seller.kyc_gst, Text) == "pending")
    )
    assert body["kycPending"]["gst"] == pending_gst
    assert set(body["kycPending"]) == {"gst", "pan", "cheque"}
    assert "email" not in response.text
    assert "addressSnapshot" not in response.text
    assert "SENSITIVE" not in response.text


async def test_read_is_audited_once(admin_client: AsyncClient, admin_data, admin_db) -> None:
    admin_id = await admin_data.user(role="admin")
    token = await admin_data.session(admin_id)
    before = {row.id for row in await _overview_rows(admin_db)}

    response = await admin_client.get("/api/admin/overview", cookies=_cookie(token))

    assert response.status_code == 200
    created = [row for row in await _overview_rows(admin_db) if row.id not in before]
    assert len(created) == 1
    event = created[0]
    assert event.actor_user_id == admin_id
    assert event.target_type == "AdminOverview"
    assert event.target_id is None


async def test_audit_failure_rolls_back(
    admin_client: AsyncClient, admin_data, admin_db, monkeypatch
) -> None:
    token = await _admin_token(admin_data)
    before = {row.id for row in await _overview_rows(admin_db)}

    async def failing_audit(db, **kwargs):
        db.add(
            AuditEvent(
                id="test_overview_audit_failure",
                actor_user_id=kwargs["actor_user_id"],
                action=kwargs["action"],
                target_type=kwargs["target_type"],
                audit_metadata=None,
            )
        )
        await db.flush()
        raise RuntimeError("simulated overview audit failure")

    monkeypatch.setattr(service, "record_admin_audit", failing_audit)

    response = await admin_client.get("/api/admin/overview", cookies=_cookie(token))

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "simulated overview audit failure" not in response.text
    assert {row.id for row in await _overview_rows(admin_db)} == before


async def test_existing_records_unchanged(admin_client: AsyncClient, admin_data, admin_db) -> None:
    token = await _admin_token(admin_data)
    counts = {
        "users": (await admin_db.execute(select(func.count()).select_from(User))).scalar_one(),
        "sellers": (await admin_db.execute(select(func.count()).select_from(Seller))).scalar_one(),
        "orders": (await admin_db.execute(select(func.count()).select_from(Order))).scalar_one(),
        "shipments": (await admin_db.execute(select(func.count()).select_from(Shipment))).scalar_one(),
        "escrow": (await admin_db.execute(select(func.count()).select_from(EscrowEntry))).scalar_one(),
    }

    response = await admin_client.get("/api/admin/overview", cookies=_cookie(token))
    assert response.status_code == 200

    assert (await admin_db.execute(select(func.count()).select_from(User))).scalar_one() == counts["users"]
    assert (await admin_db.execute(select(func.count()).select_from(Seller))).scalar_one() == counts["sellers"]
    assert (await admin_db.execute(select(func.count()).select_from(Order))).scalar_one() == counts["orders"]
    assert (await admin_db.execute(select(func.count()).select_from(Shipment))).scalar_one() == counts["shipments"]
    assert (await admin_db.execute(select(func.count()).select_from(EscrowEntry))).scalar_one() == counts["escrow"]
