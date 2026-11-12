import asyncio
import uuid
from datetime import date, datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.reservation import Reservation


@pytest.mark.asyncio
async def test_create_and_read_reviews(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "کلبه چوبی جنگلی بازخورد",
            "address": "مازندران، جاده چالوس",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 500000,
            "extra_person_fee": 100000,
            "cleaning_fee": 50000,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    res_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=40)).isoformat(),
            "check_out": (date.today() + timedelta(days=42)).isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_res.status_code == 201
    res_id = res_res.json()["id"]

    checkout_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert checkout_res.status_code in (200, 201)
    payment_id = checkout_res.json()["payment_id"]
    tracking_code = checkout_res.json()["tracking_code"]

    verify_res = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": payment_id,
            "tracking_code": tracking_code,
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert verify_res.status_code == 200

    early_review = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res_id,
            "rating": 5,
            "cleanliness_rating": 5,
            "accuracy_rating": 5,
            "comment": "عالی بود قبل از سفر!",
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert early_review.status_code == 400
    assert "check-out" in early_review.json()["detail"].lower()

    async with AsyncSessionLocal() as session:
        db_res = await session.get(Reservation, res_id)
        assert db_res is not None
        db_res.check_in = date.today() - timedelta(days=3)
        db_res.check_out = date.today() - timedelta(days=1)
        await session.commit()

    valid_review = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res_id,
            "rating": 5,
            "cleanliness_rating": 4,
            "accuracy_rating": 5,
            "comment": "تجربه عالی و بسیار تمیز بود.",
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert valid_review.status_code == 201
    assert valid_review.json()["rating"] == 5

    dup_review = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res_id,
            "rating": 4,
            "comment": "تلاش مجدد برای ثبت نظر",
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert dup_review.status_code == 400


