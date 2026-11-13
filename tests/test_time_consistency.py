from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.core.time import TEHRAN_TZ, today_tehran


def test_today_tehran_matches_zoneinfo():
    # Compute the expected date before and after so crossing midnight between
    # the helper call and the comparison cannot make the test flaky.
    tz = ZoneInfo("Asia/Tehran")
    before = datetime.now(tz).date()
    actual = today_tehran()
    after = datetime.now(tz).date()
    assert actual in (before, after)
    assert TEHRAN_TZ.key == "Asia/Tehran"


@pytest.mark.asyncio
async def test_calendar_defaults_to_tehran_today(client: AsyncClient, admin_token: str):
    cities = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories = await client.get(f"{settings.API_V1_STR}/categories/")
    created = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "category_id": categories.json()[0]["id"],
            "city_id": cities.json()[0]["id"],
            "title": "Tehran Today Calendar",
            "address": "تهران، تست تقویم، پلاک ۱",
            "base_price": 1000000,
            "capacity": 2,
            "max_capacity": 3,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert created.status_code == 201
    acc_id = created.json()["id"]

    calendar = await client.get(f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar?days=1")
    assert calendar.status_code == 200
    assert calendar.json()[0]["date"] == today_tehran().isoformat()
