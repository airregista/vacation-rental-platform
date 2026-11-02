from sqlalchemy import BigInteger, ForeignKey, Identity, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Amenity(Base):
    __tablename__ = "amenities"

    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)


class AccommodationAmenity(Base):
    __tablename__ = "accommodation_amenities"

    accommodation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("accommodations.id", ondelete="CASCADE"), primary_key=True
    )
    amenity_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("amenities.id", ondelete="CASCADE"), primary_key=True, index=True
    )
