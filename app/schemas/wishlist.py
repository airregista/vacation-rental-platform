from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.schemas.accommodation import AccommodationListItem


class WishlistToggleResponse(BaseModel):
    accommodation_id: int
    is_favorite: bool
    message: str


class WishlistItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    accommodation_id: int
    created_at: datetime
    accommodation: AccommodationListItem
