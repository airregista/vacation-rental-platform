import hashlib
import hmac
import ipaddress
import logging
import math
import re
import secrets
import socket
import urllib.parse
from collections.abc import Sequence
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated

import httpx
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import delete, distinct, exists, func, not_, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.api.dependencies import (
    CurrentHostOrAdminDep,
    CurrentUserDep,
    OptionalCurrentUserDep,
    SessionDep,
)
from app.core.config import settings
from app.models.accommodation import Accommodation, AccommodationImage, PricingException
from app.models.amenity import AccommodationAmenity, Amenity
from app.models.category import Category
from app.models.geo import City
from app.models.reservation import Reservation
from app.models.review import Review
from app.models.user import User
from app.schemas.accommodation import (
    AccommodationCreate,
    AccommodationDetail,
    AccommodationImageCreate,
    AccommodationImageResponse,
    AccommodationListItem,
    AccommodationUpdate,
    CalendarFeedTokenResponse,
    CalendarSyncResponse,
    PricingExceptionBatchCreate,
    PricingExceptionBatchResponse,
    PricingExceptionCreate,
    PricingExceptionResponse,
)
from app.schemas.category import CategoryResponse
from app.schemas.geo import CityResponse, ProvinceResponse
from app.schemas.reservation import CalendarDayInfo

router = APIRouter(prefix="/accommodations", tags=["accommodations"])


