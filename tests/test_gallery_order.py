import pytest
from httpx import AsyncClient

from app.core.config import settings


async def _create_listing(client: AsyncClient, admin_token: str, images: list[dict]) -> dict:
    cities = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories = await client.get(f"{settings.API_V1_STR}/categories/")
    payload = {
        "category_id": categories.json()[0]["id"],
        "city_id": cities.json()[0]["id"],
        "title": "گالری تست ترتیب تصاویر",
        "address": "تهران، تست گالری، پلاک ۱",
        "base_price": 1000000,
        "capacity": 2,
        "max_capacity": 3,
        "images": images,
    }
    created = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert created.status_code == 201, created.text
    return created.json()


@pytest.mark.asyncio
async def test_gallery_order_and_reorder(client: AsyncClient, admin_token: str):
    created = await _create_listing(
        client,
        admin_token,
        [
            {"image_url": "https://example.com/g2.jpg", "is_cover": True, "sort_order": 2},
            {"image_url": "https://example.com/g0.jpg", "is_cover": False, "sort_order": 0},
            {"image_url": "https://example.com/g1.jpg", "is_cover": False, "sort_order": 1},
        ],
    )
    acc_id = created["id"]
    images = created["images"]
    assert [img["image_url"] for img in images] == [
        "https://example.com/g0.jpg",
        "https://example.com/g1.jpg",
        "https://example.com/g2.jpg",
    ]
    assert [img["is_cover"] for img in images] == [False, False, True]
    image_ids = [img["id"] for img in images]

    detail = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    assert detail.status_code == 200
    assert [img["image_url"] for img in detail.json()["images"]] == [
        "https://example.com/g0.jpg",
        "https://example.com/g1.jpg",
        "https://example.com/g2.jpg",
    ]

    # Reorder: reverse the current order.
    reversed_ids = list(reversed(image_ids))
    reordered = await client.put(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images/order",
        json={"image_ids": reversed_ids},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reordered.status_code == 200, reordered.text
    assert [img["id"] for img in reordered.json()] == reversed_ids
    assert [img["sort_order"] for img in reordered.json()] == [0, 1, 2]

    detail = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    assert [img["id"] for img in detail.json()["images"]] == reversed_ids
    assert [img["sort_order"] for img in detail.json()["images"]] == [0, 1, 2]

    # Invalid reorder payloads are rejected with 400.
    headers = {"Authorization": f"Bearer {admin_token}"}
    order_url = f"{settings.API_V1_STR}/accommodations/{acc_id}/images/order"
    for bad_ids in (
        image_ids[:2],  # missing ID
        [image_ids[0], image_ids[0], image_ids[1]],  # duplicate ID
        [999999, *image_ids[1:]],  # foreign ID
    ):
        bad = await client.put(order_url, json={"image_ids": bad_ids}, headers=headers)
        assert bad.status_code == 400, bad.text


@pytest.mark.asyncio
async def test_cover_promotion_and_delete_fallback(client: AsyncClient, admin_token: str):
    created = await _create_listing(
        client,
        admin_token,
        [
            {"image_url": "https://example.com/c1.jpg", "is_cover": True, "sort_order": 0},
            {"image_url": "https://example.com/c2.jpg", "is_cover": False, "sort_order": 1},
        ],
    )
    acc_id = created["id"]
    images = created["images"]
    first_id = images[0]["id"]
    second_id = images[1]["id"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Promote the second image to cover.
    cover = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images/{second_id}/cover",
        headers=headers,
    )
    assert cover.status_code == 200, cover.text
    assert cover.json()["id"] == second_id
    assert cover.json()["is_cover"] is True

    detail = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    covers = [img for img in detail.json()["images"] if img["is_cover"]]
    assert len(covers) == 1
    assert covers[0]["id"] == second_id

    # Deleting the cover promotes the remaining image.
    deleted = await client.delete(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images/{second_id}",
        headers=headers,
    )
    assert deleted.status_code == 204

    detail = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    remaining = detail.json()["images"]
    assert len(remaining) == 1
    covers = [img for img in remaining if img["is_cover"]]
    assert len(covers) == 1
    assert covers[0]["id"] == first_id


@pytest.mark.asyncio
async def test_create_normalizes_duplicate_covers(client: AsyncClient, admin_token: str):
    created = await _create_listing(
        client,
        admin_token,
        [
            {"image_url": "https://example.com/n1.jpg", "is_cover": True, "sort_order": 0},
            {"image_url": "https://example.com/n2.jpg", "is_cover": True, "sort_order": 1},
        ],
    )
    acc_id = created["id"]
    images = created["images"]
    covers = [img for img in images if img["is_cover"]]
    assert len(covers) == 1
    assert covers[0]["image_url"] == "https://example.com/n1.jpg"

    detail = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    covers = [img for img in detail.json()["images"] if img["is_cover"]]
    assert len(covers) == 1
    assert covers[0]["image_url"] == "https://example.com/n1.jpg"

    # Reorder still includes every image.
    all_ids = [img["id"] for img in detail.json()["images"]]
    reordered = await client.put(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images/order",
        json={"image_ids": list(reversed(all_ids))},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reordered.status_code == 200, reordered.text
    assert [img["id"] for img in reordered.json()] == list(reversed(all_ids))


@pytest.mark.asyncio
async def test_first_added_image_becomes_cover(client: AsyncClient, admin_token: str):
    created = await _create_listing(client, admin_token, [])
    acc_id = created["id"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    first = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images",
        json={"image_url": "https://example.com/add1.jpg", "sort_order": 5},
        headers=headers,
    )
    assert first.status_code == 201, first.text
    assert first.json()["is_cover"] is True

    second = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/images",
        json={"image_url": "https://example.com/add2.jpg", "sort_order": 6},
        headers=headers,
    )
    assert second.status_code == 201, second.text
    assert second.json()["is_cover"] is False

    detail = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}")
    covers = [img for img in detail.json()["images"] if img["is_cover"]]
    assert len(covers) == 1
    assert covers[0]["image_url"] == "https://example.com/add1.jpg"
