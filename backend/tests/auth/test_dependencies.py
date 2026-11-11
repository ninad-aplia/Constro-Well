"""Reusable role dependencies, exercised directly against disposable rows."""

import pytest

from fastapi_app.core.errors import ApiError
from fastapi_app.core.security import (
    require_admin,
    require_customer,
    require_driver,
    require_seller,
    require_user,
)
from fastapi_app.models.identity import User


async def _load(db, user_id: str) -> User:
    user = await db.get(User, user_id)
    assert user is not None
    return user


async def test_require_user_returns_the_authenticated_row(db, identities) -> None:
    user_id, _ = await identities.user()
    user = await _load(db, user_id)

    assert (await require_user(user)).id == user_id


async def test_require_user_rejects_none() -> None:
    with pytest.raises(ApiError) as error:
        await require_user(None)
    assert error.value.status_code == 401


async def test_require_customer_accepts_customer_and_rejects_others(db, identities) -> None:
    customer_id, _ = await identities.user(role="customer")
    seller_id, _ = await identities.user(role="seller")

    assert (await require_customer(await _load(db, customer_id))).id == customer_id
    with pytest.raises(ApiError) as error:
        await require_customer(await _load(db, seller_id))
    assert error.value.status_code == 403


async def test_require_admin_rejects_non_admin(db, identities) -> None:
    user_id, _ = await identities.user(role="customer")

    with pytest.raises(ApiError) as error:
        await require_admin(await _load(db, user_id))
    assert error.value.status_code == 403
    assert error.value.code == "forbidden"


async def test_require_seller_returns_profile_only_for_owner(db, identities) -> None:
    seller_user, _ = await identities.user(role="seller")
    seller_id = await identities.seller(seller_user)

    user, seller = await require_seller(await _load(db, seller_user), db)
    assert user.id == seller_user
    assert seller.id == seller_id

    orphan_user, _ = await identities.user(role="seller")
    with pytest.raises(ApiError) as error:
        await require_seller(await _load(db, orphan_user), db)
    assert error.value.code == "seller_profile_missing"


async def test_require_driver_returns_profile_only_for_owner(db, identities) -> None:
    driver_user, _ = await identities.user(role="driver")
    seller_owner, _ = await identities.user(role="seller")
    seller_id = await identities.seller(seller_owner)
    driver_id = await identities.driver(seller_id, driver_user)

    user, driver = await require_driver(await _load(db, driver_user), db)
    assert user.id == driver_user
    assert driver.id == driver_id

    orphan_user, _ = await identities.user(role="driver")
    with pytest.raises(ApiError) as error:
        await require_driver(await _load(db, orphan_user), db)
    assert error.value.code == "driver_profile_missing"