def generate_calendar_feed_token(
    accommodation_id: int,
    expires_at: datetime | None = None,
    token_version: int = 0,
) -> str:
    """Generate time-bounded calendar feed token in the format '{ts}:{signature}'.

    The signature covers the versioned payload
    f'calendar:{accommodation_id}:{token_version}:{ts}' (or the legacy
    f'calendar:{accommodation_id}:{ts}' when the version is 0) using
    SECRET_KEY.
    """
    if expires_at is None:
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.CALENDAR_FEED_TTL_MINUTES
        )
    elif expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    ts = int(expires_at.timestamp())
    payload = (
        f"calendar:{accommodation_id}:{ts}"
        if token_version == 0
        else f"calendar:{accommodation_id}:{token_version}:{ts}"
    )
    signature = hmac.new(
        settings.SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()[:16]
    return f"{ts}:{signature}"


def validate_calendar_feed_token(
    token: str | None,
    accommodation_id: int,
    token_version: int = 0,
) -> bool:
    """Verify HMAC signature over the versioned payload and that the token has not expired."""
    if not token or ":" not in token:
        return False
    parts = token.split(":")
    if len(parts) != 2:
        return False
    ts_str, signature = parts
    try:
        ts = int(ts_str)
        expires_at = datetime.fromtimestamp(ts, tz=timezone.utc)
    except (ValueError, OverflowError, OSError):
        return False

    if datetime.now(timezone.utc) > expires_at:
        return False

    payload = (
        f"calendar:{accommodation_id}:{ts}"
        if token_version == 0
        else f"calendar:{accommodation_id}:{token_version}:{ts}"
    )
    expected_signature = hmac.new(
        settings.SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()[:16]
    return secrets.compare_digest(expected_signature, signature)


async def _build_accommodation_list_items(
    db: AsyncSession,
    accommodations: Sequence[Accommodation],
) -> list[AccommodationListItem]:
    acc_ids = [a.id for a in accommodations]
    ratings_map: dict[int, tuple[float, int]] = {}
    if acc_ids:
        agg_stmt = (
            select(
                Review.accommodation_id,
                func.avg(Review.rating).label("avg_rating"),
                func.count(Review.id).label("count_rating"),
            )
            .where(Review.accommodation_id.in_(acc_ids))
            .group_by(Review.accommodation_id)
        )
        agg_res = await db.execute(agg_stmt)
        for row in agg_res.all():
            ratings_map[row.accommodation_id] = (float(row.avg_rating), int(row.count_rating))

    items: list[AccommodationListItem] = []
    for acc in accommodations:
        cover = next((img.image_url for img in acc.images if img.is_cover), None)
        if not cover and acc.images:
            cover = acc.images[0].image_url

        avg_rat, count_rat = ratings_map.get(acc.id, (None, 0))
        city_resp = None
        if acc.city:
            prov_resp = (
                ProvinceResponse.model_validate(acc.city.province)
                if acc.city.province
                else None
            )
            city_resp = CityResponse(
                id=acc.city.id,
                province_id=acc.city.province_id,
                name=acc.city.name,
                province=prov_resp,
            )

        cat_resp = CategoryResponse.model_validate(acc.category) if acc.category else None

        items.append(
            AccommodationListItem(
                id=acc.id,
                title=acc.title,
                city=city_resp,
                category=cat_resp,
                base_price=acc.base_price,
                capacity=acc.capacity,
                max_capacity=acc.max_capacity,
                rooms_count=acc.rooms_count,
                beds_count=acc.beds_count,
                min_nights=acc.min_nights,
                cover_image=cover,
                cancellation_policy=acc.cancellation_policy,
                average_rating=round(avg_rat, 1) if avg_rat is not None else None,
                reviews_count=count_rat,
                is_active=acc.is_active,
            )
        )
    return items


@router.get("/", response_model=list[AccommodationListItem])
async def list_accommodations(
    db: SessionDep,
    city_id: Annotated[int | None, Query(description="Filter by city ID")] = None,
    province_id: Annotated[int | None, Query(description="Filter by province ID")] = None,
    category_id: Annotated[int | None, Query(description="Filter by category ID")] = None,
    guests_count: Annotated[
        int | None, Query(ge=1, description="Minimum maximum capacity required")
    ] = None,
    min_rooms: Annotated[int | None, Query(ge=1, description="Minimum number of rooms")] = None,
    min_beds: Annotated[int | None, Query(ge=1, description="Minimum number of beds")] = None,
    min_price: Annotated[Decimal | None, Query(ge=0, description="Minimum base price")] = None,
    max_price: Annotated[Decimal | None, Query(ge=0, description="Maximum base price")] = None,
    check_in: Annotated[
        date | None, Query(description="Check-in date for availability check")
    ] = None,
    check_out: Annotated[
        date | None, Query(description="Check-out date for availability check")
    ] = None,
    amenity_ids: Annotated[list[int] | None, Query(description="Required amenity IDs")] = None,
    lat: Annotated[
        float | None, Query(ge=-90, le=90, description="Latitude for spatial radius search")
    ] = None,
    lng: Annotated[
        float | None, Query(ge=-180, le=180, description="Longitude for spatial radius search")
    ] = None,
    radius_km: Annotated[
        float | None, Query(gt=0, le=1000, description="Search radius in kilometers")
    ] = None,
    sort_by: Annotated[str, Query(description="Sorting: newest, price_asc, price_desc")] = "newest",
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[AccommodationListItem]:
    stmt = (
        select(Accommodation)
        .options(
            joinedload(Accommodation.city).joinedload(City.province),
            joinedload(Accommodation.category),
            joinedload(Accommodation.host),
            selectinload(Accommodation.images),
        )
        .where(Accommodation.is_active.is_(True))
    )

    if city_id is not None:
        stmt = stmt.where(Accommodation.city_id == city_id)
    if province_id is not None:
        stmt = stmt.join(Accommodation.city).where(City.province_id == province_id)
    if category_id is not None:
        stmt = stmt.where(Accommodation.category_id == category_id)
    if guests_count is not None:
        stmt = stmt.where(Accommodation.max_capacity >= guests_count)
    if min_rooms is not None:
        stmt = stmt.where(Accommodation.rooms_count >= min_rooms)
    if min_beds is not None:
        stmt = stmt.where(Accommodation.beds_count >= min_beds)
    if min_price is not None:
        stmt = stmt.where(Accommodation.base_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Accommodation.base_price <= max_price)

    # Date range availability filter: exclude accommodations with overlapping confirmed bookings or blocked dates
    if (check_in is not None and check_out is None) or (check_in is None and check_out is not None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both check_in and check_out parameters must be provided together for availability filtering",
        )

    if check_in and check_out:
        if check_out <= check_in:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Check-out date must be strictly after check-in date",
            )

        stay_nights = (check_out - check_in).days
        stmt = stmt.where(
            Accommodation.min_nights <= stay_nights,
            not_(
                exists(
                    select(PricingException.id).where(
                        PricingException.accommodation_id == Accommodation.id,
                        PricingException.min_nights > stay_nights,
                        PricingException.date >= check_in,
                        PricingException.date < check_out,
                    )
                )
            ),
            not_(
                exists(
                    select(Reservation.id).where(
                        Reservation.accommodation_id == Accommodation.id,
                        Reservation.status == "confirmed",
                        Reservation.check_in < check_out,
                        Reservation.check_out > check_in,
                    )
                )
            ),
            not_(
                exists(
                    select(PricingException.id).where(
                        PricingException.accommodation_id == Accommodation.id,
                        PricingException.is_blocked.is_(True),
                        PricingException.date >= check_in,
                        PricingException.date < check_out,
                    )
                )
            ),
        )

    # Filter by amenities if specified
    if amenity_ids:
        unique_amenity_ids = list(dict.fromkeys(amenity_ids))
        stmt = (
            stmt.join(Accommodation.amenities)
            .where(Amenity.id.in_(unique_amenity_ids))
            .group_by(Accommodation.id)
            .having(func.count(distinct(Amenity.id)) == len(unique_amenity_ids))
        )

    # Spatial radius search (Haversine formula)
    spatial_params = [lat is not None, lng is not None, radius_km is not None]
    if any(spatial_params) and not all(spatial_params):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parameters lat, lng, and radius_km must all be provided together for spatial search",
        )

    if lat is not None and lng is not None and radius_km is not None:
        delta_lat = radius_km / 111.0
        min_lat = max(-90.0, lat - delta_lat)
        max_lat = min(90.0, lat + delta_lat)

        stmt = stmt.where(
            Accommodation.latitude.is_not(None),
            Accommodation.longitude.is_not(None),
            Accommodation.latitude >= min_lat,
            Accommodation.latitude <= max_lat,
        )

        cos_lat = math.cos(math.radians(lat))
        if cos_lat > 0.001:
            delta_lng = radius_km / (111.0 * cos_lat)
            if delta_lng < 180.0:
                min_lng = lng - delta_lng
                max_lng = lng + delta_lng
                if min_lng >= -180.0 and max_lng <= 180.0:
                    stmt = stmt.where(
                        Accommodation.longitude >= min_lng,
                        Accommodation.longitude <= max_lng,
                    )

        cos_angle = func.cos(func.radians(lat)) * func.cos(
            func.radians(Accommodation.latitude)
        ) * func.cos(func.radians(Accommodation.longitude) - func.radians(lng)) + func.sin(
            func.radians(lat)
        ) * func.sin(func.radians(Accommodation.latitude))
        clamped_cos = func.greatest(-1.0, func.least(1.0, cos_angle))
        haversine_expr = 6371 * func.acos(clamped_cos)
        stmt = stmt.where(haversine_expr <= radius_km)

    # Sorting with deterministic primary key tie-breaker for pagination
    if sort_by == "price_asc":
        stmt = stmt.order_by(Accommodation.base_price.asc(), Accommodation.id.desc())
    elif sort_by == "price_desc":
        stmt = stmt.order_by(Accommodation.base_price.desc(), Accommodation.id.desc())
    else:
        stmt = stmt.order_by(Accommodation.created_at.desc(), Accommodation.id.desc())

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    accommodations = result.scalars().all()

    return await _build_accommodation_list_items(db, accommodations)


@router.get("/my", response_model=list[AccommodationListItem])
async def list_my_accommodations(
    current_user: CurrentUserDep,
    db: SessionDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[AccommodationListItem]:
    stmt = (
        select(Accommodation)
        .options(
            joinedload(Accommodation.city).joinedload(City.province),
            joinedload(Accommodation.category),
            joinedload(Accommodation.host),
            selectinload(Accommodation.images),
        )
        .where(Accommodation.host_id == current_user.id)
        .order_by(Accommodation.created_at.desc(), Accommodation.id.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    accommodations = result.scalars().all()

    return await _build_accommodation_list_items(db, accommodations)


@router.get("/{id}", response_model=AccommodationDetail)
async def get_accommodation(
    id: int,
    db: SessionDep,
    current_user: OptionalCurrentUserDep = None,
) -> AccommodationDetail:
    stmt = (
        select(Accommodation)
        .options(
            selectinload(Accommodation.host),
            selectinload(Accommodation.city).selectinload(City.province),
            selectinload(Accommodation.category),
            selectinload(Accommodation.images),
            selectinload(Accommodation.amenities),
        )
        .where(Accommodation.id == id)
    )
    result = await db.execute(stmt)
    acc = result.scalars().first()
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Accommodation not found",
        )

    is_owner_or_admin = bool(
        current_user and (current_user.role == "admin" or acc.host_id == current_user.id)
    )

    has_confirmed_booking = False
    if current_user and not is_owner_or_admin:
        has_confirmed_booking = bool(
            await db.scalar(
                select(
                    exists().where(
                        Reservation.accommodation_id == id,
                        Reservation.user_id == current_user.id,
                        Reservation.status.in_(("confirmed", "completed")),
                    )
                )
            )
        )

    if not acc.is_active and not (is_owner_or_admin or has_confirmed_booking):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Accommodation not found or is currently inactive",
        )

    # Reviews aggregate
    agg_stmt = select(
        func.avg(Review.rating).label("avg_rating"),
        func.count(Review.id).label("count_rating"),
    ).where(Review.accommodation_id == id)
    agg_res = await db.execute(agg_stmt)
    avg_r, count_r = agg_res.one()

    detail = AccommodationDetail.model_validate(acc)
    detail.average_rating = round(float(avg_r), 1) if avg_r is not None else None
    detail.reviews_count = int(count_r)
    if is_owner_or_admin:
        detail.calendar_ics_token = generate_calendar_feed_token(
            acc.id, token_version=acc.calendar_feed_token_version
        )
    else:
        detail.external_calendar_url = None
        detail.last_calendar_sync_at = None
    return detail


@router.get("/{id}/calendar", response_model=list[CalendarDayInfo])
async def get_accommodation_calendar(
    id: int,
    db: SessionDep,
    current_user: OptionalCurrentUserDep = None,
    start_date: Annotated[date | None, Query(description="Start date (defaults to today)")] = None,
    days: Annotated[int, Query(ge=1, le=90, description="Number of days to check")] = 30,
) -> list[CalendarDayInfo]:
    if start_date is None:
        start_date = date.today()
    end_date = start_date + timedelta(days=days)

    stmt = select(Accommodation).where(Accommodation.id == id)
    res = await db.execute(stmt)
    acc = res.scalars().first()
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Accommodation not found",
        )

    if not acc.is_active and (
        not current_user or (current_user.role != "admin" and acc.host_id != current_user.id)
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Accommodation not found or is currently inactive",
        )

    # Fetch pricing exceptions
    ex_stmt = select(PricingException).where(
        PricingException.accommodation_id == id,
        PricingException.date >= start_date,
        PricingException.date < end_date,
    )
    ex_res = await db.execute(ex_stmt)
    exceptions = {e.date: e for e in ex_res.scalars().all()}

    # Fetch confirmed reservations
    res_stmt = select(Reservation).where(
        Reservation.accommodation_id == id,
        Reservation.status == "confirmed",
        Reservation.check_in < end_date,
        Reservation.check_out > start_date,
    )
    res_result = await db.execute(res_stmt)
    confirmed_reservations = res_result.scalars().all()

    calendar_days: list[CalendarDayInfo] = []
    curr = start_date
    while curr < end_date:
        exception = exceptions.get(curr)
        day_price = (
            exception.price if (exception and exception.price is not None) else acc.base_price
        )
        is_exception = exception is not None and exception.price is not None

        # Check if booked
        is_booked = any(r.check_in <= curr < r.check_out for r in confirmed_reservations)
        is_blocked = (exception.is_blocked if exception else False) or (not acc.is_active)

        is_available = not is_booked and not is_blocked
        day_min_nights = (
            exception.min_nights
            if (exception and exception.min_nights is not None)
            else acc.min_nights
        )

        calendar_days.append(
            CalendarDayInfo(
                date=curr,
                price=day_price,
                is_available=is_available,
                is_exception=is_exception,
                min_nights=day_min_nights,
            )
        )
        curr += timedelta(days=1)

    return calendar_days


@router.get("/{id}/calendar.ics", response_class=Response)
async def export_accommodation_calendar_ics(
    id: int,
    db: SessionDep,
    current_user: OptionalCurrentUserDep = None,
    token: Annotated[str | None, Query()] = None,
) -> Response:
    acc_stmt = select(Accommodation).where(Accommodation.id == id)
    acc = (await db.execute(acc_stmt)).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    is_token_valid = validate_calendar_feed_token(
        token, acc.id, acc.calendar_feed_token_version
    )
    is_authorized_user = bool(
        current_user and (current_user.role == "admin" or acc.host_id == current_user.id)
    )
    if not is_authorized_user:
        if not acc.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Accommodation not found or is currently inactive",
            )
        if not is_token_valid:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Accommodation not found or calendar feed access is invalid or expired",
            )

    res_stmt = select(Reservation).where(
        Reservation.accommodation_id == id,
        Reservation.status == "confirmed",
    )
    reservations = (await db.execute(res_stmt)).scalars().all()

    block_stmt = select(PricingException).where(
        PricingException.accommodation_id == id,
        PricingException.is_blocked.is_(True),
    )
    blocked = (await db.execute(block_stmt)).scalars().all()

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Ashianak Accommodation//Calendar Sync//EN",
        "CALSCALE:GREGORIAN",
    ]

    for r in reservations:
        dtstart = r.check_in.strftime("%Y%m%d")
        dtend = r.check_out.strftime("%Y%m%d")
        opaque_id = hashlib.sha256(f"{r.id}-{settings.SECRET_KEY}".encode()).hexdigest()[:12]
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:booking-{opaque_id}@ashianak.local",
                f"DTSTART;VALUE=DATE:{dtstart}",
                f"DTEND;VALUE=DATE:{dtend}",
                "SUMMARY:Reserved / Unavailable",
                "END:VEVENT",
            ]
        )

    for b in blocked:
        dt_start = b.date.strftime("%Y%m%d")
        dt_end = (b.date + timedelta(days=1)).strftime("%Y%m%d")
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:block-{b.id}@ashianak.local",
                f"DTSTART;VALUE=DATE:{dt_start}",
                f"DTEND;VALUE=DATE:{dt_end}",
                "SUMMARY:Blocked - Not Available",
                "END:VEVENT",
            ]
        )

    lines.append("END:VCALENDAR")
    ics_content = "\r\n".join(lines)
    return Response(content=ics_content, media_type="text/calendar")


