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

    # R1: an admin may only assign a listing to a host/admin — promote the
    # seed guest (user 2) to host first; this test treats them as the host.
    promote_res = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert promote_res.status_code == 200

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

    # 4. Host-defined custom policy: window and penalty round-trip
    custom_res = await client.put(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        json={
            "cancellation_policy": "custom",
            "cancellation_free_hours": 48,
            "cancellation_penalty_percent": 25,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert custom_res.status_code == 200
    custom_data = custom_res.json()
    assert custom_data["cancellation_policy"] == "custom"
    assert custom_data["cancellation_free_hours"] == 48
    assert float(custom_data["cancellation_penalty_percent"]) == 25.0

    # 5. Out-of-range penalty and unknown policy are rejected
    bad_percent = await client.put(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        json={"cancellation_penalty_percent": 101},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert bad_percent.status_code == 422

    bad_policy = await client.put(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        json={"cancellation_policy": "anything"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert bad_policy.status_code == 422


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
async def test_filter_accommodations_by_rooms_and_beds(
    client: AsyncClient, admin_token: str
):
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    uid = uuid.uuid4().hex[:6]
    acc1_payload = {
        "category_id": category_id,
        "city_id": city_id,
        "title": f"Rooms Test Acc 1 {uid}",
        "address": "مازندران، رامسر، بلوار کازینو",
        "base_price": 2000000,
        "rooms_count": 2,
        "beds_count": 3,
        "min_nights": 1,
    }
    acc2_payload = {
        "category_id": category_id,
        "city_id": city_id,
        "title": f"Rooms Test Acc 2 {uid}",
        "address": "مازندران، تنکابن، خیابان دریا",
        "base_price": 3000000,
        "rooms_count": 4,
        "beds_count": 6,
        "min_nights": 2,
    }
    r1 = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=acc1_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r1.status_code == 201
    id1 = r1.json()["id"]

    r2 = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=acc2_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 201
    id2 = r2.json()["id"]

    # Filter with min_rooms=3 -> only acc2
    res_rooms = await client.get(f"{settings.API_V1_STR}/accommodations/?min_rooms=3")
    assert res_rooms.status_code == 200
    ids_rooms = [a["id"] for a in res_rooms.json()]
    assert id2 in ids_rooms
    assert id1 not in ids_rooms
    for a in res_rooms.json():
        assert a["rooms_count"] >= 3

    # Filter with min_beds=5 -> only acc2
    res_beds = await client.get(f"{settings.API_V1_STR}/accommodations/?min_beds=5")
    assert res_beds.status_code == 200
    ids_beds = [a["id"] for a in res_beds.json()]
    assert id2 in ids_beds
    assert id1 not in ids_beds
    for a in res_beds.json():
        assert a["beds_count"] >= 5

    # Filter with min_rooms=2 and min_beds=3 -> both acc1 and acc2
    res_both = await client.get(f"{settings.API_V1_STR}/accommodations/?min_rooms=2&min_beds=3")
    assert res_both.status_code == 200
    ids_both = [a["id"] for a in res_both.json()]
    assert id1 in ids_both
    assert id2 in ids_both
    for a in res_both.json():
        assert a["rooms_count"] >= 2 and a["beds_count"] >= 3


@pytest.mark.asyncio
async def test_filter_accommodations_by_stay_dates_enforces_min_nights(
    client: AsyncClient, admin_token: str
):
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    uid = uuid.uuid4().hex[:6]
    # Acc 1: min_nights = 1
    acc1_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "title": f"Stay Filter 1 Night {uid}",
            "address": "گیلان، فومن",
            "base_price": 1000000,
            "min_nights": 1,
            "is_active": True,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    id1 = acc1_res.json()["id"]

    # Acc 2: min_nights = 3
    acc2_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "title": f"Stay Filter 3 Nights {uid}",
            "address": "گیلان، ماسال",
            "base_price": 2000000,
            "min_nights": 3,
            "is_active": True,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    id2 = acc2_res.json()["id"]

    ci_1 = (date.today() + timedelta(days=60)).isoformat()
    co_1 = (date.today() + timedelta(days=61)).isoformat()  # 1 night
    co_3 = (date.today() + timedelta(days=63)).isoformat()  # 3 nights

    # Search for 1 night -> Acc 1 is returned, Acc 2 is filtered out
    search_1n = await client.get(
        f"{settings.API_V1_STR}/accommodations/?check_in={ci_1}&check_out={co_1}"
    )
    assert search_1n.status_code == 200
    search_1n_ids = [a["id"] for a in search_1n.json()]
    assert id1 in search_1n_ids
    assert id2 not in search_1n_ids

    # Search for 3 nights -> both Acc 1 and Acc 2 are returned
    search_3n = await client.get(
        f"{settings.API_V1_STR}/accommodations/?check_in={ci_1}&check_out={co_3}"
    )
    assert search_3n.status_code == 200
    search_3n_ids = [a["id"] for a in search_3n.json()]
    assert id1 in search_3n_ids
    assert id2 in search_3n_ids



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


@pytest.mark.asyncio
async def test_inactive_accommodation_hidden_from_public_detail_and_calendar(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    # R1: an admin may only assign a listing to a host/admin — promote the
    # seed guest (user 2) to host first; this test treats them as the host.
    promote_res = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert promote_res.status_code == 200
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "host_id": 2,
            "title": f"اقامتگاه غیرفعال تست {uuid.uuid4().hex[:6]}",
            "address": "آدرس غیرفعال",
            "base_price": 1000000,
            "capacity": 2,
            "max_capacity": 4,
            "is_active": False,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    acc_id = create_res.json()["id"]

    # Unauthenticated caller -> 404
    anon_detail = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    assert anon_detail.status_code == 404
    assert anon_detail.json()["detail"] == "Accommodation not found or is currently inactive"

    anon_calendar = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar")
    assert anon_calendar.status_code == 404
    assert anon_calendar.json()["detail"] == "Accommodation not found or is currently inactive"

    anon_ical = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics")
    assert anon_ical.status_code == 404
    assert anon_ical.json()["detail"] == "Accommodation not found or is currently inactive"

    # Host caller -> 200
    host_detail = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert host_detail.status_code == 200
    assert host_detail.json()["is_active"] is False

    host_calendar = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert host_calendar.status_code == 200

    host_ical = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert host_ical.status_code == 200

    # Admin caller -> 200
    admin_detail = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_detail.status_code == 200

    admin_calendar = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_calendar.status_code == 200


@pytest.mark.asyncio
async def test_ical_export_requires_auth_or_valid_feed_token(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    # R1: an admin may only assign a listing to a host/admin — promote the
    # seed guest (user 2) to host first; this test treats them as the host.
    promote_res = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert promote_res.status_code == 200
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "host_id": 2,
            "title": f"اقامتگاه تست تقویم آی‌کل {uuid.uuid4().hex[:6]}",
            "address": "آدرس تقویم آی‌کل",
            "base_price": 1000000,
            "capacity": 2,
            "max_capacity": 4,
            "is_active": True,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    acc_id = create_res.json()["id"]

    booker_reg = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": f"0912{uuid.uuid4().int % 10000000:07d}",
            "password": "guestPassword123",
        },
    )
    assert booker_reg.status_code == 201
    booker_token = booker_reg.json()["access_token"]

    res_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=10)).isoformat(),
            "check_out": (date.today() + timedelta(days=12)).isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {booker_token}"},
    )
    assert res_res.status_code == 201
    res_id = res_res.json()["id"]

    checkout_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {booker_token}"},
    )
    await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": checkout_res.json()["payment_id"],
            "tracking_code": checkout_res.json()["tracking_code"],
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {booker_token}"},
    )

    # 1. Unauthenticated request without token returns 404
    unauth_res = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics")
    assert unauth_res.status_code == 404
    assert "Accommodation not found" in unauth_res.json()["detail"]

    # 2. Invalid token returns 404
    invalid_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics?token=badtoken"
    )
    assert invalid_res.status_code == 404

    # 3. Host detail exposes calendar_ics_token
    host_detail = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    feed_token = host_detail.json().get("calendar_ics_token")
    assert feed_token is not None

    # Public detail should NOT expose calendar_ics_token
    public_detail = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    assert public_detail.json().get("calendar_ics_token") is None

    # 4. Valid token access returns 200 with masked UID and anonymized summary
    token_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics?token={feed_token}"
    )
    assert token_res.status_code == 200
    assert "UID:booking-" in token_res.text
    assert f"UID:res-{res_id}" not in token_res.text
    assert "SUMMARY:Reserved / Unavailable" in token_res.text
    assert f"Reservation #{res_id}" not in token_res.text

    # 5. Host auth access returns 200
    host_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert host_res.status_code == 200
    assert "UID:booking-" in host_res.text


