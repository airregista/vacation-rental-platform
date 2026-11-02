# ponytail: simple tiered cancellation math; upgrade to pluggable policy engine if dynamic rules are needed
from datetime import datetime, time, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo
from app.models.accommodation import Accommodation
from app.models.reservation import Reservation

TEHRAN_TZ = ZoneInfo("Asia/Tehran")


def calculate_cancellation_refund(
    reservation: Reservation,
    accommodation: Accommodation,
    cancel_time: datetime | None = None,
) -> tuple[Decimal, Decimal, float]:
    """
    Returns (refundable_amount, penalty_amount, hours_to_checkin).
    Timezone-safe: combines reservation.check_in (date) and accommodation.check_in_time (time)
    in Asia/Tehran local time before converting to UTC and subtracting cancel_time.
    """
    if cancel_time is None:
        cancel_time = datetime.now(timezone.utc)
    elif cancel_time.tzinfo is None:
        cancel_time = cancel_time.replace(tzinfo=timezone.utc)

    # Timezone-aware check-in datetime
    check_time = getattr(accommodation, "check_in_time", None) or time(14, 0)
    local_checkin_dt = datetime.combine(
        reservation.check_in, check_time, tzinfo=TEHRAN_TZ
    )
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
            # Retain 1st night base price + cleaning fee as penalty, refund the rest
            first_night_penalty = Decimal(accommodation.base_price) + Decimal(
                accommodation.cleaning_fee
            )
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

    else:
        refundable = total
        penalty = Decimal(0)

    return refundable, penalty, round(hours_to_checkin, 1)
