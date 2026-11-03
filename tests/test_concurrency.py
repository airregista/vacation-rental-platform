from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_double_booking_prevention_on_concurrent_payments(
    client: AsyncClient,
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

    verify_a = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": payment_a_id,
            "tracking_code": tracking_a,
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert verify_a.status_code == 200
    assert verify_a.json()["status"] == "success"

    verify_b = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": payment_b_id,
            "tracking_code": tracking_b,
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert verify_b.status_code == 409
    assert "no longer available" in verify_b.json()["detail"].lower()


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
