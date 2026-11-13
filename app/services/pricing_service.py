from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accommodation import Accommodation, PricingException
from app.schemas.reservation import PriceBreakdownItem, PriceCalculationResponse
from app.services.coupon_service import evaluate_coupon, get_coupon_by_code, normalize_code


async def calculate_reservation_price(
    db: AsyncSession,
    accommodation: Accommodation,
    check_in: date,
    check_out: date,
    guests_count: int,
    coupon_code: str | None = None,
) -> PriceCalculationResponse:
    from app.services.reservation_service import validate_reservation_horizon

    validate_reservation_horizon(check_in, check_out)

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
    stmt = select(PricingException).where(
        PricingException.accommodation_id == accommodation.id,
        PricingException.date >= check_in,
        PricingException.date < check_out,
    )
    result = await db.execute(stmt)
    exceptions_by_date = {ex.date: ex for ex in result.scalars().all()}

    breakdown: list[PriceBreakdownItem] = []
    current_date = check_in
    nights_total = Decimal(0)
    total_nights = (check_out - check_in).days

    required_min_nights = max(
        [getattr(accommodation, "min_nights", 1)]
        + [ex.min_nights for ex in exceptions_by_date.values() if ex.min_nights is not None]
    )
    if total_nights < required_min_nights:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Booking duration ({total_nights} nights) is less than the required minimum stay of {required_min_nights} nights",
        )

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
    extra_guest_total = (
        Decimal(extra_guests) * Decimal(accommodation.extra_guest_fee) * Decimal(total_nights)
    )

    subtotal = nights_total + extra_guest_total
    discount_amount = Decimal(0)
    applied_coupon_code: str | None = None

    if coupon_code and coupon_code.strip():
        coupon = await get_coupon_by_code(db, coupon_code)
        evaluation = evaluate_coupon(coupon, subtotal)
        if not evaluation.is_valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=evaluation.message)
        discount_amount = evaluation.discount_amount
        applied_coupon_code = normalize_code(coupon_code)

    cleaning_fee = Decimal(accommodation.cleaning_fee)
    total_price = max(Decimal(0), subtotal + cleaning_fee - discount_amount)

    return PriceCalculationResponse(
        total_nights=total_nights,
        nights_total=nights_total,
        extra_guests_count=extra_guests,
        extra_guest_fee_per_night=Decimal(accommodation.extra_guest_fee),
        extra_guest_total=extra_guest_total,
        cleaning_fee=cleaning_fee,
        discount_amount=discount_amount,
        coupon_code=applied_coupon_code,
        total_price=total_price,
        cancellation_policy=getattr(accommodation, "cancellation_policy", "flexible"),
        breakdown=breakdown,
    )
