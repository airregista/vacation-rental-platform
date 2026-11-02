from typing import TYPE_CHECKING
from sqlalchemy import Identity, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.accommodation import Accommodation


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    title: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    icon_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    accommodations: Mapped[list["Accommodation"]] = relationship(
        "Accommodation", back_populates="category"
    )
