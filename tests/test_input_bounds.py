import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.schemas.constraints import INTEGER_MAX


async def _admin_listing(client: AsyncClient, admin_token: str) -> int:
    cities = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories = await client.get(f"{settings.API_V1_STR}/categories/")
    created = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": categories.json()[0]["id"],
            "city_id": cities.json()[0]["id"],
            "title": f"Bounds {uuid.uuid4().hex[:8]}",
            "address": "تهران، تست مرزها، پلاک ۱",
            "base_price": 1000000,
            "capacity": 2,
            "max_capacity": 3,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert created.status_code == 201
    return created.json()["id"]


@pytest.mark.asyncio
async def test_registration_email_longer_than_column_is_422(client: AsyncClient):
    res = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": f"0912{uuid.uuid4().int % 10000000:07d}",
            "email": f"{'a' * 95}@example.com",
            "password": "Password123!",
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_image_url_and_sort_order_bounds_are_422(client: AsyncClient, admin_token: str):
    acc_id = await _admin_listing(client, admin_token)
    too_long = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images",
        json={"image_url": "https://example.com/" + "a" * 250},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert too_long.status_code == 422

    bad_order = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images",
        json={"image_url": "https://example.com/ok.jpg", "sort_order": INTEGER_MAX + 1},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert bad_order.status_code == 422


@pytest.mark.asyncio
async def test_negative_pricing_exception_price_is_422(client: AsyncClient, admin_token: str):
    acc_id = await _admin_listing(client, admin_token)
    res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/pricing-exceptions",
        json={"date": (date.today() + timedelta(days=10)).isoformat(), "price": -1},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_money_precision_and_magnitude_are_422(client: AsyncClient, admin_token: str):
    cities = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories = await client.get(f"{settings.API_V1_STR}/categories/")
    base = {
        "category_id": categories.json()[0]["id"],
        "city_id": cities.json()[0]["id"],
        "title": f"Money Bounds {uuid.uuid4().hex[:8]}",
        "address": "تهران، تست پول، پلاک ۲",
        "capacity": 2,
        "max_capacity": 3,
    }

    # httpx's json= uses json.dumps, which cannot serialize Decimal. Send a
    # float/int; Pydantic converts them to Decimal before validating.
    fractional = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={**base, "base_price": 1000.5},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert fractional.status_code == 422

    too_large = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={**base, "base_price": 1000000000000},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert too_large.status_code == 422

    # cleaning_fee is Numeric(10, 0), not 12: ten digits is the maximum.
    fee_too_large = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={**base, "base_price": 1000000, "cleaning_fee": 10000000000},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert fee_too_large.status_code == 422


@pytest.mark.asyncio
async def test_smallint_overflow_is_422(client: AsyncClient, admin_token: str):
    cities = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories = await client.get(f"{settings.API_V1_STR}/categories/")
    res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": categories.json()[0]["id"],
            "city_id": cities.json()[0]["id"],
            "title": f"Capacity Bounds {uuid.uuid4().hex[:8]}",
            "address": "تهران، تست ظرفیت، پلاک ۳",
            "base_price": 1000000,
            "capacity": 2,
            "max_capacity": 40000,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_coupon_and_reservation_bounds_are_422(
    client: AsyncClient, admin_token: str, guest_token: str
):
    coupon = await client.post(
        f"{settings.API_V1_STR}/coupons/",
        json={
            "code": f"BOUND{uuid.uuid4().hex[:8].upper()}",
            "discount_type": "fixed",
            "discount_value": 1000,
            "min_booking_amount": 0,
            "valid_from": (date.today() - timedelta(days=1)).isoformat(),
            "valid_until": (date.today() + timedelta(days=30)).isoformat(),
            "usage_limit": INTEGER_MAX + 1,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert coupon.status_code == 422

    acc_id = await _admin_listing(client, admin_token)
    booking = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=200)).isoformat(),
            "check_out": (date.today() + timedelta(days=202)).isoformat(),
            "guests_count": 1,
            "coupon_code": "X" * 31,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert booking.status_code == 422
