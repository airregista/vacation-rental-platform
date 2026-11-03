from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Identity,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Coupon(Base):
    __tablename__ = "coupons"
    __table_args__ = (
        CheckConstraint(
            "discount_type IN ('percentage', 'fixed')", name="chk_coupon_discount_type"
        ),
        CheckConstraint("discount_value > 0", name="chk_coupon_discount_value"),
        CheckConstraint("min_booking_amount >= 0", name="chk_coupon_min_booking_amount"),
    )

    # ponytail: surrogate integer ID; UUID/external slug can be added if public reference needed
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    discount_type: Mapped[str] = mapped_column(String(10), nullable=False)
    discount_value: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False)
    max_discount_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 0), nullable=True)
    min_booking_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 0), server_default="0", nullable=False
    )
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    usage_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    used_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
