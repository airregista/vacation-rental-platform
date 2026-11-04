import uuid
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

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

    ical_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
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
    ical_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert ical_res.status_code == 200
    assert "Blocked - Not Available" in ical_res.text

    # Non-host cannot delete host's image
    img_id = img_res.json()["id"]
    forbidden_del = await client.delete(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images/{img_id}",
        headers={"Authorization": f"Bearer {guest2_token}"},
    )
    assert forbidden_del.status_code == 403

    # Host can delete their own image
    del_res = await client.delete(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images/{img_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert del_res.status_code == 204

    # Host can view reservation details
    host_detail_res = await client.get(
        f"{settings.API_V1_STR}/reservations/{booking_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert host_detail_res.status_code == 200
    assert host_detail_res.json()["id"] == booking_id

    # Register an unrelated 3rd guest user and verify 403 Forbidden
    unrelated_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    guest3_res = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": unrelated_phone,
            "password": "guestPassword123",
            "first_name": "غریبه",
            "last_name": "تست",
        },
    )
    assert guest3_res.status_code == 201
    guest3_token = guest3_res.json()["access_token"]

    forbidden_detail_res = await client.get(
        f"{settings.API_V1_STR}/reservations/{booking_id}",
        headers={"Authorization": f"Bearer {guest3_token}"},
    )
    assert forbidden_detail_res.status_code == 403


@pytest.mark.asyncio
async def test_incomplete_spatial_search_rejected(client: AsyncClient):
    # Only lat and lng provided without radius_km
    res = await client.get(f"{settings.API_V1_STR}/accommodations/?lat=36.9&lng=50.6")
    assert res.status_code == 400
    assert "radius_km" in res.json()["detail"].lower()

    # Only radius_km provided without lat and lng
    res2 = await client.get(f"{settings.API_V1_STR}/accommodations/?radius_km=15")
    assert res2.status_code == 400


@pytest.mark.asyncio
async def test_spatial_search_coordinate_validation_boundaries(
    client: AsyncClient,
    admin_token: str,
):
    # 1. Out-of-bounds latitude (lat=95.0, -95.0) returns HTTP 422
    res_lat_high = await client.get(
        f"{settings.API_V1_STR}/accommodations/?lat=95.0&lng=50.0&radius_km=10"
    )
    assert res_lat_high.status_code == 422

    res_lat_low = await client.get(
        f"{settings.API_V1_STR}/accommodations/?lat=-95.0&lng=50.0&radius_km=10"
    )
    assert res_lat_low.status_code == 422

    # 2. Out-of-bounds longitude (lng=190.0, -190.0) returns HTTP 422
    res_lng_high = await client.get(
        f"{settings.API_V1_STR}/accommodations/?lat=35.0&lng=190.0&radius_km=10"
    )
    assert res_lng_high.status_code == 422

    res_lng_low = await client.get(
        f"{settings.API_V1_STR}/accommodations/?lat=35.0&lng=-190.0&radius_km=10"
    )
    assert res_lng_low.status_code == 422

    # 3. Zero or negative radius (radius_km=0 or -5) returns HTTP 422
    res_radius_zero = await client.get(
        f"{settings.API_V1_STR}/accommodations/?lat=35.0&lng=50.0&radius_km=0"
    )
    assert res_radius_zero.status_code == 422

    res_radius_neg = await client.get(
        f"{settings.API_V1_STR}/accommodations/?lat=35.0&lng=50.0&radius_km=-5"
    )
    assert res_radius_neg.status_code == 422

    # 4. Verify accommodations with latitude IS NULL are omitted from radius search results without exceptions
    acc_null_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه بدون مختصات-{uuid.uuid4().hex[:6]}",
            "address": "تهران، بدون مختصات",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 500000,
            "host_id": 1,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_null_res.status_code == 201
    null_acc_id = acc_null_res.json()["id"]

    search_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/?lat=35.6892&lng=51.3890&radius_km=500"
    )
    assert search_res.status_code == 200
    search_ids = [a["id"] for a in search_res.json()]
    assert null_acc_id not in search_ids


