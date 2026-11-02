from datetime import date, timedelta
import uuid
import pytest
from httpx import AsyncClient
from app.core.config import settings


@pytest.mark.asyncio
async def test_host_listing_and_reservations_isolation(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "ویلا ساحلی رامسر میزبان",
            "address": "مازندران، رامسر، بلوار ساحلی",
            "city_id": 1,
            "category_id": 1,
            "capacity": 4,
            "max_capacity": 6,
            "base_price": 1200000,
            "extra_person_fee": 150000,
            "cleaning_fee": 80000,
            "latitude": 36.9189,
            "longitude": 50.6481,
            "host_id": 2,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    my_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/my",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert my_res.status_code == 200
    host_acc_ids = [a["id"] for a in my_res.json()]
    assert acc_id in host_acc_ids

    geo_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/?lat=36.9200&lng=50.6500&radius_km=5"
    )
    assert geo_res.status_code == 200
    geo_ids = [a["id"] for a in geo_res.json()]
    assert acc_id in geo_ids

    far_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/?lat=35.6892&lng=51.3890&radius_km=5"
    )
    assert far_res.status_code == 200
    far_ids = [a["id"] for a in far_res.json()]
    assert acc_id not in far_ids

    ical_res = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics")
    assert ical_res.status_code == 200
    assert "BEGIN:VCALENDAR" in ical_res.text
    assert "text/calendar" in ical_res.headers["content-type"]


@pytest.mark.asyncio
async def test_host_reservations_and_permissions(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    # Register a separate guest user
    random_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    guest2_res = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": random_phone,
            "password": "guestPassword123",
            "first_name": "مهمان",
            "last_name": "رزرو کننده",
        },
    )
    assert guest2_res.status_code == 201
    guest2_token = guest2_res.json()["access_token"]

    # Admin creates accommodation owned by guest 1 (host_id=2)
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "کلبه چوبی میزبان",
            "address": "گیلان، ماسال، اولسبلانگاه",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 800000,
            "cleaning_fee": 50000,
            "host_id": 2,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    # Host can add image
    img_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images",
        json={"image_url": "https://example.com/host-cottage.jpg", "is_cover": True},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert img_res.status_code == 201

    # Other guest cannot add image to host's accommodation
    forbidden_img = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images",
        json={"image_url": "https://example.com/hacker.jpg", "is_cover": False},
        headers={"Authorization": f"Bearer {guest2_token}"},
    )
    assert forbidden_img.status_code == 403

    # Host can set pricing exception
    ex_date = (date.today() + timedelta(days=20)).isoformat()
    price_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/pricing-exceptions",
        json={"date": ex_date, "price": 950000, "is_blocked": True},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert price_res.status_code == 200

    # Other guest cannot set pricing exception
    forbidden_price = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/pricing-exceptions",
        json={"date": ex_date, "price": 100000, "is_blocked": False},
        headers={"Authorization": f"Bearer {guest2_token}"},
    )
    assert forbidden_price.status_code == 403

    # Guest 2 books the accommodation
    check_in = date.today() + timedelta(days=10)
    check_out = date.today() + timedelta(days=13)
    res_booking = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": check_in.isoformat(),
            "check_out": check_out.isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest2_token}"},
    )
    assert res_booking.status_code == 201
    booking_id = res_booking.json()["id"]

    # Host lists reservations on /reservations/host
    host_reservations_res = await client.get(
        f"{settings.API_V1_STR}/reservations/host",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert host_reservations_res.status_code == 200
    host_res_ids = [r["id"] for r in host_reservations_res.json()]
    assert booking_id in host_res_ids

    # Guest 2 lists /reservations/host -> should NOT see this reservation because Guest 2 is not the host
    guest2_host_res = await client.get(
        f"{settings.API_V1_STR}/reservations/host",
        headers={"Authorization": f"Bearer {guest2_token}"},
    )
    assert guest2_host_res.status_code == 200
    guest2_res_ids = [r["id"] for r in guest2_host_res.json()]
    assert booking_id not in guest2_res_ids

    # iCalendar export contains the blocked date
    ical_res = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics")
    assert ical_res.status_code == 200
    assert "Blocked - Not Available" in ical_res.text
