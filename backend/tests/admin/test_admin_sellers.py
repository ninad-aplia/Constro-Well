"""GET /api/admin/sellers — authorization, KYC representation, audit."""

from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from fastapi_app.domains.admin import service
from fastapi_app.models.audit import AuditEvent
from fastapi_app.models.identity import User
from fastapi_app.models.seller import Seller

ACTION = "admin.sellers.list"
SELLER_KEYS = {
    "id",
    "storeName",
    "ownerUserId",
    "ownerName",
    "city",
    "vacationMode",
    "kycGst",
    "kycPan",
    "kycCheque",
    "createdAt",
}
SENSITIVE_MARKERS = ("SENSITIVE-BANK-REF", "Sensitive pickup address", "gstin", "bankRef", "pickupAddress")


def _cookie(token: str) -> dict[str, str]:
    return {"cw_session": token}


async def _token(data, role: str = "admin") -> tuple[str, str]:
    user_id = await data.user(role=role)
    return user_id, await data.session(user_id)


async def _list_audit_rows(db):
    return (
        await db.execute(select(AuditEvent).where(AuditEvent.action == ACTION))
    ).scalars().all()


async def test_missing_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/sellers")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


async def test_invalid_session_is_401(admin_client: AsyncClient) -> None:
    response = await admin_client.get("/api/admin/sellers", cookies=_cookie("bad-token"))
    assert response.status_code == 401


@pytest.mark.parametrize("role", ["customer", "seller", "driver"])
async def test_non_admin_is_403(admin_client: AsyncClient, admin_data, role: str) -> None:
    _, token = await _token(admin_data, role)

    response = await admin_client.get("/api/admin/sellers", cookies=_cookie(token))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_admin_success_contract_kyc_and_no_sensitive_fields(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    owner_id = await admin_data.user(role="seller", email="owner@admin.test")
    seller_id = await admin_data.seller(
        owner_id,
        seller_id="test_seller_contract",
        store_name="Contract Store",
        city="Nashik",
        kyc=("pending", "verified", "pending"),
        vacation_mode=True,
        created_at=datetime(2099, 2, 1, 10, 0, 0),
    )
    await admin_db.commit()

    response = await admin_client.get("/api/admin/sellers", cookies=_cookie(await admin_data.session(await admin_data.user(role="admin"))))

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"sellers", "pagination"}
    assert set(body["pagination"]) == {"page", "pageSize", "total", "totalPages"}
    seller = next(row for row in body["sellers"] if row["id"] == seller_id)
    assert set(seller) == SELLER_KEYS
    assert seller["ownerUserId"] == owner_id
    assert seller["ownerName"] == "Admin Test seller"
    assert seller["storeName"] == "Contract Store"
    assert seller["city"] == "Nashik"
    assert seller["vacationMode"] is True
    assert (seller["kycGst"], seller["kycPan"], seller["kycCheque"]) == ("pending", "verified", "pending")
    for marker in SENSITIVE_MARKERS:
        assert marker not in response.text


async def test_default_pagination_and_bounds(admin_client: AsyncClient, admin_data) -> None:
    _, token = await _token(admin_data)

    first = await admin_client.get("/api/admin/sellers", cookies=_cookie(token))
    assert first.status_code == 200
    assert first.json()["pagination"]["page"] == 1
    assert first.json()["pagination"]["pageSize"] == 20
    assert first.json()["pagination"]["total"] >= 1

    beyond = await admin_client.get(
        "/api/admin/sellers?page=10000&pageSize=50", cookies=_cookie(token)
    )
    assert beyond.status_code == 200
    assert beyond.json()["sellers"] == []
    assert beyond.json()["pagination"]["total"] >= 1

    for query in ("page=0", "pageSize=0", "pageSize=51", "pageSize=abc"):
        bad = await admin_client.get(f"/api/admin/sellers?{query}", cookies=_cookie(token))
        assert bad.status_code == 400
        assert bad.json()["error"]["code"] == "validation_error"


async def test_deterministic_ordering_and_tiebreak(admin_client: AsyncClient, admin_data, admin_db) -> None:
    newest = datetime(2099, 3, 1, 12, 0, 0)
    older = datetime(2099, 3, 1, 11, 0, 0)
    for suffix, created in (("zzz", newest), ("aaa", newest), ("mmm", older)):
        owner = await admin_data.user(role="seller")
        await admin_data.seller(
            owner, seller_id=f"test_seller_{suffix}", created_at=created
        )
    await admin_db.commit()
    _, token = await _token(admin_data)

    response = await admin_client.get(
        "/api/admin/sellers?page=1&pageSize=3", cookies=_cookie(token)
    )

    assert response.status_code == 200
    ids = [row["id"] for row in response.json()["sellers"]]
    assert ids == ["test_seller_zzz", "test_seller_aaa", "test_seller_mmm"]


async def test_success_creates_exactly_one_audit_event(
    admin_client: AsyncClient, admin_data, admin_db
) -> None:
    admin_id, token = await _token(admin_data)
    before = {row.id for row in await _list_audit_rows(admin_db)}

    response = await admin_client.get(
        "/api/admin/sellers?page=1&pageSize=5", cookies=_cookie(token)
    )

    assert response.status_code == 200
    created = [row for row in await _list_audit_rows(admin_db) if row.id not in before]
    assert len(created) == 1
    event = created[0]
    assert event.actor_user_id == admin_id
    assert event.action == ACTION
    assert event.target_type == "Seller"
    assert event.audit_metadata == {
        "page": 1,
        "pageSize": 5,
        "total": response.json()["pagination"]["total"],
    }


async def test_audit_failure_returns_500_and_leaves_no_event(
    admin_client: AsyncClient, admin_data, admin_db, monkeypatch
) -> None:
    _, token = await _token(admin_data)
    before = {row.id for row in await _list_audit_rows(admin_db)}

    async def failing_audit(db, **kwargs):
        db.add(
            AuditEvent(
                id="test_seller_audit_failure",
                actor_user_id=kwargs["actor_user_id"],
                action=kwargs["action"],
                target_type=kwargs["target_type"],
                audit_metadata=None,
            )
        )
        await db.flush()
        raise RuntimeError("simulated seller audit failure")

    monkeypatch.setattr(service, "record_admin_audit", failing_audit)

    response = await admin_client.get("/api/admin/sellers", cookies=_cookie(token))

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "simulated seller audit failure" not in response.text
    assert {row.id for row in await _list_audit_rows(admin_db)} == before


async def test_existing_records_unchanged(admin_client: AsyncClient, admin_data, admin_db) -> None:
    _, token = await _token(admin_data)
    users_before = (await admin_db.execute(select(func.count()).select_from(User))).scalar_one()
    sellers_before = (await admin_db.execute(select(func.count()).select_from(Seller))).scalar_one()
    committed_sellers = (
        await admin_db.execute(select(Seller.id).where(Seller.id.not_like("test_seller_%")))
    ).scalars().all()

    response = await admin_client.get("/api/admin/sellers", cookies=_cookie(token))
    assert response.status_code == 200

    assert (await admin_db.execute(select(func.count()).select_from(User))).scalar_one() == users_before
    assert (await admin_db.execute(select(func.count()).select_from(Seller))).scalar_one() == sellers_before
    after = (
        await admin_db.execute(select(Seller.id).where(Seller.id.not_like("test_seller_%")))
    ).scalars().all()
    assert after == committed_sellers
