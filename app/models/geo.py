from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Identity, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.accommodation import Accommodation


class Province(Base):
    __tablename__ = "provinces"

    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    cities: Mapped[list["City"]] = relationship(
        "City", back_populates="province", cascade="all, delete-orphan"
    )


class City(Base):
    __tablename__ = "cities"
    __table_args__ = (
        UniqueConstraint("province_id", "name", name="uq_city_province_name"),
    )

    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    province_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("provinces.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    province: Mapped["Province"] = relationship("Province", back_populates="cities")
    accommodations: Mapped[list["Accommodation"]] = relationship(
        "Accommodation", back_populates="city"
    )
