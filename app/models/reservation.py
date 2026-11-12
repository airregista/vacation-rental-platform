from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.accommodation import Accommodation
    from app.models.payment import HostPayout, Payment
    from app.models.review import Review
    from app.models.user import User


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        CheckConstraint("check_out > check_in", name="chk_reservation_dates"),
        CheckConstraint("guests_count > 0", name="chk_reservation_guests_count"),
        CheckConstraint("total_nights > 0", name="chk_reservation_total_nights"),
        CheckConstraint("total_price >= 0", name="chk_reservation_total_price"),
        CheckConstraint(
            "status IN ('pending', 'confirmed', 'cancelled', 'completed')",
            name="chk_reservation_status",
        ),
        CheckConstraint(
            "refund_amount IS NULL OR refund_amount >= 0",
            name="chk_reservation_refund_non_negative",
        ),
        CheckConstraint(
            "penalty_amount IS NULL OR penalty_amount >= 0",
            name="chk_reservation_penalty_non_negative",
        ),
        CheckConstraint(
            "coalesce(refund_amount, 0) + coalesce(penalty_amount, 0) <= total_price",
            name="chk_reservation_refund_penalty_total",
        ),
        CheckConstraint(
            "total_nights = (check_out - check_in)",
            name="chk_reservation_total_nights_matches_dates",
        ),
        Index("ix_reservations_overlap", "accommodation_id", "status", "check_in", "check_out"),
        Index("ix_reservations_user_created", "user_id", "created_at"),
        Index("ix_reservations_status_created", "status", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    accommodation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("accommodations.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    check_in: Mapped[date] = mapped_column(Date, nullable=False)
    check_out: Mapped[date] = mapped_column(Date, nullable=False)
    guests_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    total_nights: Mapped[int] = mapped_column(Integer, nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False)
    coupon_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), server_default="pending", index=True, nullable=False
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    refund_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 0), nullable=True)
    penalty_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 0), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="reservations")
    accommodation: Mapped["Accommodation"] = relationship(
        "Accommodation", back_populates="reservations"
    )
    payments: Mapped[list["Payment"]] = relationship(
        "Payment", back_populates="reservation", cascade="all, delete-orphan"
    )
    review: Mapped["Review"] = relationship("Review", back_populates="reservation", uselist=False)
    payout: Mapped["HostPayout | None"] = relationship(
        "HostPayout", back_populates="reservation", uselist=False
    )
    messages: Mapped[list["ReservationMessage"]] = relationship(
        "ReservationMessage",
        back_populates="reservation",
        cascade="all, delete-orphan",
        order_by="ReservationMessage.created_at.asc()",
    )


class ReservationMessage(Base):
    __tablename__ = "reservation_messages"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    reservation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("reservations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    sender_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    reservation: Mapped["Reservation"] = relationship("Reservation", back_populates="messages")
    sender: Mapped["User"] = relationship("User")

