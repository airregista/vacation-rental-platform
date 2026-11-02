from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import BigInteger, DateTime, Identity, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.reservation import Reservation
    from app.models.review import Review
    from app.models.wishlist import Wishlist


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    phone: Mapped[str] = mapped_column(String(15), unique=True, index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(100), unique=True, index=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="guest", nullable=False)  # "admin" or "guest"
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    reservations: Mapped[list["Reservation"]] = relationship("Reservation", back_populates="user")
    reviews: Mapped[list["Review"]] = relationship("Review", back_populates="user")
    wishlists: Mapped[list["Wishlist"]] = relationship("Wishlist", back_populates="user")
