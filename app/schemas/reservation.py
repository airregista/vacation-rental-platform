from datetime import date, datetime
from decimal import Decimal
from typing import Self
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class BaseReservationRequest(BaseModel):
    accommodation_id: int
    check_in: date
    check_out: date
    guests_count: int = Field(default=1, gt=0)
    coupon_code: str | None = None

    @model_validator(mode="after")
    def validate_reservation_dates(self) -> Self:
        iran_today = datetime.now(ZoneInfo("Asia/Tehran")).date()
        if self.check_in < iran_today:
            raise ValueError("Check-in date cannot be in the past")
        if self.check_out <= self.check_in:
            raise ValueError("Check-out date must be strictly after check-in date")
        return self


class PriceCalculationRequest(BaseReservationRequest):
    pass


class PriceBreakdownItem(BaseModel):
    date: date
    price: Decimal
    is_exception: bool


class PriceCalculationResponse(BaseModel):
    total_nights: int
    nights_total: Decimal
    extra_guests_count: int = 0
    extra_guest_fee_per_night: Decimal = Decimal(0)
    extra_guest_total: Decimal
    cleaning_fee: Decimal
    discount_amount: Decimal = Decimal(0)
    coupon_code: str | None = None
    total_price: Decimal
    cancellation_policy: str = "flexible"
    breakdown: list[PriceBreakdownItem]


class ReservationCreate(BaseReservationRequest):
    pass


class ReservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    accommodation_id: int
    check_in: date
    check_out: date
    guests_count: int
    total_nights: int
    total_price: Decimal
    coupon_code: str | None = None
    status: str
    cancelled_at: datetime | None = None
    cancellation_reason: str | None = None
    refund_amount: Decimal | None = None
    penalty_amount: Decimal | None = None
    created_at: datetime
    updated_at: datetime
    accommodation_title: str | None = None


class CalendarDayInfo(BaseModel):
    date: date
    price: Decimal
    is_available: bool
    is_exception: bool
    min_nights: int | None = None


class CancellationResponse(BaseModel):
    reservation_id: int
    status: str
    refund_amount: Decimal
    penalty_amount: Decimal
    message: str


class CancellationPreviewResponse(BaseModel):
    reservation_id: int
    cancellation_policy: str
    hours_to_checkin: float
    total_price: Decimal
    refundable_amount: Decimal
    penalty_amount: Decimal


class CancellationRequest(BaseModel):
    reason: str | None = None


class ReservationMessageCreate(BaseModel):
    message: str = Field(min_length=1, max_length=2000)

    @field_validator("message")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Message cannot be empty or whitespace only")
        return clean


class ReservationMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reservation_id: int
    sender_id: int
    sender_name: str | None = None
    message: str
    read_at: datetime | None = None
    created_at: datetime

