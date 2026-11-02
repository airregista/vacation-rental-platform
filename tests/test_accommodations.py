import uuid
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


@pytest.mark.asyncio
async def test_host_scoping_accommodation_permissions(
    client: AsyncClient, admin_token: str, guest_token: str
):
    # 1. Get guest user info
    me_res = await client.get(
        f"{settings.API_V1_STR}/auth/me",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert me_res.status_code == 200
    guest_user_id = me_res.json()["id"]

    # 2. Register a second guest user
    random_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    guest2_res = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": random_phone,
            "password": "guestPassword123",
            "first_name": "مهمان",
            "last_name": "دوم",
        },
    )
    assert guest2_res.status_code == 201
    guest2_token = guest2_res.json()["access_token"]

    # 3. Admin creates accommodation with host_id = guest_user_id
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    acc_payload = {
        "category_id": category_id,
        "city_id": city_id,
        "host_id": guest_user_id,
        "title": "اقامتگاه اختصاصی هاست",
        "description": "توضیحات تست هاست",
        "address": "تهران، خیابان ولیعصر",
        "base_price": 2500000,
        "cleaning_fee": 100000,
        "capacity": 2,
        "max_capacity": 4,
        "extra_guest_fee": 150000,
        "rooms_count": 1,
        "beds_count": 1,
        "rules": "قوانین تست",
        "is_active": True,
        "images": [],
    }

    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=acc_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    acc_id = create_res.json()["id"]
    assert create_res.json()["host"]["id"] == guest_user_id

    # 4. Host (guest_user) CAN update their accommodation
    update_res = await client.put(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        json={"title": "عنوان ویرایش شده توسط میزبان"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "عنوان ویرایش شده توسط میزبان"

    # 5. Another guest CANNOT update it (403 Forbidden)
    forbidden_res = await client.put(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        json={"title": "ویرایش غیرمجاز توسط مهمان دیگر"},
        headers={"Authorization": f"Bearer {guest2_token}"},
    )
    assert forbidden_res.status_code == 403

    # 6. Admin user CAN update it even though they are not the host
    admin_update_res = await client.put(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        json={"title": "عنوان ویرایش شده توسط ادمین"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_update_res.status_code == 200
    assert admin_update_res.json()["title"] == "عنوان ویرایش شده توسط ادمین"

    # 7. Another guest CANNOT delete it (403 Forbidden)
    del_forbidden = await client.delete(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        headers={"Authorization": f"Bearer {guest2_token}"},
    )
    assert del_forbidden.status_code == 403

    # 8. Host CAN delete their accommodation (204 No Content)
    del_res = await client.delete(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert del_res.status_code == 204
