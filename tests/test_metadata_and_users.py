import uuid

import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_users_endpoints_and_rbac(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    # Admin can list users
    res = await client.get(
        f"{settings.API_V1_STR}/users/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # Guest is forbidden from listing users
    res = await client.get(
        f"{settings.API_V1_STR}/users/",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_get_user_by_id_and_permissions(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    # Fetch user IDs via /auth/me
    guest_me = await client.get(
        f"{settings.API_V1_STR}/auth/me",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert guest_me.status_code == 200
    guest_user_id = guest_me.json()["id"]

    admin_me = await client.get(
        f"{settings.API_V1_STR}/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_me.status_code == 200
    admin_user_id = admin_me.json()["id"]

    # 1. Admin queries GET /users/{guest_user_id} and receives HTTP 200 with User response
    res_admin_query = await client.get(
        f"{settings.API_V1_STR}/users/{guest_user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin_query.status_code == 200
    guest_data = res_admin_query.json()
    assert guest_data["id"] == guest_user_id
    assert guest_data["role"] == "guest"

    # 2. Guest queries GET /users/{admin_user_id} and receives HTTP 403 Forbidden
    res_guest_query = await client.get(
        f"{settings.API_V1_STR}/users/{admin_user_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_guest_query.status_code == 403

    # 3. Admin queries GET /users/999999 and receives HTTP 404 Not Found
    res_not_found = await client.get(
        f"{settings.API_V1_STR}/users/999999",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_not_found.status_code == 404


@pytest.mark.asyncio
async def test_geo_provinces_and_cities(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    # Public read
    res = await client.get(f"{settings.API_V1_STR}/geo/provinces")
    assert res.status_code == 200

    # Admin creates province
    prov_name = f"استان تست-{uuid.uuid4().hex[:6]}"
    res_prov = await client.post(
        f"{settings.API_V1_STR}/geo/provinces",
        json={"name": prov_name, "slug": f"prov-{uuid.uuid4().hex[:6]}"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_prov.status_code == 201
    prov_id = res_prov.json()["id"]

    # Admin creates city in province
    city_name = f"شهر تست-{uuid.uuid4().hex[:6]}"
    res_city = await client.post(
        f"{settings.API_V1_STR}/geo/cities",
        json={"province_id": prov_id, "name": city_name, "slug": f"city-{uuid.uuid4().hex[:6]}"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_city.status_code == 201

    # Guest forbidden from creating province
    res_forbidden = await client.post(
        f"{settings.API_V1_STR}/geo/provinces",
        json={"name": "غیرمجاز", "slug": "forbidden"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_forbidden.status_code == 403


@pytest.mark.asyncio
async def test_categories_and_amenities(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    # Public reads
    cat_list = await client.get(f"{settings.API_V1_STR}/categories/")
    assert cat_list.status_code == 200

    amenity_list = await client.get(f"{settings.API_V1_STR}/amenities/")
    assert amenity_list.status_code == 200

    # Admin creates category
    cat_slug = f"cat-{uuid.uuid4().hex[:6]}"
    res_cat = await client.post(
        f"{settings.API_V1_STR}/categories/",
        json={"title": f"دسته {cat_slug}", "slug": cat_slug, "icon": "home"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_cat.status_code == 201

    # Admin creates amenity
    res_am = await client.post(
        f"{settings.API_V1_STR}/amenities/",
        json={"name": f"امکان {cat_slug}", "icon": "wifi"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_am.status_code == 201

    # Guest forbidden
    res_guest = await client.post(
        f"{settings.API_V1_STR}/categories/",
        json={"title": "دسته غیرمجاز", "slug": "guest-cat"},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_guest.status_code == 403
