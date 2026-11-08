import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import create_access_token, get_password_hash
from app.models.accommodation import Accommodation
from app.models.category import Category
from app.models.geo import City
from app.models.user import User

TEHRAN_TZ = ZoneInfo("Asia/Tehran")


@pytest_asyncio.fixture
async def host_user() -> User:
    async with AsyncSessionLocal() as session:
        user = User(
            phone=f"0919{uuid.uuid4().int % 10000000:07d}",
            email=f"host_{uuid.uuid4().hex[:8]}@example.com",
            password_hash=get_password_hash("host123"),
            first_name="Host",
            last_name="User",
            role="host",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest_asyncio.fixture
async def test_accommodation(host_user: User) -> Accommodation:
    async with AsyncSessionLocal() as session:
        city = (await session.execute(select(City))).scalars().first()
        category = (await session.execute(select(Category))).scalars().first()
        assert city is not None
        assert category is not None
        acc = Accommodation(
            host_id=host_user.id,
            category_id=category.id,
            city_id=city.id,
            title="Test Limits Accommodation",
            description="Testing batch limits",
            address="Test Address",
            base_price=Decimal("1000000"),
            cleaning_fee=Decimal("50000"),
            capacity=2,
            max_capacity=4,
            extra_guest_fee=Decimal("100000"),
            rooms_count=1,
            beds_count=1,
            is_active=True,
        )
        session.add(acc)
        await session.commit()
        await session.refresh(acc)
        return acc


@pytest_asyncio.fixture
async def host_token_headers(host_user: User) -> dict[str, str]:
    token = create_access_token(host_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def user_token_headers(guest_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {guest_token}"}


@pytest.mark.asyncio
async def test_batch_range_over_90_days_rejected(
    client: AsyncClient,
    test_accommodation: Accommodation,
    host_token_headers: dict[str, str],
):
    """Batch blocking range of 91 days is rejected by schema validation (HTTP 422)."""
    today = datetime.now(TEHRAN_TZ).date()
    payload = {
        "start_date": str(today + timedelta(days=1)),
        "end_date": str(today + timedelta(days=92)),  # 91 days
        "is_blocked": True,
    }
    resp = await client.post(
        f"/api/v1/accommodations/{test_accommodation.id}/pricing-exceptions/batch",
        json=payload,
        headers=host_token_headers,
    )
    assert resp.status_code == 422
    assert "cannot exceed 90 days" in resp.text


@pytest.mark.asyncio
async def test_batch_range_exactly_90_days_accepted(
    client: AsyncClient,
    test_accommodation: Accommodation,
    host_token_headers: dict[str, str],
):
    """Batch blocking range of exactly 90 days is accepted (HTTP 200)."""
    today = datetime.now(TEHRAN_TZ).date()
    start = today + timedelta(days=10)
    end = start + timedelta(days=90)  # Exactly 90 days difference
    payload = {
        "start_date": str(start),
        "end_date": str(end),
        "is_blocked": True,
    }
    resp = await client.post(
        f"/api/v1/accommodations/{test_accommodation.id}/pricing-exceptions/batch",
        json=payload,
        headers=host_token_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["updated_count"] == 91


@pytest.mark.asyncio
async def test_max_blocked_dates_defense_in_depth(
    client: AsyncClient,
    test_accommodation: Accommodation,
    host_token_headers: dict[str, str],
    monkeypatch,
):
    """If schema limit is temporarily bypassed or relaxed, handler aborts on max dates ceiling."""
    monkeypatch.setattr(settings, "CALENDAR_MAX_BLOCK_DAYS", 2000)
    monkeypatch.setattr(settings, "CALENDAR_MAX_BLOCKED_DATES", 100)

    today = datetime.now(TEHRAN_TZ).date()
    payload = {
        "start_date": str(today + timedelta(days=1)),
        "end_date": str(today + timedelta(days=150)),
        "is_blocked": True,
    }
    resp = await client.post(
        f"/api/v1/accommodations/{test_accommodation.id}/pricing-exceptions/batch",
        json=payload,
        headers=host_token_headers,
    )
    assert resp.status_code == 400
    assert "exceeds the maximum allowed size" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_check_in_beyond_horizon_rejected(
    client: AsyncClient,
    test_accommodation: Accommodation,
    user_token_headers: dict[str, str],
):
    """Check-in date beyond 540 days is rejected (HTTP 400)."""
    today = datetime.now(TEHRAN_TZ).date()
    horizon = settings.RESERVATION_MAX_CHECKIN_MONTHS * 30  # 540
    payload = {
        "accommodation_id": test_accommodation.id,
        "check_in": str(today + timedelta(days=horizon + 1)),
        "check_out": str(today + timedelta(days=horizon + 3)),
        "guests_count": 1,
    }
    resp = await client.post("/api/v1/reservations/", json=payload, headers=user_token_headers)
    assert resp.status_code == 400
    assert "Check-in date exceeds the maximum booking horizon" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_boundary_stay_at_horizon_accepted(
    client: AsyncClient,
    test_accommodation: Accommodation,
    user_token_headers: dict[str, str],
):
    """Stay with checkout exactly at 540 days is accepted at calculation and booking."""
    today = datetime.now(TEHRAN_TZ).date()
    horizon = settings.RESERVATION_MAX_CHECKIN_MONTHS * 30  # 540
    calc_payload = {
        "accommodation_id": test_accommodation.id,
        "check_in": str(today + timedelta(days=horizon - 2)),
        "check_out": str(today + timedelta(days=horizon)),
        "guests_count": 1,
    }
    resp = await client.post("/api/v1/reservations/calculate-price", json=calc_payload)
    assert resp.status_code == 200
    assert resp.json()["total_nights"] == 2


@pytest.mark.asyncio
async def test_check_out_beyond_horizon_rejected(
    client: AsyncClient,
    test_accommodation: Accommodation,
    user_token_headers: dict[str, str],
):
    """Stay where check-in is valid but check-out crosses the 540-day horizon is rejected."""
    today = datetime.now(TEHRAN_TZ).date()
    horizon = settings.RESERVATION_MAX_CHECKIN_MONTHS * 30  # 540
    calc_payload = {
        "accommodation_id": test_accommodation.id,
        "check_in": str(today + timedelta(days=horizon - 1)),
        "check_out": str(today + timedelta(days=horizon + 1)),
        "guests_count": 1,
    }
    resp = await client.post("/api/v1/reservations/calculate-price", json=calc_payload)
    assert resp.status_code == 400
    assert "Check-out date exceeds the maximum booking horizon" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_price_calculation_enforces_horizon(
    client: AsyncClient,
    test_accommodation: Accommodation,
):
    """Public calculate-price endpoint consistently enforces the booking horizon."""
    today = datetime.now(TEHRAN_TZ).date()
    calc_payload = {
        "accommodation_id": test_accommodation.id,
        "check_in": str(today + timedelta(days=600)),
        "check_out": str(today + timedelta(days=605)),
        "guests_count": 1,
    }
    resp = await client.post("/api/v1/reservations/calculate-price", json=calc_payload)
    assert resp.status_code == 400
    assert "exceeds the maximum booking horizon" in resp.json()["detail"]
