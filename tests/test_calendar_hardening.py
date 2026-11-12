import logging
import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from fastapi import HTTPException, status
from httpx import AsyncClient
from sqlalchemy import select

from app.api.v1.endpoints import accommodations as accommodations_module
from app.api.v1.endpoints.accommodations import validate_external_feed_url
from app.core.database import AsyncSessionLocal
from app.core.security import create_access_token, get_password_hash
from app.models.accommodation import Accommodation, PricingException
from app.models.category import Category
from app.models.geo import City
from app.models.user import User


@pytest_asyncio.fixture
async def hardening_host_user() -> User:
    async with AsyncSessionLocal() as session:
        user = User(
            phone=f"0918{uuid.uuid4().int % 10000000:07d}",
            email=f"hardening_host_{uuid.uuid4().hex[:8]}@example.com",
            password_hash=get_password_hash("host123"),
            first_name="Hardening",
            last_name="Host",
            role="host",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest_asyncio.fixture
async def external_calendar_accommodation(hardening_host_user: User) -> Accommodation:
    async with AsyncSessionLocal() as session:
        city = (await session.execute(select(City))).scalars().first()
        category = (await session.execute(select(Category))).scalars().first()
        assert city is not None
        assert category is not None
        acc = Accommodation(
            host_id=hardening_host_user.id,
            category_id=category.id,
            city_id=city.id,
            title="Hardening Calendar Accommodation",
            description="Testing external calendar hardening",
            address="Test Address",
            base_price=Decimal("1000000"),
            cleaning_fee=Decimal("50000"),
            capacity=2,
            max_capacity=4,
            extra_guest_fee=Decimal("100000"),
            rooms_count=1,
            beds_count=1,
            is_active=True,
            external_calendar_url="https://93.184.216.34/feed.ics",
        )
        session.add(acc)
        await session.commit()
        await session.refresh(acc)
        return acc


@pytest_asyncio.fixture
async def hardening_host_headers(hardening_host_user: User) -> dict[str, str]:
    token = create_access_token(hardening_host_user.id)
    return {"Authorization": f"Bearer {token}"}


def _install_getaddrinfo(monkeypatch: pytest.MonkeyPatch, addresses: list[str]) -> None:
    def fake_getaddrinfo(host: str, port: int, *args: object, **kwargs: object):
        return [("", "", "", "", (address, port)) for address in addresses]

    monkeypatch.setattr(
        accommodations_module.socket, "getaddrinfo", fake_getaddrinfo
    )


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/feed.ics",
        "http://[::1]/feed.ics",
        "http://169.254.169.254/latest/meta-data",
        "http://10.0.0.5/feed.ics",
        "http://example.local/feed.ics",
        "ftp://example.com/feed.ics",
        "http://user:pass@example.com/feed.ics",
        "http://example.com:8080/feed.ics",
    ],
)
def test_validate_external_feed_url_rejects_unsafe_urls(url: str) -> None:
    with pytest.raises(HTTPException) as exc_info:
        validate_external_feed_url(url)
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.parametrize(
    "url",
    [
        "http://[::1/feed.ics",
        "http://[not-an-ip]/feed.ics",
    ],
)
def test_validate_external_feed_url_rejects_malformed_ipv6(url: str) -> None:
    with pytest.raises(HTTPException) as exc_info:
        validate_external_feed_url(url)
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert exc_info.value.detail == "Invalid calendar feed URL"


def test_validate_external_feed_url_rejects_nat64_literal() -> None:
    with pytest.raises(HTTPException) as exc_info:
        validate_external_feed_url("http://[64:ff9b::7f00:1]/feed.ics")
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "NAT64" in exc_info.value.detail


