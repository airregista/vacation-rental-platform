from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.coupon import Coupon


@dataclass(frozen=True)
class CouponEvaluation:
    is_valid: bool
    message: str
    discount_amount: Decimal = Decimal(0)
    discount_type: str | None = None


def normalize_code(code: str) -> str:
    return code.strip().upper()


def calculate_discount(coupon: Coupon, booking_amount: Decimal) -> Decimal:
    if coupon.discount_type == "percentage":
        raw = (booking_amount * Decimal(coupon.discount_value)) / Decimal(100)
        if coupon.max_discount_amount is not None:
            raw = min(raw, Decimal(coupon.max_discount_amount))
    else:
        raw = min(booking_amount, Decimal(coupon.discount_value))
    return Decimal(round(raw))


async def get_coupon_by_code(db: AsyncSession, code: str) -> Coupon | None:
    stmt = select(Coupon).where(Coupon.code == normalize_code(code))
    return (await db.execute(stmt)).scalars().first()


def evaluate_coupon(
    coupon: Coupon | None,
    booking_amount: Decimal,
    now: datetime | None = None,
) -> CouponEvaluation:
    """Single source of truth for coupon validity and discount math."""
    now = now or datetime.now(timezone.utc)
    if not coupon or not coupon.is_active:
        return CouponEvaluation(False, "Invalid or inactive coupon code")
    if now < coupon.valid_from:
        return CouponEvaluation(False, "Coupon is not yet active")
    if now > coupon.valid_until:
        return CouponEvaluation(False, "Coupon has expired")
    if booking_amount < coupon.min_booking_amount:
        return CouponEvaluation(
            False, f"Minimum booking amount is {coupon.min_booking_amount}"
        )
    if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
        return CouponEvaluation(False, "Coupon usage limit reached")

    return CouponEvaluation(
        True,
        "Coupon applied successfully",
        calculate_discount(coupon, booking_amount),
        coupon.discount_type,
    )
