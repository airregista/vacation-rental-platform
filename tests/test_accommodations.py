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


@pytest.mark.asyncio
async def test_invalid_host_id_returns_400(client: AsyncClient, admin_token: str):
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    acc_payload = {
        "category_id": category_id,
        "city_id": city_id,
        "host_id": 999999,  # Non-existent host ID
        "title": "اقامتگاه با هاست نامعتبر",
        "address": "تهران، خیابان تست",
        "base_price": 2000000,
        "capacity": 2,
        "max_capacity": 4,
    }

    res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=acc_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400
    assert "Host user with ID 999999 not found" in res.json()["detail"]


@pytest.mark.asyncio
async def test_cancellation_policy_crud_on_accommodation(client: AsyncClient, admin_token: str):
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    # 1. Create with strict policy
    acc_payload = {
        "category_id": category_id,
        "city_id": city_id,
        "title": "اقامتگاه با کنسلی سخت‌گیرانه",
        "address": "تهران، خیابان نیاوران",
        "base_price": 3000000,
        "capacity": 2,
        "max_capacity": 4,
        "cancellation_policy": "strict",
    }

    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=acc_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    created_data = create_res.json()
    acc_id = created_data["id"]
    assert created_data["cancellation_policy"] == "strict"

    # 2. Get detail
    get_res = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    assert get_res.status_code == 200
    assert get_res.json()["cancellation_policy"] == "strict"

    # 3. Update to moderate policy
    update_res = await client.put(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        json={"cancellation_policy": "moderate"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["cancellation_policy"] == "moderate"


@pytest.mark.asyncio
async def test_unpaired_date_search_rejected(client: AsyncClient):
    res = await client.get(
        f"{settings.API_V1_STR}/accommodations/?check_in={date.today().isoformat()}"
    )
    assert res.status_code == 400
    assert "both check_in and check_out" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_pricing_exception_deletion_and_amenity_updates(
    client: AsyncClient,
    admin_token: str,
):
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]
    test_date = (date.today() + timedelta(days=25)).isoformat()

    # 1. Create a pricing exception
    ex_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/pricing-exceptions",
        json={"date": test_date, "price": 880000, "is_blocked": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert ex_res.status_code == 200

    # 2. Delete the pricing exception
    del_res = await client.delete(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/pricing-exceptions/{test_date}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert del_res.status_code == 204

    # 3. Deleting non-existent exception returns 404
    dup_del = await client.delete(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/pricing-exceptions/{test_date}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert dup_del.status_code == 404

    # 4. Update accommodation amenities (passing duplicate IDs should be deduplicated safely)
    am_res = await client.get(f"{settings.API_V1_STR}/amenities/")
    am_id = am_res.json()[0]["id"]
    update_res = await client.put(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        json={"amenity_ids": [am_id, am_id]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert update_res.status_code == 200
    updated_amenity_ids = [a["id"] for a in update_res.json()["amenities"]]
    assert am_id in updated_amenity_ids


@pytest.mark.asyncio
async def test_filter_by_amenities_and_sorting(client: AsyncClient):
    # 1. Fetch available amenities
    amenities_res = await client.get(f"{settings.API_V1_STR}/amenities/")
    assert amenities_res.status_code == 200
    amenities = amenities_res.json()
    assert len(amenities) >= 2

    # Seed accommodation 1 has amenities: چشم‌انداز ابدی جنگل و کوه, باربیکیو و منقل هیزمی, وای‌فای پرسرعت رایگان, پارکینگ اختصاصی سرپوشیده
    amenity_ids = [amenities[0]["id"], amenities[1]["id"]]
    query_str = f"amenity_ids={amenity_ids[0]}&amenity_ids={amenity_ids[1]}"

    filtered_res = await client.get(f"{settings.API_V1_STR}/accommodations/?{query_str}")
    assert filtered_res.status_code == 200
    filtered_items = filtered_res.json()
    assert isinstance(filtered_items, list)
    assert len(filtered_items) >= 1

    # Verify each returned accommodation has both amenities by querying detail
    for item in filtered_items:
        detail_res = await client.get(f"{settings.API_V1_STR}/accommodations/{item['id']}")
        assert detail_res.status_code == 200
        prop_amenity_ids = {a["id"] for a in detail_res.json()["amenities"]}
        assert set(amenity_ids).issubset(prop_amenity_ids)

    # 2. Verify sorting by price ascending
    asc_res = await client.get(f"{settings.API_V1_STR}/accommodations/?sort_by=price_asc")
    assert asc_res.status_code == 200
    asc_prices = [Decimal(str(item["base_price"])) for item in asc_res.json()]
    assert asc_prices == sorted(asc_prices)

    # 3. Verify sorting by price descending
    desc_res = await client.get(f"{settings.API_V1_STR}/accommodations/?sort_by=price_desc")
    assert desc_res.status_code == 200
    desc_prices = [Decimal(str(item["base_price"])) for item in desc_res.json()]
    assert desc_prices == sorted(desc_prices, reverse=True)


@pytest.mark.asyncio
async def test_amenity_filter_duplicate_query_params(client: AsyncClient):
    amenities_res = await client.get(f"{settings.API_V1_STR}/amenities/")
    assert amenities_res.status_code == 200
    amenities = amenities_res.json()
    assert len(amenities) >= 1
    am_id = amenities[0]["id"]

    single_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/?amenity_ids={am_id}"
    )
    assert single_res.status_code == 200
    single_items = single_res.json()
    assert len(single_items) >= 1

    dup_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/?amenity_ids={am_id}&amenity_ids={am_id}"
    )
    assert dup_res.status_code == 200
    dup_items = dup_res.json()
    assert [a["id"] for a in dup_items] == [a["id"] for a in single_items]


@pytest.mark.asyncio
async def test_delete_nonexistent_image_returns_404(
    client: AsyncClient,
    admin_token: str,
):
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    assert acc_res.status_code == 200
    acc_id = acc_res.json()[0]["id"]

    del_res = await client.delete(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images/999999",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert del_res.status_code == 404
    assert del_res.json()["detail"] == "Accommodation image not found"


@pytest.mark.asyncio
async def test_pagination_deterministic_ordering_with_duplicate_prices(
    client: AsyncClient,
    admin_token: str,
):
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    target_price = 7654321
    for _ in range(4):
        create_res = await client.post(
            f"{settings.API_V1_STR}/accommodations/",
            json={
                "category_id": category_id,
                "city_id": city_id,
                "title": f"اقامتگاه مرتب‌سازی {uuid.uuid4().hex[:6]}",
                "description": "توضیحات تست",
                "address": "آدرس تست",
                "base_price": target_price,
                "cleaning_fee": 100000,
                "capacity": 2,
                "max_capacity": 4,
                "extra_guest_fee": 50000,
                "rooms_count": 1,
                "beds_count": 1,
                "rules": "قوانین",
                "is_active": True,
                "images": [],
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert create_res.status_code == 201

    p1_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/?min_price={target_price}&max_price={target_price}&sort_by=price_asc&skip=0&limit=2"
    )
    assert p1_res.status_code == 200
    p1_items = p1_res.json()
    assert len(p1_items) == 2

    p2_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/?min_price={target_price}&max_price={target_price}&sort_by=price_asc&skip=2&limit=2"
    )
    assert p2_res.status_code == 200
    p2_items = p2_res.json()
    assert len(p2_items) == 2

    p1_ids = [item["id"] for item in p1_items]
    p2_ids = [item["id"] for item in p2_items]

    assert set(p1_ids).isdisjoint(set(p2_ids))
    all_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/?min_price={target_price}&max_price={target_price}&sort_by=price_asc&skip=0&limit=4"
    )
    assert all_res.status_code == 200
    all_ids = [item["id"] for item in all_res.json()]
    assert p1_ids + p2_ids == all_ids
    assert p1_ids[0] > p1_ids[1] > p2_ids[0] > p2_ids[1]

