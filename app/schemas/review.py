from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewAuthor(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str | None = None
    last_name: str | None = None
    avatar_url: str | None = None


class ReviewCreate(BaseModel):
    reservation_id: int
    rating: int = Field(ge=1, le=5, description="Overall rating between 1 and 5")
    cleanliness_rating: int | None = Field(default=None, ge=1, le=5)
    accuracy_rating: int | None = Field(default=None, ge=1, le=5)
    comment: str = Field(min_length=5, max_length=1000)


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reservation_id: int
    user_id: int
    accommodation_id: int
    rating: int
    cleanliness_rating: int | None = None
    accuracy_rating: int | None = None
    comment: str
    created_at: datetime
    user: ReviewAuthor | None = None
