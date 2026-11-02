from datetime import date, timedelta
import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.reservation import Reservation


@pytest.mark.asyncio
async def test_create_and_read_reviews(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "کلبه چوبی جنگلی بازخورد",
            "address": "مازندران، جاده چالوس",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 500000,
            "extra_person_fee": 100000,
            "cleaning_fee": 50000,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    res_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=40)).isoformat(),
            "check_out": (date.today() + timedelta(days=42)).isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_res.status_code == 201
    res_id = res_res.json()["id"]

    checkout_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert checkout_res.status_code in (200, 201)
    payment_id = checkout_res.json()["payment_id"]
    tracking_code = checkout_res.json()["tracking_code"]

    verify_res = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": payment_id,
            "tracking_code": tracking_code,
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert verify_res.status_code == 200

    early_review = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res_id,
            "rating": 5,
            "cleanliness_rating": 5,
            "accuracy_rating": 5,
            "comment": "عالی بود قبل از سفر!",
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert early_review.status_code == 400
    assert "completed" in early_review.json()["detail"].lower()

    async with AsyncSessionLocal() as session:
        db_res = await session.get(Reservation, res_id)
        db_res.check_in = date.today() - timedelta(days=3)
        db_res.check_out = date.today() - timedelta(days=1)
        await session.commit()

    valid_review = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res_id,
            "rating": 5,
            "cleanliness_rating": 4,
            "accuracy_rating": 5,
            "comment": "تجربه عالی و بسیار تمیز بود.",
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert valid_review.status_code == 201
    assert valid_review.json()["rating"] == 5

    dup_review = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res_id,
            "rating": 4,
            "comment": "تلاش مجدد برای ثبت نظر",
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert dup_review.status_code == 400


@pytest.mark.asyncio
async def test_wishlist_and_public_review_listing(
    client: AsyncClient,
    guest_token: str,
    admin_token: str,
):
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    accommodation = acc_res.json()[0]
    acc_id = accommodation["id"]

    # 1. Wishlist toggle: Add
    wl_add = await client.post(
        f"{settings.API_V1_STR}/wishlists/{acc_id}/toggle",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl_add.status_code == 200
    assert wl_add.json()["is_favorite"] is True

    # 2. Wishlist list: Verify presence
    wl_list = await client.get(
        f"{settings.API_V1_STR}/wishlists/",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl_list.status_code == 200
    assert any(item["accommodation_id"] == acc_id for item in wl_list.json())

    # 3. Wishlist toggle: Remove
    wl_rem = await client.post(
        f"{settings.API_V1_STR}/wishlists/{acc_id}/toggle",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl_rem.status_code == 200
    assert wl_rem.json()["is_favorite"] is False

    # 4. Public reviews listing
    rev_list = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews")
    assert rev_list.status_code == 200
    assert isinstance(rev_list.json(), list)