@pytest.mark.asyncio
async def test_batch_pricing_exceptions(client: AsyncClient, admin_token: str):
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]
    start = date.today() + timedelta(days=80)
    end = date.today() + timedelta(days=86)

    batch_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/pricing-exceptions/batch",
        json={
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "price": 1250000,
            "is_blocked": True,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert batch_res.status_code == 200
    assert batch_res.json()["updated_count"] == 7


@pytest.mark.asyncio
async def test_external_calendar_sync_flow(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    # 1. Admin creates accommodation owned by host (host_id=2) with external_calendar_url
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه تست آی‌کَل-{uuid.uuid4().hex[:6]}",
            "address": "گیلان، رشت",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 1000000,
            "host_id": 2,
            "external_calendar_url": "https://calendar.example.com/feed.ics",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]
    assert acc_res.json()["external_calendar_url"] == "https://calendar.example.com/feed.ics"

    # 2. Mock httpx.AsyncClient.get returning valid ICS text with 2 VEVENT blocks
    start1 = (date.today() + timedelta(days=10)).strftime("%Y%m%d")
    end1 = (date.today() + timedelta(days=13)).strftime("%Y%m%d")  # 3 days: 10, 11, 12
    start2 = (date.today() + timedelta(days=20)).strftime("%Y%m%d")
    end2 = (date.today() + timedelta(days=22)).strftime("%Y%m%d")  # 2 days: 20, 21
    ics_text = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
DTSTART;VALUE=DATE:{start1}
DTEND;VALUE=DATE:{end1}
SUMMARY:Airbnb (Not available)
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:{start2}
DTEND;VALUE=DATE:{end2}
SUMMARY:Airbnb (Not available)
END:VEVENT
END:VCALENDAR"""

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = ics_text
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get, patch(
        "socket.gethostbyname", return_value="93.184.215.14"
    ):
        mock_get.return_value = mock_resp

        # Host sends POST /accommodations/{id}/calendar/sync
        sync_res = await client.post(
            f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar/sync",
            headers={"Authorization": f"Bearer {guest_token}"},
        )
        assert sync_res.status_code == 200
        sync_data = sync_res.json()
        assert sync_data["synced_events_count"] == 2
        assert sync_data["blocked_days_count"] == 5
        assert sync_data["last_sync_at"] is not None

    # Assert PricingException entries exist with is_blocked = True via calendar endpoint
    cal_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar?days=30",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cal_res.status_code == 200
    days = cal_res.json()
    blocked_dates = {d["date"] for d in days if not d["is_available"]}
    expected_dates = {
        (date.today() + timedelta(days=d)).isoformat()
        for d in [10, 11, 12, 20, 21]
    }
    assert blocked_dates.issuperset(expected_dates)

    # Assert exported iCal calendar contains blocked entries
    cal_ics = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cal_ics.status_code == 200
    assert "Blocked - Not Available" in cal_ics.text

    # Assert detail endpoint returns updated last_calendar_sync_at
    detail_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert detail_res.status_code == 200
    assert detail_res.json()["last_calendar_sync_at"] is not None


@pytest.mark.asyncio
async def test_external_calendar_sync_unauthorized(
    client: AsyncClient,
    admin_token: str,
):
    # Admin creates accommodation owned by user 2
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه مجوز تست-{uuid.uuid4().hex[:6]}",
            "address": "گیلان، لاهیجان",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 900000,
            "host_id": 2,
            "external_calendar_url": "https://calendar.example.com/ical.ics",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    # Register an unrelated guest
    unrelated_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    guest_other_res = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": unrelated_phone,
            "password": "guestPassword123",
            "first_name": "کاربر",
            "last_name": "غیرمجاز",
        },
    )
    assert guest_other_res.status_code == 201
    guest_other_token = guest_other_res.json()["access_token"]

    # Non-host guest receives HTTP 403 Forbidden
    sync_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar/sync",
        headers={"Authorization": f"Bearer {guest_other_token}"},
    )
    assert sync_res.status_code == 403


@pytest.mark.asyncio
async def test_external_calendar_sync_ssrf_rejection(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    # Host creates/updates accommodation with loopback calendar URL
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه تست اس‌اس‌آراف-{uuid.uuid4().hex[:6]}",
            "address": "مازندران، چالوس",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 950000,
            "host_id": 2,
            "external_calendar_url": "http://127.0.0.1/admin.ics",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    # Host attempts syncing with http://127.0.0.1/admin.ics and receives HTTP 400 Bad Request
    sync_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar/sync",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert sync_res.status_code == 400
    assert "Loopback" in sync_res.json()["detail"] or "forbidden" in sync_res.json()["detail"].lower()

    # Domain resolving to 127.0.0.1 is also rejected by DNS check
    with patch("socket.gethostbyname", return_value="127.0.0.1"):
        await client.put(
            f"{settings.API_V1_STR}/accommodations/{acc_id}",
            json={"external_calendar_url": "http://evil-dns.example.com/calendar.ics"},
            headers={"Authorization": f"Bearer {guest_token}"},
        )
        dns_res = await client.post(
            f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar/sync",
            headers={"Authorization": f"Bearer {guest_token}"},
        )
        assert dns_res.status_code == 400
        assert "forbidden" in dns_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_external_calendar_sync_redirect_ssrf_rejection(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه تست ریدایرکت اس‌اس‌آراف-{uuid.uuid4().hex[:6]}",
            "address": "مازندران، چالوس",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 950000,
            "host_id": 2,
            "external_calendar_url": "https://calendar.example.com/redirect.ics",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    acc_id = acc_res.json()["id"]

    mock_redirect_resp = MagicMock()
    mock_redirect_resp.status_code = 302
    mock_redirect_resp.headers = {"location": "http://127.0.0.1/admin.ics"}

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get, patch(
        "socket.gethostbyname", return_value="93.184.215.14"
    ):
        mock_get.return_value = mock_redirect_resp
        sync_res = await client.post(
            f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar/sync",
            headers={"Authorization": f"Bearer {guest_token}"},
        )
        assert sync_res.status_code == 400
        assert "forbidden" in sync_res.json()["detail"].lower() or "loopback" in sync_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_external_calendar_url_hidden_from_public_and_guests(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    secret_feed = "https://calendar.example.com/secret-token-12345.ics"
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه تست حریم خصوصی فید-{uuid.uuid4().hex[:6]}",
            "address": "گیلان، ماسال",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 1200000,
            "host_id": 2,
            "external_calendar_url": secret_feed,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    acc_id = acc_res.json()["id"]

    # 1. Anonymous list query: external_calendar_url field is not exposed in list items
    list_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    assert list_res.status_code == 200
    for item in list_res.json():
        assert "external_calendar_url" not in item

    # 2. Anonymous detail query: external_calendar_url is None
    anon_detail = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    assert anon_detail.status_code == 200
    assert anon_detail.json()["external_calendar_url"] is None

    # 3. Third-party guest detail query: external_calendar_url is None
    other_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    reg_other = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": other_phone,
            "password": "Password123!",
            "first_name": "ناشناس",
            "last_name": "مسافر",
        },
    )
    other_token = reg_other.json()["access_token"]
    guest_detail = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert guest_detail.status_code == 200
    assert guest_detail.json()["external_calendar_url"] is None

    # 4. Property host (user_id=2): external_calendar_url is visible
    host_detail = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert host_detail.status_code == 200
    assert host_detail.json()["external_calendar_url"] == secret_feed

    # 5. Admin: external_calendar_url is visible
    admin_detail = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_detail.status_code == 200
    assert admin_detail.json()["external_calendar_url"] == secret_feed


@pytest.mark.asyncio
async def test_batch_pricing_exceptions_with_min_nights(
    client: AsyncClient,
    admin_token: str,
):
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه تست حداقل اقامت دسته‌ای-{uuid.uuid4().hex[:6]}",
            "address": "مازندران، کلاردشت",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 800000,
            "min_nights": 1,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    acc_id = acc_res.json()["id"]

    start = (date.today() + timedelta(days=70)).isoformat()
    end = (date.today() + timedelta(days=73)).isoformat()

    batch_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/pricing-exceptions/batch",
        json={
            "start_date": start,
            "end_date": end,
            "price": 1500000,
            "is_blocked": False,
            "min_nights": 4,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert batch_res.status_code == 200
    assert batch_res.json()["updated_count"] == 4

    # Verify calendar reflects updated min_nights
    cal_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar?start_date={start}&days=4"
    )
    assert cal_res.status_code == 200
    days = cal_res.json()
    assert len(days) == 4
    for d in days:
        assert d["min_nights"] == 4
        assert Decimal(str(d["price"])) == 1500000
