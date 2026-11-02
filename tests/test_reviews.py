from datetime import date, timedelta
import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_proof_of_stay_review_and_wishlist_flow(
    client: AsyncClient, guest_token: str, admin_token: str
):
    # 1. Get an accommodation
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    accommodation = acc_res.json()[1]
    acc_id = accommodation["id"]

    # 2. Wishlist toggle: Add
    wl_add = await client.post(
        f"{settings.API_V1_STR}/wishlists/{acc_id}/toggle",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl_add.status_code == 200
    assert wl_add.json()["is_favorite"] is True

    # 3. Wishlist list: Verify presence
    wl_list = await client.get(
        f"{settings.API_V1_STR}/wishlists/",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl_list.status_code == 200
    assert any(item["accommodation_id"] == acc_id for item in wl_list.json())

    # 4. Wishlist toggle: Remove
    wl_rem = await client.post(
        f"{settings.API_V1_STR}/wishlists/{acc_id}/toggle",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl_rem.status_code == 200
    assert wl_rem.json()["is_favorite"] is False

    # 5. Create a reservation and complete payment to obtain a confirmed booking for Proof of Stay
    check_in = date.today() + timedelta(days=40)
    check_out = date.today() + timedelta(days=42)

    booking_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in.isoformat(),
            "check_out": check_out.isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert booking_res.status_code == 201
    res_id = booking_res.json()["id"]

    # Attempt review BEFORE payment confirmation -> Must fail with 400
    premature_review = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res_id,
            "rating": 5,
            "cleanliness_rating": 5,
            "accuracy_rating": 5,
            "comment": "اقامتگاه فوق‌العاده تمیز و عالی بود!",
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert premature_review.status_code == 400

    # Pay and confirm
    pay_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    pay_data = pay_res.json()
    await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": pay_data["payment_id"],
            "tracking_code": pay_data["tracking_code"],
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )

    # Attempt review by another user (e.g. admin) on this reservation -> Must fail with 403
    foreign_review = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res_id,
            "rating": 4,
            "comment": "تلاش برای ثبت نظر برای رزرو شخص دیگر",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert foreign_review.status_code == 403

    # Submit valid review by guest
    valid_review = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res_id,
            "rating": 5,
            "cleanliness_rating": 5,
            "accuracy_rating": 5,
            "comment": "تجربه بی‌نظیری بود. استخر آبگرم کاملا تمیز بود و برخورد میزبان عالی.",
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert valid_review.status_code == 201
    assert valid_review.json()["rating"] == 5

    # Duplicate review attempt on same reservation -> Must fail with 400
    dup_review = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res_id,
            "rating": 3,
            "comment": "تلاش برای ثبت مجدد نظر روی یک رزرو",
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert dup_review.status_code == 400

    # Public reviews listing
    rev_list = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews")
    assert rev_list.status_code == 200
    assert len(rev_list.json()) >= 1
