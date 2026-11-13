# ponytail: simple tiered cancellation math; upgrade to pluggable policy engine if dynamic rules are needed
from datetime import datetime, time, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import TEHRAN_TZ
from app.models.accommodation import Accommodation, PricingException
from app.models.reservation import Reservation


async def get_first_night_price(
    db: AsyncSession,
    reservation: Reservation,
    accommodation: Accommodation,
) -> Decimal:
    """Return the actual price of the first night, honouring calendar exceptions.

    A date with a custom nightly rate must use that rate for the flexible
    late-cancellation penalty; falling back to ``base_price`` would under- or
    over-charge guests whenever per-day pricing is in effect.
    """
    stmt = select(PricingException.price).where(
        PricingException.accommodation_id == accommodation.id,
        PricingException.date == reservation.check_in,
        PricingException.price.is_not(None),
    )
    exception_price = (await db.execute(stmt)).scalars().first()
    if exception_price is not None:
        return Decimal(exception_price)
    return Decimal(accommodation.base_price)


def calculate_cancellation_refund(
    reservation: Reservation,
    accommodation: Accommodation,
    cancel_time: datetime | None = None,
    first_night_price: Decimal | None = None,
) -> tuple[Decimal, Decimal, float]:
    """
    Returns (refundable_amount, penalty_amount, hours_to_checkin).
    Timezone-safe: combines reservation.check_in (date) and accommodation.check_in_time (time)
    in Asia/Tehran local time before converting to UTC and subtracting cancel_time.

    ``first_night_price`` is the actual first-night rate resolved by the caller
    (calendar exceptions included); it falls back to ``base_price``.
    """
    if cancel_time is None:
        cancel_time = datetime.now(timezone.utc)
    elif cancel_time.tzinfo is None:
        cancel_time = cancel_time.replace(tzinfo=timezone.utc)

    # Timezone-aware check-in datetime
    check_time = getattr(accommodation, "check_in_time", None) or time(14, 0)
    local_checkin_dt = datetime.combine(reservation.check_in, check_time, tzinfo=TEHRAN_TZ)
    checkin_dt = local_checkin_dt.astimezone(timezone.utc)

    hours_to_checkin = (checkin_dt - cancel_time).total_seconds() / 3600.0

    if reservation.status != "confirmed":
        # Unpaid or non-confirmed bookings have no payment to refund
        return Decimal(0), Decimal(0), round(hours_to_checkin, 1)

    total = Decimal(reservation.total_price)

    if hours_to_checkin <= 0:
        # Check-in time has arrived or passed; no pre-stay cancellation refund
        return Decimal(0), total, round(hours_to_checkin, 1)

    policy = getattr(accommodation, "cancellation_policy", "flexible")

    if policy == "flexible":
        if hours_to_checkin >= 24:
            refundable = total
            penalty = Decimal(0)
        else:
            # Retain the actual 1st-night rate + cleaning fee as penalty, refund the rest
            first_night = (
                Decimal(first_night_price)
                if first_night_price is not None
                else Decimal(accommodation.base_price)
            )
            first_night_penalty = first_night + Decimal(accommodation.cleaning_fee)
            penalty = min(total, first_night_penalty)
            refundable = max(Decimal(0), total - penalty)

    elif policy == "moderate":
        if hours_to_checkin >= 120:  # 5 days
            refundable = total
            penalty = Decimal(0)
        else:
            penalty = (total * Decimal("0.5")).quantize(Decimal("1"))
            refundable = total - penalty

    elif policy == "strict":
        if hours_to_checkin >= 336:  # 14 days
            refundable = total
            penalty = Decimal(0)
        elif hours_to_checkin >= 168:  # 7 days
            penalty = (total * Decimal("0.5")).quantize(Decimal("1"))
            refundable = total - penalty
        else:
            penalty = total
            refundable = Decimal(0)

    elif policy == "custom":
        free_hours = int(getattr(accommodation, "cancellation_free_hours", 24) or 0)
        penalty_percent = Decimal(
            getattr(accommodation, "cancellation_penalty_percent", 50) or 0
        )
        if hours_to_checkin >= free_hours:
            refundable = total
            penalty = Decimal(0)
        else:
            penalty = (total * penalty_percent / Decimal(100)).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
            penalty = min(total, max(Decimal(0), penalty))
            refundable = total - penalty

    else:
        refundable = total
        penalty = Decimal(0)

    return refundable, penalty, round(hours_to_checkin, 1)
