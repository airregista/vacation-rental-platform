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
    Integer,
    Numeric,
    SmallInteger,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.accommodation import Accommodation
    from app.models.payment import Payment
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
    status: Mapped[str] = mapped_column(String(20), server_default="pending", index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="reservations")
    accommodation: Mapped["Accommodation"] = relationship("Accommodation", back_populates="reservations")
    payments: Mapped[list["Payment"]] = relationship(
        "Payment", back_populates="reservation", cascade="all, delete-orphan"
    )
    review: Mapped["Review"] = relationship("Review", back_populates="reservation", uselist=False)