def test_validate_external_feed_url_rejects_nat64_resolution(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_getaddrinfo(monkeypatch, ["64:ff9b::a00:1"])
    with pytest.raises(HTTPException) as exc_info:
        validate_external_feed_url("https://example.com/feed.ics")
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "NAT64" in exc_info.value.detail


def test_validate_external_feed_url_accepts_public_resolution(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_getaddrinfo(monkeypatch, ["93.184.216.34"])
    validate_external_feed_url("https://example.com/feed.ics")


def test_validate_external_feed_url_rejects_mixed_dns_answers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_getaddrinfo(monkeypatch, ["93.184.216.34", "127.0.0.1"])
    with pytest.raises(HTTPException) as exc_info:
        validate_external_feed_url("https://example.com/feed.ics")
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


def test_validate_external_feed_url_rejects_ipv6_loopback_resolution(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_getaddrinfo(monkeypatch, ["::1"])
    with pytest.raises(HTTPException) as exc_info:
        validate_external_feed_url("https://example.com/feed.ics")
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


def test_save_time_validation_does_not_resolve_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    def fake_getaddrinfo(host: str, port: int, *args: object, **kwargs: object):
        calls.append(host)
        return [("", "", "", "", ("127.0.0.1", port))]

    monkeypatch.setattr(
        accommodations_module.socket, "getaddrinfo", fake_getaddrinfo
    )
    validate_external_feed_url("https://example.com/feed.ics", resolve=False)
    assert calls == []


def _fake_async_client(
    chunks: list[bytes],
    *,
    stream_error: Exception | None = None,
):
    class FakeResponse:
        status_code = 200
        headers: dict[str, str] = {}
        encoding = "utf-8"

        async def aiter_bytes(self):
            for chunk in chunks:
                yield chunk

        def raise_for_status(self) -> None:
            return None

    class FakeStream:
        async def __aenter__(self):
            return FakeResponse()

        async def __aexit__(self, *args):
            return False

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        def stream(self, *args, **kwargs):
            if stream_error is not None:
                raise stream_error
            return FakeStream()

    return FakeClient


def _ics_for_dates(dates: list[date]) -> str:
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "CALSCALE:GREGORIAN"]
    for index, blocked_date in enumerate(dates):
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:hardening-{index}@example.com",
                f"DTSTART;VALUE=DATE:{blocked_date.strftime('%Y%m%d')}",
                f"DTEND;VALUE=DATE:{(blocked_date + timedelta(days=1)).strftime('%Y%m%d')}",
                "END:VEVENT",
            ]
        )
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


@pytest.mark.asyncio
async def test_sync_error_is_sanitized(
    client: AsyncClient,
    external_calendar_accommodation: Accommodation,
    hardening_host_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.WARNING)
    monkeypatch.setattr(
        accommodations_module.httpx,
        "AsyncClient",
        _fake_async_client(
            [],
            stream_error=RuntimeError(
                "https://example.com/feed.ics?token=internal-hostname-and-secret"
            ),
        ),
    )

    resp = await client.post(
        f"/api/v1/accommodations/{external_calendar_accommodation.id}/calendar/sync",
        headers=hardening_host_headers,
    )

    assert resp.status_code == status.HTTP_502_BAD_GATEWAY
    assert "internal-hostname-and-secret" not in resp.text
    assert resp.json()["detail"] == "Failed to fetch external calendar feed"
    assert "internal-hostname-and-secret" not in caplog.text
    assert "RuntimeError" in caplog.text