@router.post("/{id}/calendar/token", response_model=CalendarFeedTokenResponse)
async def rotate_calendar_feed_token(
    id: int,
    db: SessionDep,
    current_user: CurrentUserDep,
) -> CalendarFeedTokenResponse:
    """Generate a fresh calendar feed token with new TTL for accommodation owner or admin."""
    acc_stmt = (
        select(Accommodation)
        .where(Accommodation.id == id)
        .with_for_update(of=Accommodation)
    )
    acc = (await db.execute(acc_stmt)).scalars().first()
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage this accommodation calendar",
        )

    acc.calendar_feed_token_version = (acc.calendar_feed_token_version or 0) + 1
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.CALENDAR_FEED_TTL_MINUTES)
    token = generate_calendar_feed_token(
        acc.id,
        expires_at=expires_at,
        token_version=acc.calendar_feed_token_version,
    )
    await db.commit()
    feed_url = f"{settings.API_V1_STR}/accommodations/{acc.id}/calendar.ics?token={token}"

    return CalendarFeedTokenResponse(
        token=token,
        expires_at=expires_at,
        feed_url=feed_url,
    )


logger = logging.getLogger(__name__)
MAX_CALENDAR_FEED_BYTES = 2 * 1024 * 1024

_ALLOWED_FEED_PORTS = {None, 80, 443}
_BLOCKED_HOST_SUFFIXES = (".local", ".internal", ".localhost")
# The well-known NAT64 prefix embeds an IPv4 address that the NAT64 gateway
# translates. ipaddress reports the IPv6 form as global even when the embedded
# IPv4 is loopback/private, so reject the whole prefix.
_NAT64_PREFIX = ipaddress.ip_network("64:ff9b::/96")


