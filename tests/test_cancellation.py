from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.accommodation import Accommodation
from app.models.reservation import Reservation
from app.services.cancellation_service import calculate_cancellation_refund

TEHRAN_TZ = ZoneInfo("Asia/Tehran")


# ==========================================
# 1. Pure Unit Tests: Tier Calculations
# ==========================================


def test_calculate_refund_pending_unpaid():
    res = Reservation(
        status="pending",
        total_price=Decimal("1500000"),
        check_in=date(2026, 11, 20),
    )
    acc = Accommodation(
        check_in_time=time(14, 0),
        cancellation_policy="flexible",
        base_price=Decimal("500000"),
        cleaning_fee=Decimal("50000"),
    )
    cancel_dt = datetime(2026, 11, 10, 14, 0, tzinfo=TEHRAN_TZ)
    refundable, penalty, hours = calculate_cancellation_refund(res, acc, cancel_dt)

    assert refundable == Decimal(0)
    assert penalty == Decimal(0)
    assert hours == 240.0


def test_calculate_refund_flexible_more_than_24h():
    res = Reservation(
        status="confirmed",
        total_price=Decimal("2000000"),
        check_in=date(2026, 11, 20),
    )
    acc = Accommodation(
        check_in_time=time(14, 0),
        cancellation_policy="flexible",
        base_price=Decimal("600000"),
        cleaning_fee=Decimal("100000"),
    )
    # 48 hours before check-in
    cancel_dt = datetime(2026, 11, 18, 14, 0, tzinfo=TEHRAN_TZ)
    refundable, penalty, hours = calculate_cancellation_refund(res, acc, cancel_dt)

    assert hours == 48.0
    assert refundable == Decimal("2000000")
    assert penalty == Decimal(0)


def test_calculate_refund_flexible_less_than_24h():
    res = Reservation(
        status="confirmed",
        total_price=Decimal("2000000"),
        check_in=date(2026, 11, 20),
    )
    acc = Accommodation(
        check_in_time=time(14, 0),
        cancellation_policy="flexible",
        base_price=Decimal("600000"),
        cleaning_fee=Decimal("100000"),
    )
    # 10 hours before check-in
    cancel_dt = datetime(2026, 11, 20, 4, 0, tzinfo=TEHRAN_TZ)
    refundable, penalty, hours = calculate_cancellation_refund(res, acc, cancel_dt)

    expected_penalty = Decimal("600000") + Decimal("100000")  # 700000
    expected_refund = Decimal("2000000") - expected_penalty  # 1300000

    assert hours == 10.0
    assert penalty == expected_penalty
    assert refundable == expected_refund


def test_calculate_refund_moderate_policy():
    res = Reservation(
        status="confirmed",
        total_price=Decimal("1000000"),
        check_in=date(2026, 11, 20),
    )
    acc = Accommodation(
        check_in_time=time(14, 0),
        cancellation_policy="moderate",
        base_price=Decimal("300000"),
        cleaning_fee=Decimal("50000"),
    )

    # 130 hours before (>= 120h -> 5 days): full refund
    cancel_130h = datetime(2026, 11, 15, 4, 0, tzinfo=timezone.utc)
    refundable, penalty, hours = calculate_cancellation_refund(res, acc, cancel_130h)
    assert refundable == Decimal("1000000")
    assert penalty == Decimal(0)

    # 50 hours before (< 120h): 50% penalty
    cancel_50h = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)
    refundable, penalty, hours = calculate_cancellation_refund(res, acc, cancel_50h)
    assert penalty == Decimal("500000")
    assert refundable == Decimal("500000")


