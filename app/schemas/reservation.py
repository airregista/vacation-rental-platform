from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class PriceCalculationRequest(BaseModel):
    accommodation_id: int
    check_in: date
    check_out: date
    guests_count: int = Field(default=1, gt=0)


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
    total_price: Decimal
    cancellation_policy: str = "flexible"
    breakdown: list[PriceBreakdownItem]


class ReservationCreate(BaseModel):
    accommodation_id: int
    check_in: date
    check_out: date
    guests_count: int = Field(default=1, gt=0)


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
    status: str
    created_at: datetime
    updated_at: datetime
    accommodation_title: str | None = None


class CalendarDayInfo(BaseModel):
    date: date
    price: Decimal
    is_available: bool
    is_exception: bool


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