def _assert_global_ip(value: str) -> None:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar feed URLs must resolve to a public IP address",
        ) from None
    if isinstance(address, ipaddress.IPv6Address) and address in _NAT64_PREFIX:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar feed URLs must not use NAT64-mapped addresses",
        )
    if not address.is_global:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar feed URLs must resolve to a public IP address",
        )


def validate_external_feed_url(url_str: str, *, resolve: bool = True) -> None:
    try:
        parsed = urllib.parse.urlparse(url_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid calendar feed URL",
        ) from None
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only HTTP/HTTPS calendar feed URLs are supported",
        )

    if parsed.username or parsed.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar feed URLs must not contain credentials",
        )

    hostname = (parsed.hostname or "").rstrip(".").lower()
    if not hostname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid calendar feed URL: missing host",
        )

    try:
        port = parsed.port
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid calendar feed URL: bad port",
        )
    if port not in _ALLOWED_FEED_PORTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar feed URLs may only use ports 80 or 443",
        )

    if hostname in ("localhost", "localhost.localdomain") or hostname.endswith(
        _BLOCKED_HOST_SUFFIXES
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Loopback calendar URLs are forbidden",
        )

    try:
        literal = ipaddress.ip_address(hostname)
    except ValueError:
        literal = None

    if literal is not None:
        _assert_global_ip(hostname)
        return

    if not resolve:
        return

    try:
        infos = socket.getaddrinfo(
            hostname,
            port or (443 if parsed.scheme == "https" else 80),
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot resolve calendar feed host",
        )

    addresses = {
        info[4][0].split("%", 1)[0]
        for info in infos
        if info[4] and info[4][0]
    }
    if not addresses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot resolve calendar feed host",
        )
    for address in addresses:
        _assert_global_ip(address)


