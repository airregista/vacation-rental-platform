from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class PaymentInitiateRequest(BaseModel):
    reservation_id: int


class PaymentInitiateResponse(BaseModel):
    payment_id: int
    reservation_id: int
    amount: Decimal
    tracking_code: str
    gateway_url: str


class PaymentVerifyRequest(BaseModel):
    payment_id: int
    tracking_code: str
    simulate_success: bool = True


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reservation_id: int
    amount: Decimal
    tracking_code: str | None = None
    status: str
    paid_at: datetime | None = None
    created_at: datetime
