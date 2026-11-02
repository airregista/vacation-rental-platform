from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    title: str = Field(min_length=2, max_length=50)
    slug: str = Field(min_length=2, max_length=50, pattern=r"^[a-z0-9-]+$")
    icon_url: str | None = None


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    icon_url: str | None = None