def parse_ical_blocked_ranges(ics_content: str) -> list[tuple[date, date]]:
    ranges: list[tuple[date, date]] = []
    vevents = re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", ics_content, re.DOTALL)
    for vevent in vevents:
        dtstart_match = re.search(r"DTSTART(?:;[^:\r\n]*)?:?(\d{8})", vevent)
        dtend_match = re.search(r"DTEND(?:;[^:\r\n]*)?:?(\d{8})", vevent)
        if dtstart_match and dtend_match:
            start_str = dtstart_match.group(1)
            end_str = dtend_match.group(1)
            try:
                s_date = datetime.strptime(start_str, "%Y%m%d").date()
                e_date = datetime.strptime(end_str, "%Y%m%d").date()
                if e_date > s_date:
                    ranges.append((s_date, e_date))
            except ValueError:
                continue
        elif dtstart_match and not dtend_match:
            try:
                s_date = datetime.strptime(dtstart_match.group(1), "%Y%m%d").date()
                ranges.append((s_date, s_date + timedelta(days=1)))
            except ValueError:
                continue
    return ranges


@router.post("/{id}/calendar/sync", response_model=CalendarSyncResponse)
async def sync_external_calendar(
    id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> CalendarSyncResponse:
    stmt = select(Accommodation).where(Accommodation.id == id).with_for_update(of=Accommodation)
    acc = (await db.execute(stmt)).scalars().first()
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Accommodation not found")
    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    if not acc.external_calendar_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No external calendar URL configured for this accommodation",
        )

    target_url = acc.external_calendar_url
    max_redirects = 5
    ics_text = ""
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            for _ in range(max_redirects):
                validate_external_feed_url(target_url)
                async with client.stream("GET", target_url) as resp:
                    if resp.status_code in (301, 302, 303, 307, 308) and "location" in resp.headers:
                        target_url = urllib.parse.urljoin(
                            target_url, resp.headers.get("location", "")
                        )
                        continue

                    resp.raise_for_status()
                    content = bytearray()
                    async for chunk in resp.aiter_bytes():
                        content.extend(chunk)
                        if len(content) > MAX_CALENDAR_FEED_BYTES:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Calendar feed content exceeds maximum permitted size (2MB)",
                            )
                    ics_text = content.decode(resp.encoding or "utf-8", errors="replace")
                    break
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Too many redirects fetching external calendar feed",
                )
    except HTTPException:
        raise
    except Exception as exc:
        # Do not log the exception text or the stack trace: httpx errors embed
        # the request URL, which can carry a private token or API key.
        logger.warning(
            "Failed to fetch external calendar feed for accommodation %s (%s)",
            id,
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch external calendar feed",
        )

    event_ranges = parse_ical_blocked_ranges(ics_text)
    today = date.today()
    max_future = today + timedelta(days=180)

    dates_to_block: set[date] = set()
    for s_date, e_date in event_ranges:
        curr = max(today, s_date)
        end_d = min(max_future, e_date)
        while curr < end_d:
            dates_to_block.add(curr)
            curr += timedelta(days=1)

    if dates_to_block:
        values = [
            {
                "accommodation_id": acc.id,
                "date": d,
                "is_blocked": True,
                "manual_blocked": False,
                "ical_blocked": True,
            }
            for d in sorted(dates_to_block)
        ]
        insert_stmt = (
            pg_insert(PricingException)
            .values(values)
            .on_conflict_do_update(
                constraint="uq_pricing_exception_accommodation_date",
                set_={"is_blocked": True, "ical_blocked": True},
            )
        )
        await db.execute(insert_stmt)

    # Clear the iCal flag on dates the upstream feed no longer blocks. Manual
    # blocks survive because is_blocked falls back to manual_blocked. Rows that
    # carried only the iCal block (no manual block, price, or min_nights) are
    # deleted below so they do not linger as false blocks.
    stale_stmt = (
        update(PricingException)
        .where(
            PricingException.accommodation_id == acc.id,
            PricingException.ical_blocked.is_(True),
            PricingException.date >= today,
            PricingException.date < max_future,
        )
        .values(ical_blocked=False, is_blocked=PricingException.manual_blocked)
    )
    if dates_to_block:
        stale_stmt = stale_stmt.where(
            PricingException.date.notin_(sorted(dates_to_block))
        )
    await db.execute(stale_stmt)

    await db.execute(
        delete(PricingException).where(
            PricingException.accommodation_id == acc.id,
            PricingException.manual_blocked.is_(False),
            PricingException.ical_blocked.is_(False),
            PricingException.date >= today,
            PricingException.date < max_future,
            PricingException.price.is_(None),
            PricingException.min_nights.is_(None),
        )
    )

    now_utc = datetime.now(timezone.utc)
    acc.last_calendar_sync_at = now_utc
    await db.commit()

    return CalendarSyncResponse(
        synced_events_count=len(event_ranges),
        blocked_days_count=len(dates_to_block),
        last_sync_at=now_utc,
    )


