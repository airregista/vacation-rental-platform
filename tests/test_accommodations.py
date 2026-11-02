from datetime import date, timedelta
from decimal import Decimal
import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_list_accommodations(client: AsyncClient):
    res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    item = data[0]
    assert "title" in item
    assert "base_price" in item
    assert "cover_image" in item


@pytest.mark.asyncio
async def test_filter_accommodations_by_guests_and_price(client: AsyncClient):
    res = await client.get(f"{settings.API_V1_STR}/accommodations/?guests_count=5")
    assert res.status_code == 200
    data = res.json()
    for acc in data:
        assert acc["max_capacity"] >= 5


@pytest.mark.asyncio
async def test_admin_create_accommodation_permission(
    client: AsyncClient, admin_token: str, guest_token: str
):
    # Fetch city and category
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    new_acc_payload = {
        "category_id": category_id,
        "city_id": city_id,
        "title": "کلبه جنگلی تست برای تست سیستم",
        "description": "توضیحات مربوط به کلبه تست",
        "address": "مازندران، چالوس، خیابان ساحلی",
        "base_price": 1800000,
        "cleaning_fee": 150000,
        "capacity": 3,
        "max_capacity": 5,
        "extra_guest_fee": 200000,
        "rooms_count": 1,
        "beds_count": 2,
        "rules": "قوانین تست",
        "is_active": True,
        "images": [
            {"image_url": "https://example.com/test1.jpg", "is_cover": True, "sort_order": 1}
        ],
    }

    # 1. Guest user cannot create accommodation (403 Forbidden)
    guest_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=new_acc_payload,
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert guest_res.status_code == 403

    # 2. Admin can create accommodation (201 Created)
    admin_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=new_acc_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_res.status_code == 201
    created_acc = admin_res.json()
    assert created_acc["title"] == new_acc_payload["title"]
    assert len(created_acc["images"]) == 1


@pytest.mark.asyncio
async def test_accommodation_calendar(client: AsyncClient):
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]

    cal_res = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar?days=14")
    assert cal_res.status_code == 200
    cal_data = cal_res.json()
    assert len(cal_data) == 14
    assert "date" in cal_data[0]
    assert "price" in cal_data[0]
    assert "is_available" in cal_data[0]
