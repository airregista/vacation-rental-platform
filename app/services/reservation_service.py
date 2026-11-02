from datetime import date
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    stmt = (
        select(Reservation)
        .where(
            Reservation.accommodation_id == accommodation_id,
            Reservation.status == "confirmed",
            Reservation.check_in < check_out,
            Reservation.check_out > check_in,
        )
    )
    if exclude_reservation_id:
        stmt = stmt.where(Reservation.id != exclude_reservation_id)

    result = await db.execute(stmt)
    overlapping = result.scalars().first()
    return overlapping is not None