@router.post("/", response_model=AccommodationDetail, status_code=status.HTTP_201_CREATED)
async def create_accommodation(
    acc_in: AccommodationCreate,
    current_user: CurrentHostOrAdminDep,
    db: SessionDep,
) -> AccommodationDetail:
    # Verify city and category
    city_exists = (
        await db.execute(select(City.id).where(City.id == acc_in.city_id))
    ).scalar_one_or_none()
    if not city_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"City ID {acc_in.city_id} does not exist",
        )

    cat_exists = (
        await db.execute(select(Category.id).where(Category.id == acc_in.category_id))
    ).scalar_one_or_none()
    if not cat_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category ID {acc_in.category_id} does not exist",
        )

    if acc_in.amenity_ids:
        existing_amenities = (
            (await db.execute(select(Amenity.id).where(Amenity.id.in_(acc_in.amenity_ids))))
            .scalars()
            .all()
        )
        missing = set(acc_in.amenity_ids) - set(existing_amenities)
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Amenity IDs not found: {sorted(list(missing))}",
            )

    if current_user.role == "admin" and acc_in.host_id is not None:
        host_user = (
            (await db.execute(select(User).where(User.id == acc_in.host_id))).scalars().first()
        )
        if not host_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Host user with ID {acc_in.host_id} not found",
            )
        if host_user.role not in ("host", "admin"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with ID {acc_in.host_id} is not a host or admin",
            )
        host_id = acc_in.host_id
    elif (
        current_user.role != "admin"
        and acc_in.host_id is not None
        and acc_in.host_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hosts cannot create accommodations on behalf of other users",
        )
    else:
        host_id = current_user.id

    if acc_in.external_calendar_url:
        validate_external_feed_url(acc_in.external_calendar_url, resolve=False)

    accommodation = Accommodation(
        host_id=host_id,
        category_id=acc_in.category_id,
        city_id=acc_in.city_id,
        title=acc_in.title,
        description=acc_in.description,
        address=acc_in.address,
        latitude=acc_in.latitude,
        longitude=acc_in.longitude,
        base_price=acc_in.base_price,
        cleaning_fee=acc_in.cleaning_fee,
        capacity=acc_in.capacity,
        max_capacity=acc_in.max_capacity,
        extra_guest_fee=acc_in.extra_guest_fee,
        rooms_count=acc_in.rooms_count,
        beds_count=acc_in.beds_count,
        min_nights=acc_in.min_nights,
        check_in_time=acc_in.check_in_time,
        check_out_time=acc_in.check_out_time,
        rules=acc_in.rules,
        cancellation_policy=acc_in.cancellation_policy,
        is_active=acc_in.is_active,
        external_calendar_url=acc_in.external_calendar_url,
    )
    db.add(accommodation)
    await db.flush()

    # Add images
    has_explicit_cover = any(img.is_cover for img in acc_in.images)
    for idx, img in enumerate(acc_in.images):
        is_cover = img.is_cover if has_explicit_cover else (idx == 0)
        image = AccommodationImage(
            accommodation_id=accommodation.id,
            image_url=img.image_url,
            is_cover=is_cover,
            sort_order=img.sort_order or idx,
        )
        db.add(image)

    # Add amenities
    if acc_in.amenity_ids:
        for aid in dict.fromkeys(acc_in.amenity_ids):
            link = AccommodationAmenity(accommodation_id=accommodation.id, amenity_id=aid)
            db.add(link)

    await db.commit()

    # Re-fetch with relationships
    return await get_accommodation(accommodation.id, db, current_user=current_user)


