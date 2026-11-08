from datetime import date, datetime, time
from decimal import Decimal
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.amenity import AmenityResponse
from app.schemas.category import CategoryResponse
from app.schemas.geo import CityResponse
from app.schemas.user import UserResponse


class AccommodationImageCreate(BaseModel):
    image_url: str
    is_cover: bool = False
    sort_order: int = 0


class AccommodationImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    image_url: str
    is_cover: bool
    sort_order: int


class PricingExceptionCreate(BaseModel):
    date: date
    price: Decimal | None = None
    is_blocked: bool = False
    min_nights: int | None = Field(default=None, ge=1)


class PricingExceptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    price: Decimal | None = None
    is_blocked: bool
    min_nights: int | None = None


class PricingExceptionBatchCreate(BaseModel):
    start_date: date
    end_date: date
    price: Decimal | None = Field(default=None, ge=0)
    is_blocked: bool = True
    min_nights: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_date_range(self) -> Self:
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        if (self.end_date - self.start_date).days > 365:
            raise ValueError("Date range cannot exceed 365 days")
        return self


class PricingExceptionBatchResponse(BaseModel):
    updated_count: int
    start_date: date
    end_date: date


class AccommodationCreate(BaseModel):
    category_id: int
    city_id: int
    host_id: int | None = None
    title: str = Field(min_length=3, max_length=150)
    description: str | None = None
    address: str = Field(min_length=5, max_length=255)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    base_price: Decimal = Field(ge=0)
    cleaning_fee: Decimal = Field(default=Decimal(0), ge=0)
    capacity: int = Field(default=2, gt=0)
    max_capacity: int = Field(default=4, gt=0)
    extra_guest_fee: Decimal = Field(default=Decimal(0), ge=0)
    rooms_count: int = Field(default=1, ge=0)
    beds_count: int = Field(default=1, ge=0)
    min_nights: int = Field(default=1, ge=1)
    check_in_time: time = time(14, 0)
    check_out_time: time = time(12, 0)
    rules: str | None = None
    cancellation_policy: str = Field(default="flexible", pattern="^(flexible|moderate|strict)$")
    is_active: bool = True
    external_calendar_url: str | None = Field(default=None, max_length=500)
    amenity_ids: list[int] = Field(default_factory=list)
    images: list[AccommodationImageCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_capacity(self) -> Self:
        if self.max_capacity < self.capacity:
            raise ValueError("max_capacity must be greater than or equal to base capacity")
        return self


class AccommodationUpdate(BaseModel):
    category_id: int | None = None
    city_id: int | None = None
    title: str | None = Field(default=None, min_length=3, max_length=150)
    description: str | None = None
    address: str | None = Field(default=None, min_length=5, max_length=255)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    base_price: Decimal | None = Field(default=None, ge=0)
    cleaning_fee: Decimal | None = Field(default=None, ge=0)
    capacity: int | None = Field(default=None, gt=0)
    max_capacity: int | None = Field(default=None, gt=0)
    extra_guest_fee: Decimal | None = Field(default=None, ge=0)
    rooms_count: int | None = Field(default=None, ge=0)
    beds_count: int | None = Field(default=None, ge=0)
    min_nights: int | None = Field(default=None, ge=1)
    check_in_time: time | None = None
    check_out_time: time | None = None
    rules: str | None = None
    cancellation_policy: str | None = Field(default=None, pattern="^(flexible|moderate|strict)$")
    is_active: bool | None = None
    external_calendar_url: str | None = Field(default=None, max_length=500)
    amenity_ids: list[int] | None = None

    @model_validator(mode="after")
    def validate_capacity(self) -> Self:
        if self.capacity is not None and self.max_capacity is not None:
            if self.max_capacity < self.capacity:
                raise ValueError("max_capacity must be greater than or equal to base capacity")
        return self


class AccommodationListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    city: CityResponse | None = None
    category: CategoryResponse | None = None
    base_price: Decimal
    capacity: int
    max_capacity: int
    rooms_count: int
    beds_count: int
    min_nights: int = 1
    cover_image: str | None = None
    cancellation_policy: str = "flexible"
    average_rating: float | None = None
    reviews_count: int = 0
    is_active: bool


class AccommodationDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    host_id: int
    category_id: int
    city_id: int
    title: str
    description: str | None = None
    address: str
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    base_price: Decimal
    cleaning_fee: Decimal
    capacity: int
    max_capacity: int
    extra_guest_fee: Decimal
    rooms_count: int
    beds_count: int
    min_nights: int = 1
    check_in_time: time
    check_out_time: time
    rules: str | None = None
    cancellation_policy: str = "flexible"
    is_active: bool
    created_at: datetime
    external_calendar_url: str | None = None
    last_calendar_sync_at: datetime | None = None

    host: UserResponse | None = None
    category: CategoryResponse | None = None
    city: CityResponse | None = None
    images: list[AccommodationImageResponse] = Field(default_factory=list)
    amenities: list[AmenityResponse] = Field(default_factory=list)
    average_rating: float | None = None
    reviews_count: int = 0
    calendar_ics_token: str | None = None


class CalendarFeedTokenResponse(BaseModel):
    token: str
    expires_at: datetime
    feed_url: str


class CalendarSyncResponse(BaseModel):
    synced_events_count: int
    blocked_days_count: int
    last_sync_at: datetime
