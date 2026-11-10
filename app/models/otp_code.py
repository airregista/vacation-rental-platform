from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class OTPCode(Base):
    """One-time password code issued for phone login.

    Stored in PostgreSQL (not in-process memory) so an OTP sent by one
    worker/process can be verified by another, and survives restarts.
    ``phone`` is the primary key: a phone has at most one live code.
    """

    __tablename__ = "otp_codes"

    phone: Mapped[str] = mapped_column(String(15), primary_key=True, nullable=False)
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