@pytest.mark.asyncio
async def test_sync_rejects_oversized_stream(
    client: AsyncClient,
    external_calendar_accommodation: Accommodation,
    hardening_host_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    oversized_chunks = [b"x" * (1024 * 1024), b"x" * (1024 * 1024 + 1)]
    monkeypatch.setattr(
        accommodations_module.httpx,
        "AsyncClient",
        _fake_async_client(oversized_chunks),
    )

    resp = await client.post(
        f"/api/v1/accommodations/{external_calendar_accommodation.id}/calendar/sync",
        headers=hardening_host_headers,
    )

    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert "exceeds maximum permitted size" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_sync_reconciles_ical_owned_rows(
    client: AsyncClient,
    external_calendar_accommodation: Accommodation,
    hardening_host_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    today = date.today()
    stale_ical_date = today + timedelta(days=10)
    manual_date = today + timedelta(days=15)
    new_ical_date = today + timedelta(days=20)

    async with AsyncSessionLocal() as session:
        session.add_all(
            [
                PricingException(
                    accommodation_id=external_calendar_accommodation.id,
                    date=stale_ical_date,
                    manual_blocked=False,
                    ical_blocked=True,
                ),
                PricingException(
                    accommodation_id=external_calendar_accommodation.id,
                    date=manual_date,
                    manual_blocked=True,
                    ical_blocked=False,
                ),
            ]
        )
        await session.commit()

    sync_url = (
        f"/api/v1/accommodations/{external_calendar_accommodation.id}/calendar/sync"
    )
    monkeypatch.setattr(
        accommodations_module.httpx,
        "AsyncClient",
        _fake_async_client([_ics_for_dates([new_ical_date]).encode("utf-8")]),
    )

    resp = await client.post(sync_url, headers=hardening_host_headers)
    assert resp.status_code == status.HTTP_200_OK, resp.text

    async with AsyncSessionLocal() as session:
        rows = {
            row.date: row
            for row in (
                await session.execute(
                    select(PricingException).where(
                        PricingException.accommodation_id
                        == external_calendar_accommodation.id
                    )
                )
            )
            .scalars()
            .all()
        }

    assert stale_ical_date not in rows
    assert manual_date in rows
    assert rows[manual_date].manual_blocked is True
    assert rows[manual_date].ical_blocked is False
    assert rows[manual_date].is_blocked is True
    assert new_ical_date in rows
    assert rows[new_ical_date].manual_blocked is False
    assert rows[new_ical_date].ical_blocked is True
    assert rows[new_ical_date].is_blocked is True

    monkeypatch.setattr(
        accommodations_module.httpx,
        "AsyncClient",
        _fake_async_client([_ics_for_dates([]).encode("utf-8")]),
    )

    resp = await client.post(sync_url, headers=hardening_host_headers)
    assert resp.status_code == status.HTTP_200_OK, resp.text

    async with AsyncSessionLocal() as session:
        rows = {
            row.date: row
            for row in (
                await session.execute(
                    select(PricingException).where(
                        PricingException.accommodation_id
                        == external_calendar_accommodation.id
                    )
                )
            )
            .scalars()
            .all()
        }

    assert new_ical_date not in rows
    assert manual_date in rows
    assert rows[manual_date].manual_blocked is True
    assert rows[manual_date].is_blocked is True


@pytest.mark.asyncio
async def test_empty_feed_clears_ical_block_on_priced_row(
    client: AsyncClient,
    external_calendar_accommodation: Accommodation,
    hardening_host_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A price-only row must not stay blocked after iCal removes the date.

    This is the stale-block regression: the old single ``source`` tag left the
    row labeled manual, so the reconciliation never cleared it.
    """
    priced_date = date.today() + timedelta(days=12)

    async with AsyncSessionLocal() as session:
        session.add(
            PricingException(
                accommodation_id=external_calendar_accommodation.id,
                date=priced_date,
                price=Decimal("123000"),
                manual_blocked=False,
                ical_blocked=True,
            )
        )
        await session.commit()

    monkeypatch.setattr(
        accommodations_module.httpx,
        "AsyncClient",
        _fake_async_client([_ics_for_dates([]).encode("utf-8")]),
    )
    resp = await client.post(
        f"/api/v1/accommodations/{external_calendar_accommodation.id}/calendar/sync",
        headers=hardening_host_headers,
    )
    assert resp.status_code == status.HTTP_200_OK, resp.text

    async with AsyncSessionLocal() as session:
        row = (
            await session.execute(
                select(PricingException).where(
                    PricingException.accommodation_id
                    == external_calendar_accommodation.id,
                    PricingException.date == priced_date,
                )
            )
        ).scalars().one()

    assert row.price == Decimal("123000")
    assert row.manual_blocked is False
    assert row.ical_blocked is False
    assert row.is_blocked is False


@pytest.mark.asyncio
async def test_manual_unblock_does_not_override_active_ical_block(
    client: AsyncClient,
    external_calendar_accommodation: Accommodation,
    hardening_host_headers: dict[str, str],
) -> None:
    blocked_date = date.today() + timedelta(days=9)

    async with AsyncSessionLocal() as session:
        session.add(
            PricingException(
                accommodation_id=external_calendar_accommodation.id,
                date=blocked_date,
                manual_blocked=False,
                ical_blocked=True,
            )
        )
        await session.commit()

    resp = await client.post(
        f"/api/v1/accommodations/{external_calendar_accommodation.id}/pricing-exceptions",
        json={"date": blocked_date.isoformat(), "is_blocked": False},
        headers=hardening_host_headers,
    )

    assert resp.status_code == status.HTTP_200_OK, resp.text
    body = resp.json()
    assert body["manual_blocked"] is False
    assert body["ical_blocked"] is True
    assert body["is_blocked"] is True


@pytest.mark.asyncio
async def test_manual_block_survives_ical_removal(
    client: AsyncClient,
    external_calendar_accommodation: Accommodation,
    hardening_host_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    blocked_date = date.today() + timedelta(days=11)

    async with AsyncSessionLocal() as session:
        session.add(
            PricingException(
                accommodation_id=external_calendar_accommodation.id,
                date=blocked_date,
                manual_blocked=True,
                ical_blocked=True,
            )
        )
        await session.commit()

    monkeypatch.setattr(
        accommodations_module.httpx,
        "AsyncClient",
        _fake_async_client([_ics_for_dates([]).encode("utf-8")]),
    )
    resp = await client.post(
        f"/api/v1/accommodations/{external_calendar_accommodation.id}/calendar/sync",
        headers=hardening_host_headers,
    )
    assert resp.status_code == status.HTTP_200_OK, resp.text

    async with AsyncSessionLocal() as session:
        row = (
            await session.execute(
                select(PricingException).where(
                    PricingException.accommodation_id
                    == external_calendar_accommodation.id,
                    PricingException.date == blocked_date,
                )
            )
        ).scalars().one()

    assert row.manual_blocked is True
    assert row.ical_blocked is False
    assert row.is_blocked is True