@router.put("/{id}", response_model=AccommodationDetail)
async def update_accommodation(
    id: int,
    acc_in: AccommodationUpdate,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> AccommodationDetail:
    stmt = select(Accommodation).where(Accommodation.id == id)
    res = await db.execute(stmt)
    acc = res.scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this accommodation",
        )

    if acc_in.city_id is not None:
        city_exists = (
            await db.execute(select(City.id).where(City.id == acc_in.city_id))
        ).scalar_one_or_none()
        if not city_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"City ID {acc_in.city_id} does not exist",
            )

    if acc_in.category_id is not None:
        cat_exists = (
            await db.execute(select(Category.id).where(Category.id == acc_in.category_id))
        ).scalar_one_or_none()
        if not cat_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category ID {acc_in.category_id} does not exist",
            )

    new_capacity = acc_in.capacity if acc_in.capacity is not None else acc.capacity
    new_max_capacity = acc_in.max_capacity if acc_in.max_capacity is not None else acc.max_capacity

    if new_max_capacity < new_capacity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"max_capacity ({new_max_capacity}) must be greater than or equal to base capacity ({new_capacity})",
        )

    if acc_in.amenity_ids is not None:
        unique_amenity_ids = list(dict.fromkeys(acc_in.amenity_ids))
        if unique_amenity_ids:
            existing_amenities = (
                (await db.execute(select(Amenity.id).where(Amenity.id.in_(unique_amenity_ids))))
                .scalars()
                .all()
            )
            missing = set(unique_amenity_ids) - set(existing_amenities)
            if missing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Amenity IDs not found: {sorted(list(missing))}",
                )
        await db.execute(
            delete(AccommodationAmenity).where(AccommodationAmenity.accommodation_id == id)
        )
        for aid in unique_amenity_ids:
            db.add(AccommodationAmenity(accommodation_id=id, amenity_id=aid))

    update_data = acc_in.model_dump(exclude_unset=True)
    update_data.pop("amenity_ids", None)
    if update_data.get("external_calendar_url"):
        validate_external_feed_url(
            update_data["external_calendar_url"], resolve=False
        )
    for field, value in update_data.items():
        setattr(acc, field, value)

    await db.commit()
    db.expire(acc)  # Invalidate accommodation to reload fresh amenities in get_accommodation
    return await get_accommodation(id, db, current_user=current_user)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_accommodation(
    id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> None:
    stmt = select(Accommodation).where(Accommodation.id == id)
    res = await db.execute(stmt)
    acc = res.scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this accommodation",
        )

    # Soft delete / deactivate
    acc.is_active = False
    await db.commit()


