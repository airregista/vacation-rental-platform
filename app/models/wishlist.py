from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.accommodation import Accommodation
    from app.models.user import User


class Wishlist(Base):
    __tablename__ = "wishlists"

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    accommodation_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("accommodations.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="wishlists")
    accommodation: Mapped["Accommodation"] = relationship("Accommodation")
