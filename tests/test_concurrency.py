import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.main import app
from app.models.payment import Payment


@pytest.mark.asyncio
@pytest.mark.real_db
async def test_double_booking_prevention_on_concurrent_payments(
    client: AsyncClient,
    real_db: None,
    admin_token: str,
    guest_token: str,
):
    create_acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "ویلا لوکس همزمانی",
            "address": "تهران، خیابان تست همزمانی، پلاک ۱",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 1000000,
            "extra_person_fee": 100000,
            "cleaning_fee": 50000,
            "cancellation_policy": "flexible",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_acc_res.status_code == 201
    acc_id = create_acc_res.json()["id"]

    check_in = (date.today() + timedelta(days=20)).isoformat()
    check_out = (date.today() + timedelta(days=23)).isoformat()

    res_a = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_a.status_code == 201
    res_a_id = res_a.json()["id"]

    res_b = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_b.status_code == 201
    res_b_id = res_b.json()["id"]

    checkout_a = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_a_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert checkout_a.status_code in (200, 201)
    payment_a_id = checkout_a.json()["payment_id"]
    tracking_a = checkout_a.json()["tracking_code"]

    checkout_b = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_b_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert checkout_b.status_code in (200, 201)
    payment_b_id = checkout_b.json()["payment_id"]
    tracking_b = checkout_b.json()["tracking_code"]

    verify_a, verify_b = await asyncio.gather(
        client.post(
            f"{settings.API_V1_STR}/payments/verify",
            json={
                "payment_id": payment_a_id,
                "tracking_code": tracking_a,
                "simulate_success": True,
            },
            headers={"Authorization": f"Bearer {guest_token}"},
        ),
        client.post(
            f"{settings.API_V1_STR}/payments/verify",
            json={
                "payment_id": payment_b_id,
                "tracking_code": tracking_b,
                "simulate_success": True,
            },
            headers={"Authorization": f"Bearer {guest_token}"},
        ),
    )

    assert sorted([verify_a.status_code, verify_b.status_code]) == [200, 409]
    conflict = verify_a if verify_a.status_code == 409 else verify_b
    assert "no longer available" in conflict.json()["detail"].lower()


@pytest.mark.asyncio
async def test_idempotent_successful_payment_verification(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    create_acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "کلبه تکرار پرداخت",
            "address": "مازندران، کلبه تست تکرار، پلاک ۲",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 2,
            "base_price": 500000,
            "extra_person_fee": 0,
            "cleaning_fee": 0,
            "cancellation_policy": "flexible",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_acc_res.status_code == 201
    acc_id = create_acc_res.json()["id"]

    res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=35)).isoformat(),
            "check_out": (date.today() + timedelta(days=37)).isoformat(),
            "guests_count": 1,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    res_id = res.json()["id"]

    checkout = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert checkout.status_code in (200, 201)
    payment_id = checkout.json()["payment_id"]
    tracking = checkout.json()["tracking_code"]

    v1 = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={"payment_id": payment_id, "tracking_code": tracking, "simulate_success": True},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert v1.status_code == 200

    v2 = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={"payment_id": payment_id, "tracking_code": tracking, "simulate_success": True},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert v2.status_code == 200
    assert v2.json()["status"] == "success"


