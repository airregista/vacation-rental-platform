import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_full_booking_and_payment_flow(client: AsyncClient, guest_token: str):
    # 1. Get an accommodation
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    accommodation = acc_res.json()[0]
    acc_id = accommodation["id"]

    day_offset = 20 + (uuid.uuid4().int % 20000)
    check_in = date.today() + timedelta(days=day_offset)
    check_out = date.today() + timedelta(days=day_offset + 3)  # 3 nights

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
    assert "extra_guests_count" in calc_data
    assert "extra_guest_fee_per_night" in calc_data
    assert calc_data["cancellation_policy"] in ("flexible", "moderate", "strict")
    assert Decimal(str(calc_data["total_price"])) == (
        Decimal(str(calc_data["nights_total"]))
        + Decimal(str(calc_data["extra_guest_total"]))
        + Decimal(str(calc_data["cleaning_fee"]))
    )

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


@pytest.mark.asyncio
async def test_past_date_reservation_rejected(
    client: AsyncClient,
    guest_token: str,
):
    res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": 1,
            "check_in": (date.today() - timedelta(days=2)).isoformat(),
            "check_out": (date.today() + timedelta(days=2)).isoformat(),
            "guests_count": 1,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res.status_code in (400, 422)


@pytest.mark.asyncio
async def test_payments_history_and_authorization(client: AsyncClient, guest_token: str):
    # 1. Create a reservation and checkout payment to ensure at least one payment exists
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]
    check_in = (date.today() + timedelta(days=60)).isoformat()
    check_out = (date.today() + timedelta(days=62)).isoformat()

    res_booking = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_booking.status_code == 201
    reservation_id = res_booking.json()["id"]

    checkout_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": reservation_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert checkout_res.status_code == 201
    payment_id = checkout_res.json()["payment_id"]

    # 2. List payments for current guest
    my_payments_res = await client.get(
        f"{settings.API_V1_STR}/payments/my",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert my_payments_res.status_code == 200
    my_payments = my_payments_res.json()
    assert isinstance(my_payments, list)
    assert any(p["id"] == payment_id for p in my_payments)

    # 3. Get single payment details by ID
    single_res = await client.get(
        f"{settings.API_V1_STR}/payments/{payment_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert single_res.status_code == 200
    assert single_res.json()["id"] == payment_id

    # 4. Register a second guest user and verify 403 Forbidden on other guest's payment
    second_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    guest2_reg = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": second_phone,
            "password": "strongPassword123",
            "first_name": "مهمان",
            "last_name": "دوم",
        },
    )
    assert guest2_reg.status_code == 201
    guest2_token = guest2_reg.json()["access_token"]

    forbidden_res = await client.get(
        f"{settings.API_V1_STR}/payments/{payment_id}",
        headers={"Authorization": f"Bearer {guest2_token}"},
    )
    assert forbidden_res.status_code == 403


@pytest.mark.asyncio
async def test_cleanup_expired_reservations(client: AsyncClient, admin_token: str, guest_token: str):
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]
    check_in = (date.today() + timedelta(days=70)).isoformat()
    check_out = (date.today() + timedelta(days=73)).isoformat()

    booking_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert booking_res.status_code == 201
    res_id = booking_res.json()["id"]

    # Calling cleanup with ttl_minutes=0 immediately expires any pending reservation
    cleanup_res = await client.post(
        f"{settings.API_V1_STR}/reservations/cleanup-expired?ttl_minutes=0",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert cleanup_res.status_code == 200
    assert cleanup_res.json()["expired_count"] >= 1

    # Check reservation is cancelled
    check = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert check.status_code == 200
    assert check.json()["status"] == "cancelled"


