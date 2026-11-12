from datetime import date, datetime, time
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Computed,
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
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.amenity import Amenity
    from app.models.category import Category
    from app.models.geo import City
    from app.models.reservation import Reservation
    from app.models.review import Review
    from app.models.user import User


class Accommodation(Base):
    __tablename__ = "accommodations"
    __table_args__ = (
        CheckConstraint("base_price >= 0", name="chk_accommodation_base_price"),
        CheckConstraint("cleaning_fee >= 0", name="chk_accommodation_cleaning_fee"),
        CheckConstraint("extra_guest_fee >= 0", name="chk_accommodation_extra_guest_fee"),
        CheckConstraint("capacity > 0", name="chk_accommodation_capacity"),
        CheckConstraint("max_capacity >= capacity", name="chk_accommodation_max_capacity"),
        CheckConstraint("min_nights >= 1", name="chk_accommodation_min_nights"),
        CheckConstraint(
            "cancellation_policy IN ('flexible', 'moderate', 'strict', 'custom')",
            name="chk_accommodation_cancellation_policy",
        ),
        CheckConstraint(
            "cancellation_free_hours >= 0",
            name="chk_accommodation_cancellation_free_hours",
        ),
        CheckConstraint(
            "cancellation_penalty_percent >= 0 AND cancellation_penalty_percent <= 100",
            name="chk_accommodation_cancellation_penalty_percent",
        ),
        CheckConstraint(
            "latitude IS NULL OR (latitude >= -90 AND latitude <= 90)",
            name="chk_accommodation_latitude",
        ),
        CheckConstraint(
            "longitude IS NULL OR (longitude >= -180 AND longitude <= 180)",
            name="chk_accommodation_longitude",
        ),
        CheckConstraint("rooms_count >= 0", name="chk_accommodation_rooms_count"),
        CheckConstraint("beds_count >= 0", name="chk_accommodation_beds_count"),
        Index("ix_accommodations_active_created", "is_active", "created_at"),
        Index("ix_accommodations_active_city_price", "is_active", "city_id", "base_price"),
        Index("ix_accommodations_lat_lng", "latitude", "longitude"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    host_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    city_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cities.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    base_price: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False)
    cleaning_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 0), server_default="0", nullable=False
    )
    capacity: Mapped[int] = mapped_column(SmallInteger, server_default="2", nullable=False)
    max_capacity: Mapped[int] = mapped_column(SmallInteger, server_default="4", nullable=False)
    extra_guest_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 0), server_default="0", nullable=False
    )
    rooms_count: Mapped[int] = mapped_column(SmallInteger, server_default="1", nullable=False)
    beds_count: Mapped[int] = mapped_column(SmallInteger, server_default="1", nullable=False)
    min_nights: Mapped[int] = mapped_column(SmallInteger, server_default="1", nullable=False)
    check_in_time: Mapped[time] = mapped_column(Time, server_default="14:00", nullable=False)
    check_out_time: Mapped[time] = mapped_column(Time, server_default="12:00", nullable=False)
    rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom_amenities: Mapped[list[str]] = mapped_column(
        JSONB, default=list, server_default=text("'[]'::jsonb"), nullable=False
    )
    cancellation_policy: Mapped[str] = mapped_column(
        String(20), server_default="flexible", nullable=False
    )
    # Only used by the ``custom`` policy: free-cancellation window in hours
    # and the percentage of the total withheld after that window.
    cancellation_free_hours: Mapped[int] = mapped_column(
        Integer, server_default="24", nullable=False
    )
    cancellation_penalty_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), server_default="50", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    external_calendar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_calendar_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    calendar_feed_token_version: Mapped[int] = mapped_column(
        Integer, server_default="0", default=0, nullable=False
    )

    host: Mapped["User"] = relationship("User", back_populates="hosted_accommodations")
    category: Mapped["Category"] = relationship("Category", back_populates="accommodations")
    city: Mapped["City"] = relationship("City", back_populates="accommodations")
    images: Mapped[list["AccommodationImage"]] = relationship(
        "AccommodationImage",
        back_populates="accommodation",
        cascade="all, delete-orphan",
        order_by="AccommodationImage.sort_order",
    )
    amenities: Mapped[list["Amenity"]] = relationship(
        "Amenity", secondary="accommodation_amenities"
    )
    pricing_exceptions: Mapped[list["PricingException"]] = relationship(
        "PricingException", back_populates="accommodation", cascade="all, delete-orphan"
    )
    reservations: Mapped[list["Reservation"]] = relationship(
        "Reservation", back_populates="accommodation"
    )
    reviews: Mapped[list["Review"]] = relationship(
        "Review", back_populates="accommodation", cascade="all, delete-orphan"
    )


class AccommodationImage(Base):
    __tablename__ = "accommodation_images"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    accommodation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("accommodations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    image_url: Mapped[str] = mapped_column(String(255), nullable=False)
    is_cover: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    accommodation: Mapped["Accommodation"] = relationship("Accommodation", back_populates="images")


class PricingException(Base):
    __tablename__ = "pricing_exceptions"
    __table_args__ = (
        UniqueConstraint(
            "accommodation_id", "date", name="uq_pricing_exception_accommodation_date"
        ),
        CheckConstraint("price IS NULL OR price >= 0", name="chk_pricing_exception_price"),
        CheckConstraint(
            "min_nights IS NULL OR min_nights >= 1",
            name="chk_pricing_exception_min_nights",
        ),
        Index(
            "ix_pricing_exceptions_blocked",
            "accommodation_id",
            "date",
            postgresql_where=text("is_blocked = true"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    accommodation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("accommodations.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 0), nullable=True)
    is_blocked: Mapped[bool] = mapped_column(
        Boolean,
        Computed("manual_blocked OR ical_blocked", persisted=True),
        nullable=False,
    )
    manual_blocked: Mapped[bool] = mapped_column(
        Boolean, server_default="false", default=False, nullable=False
    )
    ical_blocked: Mapped[bool] = mapped_column(
        Boolean, server_default="false", default=False, nullable=False
    )
    min_nights: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    accommodation: Mapped["Accommodation"] = relationship(
        "Accommodation", back_populates="pricing_exceptions"
    )
