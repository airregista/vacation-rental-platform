import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.api.v1.endpoints.accommodations import (
    generate_calendar_feed_token,
    validate_calendar_feed_token,
)
from app.core.database import AsyncSessionLocal
from app.core.security import create_access_token, get_password_hash
from app.models.accommodation import Accommodation
from app.models.category import Category
from app.models.geo import City
from app.models.user import User


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
            title="Test Security Accommodation",
            description="Testing ical security",
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


@pytest_asyncio.fixture
async def admin_token_headers(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.mark.asyncio
async def test_valid_token_not_expired(
    client: AsyncClient,
    test_accommodation: Accommodation,
    host_token_headers: dict[str, str],
):
    """Obtaining a token via rotation endpoint and accessing feed returns HTTP 200 and valid ICS."""
    rot_resp = await client.post(
        f"/api/v1/accommodations/{test_accommodation.id}/calendar/token",
        headers=host_token_headers,
    )
    assert rot_resp.status_code == 200
    token_data = rot_resp.json()
    token = token_data["token"]

    feed_resp = await client.get(
        f"/api/v1/accommodations/{test_accommodation.id}/calendar.ics?token={token}"
    )
    assert feed_resp.status_code == 200
    assert "BEGIN:VCALENDAR" in feed_resp.text
    assert "END:VCALENDAR" in feed_resp.text


@pytest.mark.asyncio
async def test_token_missing_returns_404(
    client: AsyncClient,
    test_accommodation: Accommodation,
):
    """Unauthenticated request without token query param receives 404."""
    resp = await client.get(f"/api/v1/accommodations/{test_accommodation.id}/calendar.ics")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_wrong_token_returns_404(
    client: AsyncClient,
    test_accommodation: Accommodation,
):
    """Tampered or invalid token receives 404."""
    resp = await client.get(
        f"/api/v1/accommodations/{test_accommodation.id}/calendar.ics?token=9999999999:badsignature1234"
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_expired_token_returns_404(
    client: AsyncClient,
    test_accommodation: Accommodation,
):
    """Token with timestamp in the past receives 404."""
    past_time = datetime.now(timezone.utc) - timedelta(days=1)
    expired_token = generate_calendar_feed_token(test_accommodation.id, expires_at=past_time)

    resp = await client.get(
        f"/api/v1/accommodations/{test_accommodation.id}/calendar.ics?token={expired_token}"
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_unauthorized_user_cannot_rotate(
    client: AsyncClient,
    test_accommodation: Accommodation,
    user_token_headers: dict[str, str],
):
    """Regular guest user receives 403 when trying to rotate another host's feed token."""
    resp = await client.post(
        f"/api/v1/accommodations/{test_accommodation.id}/calendar/token",
        headers=user_token_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_host_and_admin_can_obtain_fresh_token(
    client: AsyncClient,
    test_accommodation: Accommodation,
    host_token_headers: dict[str, str],
    admin_token_headers: dict[str, str],
):
    """Host owner and admin can both rotate tokens successfully."""
    resp_host = await client.post(
        f"/api/v1/accommodations/{test_accommodation.id}/calendar/token",
        headers=host_token_headers,
    )
    assert resp_host.status_code == 200

    resp_admin = await client.post(
        f"/api/v1/accommodations/{test_accommodation.id}/calendar/token",
        headers=admin_token_headers,
    )
    assert resp_admin.status_code == 200


@pytest.mark.asyncio
async def test_rotation_revokes_previous_token(
    client: AsyncClient,
    test_accommodation: Accommodation,
    host_token_headers: dict[str, str],
):
    """Rotating the feed token invalidates the previous token and keeps the new one valid."""
    first_resp = await client.post(
        f"/api/v1/accommodations/{test_accommodation.id}/calendar/token",
        headers=host_token_headers,
    )
    assert first_resp.status_code == 200
    first_token = first_resp.json()["token"]

    second_resp = await client.post(
        f"/api/v1/accommodations/{test_accommodation.id}/calendar/token",
        headers=host_token_headers,
    )
    assert second_resp.status_code == 200
    second_token = second_resp.json()["token"]
    assert first_token != second_token

    old_feed_resp = await client.get(
        f"/api/v1/accommodations/{test_accommodation.id}/calendar.ics?token={first_token}"
    )
    assert old_feed_resp.status_code == 404

    new_feed_resp = await client.get(
        f"/api/v1/accommodations/{test_accommodation.id}/calendar.ics?token={second_token}"
    )
    assert new_feed_resp.status_code == 200


@pytest.mark.asyncio
async def test_token_ttl_boundary_validation():
    """Unit test verifying token validation boundary condition in UTC."""
    now_utc = datetime.now(timezone.utc)
    future = now_utc + timedelta(seconds=10)
    past = now_utc - timedelta(seconds=1)

    valid_token = generate_calendar_feed_token(10, expires_at=future)
    assert validate_calendar_feed_token(valid_token, 10) is True

    expired_token = generate_calendar_feed_token(10, expires_at=past)
    assert validate_calendar_feed_token(expired_token, 10) is False
