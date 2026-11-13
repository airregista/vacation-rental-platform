import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.reservation import Reservation


@pytest.mark.asyncio
async def test_full_booking_and_payment_flow(client: AsyncClient, guest_token: str):
    # 1. Get an accommodation
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    accommodation = acc_res.json()[0]
    acc_id = accommodation["id"]

    day_offset = 20 + (uuid.uuid4().int % 200)
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
async def test_cleanup_expired_reservations(
    client: AsyncClient, admin_token: str, guest_token: str
):
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

    # Initiate payment so a pending payment record exists
    checkout_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert checkout_res.status_code == 201
    payment_id = checkout_res.json()["payment_id"]

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

    # Check payment is failed
    pay_check = await client.get(
        f"{settings.API_V1_STR}/payments/{payment_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert pay_check.status_code == 200
    assert pay_check.json()["status"] == "failed"


@pytest.mark.asyncio
async def test_my_reservations_pagination(client: AsyncClient):
    uid = uuid.uuid4().hex[:8]
    reg = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": f"0912{uuid.uuid4().int % 10000000:07d}",
            "email": f"res_page_{uid}@example.com",
            "password": "Password123!",
            "first_name": "Res",
            "last_name": "PageUser",
        },
    )
    assert reg.status_code == 201
    user_token = reg.json()["access_token"]

    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]

    res_ids = []
    base_offset = 300 + (uuid.uuid4().int % 100)
    for i in range(3):
        ci = (date.today() + timedelta(days=base_offset + i * 5)).isoformat()
        co = (date.today() + timedelta(days=base_offset + i * 5 + 2)).isoformat()
        res = await client.post(
            f"{settings.API_V1_STR}/reservations/",
            json={
                "accommodation_id": acc_id,
                "check_in": ci,
                "check_out": co,
                "guests_count": 1,
            },
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert res.status_code == 201
        res_ids.append(res.json()["id"])

    expected_order = list(reversed(res_ids))

    p1 = await client.get(
        f"{settings.API_V1_STR}/reservations/my?skip=0&limit=2",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert p1.status_code == 200
    p1_data = p1.json()
    assert len(p1_data) == 2
    assert [r["id"] for r in p1_data] == expected_order[:2]

    p2 = await client.get(
        f"{settings.API_V1_STR}/reservations/my?skip=2&limit=2",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert p2.status_code == 200
    p2_data = p2.json()
    assert len(p2_data) == 1
    assert [r["id"] for r in p2_data] == expected_order[2:]

    p_mid = await client.get(
        f"{settings.API_V1_STR}/reservations/my?skip=1&limit=1",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert p_mid.status_code == 200
    assert [r["id"] for r in p_mid.json()] == [expected_order[1]]

    err_res = await client.get(
        f"{settings.API_V1_STR}/reservations/my?skip=-1",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert err_res.status_code == 422

    err_res2 = await client.get(
        f"{settings.API_V1_STR}/reservations/my?limit=101",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert err_res2.status_code == 422


@pytest.mark.asyncio
async def test_reservation_minimum_stay_validation_rejection(
    client: AsyncClient, admin_token: str, guest_token: str
):
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    uid = uuid.uuid4().hex[:6]
    acc_payload = {
        "category_id": category_id,
        "city_id": city_id,
        "title": f"Min Nights Property {uid}",
        "address": "گیلان، رشت، گلسار",
        "base_price": 1500000,
        "min_nights": 2,
    }
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=acc_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    check_in = (date.today() + timedelta(days=80)).isoformat()
    check_out_1night = (date.today() + timedelta(days=81)).isoformat()
    check_out_2nights = (date.today() + timedelta(days=82)).isoformat()

    # 1-night calculation request returns HTTP 400
    calc_res = await client.post(
        f"{settings.API_V1_STR}/reservations/calculate-price",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out_1night,
            "guests_count": 1,
        },
    )
    assert calc_res.status_code == 400
    assert "minimum stay of 2 nights" in calc_res.json()["detail"].lower()

    # 1-night booking request returns HTTP 400
    booking_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out_1night,
            "guests_count": 1,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert booking_res.status_code == 400
    assert "minimum stay of 2 nights" in booking_res.json()["detail"].lower()

    # 2-night booking succeeds
    valid_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out_2nights,
            "guests_count": 1,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert valid_res.status_code == 201


@pytest.mark.asyncio
async def test_pricing_exception_minimum_stay_override(
    client: AsyncClient, admin_token: str, guest_token: str
):
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    uid = uuid.uuid4().hex[:6]
    acc_payload = {
        "category_id": category_id,
        "city_id": city_id,
        "title": f"Holiday Override Property {uid}",
        "address": "مازندران، کلاردشت",
        "base_price": 2000000,
        "min_nights": 1,
    }
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=acc_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    holiday_date = (date.today() + timedelta(days=95)).isoformat()
    ex_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/pricing-exceptions",
        json={
            "date": holiday_date,
            "price": 3500000,
            "is_blocked": False,
            "min_nights": 3,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert ex_res.status_code == 200
    assert ex_res.json()["min_nights"] == 3

    ci = holiday_date
    co_2nights = (date.today() + timedelta(days=97)).isoformat()
    co_3nights = (date.today() + timedelta(days=98)).isoformat()

    booking_fail = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": ci,
            "check_out": co_2nights,
            "guests_count": 1,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert booking_fail.status_code == 400
    assert "minimum stay of 3 nights" in booking_fail.json()["detail"].lower()

    booking_ok = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": ci,
            "check_out": co_3nights,
            "guests_count": 1,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert booking_ok.status_code == 201


@pytest.mark.asyncio
async def test_host_payout_ledger_and_settlement_flow(
    client: AsyncClient, admin_token: str, guest_token: str
):
    # 1. Register a dedicated host user
    uid = uuid.uuid4().hex[:6]
    host_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    host_pw = "HostPassword123!"
    reg_res = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": host_phone,
            "email": f"host_{uid}@example.com",
            "password": host_pw,
            "first_name": "هاست",
            "last_name": "نمونه",
        },
    )
    assert reg_res.status_code == 201
    host_data = reg_res.json()["user"]
    host_id = host_data["id"]
    host_token = reg_res.json()["access_token"]
    assert host_data.get("shaba_number") is None

    # R1: an admin may only assign a listing to a host/admin — the freshly
    # registered user is a guest, so promote them to host first.
    promote_res = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert promote_res.status_code == 200

    # 2. Admin creates an accommodation for this host
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "host_id": host_id,
            "title": f"Host Payout Property {uid}",
            "address": "مازندران، نوشهر",
            "base_price": 2000000,
            "min_nights": 1,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    # 3. Guest books 2 nights and pays
    ci = (date.today() + timedelta(days=120)).isoformat()
    co = (date.today() + timedelta(days=122)).isoformat()
    book_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": ci,
            "check_out": co,
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert book_res.status_code == 201
    reservation = book_res.json()
    res_id = reservation["id"]
    total_price = Decimal(str(reservation["total_price"]))

    # Checkout & verify payment
    pay_init = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert pay_init.status_code == 201
    payment_id = pay_init.json()["payment_id"]
    tracking_code = pay_init.json()["tracking_code"]

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

    # 4. Host checks payouts ledger: should see pending payout with 10% commission deducted
    host_payouts_res = await client.get(
        f"{settings.API_V1_STR}/payments/host/payouts",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert host_payouts_res.status_code == 200
    payouts = host_payouts_res.json()
    assert len(payouts) == 1
    payout = payouts[0]
    payout_id = payout["id"]
    assert payout["reservation_id"] == res_id
    assert payout["host_id"] == host_id
    assert payout["status"] == "pending"
    assert payout["paid_at"] is None

    expected_commission = Decimal(round(total_price * Decimal("0.10")))
    expected_payout = total_price - expected_commission
    assert Decimal(str(payout["total_booking_amount"])) == total_price
    assert Decimal(str(payout["commission_amount"])) == expected_commission
    assert Decimal(str(payout["payout_amount"])) == expected_payout

    # Guest should NOT see this host's payout
    guest_payouts_res = await client.get(
        f"{settings.API_V1_STR}/payments/host/payouts",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert guest_payouts_res.status_code == 200
    assert len(guest_payouts_res.json()) == 0

    # Non-admin cannot settle
    forbidden_settle = await client.post(
        f"{settings.API_V1_STR}/payments/host/payouts/{payout_id}/settle",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert forbidden_settle.status_code == 403

    # 5. Attempting settlement for a host without Shaba returns HTTP 400
    settle_no_shaba = await client.post(
        f"{settings.API_V1_STR}/payments/host/payouts/{payout_id}/settle",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert settle_no_shaba.status_code == 400
    assert "shaba banking number" in settle_no_shaba.json()["detail"].lower()

    # 6. Host registers Shaba IR123456789012345678901234 via PUT /auth/me
    shaba_val = "IR123456789012345678901234"
    update_shaba_res = await client.put(
        f"{settings.API_V1_STR}/auth/me",
        json={"shaba_number": shaba_val},
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert update_shaba_res.status_code == 200
    assert update_shaba_res.json()["shaba_number"] == shaba_val

    # 7. Admin attempts settlement before check-in date arrives -> HTTP 400
    premature_settle = await client.post(
        f"{settings.API_V1_STR}/payments/host/payouts/{payout_id}/settle",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert premature_settle.status_code == 400
    assert "check-in date" in premature_settle.json()["detail"].lower()

    # Fast-forward reservation check_in date to today
    async with AsyncSessionLocal() as session:
        db_res = await session.get(Reservation, res_id)
        assert db_res is not None
        db_res.check_in = date.today()
        db_res.total_nights = (db_res.check_out - db_res.check_in).days
        await session.commit()

    # Admin settles payout via POST /payments/host/payouts/{id}/settle
    settle_res = await client.post(
        f"{settings.API_V1_STR}/payments/host/payouts/{payout_id}/settle",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert settle_res.status_code == 200
    settle_data = settle_res.json()
    assert settle_data["status"] == "completed"
    assert settle_data["paid_at"] is not None

    # 8. Attempting to settle again returns HTTP 400
    settle_again = await client.post(
        f"{settings.API_V1_STR}/payments/host/payouts/{payout_id}/settle",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert settle_again.status_code == 400
    assert "already been completed" in settle_again.json()["detail"].lower()

    # 9. Guest cannot cancel or preview cancellation once host payout has been settled
    preview_after_settle = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel-preview",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert preview_after_settle.status_code == 400
    assert "settled" in preview_after_settle.json()["detail"].lower()

    cancel_after_settle = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cancel_after_settle.status_code == 400
    assert "settled" in cancel_after_settle.json()["detail"].lower()


@pytest.mark.asyncio
async def test_host_payout_settlement_rejected_for_cancelled_reservation(
    client: AsyncClient, admin_token: str, guest_token: str
):
    uid = uuid.uuid4().hex[:6]
    host_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    reg_res = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": host_phone,
            "email": f"host_cancel_{uid}@example.com",
            "password": "Password123!",
            "first_name": "میزبان",
            "last_name": "کنسلی",
        },
    )
    assert reg_res.status_code == 201
    host_data = reg_res.json()["user"]
    host_id = host_data["id"]
    host_token = reg_res.json()["access_token"]

    # R1: an admin may only assign a listing to a host/admin — the freshly
    # registered user is a guest, so promote them to host first.
    promote_res = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert promote_res.status_code == 200

    # Register host Shaba number
    await client.put(
        f"{settings.API_V1_STR}/auth/me",
        json={"shaba_number": "IR123456789012345678901234"},
        headers={"Authorization": f"Bearer {host_token}"},
    )

    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "host_id": host_id,
            "title": f"Payout Cancel Property {uid}",
            "address": "مازندران، متل قو",
            "base_price": 2000000,
            "min_nights": 1,
            "cancellation_policy": "flexible",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    ci = (date.today() + timedelta(days=130)).isoformat()
    co = (date.today() + timedelta(days=132)).isoformat()
    book_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": ci,
            "check_out": co,
            "guests_count": 1,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert book_res.status_code == 201
    res_id = book_res.json()["id"]

    pay_init = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": pay_init.json()["payment_id"],
            "tracking_code": pay_init.json()["tracking_code"],
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )

    # Fetch payout ID
    payouts_res = await client.get(
        f"{settings.API_V1_STR}/payments/host/payouts",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    payout_id = payouts_res.json()[0]["id"]

    # Guest cancels reservation
    cancel_res = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel",
        json={"reason": "انصراف از سفر"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cancel_res.status_code == 200

    # Admin attempts to settle payout for cancelled reservation -> HTTP 400
    settle_res = await client.post(
        f"{settings.API_V1_STR}/payments/host/payouts/{payout_id}/settle",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert settle_res.status_code == 400
    assert "cancelled" in settle_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_reservation_messaging_flow(client: AsyncClient, admin_token: str, guest_token: str):
    # 1. Register a dedicated host user
    uid = uuid.uuid4().hex[:6]
    host_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    host_reg = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": host_phone,
            "email": f"msghost_{uid}@example.com",
            "password": "HostPassword123!",
            "first_name": "علی",
            "last_name": "میزبان",
        },
    )
    assert host_reg.status_code == 201
    host_data = host_reg.json()["user"]
    host_id = host_data["id"]
    host_token = host_reg.json()["access_token"]

    # R1: an admin may only assign a listing to a host/admin — the freshly
    # registered user is a guest, so promote them to host first.
    promote_res = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert promote_res.status_code == 200

    # 2. Admin creates an accommodation for this host
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "host_id": host_id,
            "title": f"Messaging Property {uid}",
            "address": "مازندران، چالوس",
            "base_price": 1800000,
            "min_nights": 1,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    # 3. Guest creates reservation and completes payment to confirm it
    ci = (date.today() + timedelta(days=150)).isoformat()
    co = (date.today() + timedelta(days=152)).isoformat()
    book_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": ci,
            "check_out": co,
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert book_res.status_code == 201
    res_id = book_res.json()["id"]

    pay_init = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert pay_init.status_code == 201
    payment_id = pay_init.json()["payment_id"]
    tracking_code = pay_init.json()["tracking_code"]

    # Guest cannot message on pending (unpaid) reservation
    pending_msg = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/messages",
        json={"message": "سلام روی رزرو پرداخت‌نشده"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert pending_msg.status_code == 400
    assert "confirmed or completed" in pending_msg.json()["detail"].lower()

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

    # 4. Guest posts message to host on confirmed reservation. Verify HTTP 201.
    guest_msg_payload = {"message": "سلام، ساعت تحویل کلید چند است؟"}
    guest_msg_res = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/messages",
        json=guest_msg_payload,
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert guest_msg_res.status_code == 201
    guest_msg = guest_msg_res.json()
    assert guest_msg["reservation_id"] == res_id
    assert guest_msg["message"] == guest_msg_payload["message"]
    assert guest_msg["sender_name"] is not None and len(guest_msg["sender_name"]) > 0
    assert guest_msg["created_at"] is not None
    assert guest_msg["read_at"] is None

    # 5. Host retrieves message list and posts a reply
    host_list_res = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}/messages",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert host_list_res.status_code == 200
    host_msgs = host_list_res.json()
    assert len(host_msgs) == 1
    assert host_msgs[0]["id"] == guest_msg["id"]
    assert host_msgs[0]["read_at"] is not None

    host_reply_payload = {"message": "سلام، از ساعت ۱۴ در خدمتتون هستیم."}
    host_reply_res = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/messages",
        json=host_reply_payload,
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert host_reply_res.status_code == 201
    host_reply = host_reply_res.json()
    assert host_reply["sender_id"] == host_id
    assert host_reply["sender_name"] == "علی میزبان"
    assert host_reply["message"] == host_reply_payload["message"]

    # 6. Verify messages appear in chronological order with correct sender_id and populated sender_name
    final_list_res = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}/messages",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert final_list_res.status_code == 200
    all_msgs = final_list_res.json()
    assert len(all_msgs) == 2
    assert all_msgs[0]["id"] == guest_msg["id"]
    assert all_msgs[1]["id"] == host_reply["id"]
    assert all_msgs[0]["sender_id"] != all_msgs[1]["sender_id"]
    assert all_msgs[0]["sender_id"] == guest_msg["sender_id"]
    assert all_msgs[1]["sender_id"] == host_id
    assert all_msgs[0]["sender_name"] == guest_msg["sender_name"]
    assert all_msgs[1]["sender_name"] == "علی میزبان"
    assert all_msgs[0]["created_at"] <= all_msgs[1]["created_at"]
    assert all_msgs[1]["read_at"] is not None

    # Admin can also read messages
    admin_list_res = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}/messages",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_list_res.status_code == 200
    assert len(admin_list_res.json()) == 2

    # 7. Unrelated third-party user attempts access and receives HTTP 403 Forbidden
    other_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    other_reg = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": other_phone,
            "password": "OtherPassword123!",
            "first_name": "غریبه",
            "last_name": "سوم",
        },
    )
    assert other_reg.status_code == 201
    other_token = other_reg.json()["access_token"]

    other_read = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}/messages",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert other_read.status_code == 403

    other_write = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/messages",
        json={"message": "پیام از کاربر نامربوط"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert other_write.status_code == 403

    # Empty/whitespace message validation
    empty_write = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/messages",
        json={"message": "   "},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert empty_write.status_code == 422

    # 8. Attempting to post message on cancelled reservation returns HTTP 400 Bad Request
    cancel_res = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel",
        json={"reason": "کنسلی به دلیل برنامه سفر"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cancel_res.status_code == 200

    cancelled_write = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/messages",
        json={"message": "پیام پس از کنسلی رزرو"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cancelled_write.status_code == 400
    assert "cancelled" in cancelled_write.json()["detail"].lower()


@pytest.mark.asyncio
async def test_host_payout_settlement_retained_on_penalty_cancellation(
    client: AsyncClient, admin_token: str, guest_token: str
):
    uid = uuid.uuid4().hex[:6]
    host_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    reg_res = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": host_phone,
            "email": f"host_penalty_{uid}@example.com",
            "password": "Password123!",
            "first_name": "میزبان",
            "last_name": "جریمه‌دار",
        },
    )
    assert reg_res.status_code == 201
    host_data = reg_res.json()["user"]
    host_id = host_data["id"]
    host_token = reg_res.json()["access_token"]

    # R1: an admin may only assign a listing to a host/admin — the freshly
    # registered user is a guest, so promote them to host first.
    promote_res = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert promote_res.status_code == 200

    # Register host Shaba number
    await client.put(
        f"{settings.API_V1_STR}/auth/me",
        json={"shaba_number": "IR987654321098765432109876"},
        headers={"Authorization": f"Bearer {host_token}"},
    )

    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    # Strict cancellation policy: cancelling < 7 days before check-in retains 50% penalty
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "host_id": host_id,
            "title": f"Payout Strict Penalty Property {uid}",
            "address": "مازندران، نمک‌آبرود",
            "base_price": 2000000,
            "min_nights": 1,
            "cancellation_policy": "strict",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    ci = (date.today() + timedelta(days=3)).isoformat()
    co = (date.today() + timedelta(days=5)).isoformat()
    book_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": ci,
            "check_out": co,
            "guests_count": 1,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert book_res.status_code == 201
    res_id = book_res.json()["id"]

    pay_init = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": pay_init.json()["payment_id"],
            "tracking_code": pay_init.json()["tracking_code"],
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )

    # Guest cancels reservation: strict policy with < 7 days checkin applies 50% penalty
    cancel_res = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel",
        json={"reason": "انصراف دیرهنگام"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cancel_res.status_code == 200
    penalty = Decimal(str(cancel_res.json()["penalty_amount"]))
    assert penalty > 0

    # Host checks payouts ledger: payout remains pending with amounts updated to host portion of penalty
    payouts_res = await client.get(
        f"{settings.API_V1_STR}/payments/host/payouts",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert payouts_res.status_code == 200
    payout = payouts_res.json()[0]
    assert payout["status"] == "pending"
    expected_commission = Decimal(round(penalty * Decimal("0.10")))
    expected_payout = penalty - expected_commission
    assert Decimal(str(payout["total_booking_amount"])) == penalty
    assert Decimal(str(payout["commission_amount"])) == expected_commission
    assert Decimal(str(payout["payout_amount"])) == expected_payout

    # Admin settles payout for the penalty
    payout_id = payout["id"]
    settle_res = await client.post(
        f"{settings.API_V1_STR}/payments/host/payouts/{payout_id}/settle",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert settle_res.status_code == 200
    assert settle_res.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_my_reservations_include_accommodation_image_city_province(
    client: AsyncClient, guest_token: str
):
    # T3: trip cards render photo + city chip from these fields; they were
    # absent from ReservationResponse, so every card showed the fallback.
    # Pick a seeded accommodation with a cover image and a city from the
    # public list — the same source the card data must match.
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    assert acc_res.status_code == 200
    acc = next(
        (a for a in acc_res.json() if a.get("cover_image") and a.get("city")),
        None,
    )
    assert acc is not None, "seed data must include an accommodation with cover + city"

    day_offset = 450 + (uuid.uuid4().int % 50)
    check_in = date.today() + timedelta(days=day_offset)
    check_out = date.today() + timedelta(days=day_offset + 2)

    booking_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc["id"],
            "check_in": check_in.isoformat(),
            "check_out": check_out.isoformat(),
            "guests_count": 1,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert booking_res.status_code == 201
    reservation_id = booking_res.json()["id"]

    # /my list path — what the trips page renders.
    my_res = await client.get(
        f"{settings.API_V1_STR}/reservations/my",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert my_res.status_code == 200
    item = next(r for r in my_res.json() if r["id"] == reservation_id)
    assert item["accommodation_title"] == acc["title"]
    assert item["accommodation_image"] == acc["cover_image"]
    assert item["city"] == acc["city"]["name"]
    assert item["province"] == acc["city"]["province"]["name"]

    # Single-reservation path uses the same serializer.
    single = await client.get(
        f"{settings.API_V1_STR}/reservations/{reservation_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert single.status_code == 200
    assert single.json()["accommodation_image"] == acc["cover_image"]
    assert single.json()["city"] == acc["city"]["name"]
    assert single.json()["province"] == acc["city"]["province"]["name"]


@pytest.mark.asyncio
async def test_host_cannot_book_own_accommodation(client: AsyncClient, admin_token: str):
    uid = uuid.uuid4().hex[:8]
    phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    reg = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": phone,
            "password": "hostPassword123",
            "first_name": "Self",
            "last_name": "Host",
        },
    )
    assert reg.status_code == 201
    host_id = reg.json()["user"]["id"]
    host_token = reg.json()["access_token"]

    promote = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert promote.status_code == 200

    cities = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories = await client.get(f"{settings.API_V1_STR}/categories/")
    create_acc = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": categories.json()[0]["id"],
            "city_id": cities.json()[0]["id"],
            "host_id": host_id,
            "title": f"Self Booking Guard {uid}",
            "address": "?????? ??? ???? ????? ???? ?",
            "base_price": 1000000,
            "capacity": 2,
            "max_capacity": 3,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_acc.status_code == 201
    acc_id = create_acc.json()["id"]

    booking = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=200)).isoformat(),
            "check_out": (date.today() + timedelta(days=203)).isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert booking.status_code == 403
    assert "own accommodation" in booking.json()["detail"].lower()
