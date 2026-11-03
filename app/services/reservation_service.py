from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.reservation import Reservation


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


async def expire_stale_pending_reservations(db: AsyncSession, ttl_minutes: int = 30) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=ttl_minutes)
    stmt = (
        select(Reservation)
        .options(selectinload(Reservation.payments))
        .where(Reservation.status == "pending", Reservation.created_at < cutoff)
        .with_for_update(skip_locked=True)
    )
    res = await db.execute(stmt)
    stale = res.scalars().all()
    for r in stale:
        r.status = "cancelled"
        r.cancellation_reason = "Payment session expired (TTL timeout)"
        r.cancelled_at = datetime.now(timezone.utc)
        for p in r.payments:
            if p.status == "pending":
                p.status = "failed"
    await db.commit()
    return len(stale)
