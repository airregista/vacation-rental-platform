from datetime import datetime
from decimal import Decimal
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CouponValidateRequest(BaseModel):
    code: str = Field(min_length=3, max_length=30)
    booking_amount: Decimal = Field(gt=0)


class CouponValidateResponse(BaseModel):
    is_valid: bool
    discount_amount: Decimal = Decimal(0)
    discount_type: str | None = None
    message: str | None = None


class CouponCreate(BaseModel):
    code: str = Field(min_length=3, max_length=30)
    discount_type: Literal["percentage", "fixed"]
    discount_value: Decimal = Field(gt=0)
    max_discount_amount: Decimal | None = Field(default=None, gt=0)
    min_booking_amount: Decimal = Field(default=Decimal(0), ge=0)
    valid_from: datetime
    valid_until: datetime
    usage_limit: int | None = Field(default=None, gt=0)
    is_active: bool = True

    @model_validator(mode="after")
    def validate_discount(self) -> Self:
        if self.discount_type == "percentage" and self.discount_value > 100:
            raise ValueError("Percentage discount cannot exceed 100%")
        return self


class CouponResponse(CouponCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    used_count: int
    created_at: datetime
