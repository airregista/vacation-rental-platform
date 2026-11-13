import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_public_accommodation_detail_hides_host_pii(client: AsyncClient, admin_token: str):
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": category_id,
            "city_id": city_id,
            "title": "اقامتگاه تست حریم خصوصی",
            "address": "تهران، خیابان تست",
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 1000000,
            "cleaning_fee": 50000,
            "cancellation_policy": "flexible",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201, create_res.text
    acc_id = create_res.json()["id"]

    # Public detail endpoint: no Authorization header.
    res = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    assert res.status_code == 200, res.text
    host = res.json()["host"]
    assert host is not None
    assert set(host) == {"id", "first_name", "last_name", "avatar_url", "created_at"}
    assert "phone" not in host
    assert "email" not in host
    assert "shaba_number" not in host
    assert "role" not in host

    # The owner still gets the full record from /auth/me.
    me_res = await client.get(
        f"{settings.API_V1_STR}/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert me_res.status_code == 200, me_res.text
    assert "phone" in me_res.json()
    assert "email" in me_res.json()
