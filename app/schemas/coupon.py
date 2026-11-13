from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.constraints import INTEGER_MAX


class CouponValidateRequest(BaseModel):
    code: str = Field(min_length=3, max_length=30)
    booking_amount: Decimal = Field(gt=0, max_digits=12, decimal_places=0)

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        clean = v.strip().upper()
        if len(clean) < 3:
            raise ValueError("Coupon code must be at least 3 characters after trimming whitespace")
        return clean


class CouponValidateResponse(BaseModel):
    is_valid: bool
    discount_amount: Decimal = Decimal(0)
    discount_type: str | None = None
    message: str | None = None


class CouponCreate(BaseModel):
    code: str = Field(min_length=3, max_length=30)
    discount_type: Literal["percentage", "fixed"]
    discount_value: Decimal = Field(gt=0, max_digits=12, decimal_places=0)
    max_discount_amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=0)
    min_booking_amount: Decimal = Field(default=Decimal(0), ge=0, max_digits=12, decimal_places=0)
    valid_from: datetime
    valid_until: datetime
    usage_limit: int | None = Field(default=None, gt=0, le=INTEGER_MAX)
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        clean = v.strip().upper()
        if len(clean) < 3:
            raise ValueError("Coupon code must be at least 3 characters after trimming whitespace")
        return clean

    @model_validator(mode="after")
    def validate_discount(self) -> Self:
        if self.discount_type == "percentage" and self.discount_value > 100:
            raise ValueError("Percentage discount cannot exceed 100%")
        from_dt = (
            self.valid_from
            if self.valid_from.tzinfo
            else self.valid_from.replace(tzinfo=timezone.utc)
        )
        until_dt = (
            self.valid_until
            if self.valid_until.tzinfo
            else self.valid_until.replace(tzinfo=timezone.utc)
        )
        if until_dt <= from_dt:
            raise ValueError("valid_until must be after valid_from")
        self.valid_from = from_dt
        self.valid_until = until_dt
        return self


class CouponUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    discount_value: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=0)
    max_discount_amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=0)
    min_booking_amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=0)
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    usage_limit: int | None = Field(default=None, gt=0, le=INTEGER_MAX)
    is_active: bool | None = None

    @model_validator(mode="after")
    def normalize_timestamps(self) -> Self:
        for field in ("valid_from", "valid_until"):
            value = getattr(self, field)
            if value is not None and value.tzinfo is None:
                setattr(self, field, value.replace(tzinfo=timezone.utc))
        return self


class CouponResponse(CouponCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    used_count: int
    created_at: datetime