@pytest.mark.asyncio
@pytest.mark.real_db
async def test_concurrent_zero_payable_booking_mutual_exclusion(
    client: AsyncClient,
    real_db: None,
    admin_token: str,
    guest_token: str,
):
    second_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    guest2_reg = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": second_phone,
            "password": "strongPassword123",
            "first_name": "مهمان دوم",
            "last_name": "همزمان",
        },
    )
    assert guest2_reg.status_code == 201
    guest2_token = guest2_reg.json()["access_token"]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client2:
        now = datetime.now(timezone.utc)
        free_code = f"FREE_{uuid.uuid4().hex[:6].upper()}"

        coupon_res = await client.post(
            f"{settings.API_V1_STR}/coupons/",
            json={
                "code": free_code,
                "discount_type": "percentage",
                "discount_value": 100,
                "min_booking_amount": 0,
                "valid_from": (now - timedelta(days=1)).isoformat(),
                "valid_until": (now + timedelta(days=5)).isoformat(),
                "usage_limit": 10,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert coupon_res.status_code == 201

        create_acc_res = await client.post(
            f"{settings.API_V1_STR}/accommodations/",
            json={
                "title": "ویلا رایگان همزمانی",
                "address": "تهران، همزمانی صفر، پلاک ۱",
                "city_id": 1,
                "category_id": 1,
                "capacity": 2,
                "max_capacity": 4,
                "base_price": 400000,
                "extra_person_fee": 0,
                "cleaning_fee": 0,
                "cancellation_policy": "flexible",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert create_acc_res.status_code == 201
        acc_id = create_acc_res.json()["id"]

        check_in = (date.today() + timedelta(days=130)).isoformat()
        check_out = (date.today() + timedelta(days=133)).isoformat()

        req_payload = {
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests_count": 2,
            "coupon_code": free_code,
        }

        task1 = client.post(
            f"{settings.API_V1_STR}/reservations/",
            json=req_payload,
            headers={"Authorization": f"Bearer {guest_token}"},
        )
        task2 = client2.post(
            f"{settings.API_V1_STR}/reservations/",
            json=req_payload,
            headers={"Authorization": f"Bearer {guest2_token}"},
        )

        results = await asyncio.gather(task1, task2, return_exceptions=True)

        statuses = [r.status_code for r in results if isinstance(r, Response)]
        assert 201 in statuses
        assert 409 in statuses

        success_res = next(r for r in results if getattr(r, "status_code", None) == 201)
        conflict_res = next(r for r in results if getattr(r, "status_code", None) == 409)
        assert isinstance(success_res, Response)
        assert isinstance(conflict_res, Response)

        assert success_res.json()["status"] == "confirmed"
        assert Decimal(str(success_res.json()["total_price"])) == Decimal(0)
        assert "overlap" in conflict_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_payment_conflict_cancels_reservation_and_releases_coupon(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    now = datetime.now(timezone.utc)
    coupon_code = f"DISC_{uuid.uuid4().hex[:6].upper()}"

    create_coupon_res = await client.post(
        f"{settings.API_V1_STR}/coupons/",
        json={
            "code": coupon_code,
            "discount_type": "percentage",
            "discount_value": 20,
            "min_booking_amount": 0,
            "valid_from": (now - timedelta(days=1)).isoformat(),
            "valid_until": (now + timedelta(days=5)).isoformat(),
            "usage_limit": 1,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_coupon_res.status_code == 201

    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "ویلا تست تعارض پرداخت",
            "address": "تهران، تعارض پرداخت، پلاک ۹",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 500000,
            "extra_person_fee": 0,
            "cleaning_fee": 100000,
            "cancellation_policy": "flexible",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    check_in = (date.today() + timedelta(days=150)).isoformat()
    check_out = (date.today() + timedelta(days=153)).isoformat()

    res_a = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests_count": 2,
            "coupon_code": coupon_code,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_a.status_code == 201
    res_a_id = res_a.json()["id"]
    assert res_a.json()["status"] == "pending"

    coupons_list = await client.get(
        f"{settings.API_V1_STR}/coupons/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    matched_coupon = next(c for c in coupons_list.json() if c["code"] == coupon_code)
    assert matched_coupon["used_count"] == 1

    res_b = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_b.status_code == 201
    res_b_id = res_b.json()["id"]

    checkout_b = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_b_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert checkout_b.status_code in (200, 201)
    verify_b = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": checkout_b.json()["payment_id"],
            "tracking_code": checkout_b.json()["tracking_code"],
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert verify_b.status_code == 200
    assert verify_b.json()["status"] == "success"

    checkout_a = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_a_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert checkout_a.status_code in (200, 201)
    payment_a_id = checkout_a.json()["payment_id"]
    tracking_a = checkout_a.json()["tracking_code"]

    verify_a = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": payment_a_id,
            "tracking_code": tracking_a,
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert verify_a.status_code == 409
    assert "no longer available" in verify_a.json()["detail"].lower()

    res_a_after = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_a_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_a_after.status_code == 200
    res_a_data = res_a_after.json()
    assert res_a_data["status"] == "cancelled"
    assert res_a_data["cancellation_reason"] == "Dates occupied by concurrent confirmed booking"
    assert res_a_data["cancelled_at"] is not None

    payment_a_get = await client.get(
        f"{settings.API_V1_STR}/payments/{payment_a_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert payment_a_get.status_code == 200
    assert payment_a_get.json()["status"] == "failed"

    coupons_list_after = await client.get(
        f"{settings.API_V1_STR}/coupons/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    matched_after = next(c for c in coupons_list_after.json() if c["code"] == coupon_code)
    assert matched_after["used_count"] == 0


@pytest.mark.asyncio
async def test_checkout_reuses_existing_pending_payment(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "Idempotent checkout listing",
            "address": "Idempotent checkout address",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 500000,
            "cleaning_fee": 0,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    acc_id = create_res.json()["id"]

    reservation_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=150)).isoformat(),
            "check_out": (date.today() + timedelta(days=152)).isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert reservation_res.status_code == 201
    reservation_id = reservation_res.json()["id"]

    headers = {"Authorization": f"Bearer {guest_token}"}
    first = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": reservation_id},
        headers=headers,
    )
    second = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": reservation_id},
        headers=headers,
    )
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["payment_id"] == second.json()["payment_id"]
    assert first.json()["tracking_code"] == second.json()["tracking_code"]

    async with AsyncSessionLocal() as session:
        pending_count = (
            await session.execute(
                select(func.count())
                .select_from(Payment)
                .where(
                    Payment.reservation_id == reservation_id,
                    Payment.status == "pending",
                )
            )
        ).scalar_one()
    assert pending_count == 1
