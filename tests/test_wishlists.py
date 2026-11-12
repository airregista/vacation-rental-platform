import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_wishlist_preserves_listing_fields(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "Wishlist min nights and policy",
            "address": "Wishlist test address",
            "city_id": 1,
            "category_id": 1,
            "base_price": 500000,
            "capacity": 2,
            "max_capacity": 4,
            "min_nights": 3,
            "cancellation_policy": "strict",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201
    acc_id = create_res.json()["id"]

    toggle_res = await client.post(
        f"{settings.API_V1_STR}/wishlists/{acc_id}/toggle",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert toggle_res.status_code == 200

    list_res = await client.get(
        f"{settings.API_V1_STR}/wishlists/",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert list_res.status_code == 200
    matched = next(item for item in list_res.json() if item["accommodation_id"] == acc_id)
    assert matched["accommodation"]["min_nights"] == 3
    assert matched["accommodation"]["cancellation_policy"] == "strict"
