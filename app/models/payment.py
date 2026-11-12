from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.reservation import Reservation
    from app.models.user import User


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_payment_amount"),
        CheckConstraint(
            "status IN ('pending', 'success', 'failed')",
            name="chk_payment_status",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    reservation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("reservations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False)
    tracking_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), server_default="pending", index=True, nullable=False
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    reservation: Mapped["Reservation"] = relationship("Reservation", back_populates="payments")


class HostPayout(Base):
    __tablename__ = "host_payouts"
    __table_args__ = (
        CheckConstraint("payout_amount >= 0", name="chk_payout_amount"),
        CheckConstraint("commission_amount >= 0", name="chk_payout_commission"),
        CheckConstraint("status IN ('pending', 'completed', 'cancelled')", name="chk_payout_status"),
        CheckConstraint(
            "total_booking_amount = commission_amount + payout_amount",
            name="chk_payout_arithmetic",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    reservation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("reservations.id", ondelete="RESTRICT"), unique=True, index=True, nullable=False
    )
    host_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    total_booking_amount: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False)
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False)
    payout_amount: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False)
    status: Mapped[str] = mapped_column(String(20), server_default="pending", index=True, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    reservation: Mapped["Reservation"] = relationship("Reservation", back_populates="payout")
    host: Mapped["User"] = relationship("User", back_populates="payouts")