@pytest.mark.asyncio
async def test_my_accommodations_pagination(client: AsyncClient, admin_token: str):
    uid = uuid.uuid4().hex[:8]
    reg = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": f"0912{uuid.uuid4().int % 10000000:07d}",
            "email": f"host_page_{uid}@example.com",
            "password": "Password123!",
            "first_name": "Host",
            "last_name": "PageUser",
        },
    )
    assert reg.status_code == 201
    host_token = reg.json()["access_token"]
    user_me = await client.get(
        f"{settings.API_V1_STR}/auth/me",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    host_id = user_me.json()["id"]

    # R1: an admin may only assign a listing to a host/admin — the freshly
    # registered user is a guest, so promote them to host first.
    promote_res = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert promote_res.status_code == 200

    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    created_ids = []
    for i in range(3):
        create_res = await client.post(
            f"{settings.API_V1_STR}/accommodations/",
            json={
                "category_id": category_id,
                "city_id": city_id,
                "host_id": host_id,
                "title": f"اقامتگاه صفحه‌بندی {uid}_{i}",
                "address": f"آدرس صفحه‌بندی {i}",
                "base_price": 1000000 + i * 100000,
                "capacity": 2,
                "max_capacity": 4,
                "is_active": True,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert create_res.status_code == 201
        created_ids.append(create_res.json()["id"])

    expected_order = list(reversed(created_ids))

    p1 = await client.get(
        f"{settings.API_V1_STR}/accommodations/my?skip=0&limit=2",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert p1.status_code == 200
    p1_items = p1.json()
    assert len(p1_items) == 2
    assert [a["id"] for a in p1_items] == expected_order[:2]

    p2 = await client.get(
        f"{settings.API_V1_STR}/accommodations/my?skip=2&limit=2",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert p2.status_code == 200
    p2_items = p2.json()
    assert len(p2_items) == 1
    assert [a["id"] for a in p2_items] == expected_order[2:]

    p_mid = await client.get(
        f"{settings.API_V1_STR}/accommodations/my?skip=1&limit=1",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert p_mid.status_code == 200
    assert [a["id"] for a in p_mid.json()] == [expected_order[1]]

    err_skip = await client.get(
        f"{settings.API_V1_STR}/accommodations/my?skip=-1",
        headers={"Authorization": f"Bearer {host_token}"},
    )
    assert err_skip.status_code == 422


@pytest.mark.asyncio
async def test_spatial_bounding_box_filtering(client: AsyncClient, admin_token: str):
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]
    uid = uuid.uuid4().hex[:6]

    in_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "title": f"اقامتگاه درون محدوده {uid}",
            "address": "خیابان ساحلی",
            "base_price": 1000000,
            "capacity": 2,
            "max_capacity": 4,
            "latitude": 36.9000,
            "longitude": 50.6000,
            "is_active": True,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert in_res.status_code == 201
    in_id = in_res.json()["id"]

    out_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "title": f"اقامتگاه خارج محدوده {uid}",
            "address": "خیابان آزادی",
            "base_price": 1000000,
            "capacity": 2,
            "max_capacity": 4,
            "latitude": 35.6892,
            "longitude": 51.3890,
            "is_active": True,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert out_res.status_code == 201
    out_id = out_res.json()["id"]

    search_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/?lat=36.9005&lng=50.6005&radius_km=10"
    )
    assert search_res.status_code == 200
    search_ids = [a["id"] for a in search_res.json()]
    assert in_id in search_ids
    assert out_id not in search_ids

    pole_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/?lat=89.9&lng=0.0&radius_km=50"
    )
    assert pole_res.status_code == 200


@pytest.mark.asyncio
async def test_inactive_accommodation_accessible_to_confirmed_guest_and_calculate_price_rejected(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    # R1: an admin may only assign a listing to a host/admin — promote the
    # seed guest (user 2) to host first. User 2 stays the host; a separate
    # registered guest does the booking, since hosts cannot book their own
    # listing.
    promote_res = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert promote_res.status_code == 200
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "host_id": 2,
            "title": f"اقامتگاه دسترسی مسافر {uuid.uuid4().hex[:6]}",
            "address": "آدرس تست مهمان",
            "base_price": 1000000,
            "capacity": 2,
            "max_capacity": 4,
            "is_active": True,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    acc_id = create_res.json()["id"]

    booker_reg = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": f"0912{uuid.uuid4().int % 10000000:07d}",
            "password": "guestPassword123",
        },
    )
    assert booker_reg.status_code == 201
    booker_token = booker_reg.json()["access_token"]

    # Guest books and pays
    ci = (date.today() + timedelta(days=25)).isoformat()
    co = (date.today() + timedelta(days=27)).isoformat()
    book_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": ci,
            "check_out": co,
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {booker_token}"},
    )
    assert book_res.status_code == 201
    res_id = book_res.json()["id"]

    checkout_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {booker_token}"},
    )
    assert checkout_res.status_code == 201
    await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": checkout_res.json()["payment_id"],
            "tracking_code": checkout_res.json()["tracking_code"],
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {booker_token}"},
    )

    # Host deactivates accommodation
    deactivate_res = await client.delete(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert deactivate_res.status_code == 204

    # Anonymous user -> 404
    anon_get = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    assert anon_get.status_code == 404

    # Other guest (not booked) -> 404
    other_reg = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": f"0912{uuid.uuid4().int % 10000000:07d}",
            "password": "Password123!",
        },
    )
    other_token = other_reg.json()["access_token"]
    other_get = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert other_get.status_code == 404

    # Confirmed booked guest -> 200
    booked_guest_get = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        headers={"Authorization": f"Bearer {booker_token}"},
    )
    assert booked_guest_get.status_code == 200
    assert booked_guest_get.json()["id"] == acc_id

    # calculate-price on inactive accommodation -> 404
    calc_res = await client.post(
        f"{settings.API_V1_STR}/reservations/calculate-price",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=40)).isoformat(),
            "check_out": (date.today() + timedelta(days=42)).isoformat(),
            "guests_count": 2,
        },
    )
    assert calc_res.status_code == 404
    assert "inactive" in calc_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_ical_export_blocked_dates_include_dtend(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    # R1: an admin may only assign a listing to a host/admin — promote the
    # seed guest (user 2) to host first; this test treats them as the host.
    promote_res = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert promote_res.status_code == 200
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "host_id": 2,
            "title": f"اقامتگاه تست DTEND {uuid.uuid4().hex[:6]}",
            "address": "آدرس تقویم",
            "base_price": 1000000,
            "capacity": 2,
            "max_capacity": 4,
            "is_active": True,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    acc_id = create_res.json()["id"]

    block_d = date.today() + timedelta(days=30)
    await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/pricing-exceptions",
        json={
            "date": block_d.isoformat(),
            "is_blocked": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )

    ical_res = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert ical_res.status_code == 200
    start_str = block_d.strftime("%Y%m%d")
    end_str = (block_d + timedelta(days=1)).strftime("%Y%m%d")
    assert f"DTSTART;VALUE=DATE:{start_str}" in ical_res.text
    assert f"DTEND;VALUE=DATE:{end_str}" in ical_res.text


@pytest.mark.asyncio
async def test_create_accommodation_cover_image_assignment(
    client: AsyncClient,
    admin_token: str,
):
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "title": f"اقامتگاه تست کاور {uuid.uuid4().hex[:6]}",
            "address": "آدرس کاور",
            "base_price": 1000000,
            "capacity": 2,
            "max_capacity": 4,
            "is_active": True,
            "images": [
                {"image_url": "https://example.com/img1.jpg", "is_cover": False, "sort_order": 0},
                {"image_url": "https://example.com/img2.jpg", "is_cover": True, "sort_order": 1},
            ],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    images = create_res.json()["images"]
    assert len(images) == 2
    assert images[0]["is_cover"] is False
    assert images[1]["is_cover"] is True


@pytest.mark.asyncio
async def test_set_accommodation_cover_image(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    me_res = await client.get(
        f"{settings.API_V1_STR}/auth/me",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert me_res.status_code == 200
    host_id = me_res.json()["id"]

    promote_res = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert promote_res.status_code == 200

    other_res = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": f"0913{uuid.uuid4().int % 10000000:07d}",
            "password": "guestPassword123",
            "first_name": "مهمان",
            "last_name": "دیگر",
        },
    )
    assert other_res.status_code == 201
    other_token = other_res.json()["access_token"]

    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "host_id": host_id,
            "title": f"اقامتگاه تست کاور تصویر {uuid.uuid4().hex[:6]}",
            "address": "آدرس کاور",
            "base_price": 1000000,
            "capacity": 2,
            "max_capacity": 4,
            "is_active": True,
            "images": [
                {"image_url": "https://example.com/cover1.jpg", "is_cover": True, "sort_order": 0},
                {"image_url": "https://example.com/cover2.jpg", "is_cover": False, "sort_order": 1},
            ],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    acc_id = create_res.json()["id"]
    first_image_id = create_res.json()["images"][0]["id"]
    second_image_id = create_res.json()["images"][1]["id"]

    cover_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images/{second_image_id}/cover",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert cover_res.status_code == 200
    assert cover_res.json()["is_cover"] is True

    detail_res = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    assert detail_res.status_code == 200
    assert [img["id"] for img in detail_res.json()["images"] if img["is_cover"]] == [
        second_image_id
    ]

    forbidden_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images/{first_image_id}/cover",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert forbidden_res.status_code == 403

    not_found_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images/999999/cover",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert not_found_res.status_code == 404
    assert not_found_res.json()["detail"] == "Accommodation image not found"





@pytest.mark.asyncio
async def test_accommodation_coordinates_out_of_range_rejected(
    client: AsyncClient,
    admin_token: str,
):
    payload = {
        "title": "Coordinate validation test",
        "address": "Coordinate validation address",
        "city_id": 1,
        "category_id": 1,
        "base_price": 500000,
        "capacity": 2,
        "max_capacity": 4,
    }
    headers = {"Authorization": f"Bearer {admin_token}"}

    bad_latitude = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={**payload, "latitude": 91},
        headers=headers,
    )
    assert bad_latitude.status_code == 422

    bad_longitude = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={**payload, "longitude": -181},
        headers=headers,
    )
    assert bad_longitude.status_code == 422

    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/", json=payload, headers=headers
    )
    assert create_res.status_code == 201

    update_res = await client.put(
        f"{settings.API_V1_STR}/accommodations/{create_res.json()['id']}",
        json={"latitude": -91},
        headers=headers,
    )
    assert update_res.status_code == 422


