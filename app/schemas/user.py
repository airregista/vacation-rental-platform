from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    phone: str = Field(min_length=10, max_length=15, pattern=r"^(?:\+98|0)?9\d{9}$")
    email: EmailStr | None = None
    password: str = Field(min_length=6, max_length=100)
    first_name: str | None = Field(default=None, max_length=50)
    last_name: str | None = Field(default=None, max_length=50)


class UserLogin(BaseModel):
    login: str = Field(description="Phone number or email address")
    password: str


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    first_name: str | None = Field(default=None, max_length=50)
    last_name: str | None = Field(default=None, max_length=50)
    avatar_url: str | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    role: str
    avatar_url: str | None = None
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