def test_calculate_refund_strict_policy():
    res = Reservation(
        status="confirmed",
        total_price=Decimal("1000000"),
        check_in=date(2026, 11, 20),
    )
    acc = Accommodation(
        check_in_time=time(14, 0),
        cancellation_policy="strict",
        base_price=Decimal("300000"),
        cleaning_fee=Decimal("50000"),
    )

    # 350 hours before (>= 336h -> 14 days): full refund
    cancel_350h = datetime(2026, 11, 6, 0, 0, tzinfo=timezone.utc)
    refundable, penalty, _ = calculate_cancellation_refund(res, acc, cancel_350h)
    assert refundable == Decimal("1000000")
    assert penalty == Decimal(0)

    # 200 hours before (between 168h and 336h): 50% refund
    cancel_200h = datetime(2026, 11, 12, 6, 0, tzinfo=timezone.utc)
    refundable, penalty, _ = calculate_cancellation_refund(res, acc, cancel_200h)
    assert penalty == Decimal("500000")
    assert refundable == Decimal("500000")

    # 50 hours before (< 168h -> 7 days): 100% penalty, 0 refund
    cancel_50h = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)
    refundable, penalty, _ = calculate_cancellation_refund(res, acc, cancel_50h)
    assert penalty == Decimal("1000000")
    assert refundable == Decimal(0)


def test_calculate_refund_custom_policy_uses_host_window_and_percent():
    res = Reservation(
        status="confirmed",
        total_price=Decimal("1000000"),
        check_in=date(2026, 11, 20),
    )
    acc = Accommodation(
        check_in_time=time(14, 0),
        cancellation_policy="custom",
        cancellation_free_hours=48,
        cancellation_penalty_percent=Decimal("25"),
        base_price=Decimal("300000"),
        cleaning_fee=Decimal("50000"),
    )

    # 60 hours before: inside the host's free-cancellation window
    cancel_60h = datetime(2026, 11, 18, 2, 0, tzinfo=timezone.utc)
    refundable, penalty, _ = calculate_cancellation_refund(res, acc, cancel_60h)
    assert refundable == Decimal("1000000")
    assert penalty == Decimal(0)

    # 24 hours before: 25% penalty
    cancel_24h = datetime(2026, 11, 19, 14, 0, tzinfo=timezone.utc)
    refundable, penalty, _ = calculate_cancellation_refund(res, acc, cancel_24h)
    assert penalty == Decimal("250000")
    assert refundable == Decimal("750000")


def test_calculate_refund_flexible_uses_actual_first_night_price():
    res = Reservation(
        status="confirmed",
        total_price=Decimal("2000000"),
        check_in=date(2026, 11, 20),
    )
    acc = Accommodation(
        check_in_time=time(14, 0),
        cancellation_policy="flexible",
        base_price=Decimal("600000"),
        cleaning_fee=Decimal("100000"),
    )
    cancel_dt = datetime(2026, 11, 20, 4, 0, tzinfo=TEHRAN_TZ)

    refundable, penalty, _ = calculate_cancellation_refund(
        res,
        acc,
        cancel_dt,
        first_night_price=Decimal("900000"),
    )

    assert penalty == Decimal("1000000")  # 900000 first night + 100000 cleaning
    assert refundable == Decimal("1000000")


# ==========================================
# 2. End-to-End API Integration Tests
# ==========================================