@pytest.mark.asyncio
async def test_custom_amenities_create_and_detail(client: AsyncClient, admin_token: str):
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "title": f"اقامتگاه با امکانات سفارشی {uuid.uuid4().hex[:6]}",
            "address": "تهران، خیابان امکانات",
            "base_price": 1200000,
            "capacity": 2,
            "max_capacity": 4,
            "custom_amenities": ["حیاط", "استخر"],
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["custom_amenities"] == ["حیاط", "استخر"]

    detail_res = await client.get(f"{settings.API_V1_STR}/accommodations/{created['id']}")
    assert detail_res.status_code == 200
    assert detail_res.json()["custom_amenities"] == ["حیاط", "استخر"]


@pytest.mark.asyncio
async def test_custom_amenities_update_replace_and_clear(client: AsyncClient, admin_token: str):
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "title": f"اقامتگاه ویرایش امکانات سفارشی {uuid.uuid4().hex[:6]}",
            "address": "تهران، خیابان ویرایش",
            "base_price": 1300000,
            "capacity": 2,
            "max_capacity": 4,
            "custom_amenities": ["حیاط"],
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    acc_id = create_res.json()["id"]

    replace_res = await client.put(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        json={"custom_amenities": ["پارکینگ", "آسانسور"]},
        headers=headers,
    )
    assert replace_res.status_code == 200
    assert replace_res.json()["custom_amenities"] == ["پارکینگ", "آسانسور"]

    # Omitting the field (and explicit null) leaves the list unchanged.
    unchanged_res = await client.put(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        json={"custom_amenities": None},
        headers=headers,
    )
    assert unchanged_res.status_code == 200
    assert unchanged_res.json()["custom_amenities"] == ["پارکینگ", "آسانسور"]

    clear_res = await client.put(
        f"{settings.API_V1_STR}/accommodations/{acc_id}",
        json={"custom_amenities": []},
        headers=headers,
    )
    assert clear_res.status_code == 200
    assert clear_res.json()["custom_amenities"] == []

    detail_res = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["custom_amenities"] == []


@pytest.mark.asyncio
async def test_custom_amenities_validation_and_normalization(
    client: AsyncClient, admin_token: str
):
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "category_id": category_id,
        "city_id": city_id,
        "title": f"اقامتگاه اعتبارسنجی امکانات {uuid.uuid4().hex[:6]}",
        "address": "تهران، خیابان اعتبارسنجی",
        "base_price": 1400000,
        "capacity": 2,
        "max_capacity": 4,
    }

    too_many = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={**payload, "custom_amenities": [f"امکان {i}" for i in range(16)]},
        headers=headers,
    )
    assert too_many.status_code == 422

    too_long = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={**payload, "custom_amenities": ["x" * 51]},
        headers=headers,
    )
    assert too_long.status_code == 422

    normalized = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            **payload,
            "custom_amenities": [" حیاط ", "حیاط", "Pool", "pool", ""],
        },
        headers=headers,
    )
    assert normalized.status_code == 201
    assert normalized.json()["custom_amenities"] == ["حیاط", "Pool"]
