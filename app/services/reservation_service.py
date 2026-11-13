from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.payment import Payment
from app.models.reservation import Reservation
from app.services.coupon_service import lock_coupon_by_code

TEHRAN_TZ = ZoneInfo("Asia/Tehran")


def validate_reservation_horizon(check_in: date, check_out: date) -> None:
    """Reject reservation dates extending beyond the configured booking horizon.

    Horizon is calculated as today + (RESERVATION_MAX_CHECKIN_MONTHS * 30 days) in Asia/Tehran.
    Both check_in and check_out must not exceed this boundary.
    """
    today = datetime.now(TEHRAN_TZ).date()
    horizon_days = settings.RESERVATION_MAX_CHECKIN_MONTHS * 30
    horizon = today + timedelta(days=horizon_days)

    if check_in > horizon:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Check-in date exceeds the maximum booking horizon ({horizon_days} days ahead)",
        )
    if check_out > horizon:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Check-out date exceeds the maximum booking horizon ({horizon_days} days ahead)",
        )


async def check_booking_overlap(
    db: AsyncSession,
    accommodation_id: int,
    check_in: date,
    check_out: date,
    exclude_reservation_id: int | None = None,
) -> bool:
    """
    Returns True if an overlapping confirmed reservation exists, False otherwise.
    Overlap condition: (existing.check_in < new.check_out) AND (existing.check_out > new.check_in)
    """
    stmt = select(Reservation).where(
        Reservation.accommodation_id == accommodation_id,
        Reservation.status == "confirmed",
        Reservation.check_in < check_out,
        Reservation.check_out > check_in,
    )
    if exclude_reservation_id:
        stmt = stmt.where(Reservation.id != exclude_reservation_id)

    result = await db.execute(stmt)
    overlapping = result.scalars().first()
    return overlapping is not None


async def _cancel_reservation_record(
    db: AsyncSession,
    reservation: Reservation,
    reason: str = "Payment session expired (TTL timeout)",
) -> None:
    reservation.status = "cancelled"
    reservation.cancellation_reason = reason
    reservation.cancelled_at = datetime.now(timezone.utc)

    await db.execute(
        update(Payment)
        .where(Payment.reservation_id == reservation.id, Payment.status == "pending")
        .values(status="failed")
    )

    if reservation.coupon_code:
        coupon_obj = await lock_coupon_by_code(db, reservation.coupon_code)
        if coupon_obj and coupon_obj.used_count > 0:
            coupon_obj.used_count -= 1


async def check_and_expire_reservation(
    db: AsyncSession,
    reservation: Reservation,
    ttl_minutes: int = 30,
    commit: bool = True,
) -> bool:
    res_created = reservation.created_at
    if res_created.tzinfo is None:
        res_created = res_created.replace(tzinfo=timezone.utc)

    if reservation.status != "pending" or res_created >= datetime.now(timezone.utc) - timedelta(
        minutes=ttl_minutes
    ):
        return False

    await _cancel_reservation_record(db, reservation)

    if commit:
        await db.commit()
    return True


async def expire_stale_pending_reservations(db: AsyncSession, ttl_minutes: int = 30) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=ttl_minutes)
    stmt = (
        select(Reservation)
        .where(Reservation.status == "pending", Reservation.created_at < cutoff)
        .with_for_update(skip_locked=True)
    )
    res = await db.execute(stmt)
    stale = res.scalars().all()
    for r in stale:
        await _cancel_reservation_record(db, r)
    await db.commit()
    return len(stale)