@pytest.mark.asyncio
async def test_cancel_pending_reservation_yields_zero_refund(client: AsyncClient, guest_token: str):
    # 1. Fetch accommodation
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]

    check_in = date.today() + timedelta(days=40)
    check_out = date.today() + timedelta(days=42)

    # 2. Create pending reservation
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
    assert booking_res.json()["status"] == "pending"

    # 3. Preview cancellation
    preview_res = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel-preview",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert preview_res.status_code == 200
    preview = preview_res.json()
    assert Decimal(preview["refundable_amount"]) == Decimal(0)
    assert Decimal(preview["penalty_amount"]) == Decimal(0)

    # 4. Cancel pending reservation
    cancel_res = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel",
        json={"reason": "Plans changed before payment"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cancel_res.status_code == 200
    cancel_data = cancel_res.json()
    assert cancel_data["status"] == "cancelled"
    assert Decimal(cancel_data["refund_amount"]) == Decimal(0)
    assert Decimal(cancel_data["penalty_amount"]) == Decimal(0)

    # 5. Verify status in database
    get_res = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancel_flexible_more_than_24_hours_yields_full_refund(
    client: AsyncClient, guest_token: str
):
    # 1. Fetch accommodation
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]

    check_in = date.today() + timedelta(days=50)
    check_out = date.today() + timedelta(days=53)

    # 2. Create reservation
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

    # 3. Pay for reservation to confirm it
    pay_init_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert pay_init_res.status_code == 201
    pay_info = pay_init_res.json()

    verify_res = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": pay_info["payment_id"],
            "tracking_code": pay_info["tracking_code"],
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "success"

    # 4. Preview cancellation
    preview_res = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel-preview",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert preview_res.status_code == 200
    preview = preview_res.json()
    total = Decimal(preview["total_price"])
    assert preview["hours_to_checkin"] > 24
    assert Decimal(preview["refundable_amount"]) == total
    assert Decimal(preview["penalty_amount"]) == Decimal(0)

    # 5. Execute cancellation
    cancel_res = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel",
        json={"reason": "Trip cancelled in advance"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cancel_res.status_code == 200
    cancel_data = cancel_res.json()
    assert cancel_data["status"] == "cancelled"
    assert Decimal(cancel_data["refund_amount"]) == total
    assert Decimal(cancel_data["penalty_amount"]) == Decimal(0)


@pytest.mark.asyncio
async def test_cancel_flexible_less_than_24_hours_retains_penalty(
    client: AsyncClient, guest_token: str
):
    # 1. Fetch accommodation
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    accommodation = acc_res.json()[0]
    acc_id = accommodation["id"]

    check_in = date.today() + timedelta(days=60)
    check_out = date.today() + timedelta(days=63)

    # 2. Create reservation and confirm via payment
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
    res_id = booking_res.json()["id"]

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

    # 3. Simulate check-in being within 10 hours from now
    now = datetime.now(timezone.utc)
    target_dt = now + timedelta(hours=10)
    async with AsyncSessionLocal() as session:
        db_res = await session.get(Reservation, res_id)
        db_acc = await session.get(Accommodation, acc_id)
        assert db_res is not None
        assert db_acc is not None
        db_res.check_in = target_dt.date()
        db_res.check_out = target_dt.date() + timedelta(days=3)
        db_acc.check_in_time = target_dt.time().replace(microsecond=0)
        db_acc.cancellation_policy = "flexible"
        base_price = db_acc.base_price
        cleaning_fee = db_acc.cleaning_fee
        total_price = db_res.total_price
        await session.commit()

    expected_penalty = min(total_price, base_price + cleaning_fee)
    expected_refund = total_price - expected_penalty

    # 4. Preview cancellation
    preview_res = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel-preview",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert preview_res.status_code == 200
    preview = preview_res.json()
    assert preview["hours_to_checkin"] < 24
    assert Decimal(preview["penalty_amount"]) == expected_penalty
    assert Decimal(preview["refundable_amount"]) == expected_refund

    # 5. Execute cancellation and verify match
    cancel_res = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel",
        json={"reason": "Emergency late cancellation"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cancel_res.status_code == 200
    cancel_data = cancel_res.json()
    assert Decimal(cancel_data["penalty_amount"]) == expected_penalty
    assert Decimal(cancel_data["refund_amount"]) == expected_refund


@pytest.mark.asyncio
async def test_preview_amounts_match_final_execution_amounts(client: AsyncClient, guest_token: str):
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]

    check_in = date.today() + timedelta(days=70)
    check_out = date.today() + timedelta(days=72)

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
    res_id = booking_res.json()["id"]

    # Preview before cancel
    preview_res = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel-preview",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    preview = preview_res.json()

    # Cancel
    cancel_res = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel",
        json={"reason": "Testing preview exact match"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    cancel = cancel_res.json()

    assert cancel["refund_amount"] == preview["refundable_amount"]
    assert cancel["penalty_amount"] == preview["penalty_amount"]


@pytest.mark.asyncio
async def test_cannot_cancel_after_checkin_time_has_arrived(client: AsyncClient, guest_token: str):
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]

    check_in = date.today() + timedelta(days=80)
    check_out = date.today() + timedelta(days=82)

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
    res_id = booking_res.json()["id"]

    # Manipulate DB to simulate that check-in time was 2 hours ago
    now = datetime.now(timezone.utc)
    past_dt = now - timedelta(hours=2)
    async with AsyncSessionLocal() as session:
        db_res = await session.get(Reservation, res_id)
        db_acc = await session.get(Accommodation, acc_id)
        assert db_res is not None
        assert db_acc is not None
        db_res.check_in = past_dt.date()
        db_res.total_nights = (db_res.check_out - db_res.check_in).days
        db_acc.check_in_time = past_dt.time().replace(microsecond=0)
        await session.commit()

    # Cancel preview must be blocked with HTTP 400
    preview_res = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel-preview",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert preview_res.status_code == 400
    assert "check-in time has already arrived or passed" in preview_res.json()["detail"]

    # Cancel execution must also be blocked with HTTP 400
    cancel_res = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel",
        json={"reason": "Attempting late cancel"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cancel_res.status_code == 400
    assert "check-in time has already arrived or passed" in cancel_res.json()["detail"]


@pytest.mark.asyncio
async def test_reservation_response_exposes_cancellation_fields(
    client: AsyncClient, guest_token: str
):
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]

    check_in = date.today() + timedelta(days=90)
    check_out = date.today() + timedelta(days=92)

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
    res_id = booking_res.json()["id"]

    # Cancel with a specific reason
    reason_text = "Medical emergency cancellation"
    cancel_res = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel",
        json={"reason": reason_text},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cancel_res.status_code == 200

    # Query GET /reservations/{id}
    get_res = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert get_res.status_code == 200
    res_data = get_res.json()
    assert res_data["status"] == "cancelled"
    assert res_data["cancellation_reason"] == reason_text
    assert res_data["cancelled_at"] is not None
    assert Decimal(str(res_data["refund_amount"])) == Decimal(0)
    assert Decimal(str(res_data["penalty_amount"])) == Decimal(0)


@pytest.mark.asyncio
async def test_cancellation_marks_pending_payments_failed(client: AsyncClient, guest_token: str):
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]

    check_in = (date.today() + timedelta(days=120)).isoformat()
    check_out = (date.today() + timedelta(days=123)).isoformat()

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

    checkout_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert checkout_res.status_code in (200, 201)
    payment_id = checkout_res.json()["payment_id"]

    p_get = await client.get(
        f"{settings.API_V1_STR}/payments/{payment_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert p_get.status_code == 200
    assert p_get.json()["status"] == "pending"

    cancel_res = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel",
        json={"reason": "Cancelled while payment pending"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    p_after = await client.get(
        f"{settings.API_V1_STR}/payments/{payment_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert p_after.status_code == 200
    assert p_after.json()["status"] == "failed"


@pytest.mark.asyncio
async def test_cancellation_records_explicit_refund_type(
    client: AsyncClient, guest_token: str, admin_token: str
):
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]
    check_in = date.today() + timedelta(days=100)
    check_out = check_in + timedelta(days=2)

    booking = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in.isoformat(),
            "check_out": check_out.isoformat(),
            "guests_count": 1,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert booking.status_code == 201
    res_id = booking.json()["id"]

    checkout = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert checkout.status_code in (200, 201)

    verify = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": checkout.json()["payment_id"],
            "tracking_code": checkout.json()["tracking_code"],
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert verify.status_code == 200

    cancel = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel",
        json={"reason": "type check"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cancel.status_code == 200
    assert Decimal(cancel.json()["refund_amount"]) > 0

    payments = await client.get(
        f"{settings.API_V1_STR}/payments/my",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert payments.status_code == 200
    rows = [p for p in payments.json() if p["reservation_id"] == res_id]
    assert {p["payment_type"] for p in rows} == {"charge", "refund"}
    refund = next(p for p in rows if p["payment_type"] == "refund")
    assert refund["tracking_code"].startswith("REF-")
