import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.api.v1.endpoints import accommodations as accommodations_module
from app.api.v1.endpoints.accommodations import parse_ical_blocked_ranges
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.time import today_tehran
from app.models.reservation import Reservation


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
                f"UID:horizon-{index}@example.com",
                f"DTSTART;VALUE=DATE:{blocked_date.strftime('%Y%m%d')}",
                f"DTEND;VALUE=DATE:{(blocked_date + timedelta(days=1)).strftime('%Y%m%d')}",
                "END:VEVENT",
            ]
        )
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


@pytest.mark.asyncio
async def test_sync_imports_events_beyond_day_180(
    client: AsyncClient,
    admin_token: str,
    monkeypatch: pytest.MonkeyPatch,
):
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه افق تست-{uuid.uuid4().hex[:6]}",
            "address": "گیلان، رشت",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 1000000,
            "external_calendar_url": "https://calendar.example.com/feed.ics",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201, acc_res.text
    acc_id = acc_res.json()["id"]

    today = today_tehran()
    ics_text = _ics_for_dates([today + timedelta(days=200), today + timedelta(days=201)])
    fake_client = _fake_async_client([ics_text.encode("utf-8")])

    monkeypatch.setattr(accommodations_module.httpx, "AsyncClient", fake_client)

    def fake_getaddrinfo(host: str, port: int, *args: object, **kwargs: object):
        return [("", "", "", "", ("93.184.216.34", port))]

    monkeypatch.setattr(accommodations_module.socket, "getaddrinfo", fake_getaddrinfo)

    sync_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar/sync",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert sync_res.status_code == 200, sync_res.text
    assert sync_res.json()["blocked_days_count"] == 2


@pytest.mark.asyncio
async def test_export_includes_horizon_reservation_and_drops_deep_past(
    client: AsyncClient,
    admin_token: str,
):
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه خروجی تست-{uuid.uuid4().hex[:6]}",
            "address": "گیلان، رشت",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 1000000,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201, acc_res.text
    acc_id = acc_res.json()["id"]

    me_res = await client.get(
        f"{settings.API_V1_STR}/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert me_res.status_code == 200, me_res.text
    admin_id = me_res.json()["id"]

    today = today_tehran()
    async with AsyncSessionLocal() as session:
        session.add_all(
            [
                Reservation(
                    user_id=admin_id,
                    accommodation_id=acc_id,
                    check_in=today - timedelta(days=30),
                    check_out=today - timedelta(days=28),
                    guests_count=1,
                    total_nights=2,
                    total_price=Decimal("1000000"),
                    status="confirmed",
                ),
                Reservation(
                    user_id=admin_id,
                    accommodation_id=acc_id,
                    check_in=today + timedelta(days=200),
                    check_out=today + timedelta(days=202),
                    guests_count=1,
                    total_nights=2,
                    total_price=Decimal("1000000"),
                    status="confirmed",
                ),
            ]
        )
        await session.commit()

    resp = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    far_dtstart = f"DTSTART;VALUE=DATE:{(today + timedelta(days=200)):%Y%m%d}"
    old_dtstart = f"DTSTART;VALUE=DATE:{(today - timedelta(days=30)):%Y%m%d}"
    assert far_dtstart in resp.text
    assert old_dtstart not in resp.text


def test_parser_cap_raises():
    today = today_tehran()
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "CALSCALE:GREGORIAN"]
    for index in range(3):
        start = (today + timedelta(days=index)).strftime("%Y%m%d")
        end = (today + timedelta(days=index + 1)).strftime("%Y%m%d")
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:cap-{index}@example.com",
                f"DTSTART;VALUE=DATE:{start}",
                f"DTEND;VALUE=DATE:{end}",
                "END:VEVENT",
            ]
        )
    lines.append("END:VCALENDAR")
    ics_text = "\r\n".join(lines) + "\r\n"

    with pytest.raises(ValueError):
        parse_ical_blocked_ranges(ics_text, max_events=2)


@pytest.mark.asyncio
async def test_export_rejects_too_many_events(
    client: AsyncClient,
    admin_token: str,
    monkeypatch: pytest.MonkeyPatch,
):
    acc_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json={
            "title": f"اقامتگاه سقف تست-{uuid.uuid4().hex[:6]}",
            "address": "گیلان، رشت",
            "city_id": 1,
            "category_id": 1,
            "capacity": 2,
            "max_capacity": 4,
            "base_price": 1000000,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert acc_res.status_code == 201, acc_res.text
    acc_id = acc_res.json()["id"]

    me_res = await client.get(
        f"{settings.API_V1_STR}/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert me_res.status_code == 200, me_res.text
    admin_id = me_res.json()["id"]

    today = today_tehran()
    async with AsyncSessionLocal() as session:
        session.add_all(
            [
                Reservation(
                    user_id=admin_id,
                    accommodation_id=acc_id,
                    check_in=today + timedelta(days=1),
                    check_out=today + timedelta(days=3),
                    guests_count=1,
                    total_nights=2,
                    total_price=Decimal("1000000"),
                    status="confirmed",
                ),
                Reservation(
                    user_id=admin_id,
                    accommodation_id=acc_id,
                    check_in=today + timedelta(days=10),
                    check_out=today + timedelta(days=12),
                    guests_count=1,
                    total_nights=2,
                    total_price=Decimal("1000000"),
                    status="confirmed",
                ),
            ]
        )
        await session.commit()

    monkeypatch.setattr(accommodations_module, "MAX_ICS_EVENTS", 1)

    resp = await client.get(
        f"{settings.API_V1_STR}/accommodations/{acc_id}/calendar.ics",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 413, resp.text
    assert resp.headers["X-Max-Calendar-Events"] == "1"
