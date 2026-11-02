from datetime import date, timedelta
import pytest
from httpx import AsyncClient
from app.core.config import settings


@pytest.mark.asyncio
async def test_inverted_dates_and_capacity_rejections(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "کلبه بررسی مرزها",
            "address": "خیابان تست مرزها، پلاک ۱",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 3,
            "base_price": 500000,
            "extra_guest_fee": 100000,
            "cleaning_fee": 20000,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    inverted_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=10)).isoformat(),
            "check_out": (date.today() + timedelta(days=8)).isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert inverted_res.status_code in (400, 422)

    overflow_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=12)).isoformat(),
            "check_out": (date.today() + timedelta(days=14)).isoformat(),
            "guests_count": 10,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert overflow_res.status_code in (400, 422)


@pytest.mark.asyncio
async def test_payment_failure_simulation(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "کلبه تست شکست پرداخت",
            "address": "خیابان تست پرداخت، پلاک ۲",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 2,
            "base_price": 300000,
            "extra_guest_fee": 0,
            "cleaning_fee": 0,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    res_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=50)).isoformat(),
            "check_out": (date.today() + timedelta(days=52)).isoformat(),
            "guests_count": 1,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_res.status_code == 201
    res_id = res_res.json()["id"]

    checkout = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert checkout.status_code == 201
    payment_id = checkout.json()["payment_id"]
    tracking = checkout.json()["tracking_code"]

    fail_verify = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={"payment_id": payment_id, "tracking_code": tracking, "simulate_success": False},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert fail_verify.status_code == 200
    assert fail_verify.json()["status"] == "failed"

    res_detail = await client.get(
        f"{settings.API_V1_STR}/reservations/{res_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_detail.json()["status"] == "pending"