@pytest.mark.asyncio
async def test_wishlist_returns_real_rating(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "کلبه چوبی جنگلی بازخورد علاقه‌مندی",
            "address": "مازندران، جاده چالوس",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 500000,
            "extra_person_fee": 100000,
            "cleaning_fee": 50000,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    res_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=40)).isoformat(),
            "check_out": (date.today() + timedelta(days=42)).isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_res.status_code == 201
    res_id = res_res.json()["id"]

    checkout_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert checkout_res.status_code in (200, 201)
    payment_id = checkout_res.json()["payment_id"]
    tracking_code = checkout_res.json()["tracking_code"]

    verify_res = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": payment_id,
            "tracking_code": tracking_code,
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert verify_res.status_code == 200

    async with AsyncSessionLocal() as session:
        db_res = await session.get(Reservation, res_id)
        assert db_res is not None
        db_res.check_in = date.today() - timedelta(days=3)
        db_res.check_out = date.today() - timedelta(days=1)
        await session.commit()

    valid_review = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res_id,
            "rating": 5,
            "cleanliness_rating": 4,
            "accuracy_rating": 5,
            "comment": "تجربه عالی و بسیار تمیز بود.",
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert valid_review.status_code == 201
    assert valid_review.json()["rating"] == 5

    wl_add = await client.post(
        f"{settings.API_V1_STR}/wishlists/{acc_id}/toggle",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl_add.status_code == 200
    assert wl_add.json()["is_favorite"] is True

    wl_list = await client.get(
        f"{settings.API_V1_STR}/wishlists/",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl_list.status_code == 200
    matching = [item for item in wl_list.json() if item["accommodation_id"] == acc_id]
    assert len(matching) == 1
    assert matching[0]["accommodation"]["average_rating"] == 5.0
    assert matching[0]["accommodation"]["reviews_count"] == 1

    # Second guest, second reservation on the same accommodation, review
    # with rating 4: the average must be (5 + 4) / 2 = 4.5, count 2.
    guest2_res = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": "09122222222",
            "password": "guest123",
            "first_name": "مهمان",
            "last_name": "دوم",
        },
    )
    assert guest2_res.status_code == 201
    guest2_token = guest2_res.json()["access_token"]

    res2_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=44)).isoformat(),
            "check_out": (date.today() + timedelta(days=46)).isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest2_token}"},
    )
    assert res2_res.status_code == 201
    res2_id = res2_res.json()["id"]

    checkout2_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res2_id},
        headers={"Authorization": f"Bearer {guest2_token}"},
    )
    assert checkout2_res.status_code in (200, 201)
    payment2_id = checkout2_res.json()["payment_id"]
    tracking2_code = checkout2_res.json()["tracking_code"]

    verify2_res = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": payment2_id,
            "tracking_code": tracking2_code,
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest2_token}"},
    )
    assert verify2_res.status_code == 200

    async with AsyncSessionLocal() as session:
        db_res2 = await session.get(Reservation, res2_id)
        assert db_res2 is not None
        db_res2.check_in = date.today() - timedelta(days=6)
        db_res2.check_out = date.today() - timedelta(days=4)
        await session.commit()

    review2 = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res2_id,
            "rating": 4,
            "comment": "تجربه خوب بود.",
        },
        headers={"Authorization": f"Bearer {guest2_token}"},
    )
    assert review2.status_code == 201
    assert review2.json()["rating"] == 4

    wl_list = await client.get(
        f"{settings.API_V1_STR}/wishlists/",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl_list.status_code == 200
    matching = [item for item in wl_list.json() if item["accommodation_id"] == acc_id]
    assert len(matching) == 1
    assert matching[0]["accommodation"]["average_rating"] == 4.5
    assert matching[0]["accommodation"]["reviews_count"] == 2

    # Second accommodation with no reviews: average is None, count 0.
    acc2_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": "کلبه چوبی جنگلی بدون بازخورد",
            "address": "مازندران، جاده چالوس",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 500000,
            "extra_person_fee": 100000,
            "cleaning_fee": 50000,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc2_res.status_code == 201
    acc2_id = acc2_res.json()["id"]

    wl2_add = await client.post(
        f"{settings.API_V1_STR}/wishlists/{acc2_id}/toggle",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl2_add.status_code == 200
    assert wl2_add.json()["is_favorite"] is True

    wl_list = await client.get(
        f"{settings.API_V1_STR}/wishlists/",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl_list.status_code == 200
    matching2 = [item for item in wl_list.json() if item["accommodation_id"] == acc2_id]
    assert len(matching2) == 1
    assert matching2[0]["accommodation"]["average_rating"] is None
    assert matching2[0]["accommodation"]["reviews_count"] == 0


@pytest.mark.asyncio
async def test_wishlist_and_public_review_listing(
    client: AsyncClient,
    guest_token: str,
    admin_token: str,
):
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    accommodation = acc_res.json()[0]
    acc_id = accommodation["id"]

    # 1. Wishlist toggle: Add
    wl_add = await client.post(
        f"{settings.API_V1_STR}/wishlists/{acc_id}/toggle",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl_add.status_code == 200
    assert wl_add.json()["is_favorite"] is True

    # 2. Wishlist list: Verify presence
    wl_list = await client.get(
        f"{settings.API_V1_STR}/wishlists/",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl_list.status_code == 200
    assert any(item["accommodation_id"] == acc_id for item in wl_list.json())

    # 3. Wishlist toggle: Remove
    wl_rem = await client.post(
        f"{settings.API_V1_STR}/wishlists/{acc_id}/toggle",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert wl_rem.status_code == 200
    assert wl_rem.json()["is_favorite"] is False

    # 4. Public reviews listing
    rev_list = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews")
    assert rev_list.status_code == 200
    assert isinstance(rev_list.json(), list)


@pytest.mark.asyncio
async def test_wishlist_pagination(
    client: AsyncClient,
    guest_token: str,
):
    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    accs = acc_res.json()
    assert len(accs) >= 2
    id1 = accs[0]["id"]
    id2 = accs[1]["id"]

    # Toggle to add both
    await client.post(
        f"{settings.API_V1_STR}/wishlists/{id1}/toggle",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    await client.post(
        f"{settings.API_V1_STR}/wishlists/{id2}/toggle",
        headers={"Authorization": f"Bearer {guest_token}"},
    )

    # Test pagination parameters and deterministic ordering
    p1 = await client.get(
        f"{settings.API_V1_STR}/wishlists/?skip=0&limit=1",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert p1.status_code == 200
    assert len(p1.json()) == 1

    p2 = await client.get(
        f"{settings.API_V1_STR}/wishlists/?skip=1&limit=1",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert p2.status_code == 200
    assert len(p2.json()) == 1

    assert p1.json()[0]["accommodation"]["id"] != p2.json()[0]["accommodation"]["id"]


@pytest.mark.asyncio
async def test_review_before_checkout_time_rejected(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    # Tehran-anchored "today": the review endpoint compares against Tehran
    # now, so the test must use the Tehran date, not the process-local date
    # (which is yesterday in Tehran during 00:00-03:30 under a UTC process).
    today_tehran = datetime.now(ZoneInfo("Asia/Tehran")).date()
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه تست بررسی ساعت خروج {uuid.uuid4().hex[:6]}",
            "address": "مازندران، نوشهر",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 600000,
            "cleaning_fee": 50000,
            "check_out_time": "23:59:00",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    res_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (today_tehran + timedelta(days=40)).isoformat(),
            "check_out": (today_tehran + timedelta(days=42)).isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_res.status_code == 201
    res_id = res_res.json()["id"]

    checkout_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": checkout_res.json()["payment_id"],
            "tracking_code": checkout_res.json()["tracking_code"],
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )

    # Set check_out to today via direct DB manipulation
    async with AsyncSessionLocal() as session:
        db_res = await session.get(Reservation, res_id)
        assert db_res is not None
        db_res.check_in = today_tehran - timedelta(days=2)
        db_res.check_out = today_tehran
        await session.commit()

    review_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res_id,
            "rating": 5,
            "cleanliness_rating": 5,
            "accuracy_rating": 5,
            "comment": "قبل از ساعت خروج ثبت کردم",
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert review_res.status_code == 400
    assert "check-out time" in review_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_concurrent_wishlist_toggle_no_500(
    client: AsyncClient,
    guest_token: str,
):
    from sqlalchemy import delete
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.core.database import engine, get_db
    from app.main import app
    from app.models.wishlist import Wishlist

    acc_res = await client.get(f"{settings.API_V1_STR}/accommodations/")
    acc_id = acc_res.json()[0]["id"]

    original_override = app.dependency_overrides.get(get_db)
    pool_session_maker = async_sessionmaker(bind=engine, expire_on_commit=False)

    async def concurrent_get_db():
        async with pool_session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = concurrent_get_db
    try:
        # Clean up any existing wishlist item for this accommodation
        async with pool_session_maker() as session:
            await session.execute(delete(Wishlist).where(Wishlist.accommodation_id == acc_id))
            await session.commit()

        async def do_toggle():
            return await client.post(
                f"{settings.API_V1_STR}/wishlists/{acc_id}/toggle",
                headers={"Authorization": f"Bearer {guest_token}"},
            )

        responses = await asyncio.gather(*(do_toggle() for _ in range(2)))
        for r in responses:
            assert r.status_code == 200
    finally:
        async with pool_session_maker() as session:
            await session.execute(delete(Wishlist).where(Wishlist.accommodation_id == acc_id))
            await session.commit()
        if original_override is not None:
            app.dependency_overrides[get_db] = original_override
        else:
            app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_review_integrity_error_mapped_to_400(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه تست خطای تکراری نظر {uuid.uuid4().hex[:6]}",
            "address": "مازندران، نوشهر",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 500000,
            "check_out_time": "12:00:00",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    acc_id = acc_res.json()["id"]

    res_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (date.today() + timedelta(days=20)).isoformat(),
            "check_out": (date.today() + timedelta(days=22)).isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    res_id = res_res.json()["id"]

    checkout_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": checkout_res.json()["payment_id"],
            "tracking_code": checkout_res.json()["tracking_code"],
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )

    # Set check_out to past date
    async with AsyncSessionLocal() as session:
        db_res = await session.get(Reservation, res_id)
        assert db_res is not None
        db_res.check_in = date.today() - timedelta(days=5)
        db_res.check_out = date.today() - timedelta(days=3)
        await session.commit()

    with patch("sqlalchemy.ext.asyncio.AsyncSession.commit", side_effect=IntegrityError("statement", {}, Exception())):
        review_res = await client.post(
            f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
            json={
                "reservation_id": res_id,
                "rating": 5,
                "cleanliness_rating": 5,
                "accuracy_rating": 5,
                "comment": "تست همزمانی نظر",
            },
            headers={"Authorization": f"Bearer {guest_token}"},
        )
        assert review_res.status_code == 400
        assert "already been submitted" in review_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_review_eligibility_no_stay(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه تست واجد شرایط بدون اقامت {uuid.uuid4().hex[:6]}",
            "address": "مازندران، نوشهر",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 500000,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    eligibility = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews/eligibility",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert eligibility.status_code == 200
    body = eligibility.json()
    assert body["can_review"] is False
    assert body["has_review"] is False
    assert body["reason"] == "no_stay"


@pytest.mark.asyncio
async def test_review_eligibility_lifecycle(
    client: AsyncClient,
    admin_token: str,
    guest_token: str,
):
    today_tehran = datetime.now(ZoneInfo("Asia/Tehran")).date()
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه تست چرخه واجد شرایط {uuid.uuid4().hex[:6]}",
            "address": "مازندران، نوشهر",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 500000,
            "check_out_time": "12:00:00",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]

    res_res = await client.post(
        f"{settings.API_V1_STR}/reservations/",
        json={
            "accommodation_id": acc_id,
            "check_in": (today_tehran + timedelta(days=40)).isoformat(),
            "check_out": (today_tehran + timedelta(days=42)).isoformat(),
            "guests_count": 2,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert res_res.status_code == 201
    res_id = res_res.json()["id"]

    checkout_res = await client.post(
        f"{settings.API_V1_STR}/payments/checkout",
        json={"reservation_id": res_id},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    verify_res = await client.post(
        f"{settings.API_V1_STR}/payments/verify",
        json={
            "payment_id": checkout_res.json()["payment_id"],
            "tracking_code": checkout_res.json()["tracking_code"],
            "simulate_success": True,
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert verify_res.status_code == 200

    eligibility = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews/eligibility",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert eligibility.status_code == 200
    assert eligibility.json()["can_review"] is False
    assert eligibility.json()["reason"] == "stay_not_finished"

    # Move the stay into the past so the review window opens.
    async with AsyncSessionLocal() as session:
        db_res = await session.get(Reservation, res_id)
        assert db_res is not None
        db_res.check_in = today_tehran - timedelta(days=5)
        db_res.check_out = today_tehran - timedelta(days=3)
        await session.commit()

    eligibility = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews/eligibility",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert eligibility.status_code == 200
    body = eligibility.json()
    assert body["can_review"] is True
    assert body["reservation_id"] == res_id
    assert body["reason"] is None

    review_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews",
        json={
            "reservation_id": res_id,
            "rating": 5,
            "comment": "اقامت خوبی بود و حتماً دوباره برمی‌گردم.",
        },
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert review_res.status_code == 201

    eligibility = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/reviews/eligibility",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert eligibility.status_code == 200
    body = eligibility.json()
    assert body["can_review"] is False
    assert body["has_review"] is True
    assert body["reason"] == "already_reviewed"