@router.post(
    "/{id}/images", response_model=AccommodationImageResponse, status_code=status.HTTP_201_CREATED
)
async def add_accommodation_image(
    id: int,
    img_in: AccommodationImageCreate,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> AccommodationImageResponse:
    acc = (await db.execute(select(Accommodation).where(Accommodation.id == id))).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this accommodation",
        )

    if img_in.is_cover:
        # Reset other covers
        reset_stmt = select(AccommodationImage).where(
            AccommodationImage.accommodation_id == id, AccommodationImage.is_cover.is_(True)
        )
        existing_covers = (await db.execute(reset_stmt)).scalars().all()
        for c in existing_covers:
            c.is_cover = False

    image = AccommodationImage(
        accommodation_id=id,
        image_url=img_in.image_url,
        is_cover=img_in.is_cover,
        sort_order=img_in.sort_order,
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)
    return AccommodationImageResponse.model_validate(image)


@router.delete("/{id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_accommodation_image(
    id: int,
    image_id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> None:
    acc = (await db.execute(select(Accommodation).where(Accommodation.id == id))).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this accommodation",
        )

    stmt = select(AccommodationImage).where(
        AccommodationImage.id == image_id,
        AccommodationImage.accommodation_id == id,
    )
    image = (await db.execute(stmt)).scalars().first()
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Accommodation image not found",
        )

    await db.delete(image)
    await db.commit()


@router.post("/{id}/pricing-exceptions", response_model=PricingExceptionResponse)
async def upsert_pricing_exception(
    id: int,
    ex_in: PricingExceptionCreate,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> PricingExceptionResponse:
    acc = (await db.execute(select(Accommodation).where(Accommodation.id == id))).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this accommodation",
        )

    # Check if exception exists for this date
    stmt = select(PricingException).where(
        PricingException.accommodation_id == id,
        PricingException.date == ex_in.date,
    )
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        existing.price = ex_in.price
        existing.manual_blocked = ex_in.is_blocked
        existing.is_blocked = existing.manual_blocked or existing.ical_blocked
        existing.min_nights = ex_in.min_nights
        exception_obj = existing
    else:
        exception_obj = PricingException(
            accommodation_id=id,
            date=ex_in.date,
            price=ex_in.price,
            is_blocked=ex_in.is_blocked,
            manual_blocked=ex_in.is_blocked,
            ical_blocked=False,
            min_nights=ex_in.min_nights,
        )
        db.add(exception_obj)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pricing exception for this date already exists or conflicts with concurrent update",
        )
    await db.refresh(exception_obj)
    return PricingExceptionResponse.model_validate(exception_obj)


@router.post("/{id}/pricing-exceptions/batch", response_model=PricingExceptionBatchResponse)
async def batch_pricing_exceptions(
    id: int,
    batch_in: PricingExceptionBatchCreate,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> PricingExceptionBatchResponse:
    acc = (await db.execute(select(Accommodation).where(Accommodation.id == id))).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this accommodation",
        )

    requested_count = (batch_in.end_date - batch_in.start_date).days + 1
    if requested_count > settings.CALENDAR_MAX_BLOCKED_DATES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The requested calendar mutation exceeds the maximum allowed size",
        )

    values = [
        {
            "accommodation_id": id,
            "date": batch_in.start_date + timedelta(days=i),
            "price": batch_in.price,
            "is_blocked": batch_in.is_blocked,
            "manual_blocked": batch_in.is_blocked,
            "ical_blocked": False,
            "min_nights": batch_in.min_nights,
        }
        for i in range(requested_count)
    ]

    insert_stmt = (
        pg_insert(PricingException)
        .values(values)
        .on_conflict_do_update(
            constraint="uq_pricing_exception_accommodation_date",
            set_={
                "price": batch_in.price,
                "manual_blocked": batch_in.is_blocked,
                # An iCal block is independent of the host's manual toggle: a
                # manual unblock must not make an upstream-blocked date bookable.
                "is_blocked": or_(batch_in.is_blocked, PricingException.ical_blocked),
                "min_nights": batch_in.min_nights,
            },
        )
    )
    try:
        await db.execute(insert_stmt)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Batch pricing exception conflicts with concurrent updates",
        )

    return PricingExceptionBatchResponse(
        updated_count=requested_count,
        start_date=batch_in.start_date,
        end_date=batch_in.end_date,
    )


@router.delete("/{id}/pricing-exceptions/{exception_date}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pricing_exception(
    id: int,
    exception_date: date,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> None:
    acc = (await db.execute(select(Accommodation).where(Accommodation.id == id))).scalars().first()
    if not acc:
        raise HTTPException(status_code=404, detail="Accommodation not found")

    if current_user.role != "admin" and acc.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this accommodation",
        )

    stmt = select(PricingException).where(
        PricingException.accommodation_id == id,
        PricingException.date == exception_date,
    )
    existing = (await db.execute(stmt)).scalars().first()
    if not existing:
        raise HTTPException(status_code=404, detail="Pricing exception for this date not found")

    await db.delete(existing)
    await db.commit()
