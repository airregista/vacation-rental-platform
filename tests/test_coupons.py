import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_coupons_flow(client: AsyncClient, admin_token: str, guest_token: str):
    code = f"DISC_{uuid.uuid4().hex[:6].upper()}"
    now = datetime.now(timezone.utc)

    # 1. Admin creates coupon
    create_res = await client.post(
        f"{settings.API_V1_STR}/coupons/",
        json={
            "code": code,
            "discount_type": "percentage",
            "discount_value": 20,
            "max_discount_amount": 300000,
            "min_booking_amount": 500000,
            "valid_from": (now - timedelta(days=1)).isoformat(),
            "valid_until": (now + timedelta(days=30)).isoformat(),
            "usage_limit": 10,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    created_coupon = create_res.json()
    assert created_coupon["code"] == code

    # 2. Guest validates coupon
    val_res = await client.post(
        f"{settings.API_V1_STR}/coupons/validate",
        json={"code": code, "booking_amount": 1000000},
    )
    assert val_res.status_code == 200
    assert val_res.json()["is_valid"] is True
    assert Decimal(str(val_res.json()["discount_amount"])) == Decimal(200000)

    # 3. Calculate reservation price with coupon
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]
    check_in = (now.date() + timedelta(days=90)).isoformat()
    check_out = (now.date() + timedelta(days=93)).isoformat()

    calc_res = await client.post(
        f"{settings.API_V1_STR}/reservations/calculate-price",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests_count": 2,
            "coupon_code": code,
        },
    )
    assert calc_res.status_code == 200
    assert Decimal(str(calc_res.json()["discount_amount"])) > 0
    assert calc_res.json()["coupon_code"] == code

    # 4. Create reservation with coupon
    res_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests_count": 2,
            "coupon_code": code,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_res.status_code == 201
    assert Decimal(str(res_res.json()["total_price"])) == Decimal(
        str(calc_res.json()["total_price"])
    )

    # Verify coupon used_count incremented
    coupon_list_res = await client.get(
        f"{settings.API_V1_STR}/coupons/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert coupon_list_res.status_code == 200
    matched = [c for c in coupon_list_res.json() if c["code"] == code]
    assert len(matched) == 1
    assert matched[0]["used_count"] == 1


@pytest.mark.asyncio
async def test_coupon_usage_limit_and_edge_cases(
    client: AsyncClient, admin_token: str, guest_token: str
):
    now = datetime.now(timezone.utc)
    limit_code = f"LIM_{uuid.uuid4().hex[:6].upper()}"

    # 1. Create coupon with usage_limit = 1
    create_res = await client.post(
        f"{settings.API_V1_STR}/coupons/",
        json={
            "code": f"  {limit_code}  ",  # test whitespace stripping
            "discount_type": "fixed",
            "discount_value": 30000,
            "min_booking_amount": 100000,
            "valid_from": (now - timedelta(days=1)).isoformat(),
            "valid_until": (now + timedelta(days=5)).isoformat(),
            "usage_limit": 1,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    assert create_res.json()["code"] == limit_code

    # 2. Inverted dates must be rejected with 422
    bad_dates_res = await client.post(
        f"{settings.API_V1_STR}/coupons/",
        json={
            "code": f"BAD_{uuid.uuid4().hex[:6].upper()}",
            "discount_type": "fixed",
            "discount_value": 30000,
            "valid_from": (now + timedelta(days=5)).isoformat(),
            "valid_until": (now - timedelta(days=1)).isoformat(),
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert bad_dates_res.status_code == 422

    # 3. Calculate price with blank/whitespace coupon succeeds with 0 discount
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]
    check_in = (now.date() + timedelta(days=120)).isoformat()
    check_out = (now.date() + timedelta(days=122)).isoformat()

    blank_calc = await client.post(
        f"{settings.API_V1_STR}/reservations/calculate-price",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests_count": 2,
            "coupon_code": "   ",
        },
    )
    assert blank_calc.status_code == 200
    assert Decimal(str(blank_calc.json()["discount_amount"])) == Decimal(0)
    assert blank_calc.json()["coupon_code"] is None

    # 4. First booking consumes the limit
    book1 = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests_count": 2,
            "coupon_code": limit_code,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert book1.status_code == 201

    # 5. Second booking with exhausted coupon must fail
    check_in_2 = (now.date() + timedelta(days=125)).isoformat()
    check_out_2 = (now.date() + timedelta(days=127)).isoformat()
    book2 = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in_2,
            "check_out": check_out_2,
            "guests_count": 2,
            "coupon_code": limit_code,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert book2.status_code == 400
    assert "usage limit" in book2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_coupon_validation_failures(client: AsyncClient, admin_token: str):
    now = datetime.now(timezone.utc)
    expired_code = f"EXP_{uuid.uuid4().hex[:6].upper()}"

    # Create expired coupon
    exp_res = await client.post(
        f"{settings.API_V1_STR}/coupons/",
        json={
            "code": expired_code,
            "discount_type": "fixed",
            "discount_value": 50000,
            "min_booking_amount": 100000,
            "valid_from": (now - timedelta(days=10)).isoformat(),
            "valid_until": (now - timedelta(days=1)).isoformat(),
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert exp_res.status_code == 201

    # Validate expired coupon returns is_valid=False
    val_res = await client.post(
        f"{settings.API_V1_STR}/coupons/validate",
        json={"code": expired_code, "booking_amount": 200000},
    )
    assert val_res.status_code == 200
    assert val_res.json()["is_valid"] is False
    assert "expired" in val_res.json()["message"].lower()

    # Validate below min_booking_amount
    valid_code = f"FIX_{uuid.uuid4().hex[:6].upper()}"
    await client.post(
        f"{settings.API_V1_STR}/coupons/",
        json={
            "code": valid_code,
            "discount_type": "fixed",
            "discount_value": 50000,
            "min_booking_amount": 200000,
            "valid_from": (now - timedelta(days=1)).isoformat(),
            "valid_until": (now + timedelta(days=10)).isoformat(),
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    val_below = await client.post(
        f"{settings.API_V1_STR}/coupons/validate",
        json={"code": valid_code, "booking_amount": 100000},
    )
    assert val_below.status_code == 200
    assert val_below.json()["is_valid"] is False
    assert "minimum" in val_below.json()["message"].lower()


@pytest.mark.asyncio
async def test_unpaid_coupon_quota_restored_on_cancellation(
    client: AsyncClient, admin_token: str, guest_token: str
):
    now = datetime.now(timezone.utc)
    rel_code = f"REL_{uuid.uuid4().hex[:6].upper()}"

    # 1. Create coupon with usage_limit = 1
    create_res = await client.post(
        f"{settings.API_V1_STR}/coupons/",
        json={
            "code": rel_code,
            "discount_type": "fixed",
            "discount_value": 20000,
            "min_booking_amount": 50000,
            "valid_from": (now - timedelta(days=1)).isoformat(),
            "valid_until": (now + timedelta(days=5)).isoformat(),
            "usage_limit": 1,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201

    # 2. Book with coupon
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]
    check_in = (now.date() + timedelta(days=130)).isoformat()
    check_out = (now.date() + timedelta(days=132)).isoformat()

    book = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests_count": 2,
            "coupon_code": rel_code,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert book.status_code == 201
    res_id = book.json()["id"]
    assert book.json()["coupon_code"] == rel_code

    # 3. Cancel the unpaid reservation -> coupon slot must be released
    cancel_res = await client.post(
        f"{settings.API_V1_STR}/reservations/{res_id}/cancel",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cancel_res.status_code == 200

    # 4. Another booking with the released coupon should now succeed
    check_in_2 = (now.date() + timedelta(days=135)).isoformat()
    check_out_2 = (now.date() + timedelta(days=137)).isoformat()
    book_retry = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in_2,
            "check_out": check_out_2,
            "guests_count": 2,
            "coupon_code": rel_code,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert book_retry.status_code == 201


@pytest.mark.asyncio
async def test_zero_total_price_free_coupon_flow(
    client: AsyncClient, admin_token: str, guest_token: str
):
    now = datetime.now(timezone.utc)
    free_code = f"FREE_{uuid.uuid4().hex[:6].upper()}"

    # 1. Create 100% discount coupon
    await client.post(
        f"{settings.API_V1_STR}/coupons/",
        json={
            "code": free_code,
            "discount_type": "percentage",
            "discount_value": 100,
            "min_booking_amount": 1,
            "valid_from": (now - timedelta(days=1)).isoformat(),
            "valid_until": (now + timedelta(days=5)).isoformat(),
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # 2. Book with 100% coupon on accommodation without cleaning fee -> status should be instantly confirmed
    new_acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "اقامتگاه بدون هزینه نظافت",
            "address": "خیابان رایگان، پلاک صفر",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 400000,
            "cleaning_fee": 0,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert new_acc_res.status_code == 201
    acc_id = new_acc_res.json()["id"]
    check_in = (now.date() + timedelta(days=140)).isoformat()
    check_out = (now.date() + timedelta(days=142)).isoformat()

    book = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests_count": 2,
            "coupon_code": free_code,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert book.status_code == 201
    assert Decimal(str(book.json()["total_price"])) == Decimal(0)
    assert book.json()["status"] == "confirmed"

    # 3. Checkout payment on zero price reservation returns 400
    chk_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": book.json()["id"]},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert chk_res.status_code == 400


@pytest.mark.asyncio
async def test_coupon_validation_and_timezone_normalization(client: AsyncClient, admin_token: str):
    # Short whitespace code must fail validation (< 3 chars after strip)
    short_res = await client.post(
        f"{settings.API_V1_STR}/coupons/",
        json={
            "code": "  A  ",
            "discount_type": "fixed",
            "discount_value": 1000,
            "valid_from": "2026-11-03T10:00:00Z",
            "valid_until": "2026-11-04T10:00:00Z",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert short_res.status_code == 422

    # Mixed naive and aware timestamps should normalize cleanly
    mixed_res = await client.post(
        f"{settings.API_V1_STR}/coupons/",
        json={
            "code": f"MIX_{uuid.uuid4().hex[:6].upper()}",
            "discount_type": "fixed",
            "discount_value": 1000,
            "valid_from": "2026-11-01T00:00:00Z",
            "valid_until": "2026-11-30T23:59:59",  # offset-naive
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert mixed_res.status_code == 201


def test_coupon_evaluation_applies_percentage_cap_and_expiry():
    from types import SimpleNamespace

    from app.services.coupon_service import evaluate_coupon

    now = datetime.now(timezone.utc)
    coupon = SimpleNamespace(
        is_active=True,
        valid_from=now - timedelta(days=1),
        valid_until=now + timedelta(days=1),
        min_booking_amount=Decimal(100000),
        usage_limit=None,
        used_count=0,
        discount_type="percentage",
        discount_value=Decimal(20),
        max_discount_amount=Decimal(300000),
    )

    evaluation = evaluate_coupon(coupon, Decimal(2000000), now)
    assert evaluation.is_valid is True
    assert evaluation.discount_amount == Decimal(300000)

    coupon.valid_until = now - timedelta(days=1)
    expired = evaluate_coupon(coupon, Decimal(2000000), now)
    assert expired.is_valid is False
    assert expired.message == "Coupon has expired"
