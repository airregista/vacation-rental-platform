import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import AsyncSessionLocal
from app.models.accommodation import Accommodation
from app.models.category import Category
from app.models.coupon import Coupon
from app.models.geo import City
from app.models.payment import HostPayout
from app.models.reservation import Reservation
from app.models.user import User

ADMIN_PHONE = "09120000000"


def _unique_phone() -> str:
    return f"0912{uuid.uuid4().int % 10000000:07d}"


async def _admin_id(session) -> int:
    return (await session.execute(select(User.id).where(User.phone == ADMIN_PHONE))).scalar_one()


async def _accommodation_values(session) -> dict:
    category_id = (
        await session.execute(select(Category.id).order_by(Category.id).limit(1))
    ).scalar_one()
    city_id = (await session.execute(select(City.id).order_by(City.id).limit(1))).scalar_one()
    return {
        "host_id": await _admin_id(session),
        "category_id": category_id,
        "city_id": city_id,
        "title": f"Integrity test {uuid.uuid4().hex[:8]}",
        "address": "Integrity test address",
        "latitude": Decimal("35.7000000"),
        "longitude": Decimal("51.4000000"),
        "base_price": Decimal("1000000"),
        "capacity": 2,
        "max_capacity": 2,
        "rooms_count": 1,
        "beds_count": 1,
    }


async def _create_accommodation(session) -> Accommodation:
    accommodation = Accommodation(**await _accommodation_values(session))
    session.add(accommodation)
    await session.commit()
    return accommodation


def _reservation(
    *,
    user_id: int,
    accommodation_id: int,
    check_in: date,
    nights: int = 2,
    total_nights: int | None = None,
    total_price: Decimal = Decimal("1000000"),
    status: str = "pending",
) -> Reservation:
    return Reservation(
        user_id=user_id,
        accommodation_id=accommodation_id,
        check_in=check_in,
        check_out=check_in + timedelta(days=nights),
        guests_count=1,
        total_nights=nights if total_nights is None else total_nights,
        total_price=total_price,
        status=status,
    )


@pytest.mark.asyncio
async def test_confirmed_reservations_cannot_overlap():
    async with AsyncSessionLocal() as session:
        admin_id = await _admin_id(session)
        accommodation = await _create_accommodation(session)

        session.add(
            _reservation(
                user_id=admin_id,
                accommodation_id=accommodation.id,
                check_in=date(2030, 1, 10),
                status="confirmed",
            )
        )
        await session.commit()

        session.add(
            _reservation(
                user_id=admin_id,
                accommodation_id=accommodation.id,
                check_in=date(2030, 1, 11),
                status="confirmed",
            )
        )
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        assert "ex_reservations_no_overlap" in str(exc_info.value)
        await session.rollback()


@pytest.mark.asyncio
async def test_reservation_total_nights_must_match_dates():
    async with AsyncSessionLocal() as session:
        admin_id = await _admin_id(session)
        accommodation = await _create_accommodation(session)

        session.add(
            _reservation(
                user_id=admin_id,
                accommodation_id=accommodation.id,
                check_in=date(2030, 2, 1),
                nights=3,
                total_nights=2,
            )
        )
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        assert "chk_reservation_total_nights_matches_dates" in str(exc_info.value)
        await session.rollback()


@pytest.mark.asyncio
async def test_reservation_refund_cannot_be_negative():
    async with AsyncSessionLocal() as session:
        admin_id = await _admin_id(session)
        accommodation = await _create_accommodation(session)
        reservation = _reservation(
            user_id=admin_id,
            accommodation_id=accommodation.id,
            check_in=date(2030, 3, 1),
        )
        session.add(reservation)
        await session.commit()

        reservation.refund_amount = Decimal("-1")
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        assert "chk_reservation_refund_non_negative" in str(exc_info.value)
        await session.rollback()


@pytest.mark.asyncio
async def test_reservation_refund_plus_penalty_cannot_exceed_total_price():
    async with AsyncSessionLocal() as session:
        admin_id = await _admin_id(session)
        accommodation = await _create_accommodation(session)
        reservation = _reservation(
            user_id=admin_id,
            accommodation_id=accommodation.id,
            check_in=date(2030, 4, 1),
            total_price=Decimal("1000"),
        )
        session.add(reservation)
        await session.commit()

        reservation.refund_amount = Decimal("1000")
        reservation.penalty_amount = Decimal("1")
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        assert "chk_reservation_refund_penalty_total" in str(exc_info.value)
        await session.rollback()


@pytest.mark.asyncio
async def test_user_role_must_be_known():
    async with AsyncSessionLocal() as session:
        session.add(
            User(
                phone=_unique_phone(),
                password_hash="not-a-real-hash",
                role="owner",
            )
        )
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        assert "chk_users_role" in str(exc_info.value)
        await session.rollback()


@pytest.mark.asyncio
async def test_user_phone_format_is_enforced():
    async with AsyncSessionLocal() as session:
        session.add(
            User(
                phone="12345",
                password_hash="not-a-real-hash",
                role="guest",
            )
        )
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        assert "chk_users_phone_format" in str(exc_info.value)
        await session.rollback()


@pytest.mark.asyncio
async def test_user_shaba_format_is_enforced():
    async with AsyncSessionLocal() as session:
        user = (await session.execute(select(User).where(User.phone == ADMIN_PHONE))).scalar_one()

        user.shaba_number = "IR123"
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        assert "chk_users_shaba_format" in str(exc_info.value)
        await session.rollback()


@pytest.mark.asyncio
async def test_coupon_validity_range_is_enforced():
    async with AsyncSessionLocal() as session:
        now = datetime.now(timezone.utc)
        session.add(
            Coupon(
                code=f"INTEG{uuid.uuid4().hex[:8].upper()}",
                discount_type="fixed",
                discount_value=Decimal("1000"),
                valid_from=now,
                valid_until=now,
            )
        )
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        assert "chk_coupon_validity_range" in str(exc_info.value)
        await session.rollback()


@pytest.mark.asyncio
async def test_payout_arithmetic_is_enforced():
    async with AsyncSessionLocal() as session:
        admin_id = await _admin_id(session)
        accommodation = await _create_accommodation(session)
        reservation = _reservation(
            user_id=admin_id,
            accommodation_id=accommodation.id,
            check_in=date(2030, 5, 1),
            total_price=Decimal("1000000"),
        )
        session.add(reservation)
        await session.commit()

        session.add(
            HostPayout(
                reservation_id=reservation.id,
                host_id=admin_id,
                total_booking_amount=Decimal("1000000"),
                commission_amount=Decimal("100000"),
                payout_amount=Decimal("800000"),
            )
        )
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        assert "chk_payout_arithmetic" in str(exc_info.value)
        await session.rollback()


@pytest.mark.asyncio
async def test_accommodation_latitude_range_is_enforced():
    async with AsyncSessionLocal() as session:
        values = await _accommodation_values(session)
        values["latitude"] = Decimal("91.0000000")
        session.add(Accommodation(**values))
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        assert "chk_accommodation_latitude" in str(exc_info.value)
        await session.rollback()


@pytest.mark.asyncio
async def test_user_email_must_be_lowercase():
    async with AsyncSessionLocal() as session:
        user = (await session.execute(select(User).where(User.phone == ADMIN_PHONE))).scalar_one()

        user.email = "Mixed@Example.com"
        with pytest.raises(IntegrityError) as exc_info:
            await session.commit()
        assert "chk_users_email_lowercase" in str(exc_info.value)
        await session.rollback()
