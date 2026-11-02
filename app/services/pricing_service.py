from datetime import date, timedelta
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.accommodation import Accommodation, PricingException
from app.schemas.reservation import PriceBreakdownItem, PriceCalculationResponse


async def calculate_reservation_price(
    db: AsyncSession,
    accommodation: Accommodation,
    check_in: date,
    check_out: date,
    guests_count: int,
) -> PriceCalculationResponse:
    if check_out <= check_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Check-out date must be strictly after check-in date",
        )

    if guests_count > accommodation.max_capacity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Guests count ({guests_count}) exceeds maximum capacity ({accommodation.max_capacity})",
        )

    if guests_count < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Guests count must be at least 1",
        )

    # Fetch pricing exceptions in the date range
    stmt = (
        select(PricingException)
        .where(
            PricingException.accommodation_id == accommodation.id,
            PricingException.date >= check_in,
            PricingException.date < check_out,
        )
    )
    result = await db.execute(stmt)
    exceptions_by_date = {ex.date: ex for ex in result.scalars().all()}

    breakdown: list[PriceBreakdownItem] = []
    current_date = check_in
    nights_total = Decimal(0)
    total_nights = (check_out - check_in).days

    while current_date < check_out:
        exception = exceptions_by_date.get(current_date)
        if exception and exception.is_blocked:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Accommodation is blocked and unavailable on date: {current_date}",
            )

        if exception and exception.price is not None:
            day_price = Decimal(exception.price)
            is_ex = True
        else:
            day_price = Decimal(accommodation.base_price)
            is_ex = False

        nights_total += day_price
        breakdown.append(
            PriceBreakdownItem(
                date=current_date,
                price=day_price,
                is_exception=is_ex,
            )
        )
        current_date += timedelta(days=1)

    # Calculate extra guest fee
    extra_guests = max(0, guests_count - accommodation.capacity)
    extra_guest_total = Decimal(extra_guests) * Decimal(accommodation.extra_guest_fee) * Decimal(total_nights)
    cleaning_fee = Decimal(accommodation.cleaning_fee)
    total_price = nights_total + extra_guest_total + cleaning_fee

    return PriceCalculationResponse(
        total_nights=total_nights,
        nights_total=nights_total,
        extra_guest_total=extra_guest_total,
        cleaning_fee=cleaning_fee,
        total_price=total_price,
        breakdown=breakdown,
    )
