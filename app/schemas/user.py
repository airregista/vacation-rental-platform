import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ponytail: simple regex + maketrans normalizer; upgrade to phonenumbers if international support needed
PERSIAN_ARABIC_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s\.]+(?:\.[^@\s\.]+)+$")


def normalize_iranian_phone(phone_str: str) -> str:
    clean = re.sub(r"[\s\-]", "", str(phone_str).strip()).translate(PERSIAN_ARABIC_DIGITS)
    match = re.match(r"^(?:\+98|0098|98|0)?(9\d{9})$", clean)
    if not match:
        raise ValueError("Invalid Iranian mobile phone number format")
    return f"0{match.group(1)}"


class UserRegister(BaseModel):
    phone: str = Field(min_length=11, max_length=11, pattern=r"^09\d{9}$")
    email: str | None = None
    password: str = Field(min_length=6, max_length=100)
    first_name: str | None = Field(default=None, max_length=50)
    last_name: str | None = Field(default=None, max_length=50)

    @field_validator("phone", mode="before")
    @classmethod
    def validate_and_normalize_phone(cls, v: str) -> str:
        return normalize_iranian_phone(v)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        clean = v.lower().strip()
        if not clean or not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email address format")
        return clean


class UserLogin(BaseModel):
    login: str = Field(description="Phone number or email address")
    password: str

    @field_validator("login", mode="before")
    @classmethod
    def normalize_login_identifier(cls, v: str) -> str:
        clean = str(v).strip()
        if "@" in clean:
            return clean.lower()
        try:
            return normalize_iranian_phone(clean)
        except ValueError:
            return clean


class UserUpdate(BaseModel):
    email: str | None = None
    first_name: str | None = Field(default=None, max_length=50)
    last_name: str | None = Field(default=None, max_length=50)
    avatar_url: str | None = None
    shaba_number: str | None = Field(default=None, pattern=r"^IR\d{24}$")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        clean = v.lower().strip()
        if not clean or not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email address format")
        return clean

    # ponytail: regex check only; add Iranian IBAN mod-97 check digit verification when direct banking transfers go live
    @field_validator("shaba_number", mode="before")
    @classmethod
    def normalize_shaba(cls, v: str | None) -> str | None:
        if not v:
            return None
        clean = re.sub(r"[\s\-]", "", v).upper()
        if not re.match(r"^IR\d{24}$", clean):
            raise ValueError("Shaba number must be formatted as IR followed by 24 digits")
        return clean


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    role: str
    avatar_url: str | None = None
    shaba_number: str | None = Field(default=None, pattern=r"^IR\d{24}$")
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
