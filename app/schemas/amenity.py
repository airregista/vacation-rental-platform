from pydantic import BaseModel, ConfigDict, Field


class AmenityCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    icon: str | None = None


class AmenityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    icon: str | None = None
