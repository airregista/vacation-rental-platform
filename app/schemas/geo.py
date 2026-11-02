from pydantic import BaseModel, ConfigDict, Field


class ProvinceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)


class ProvinceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class CityCreate(BaseModel):
    province_id: int
    name: str = Field(min_length=2, max_length=50)


class CityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    province_id: int
    name: str
    province: ProvinceResponse | None = None
