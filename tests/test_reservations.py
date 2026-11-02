from datetime import date, timedelta
import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_full_booking_and_payment_flow(client: AsyncClient, guest_token: str):
    # 1. Get an accommodation
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    accommodation = acc_res.json()[0]
    acc_id = accommodation["id"]

    check_in = date.today() + timedelta(days=20)
    check_out = date.today() + timedelta(days=23)  # 3 nights

    # 2. Calculate price
    calc_res = await client.post(
        f"{settings.API_V1_STR}/reservations/calculate-price",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in.isoformat(),
            "check_out": check_out.isoformat(),
            "guests_count": 2,
        },
    )
    assert calc_res.status_code == 200
    calc_data = calc_res.json()
    assert calc_data["total_nights"] == 3
    assert float(calc_data["total_price"]) > 0

    # 3. Create reservation
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
    booking_data = booking_res.json()
    assert booking_data["status"] == "pending"
    reservation_id = booking_data["id"]

    # 4. Initiate payment checkout
    pay_init_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": reservation_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert pay_init_res.status_code == 201
    pay_data = pay_init_res.json()
    payment_id = pay_data["payment_id"]
    tracking_code = pay_data["tracking_code"]

    # 5. Verify payment (simulated Shaparak gateway callback)
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
    assert verify_res.json()["status"] == "success"

    # 6. Verify reservation is now 'confirmed'
    res_check = await client.get(
        f"{settings.API_V1_STR}/reservations/{reservation_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_check.status_code == 200
    assert res_check.json()["status"] == "confirmed"

    # 7. Double-booking prevention check:
    # Attempting to book overlapping dates must fail with 409 Conflict
    conflict_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (check_in + timedelta(days=1)).isoformat(),
            "check_out": (check_out + timedelta(days=1)).isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert conflict_res.status_code == 409
    assert "overlap" in conflict_res.json()["detail"].lower()
