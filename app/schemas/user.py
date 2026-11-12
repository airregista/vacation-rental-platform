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


BCRYPT_MAX_PASSWORD_BYTES = 72


def validate_password_length(value: str) -> str:
    if len(value.encode("utf-8")) > BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError(
            "Password must be at most 72 bytes when UTF-8 encoded "
            "(Persian/Arabic characters use 2 bytes each)"
        )
    return value


class UserRegister(BaseModel):
    phone: str = Field(min_length=11, max_length=11, pattern=r"^09\d{9}$")
    email: str | None = None
    password: str = Field(min_length=6, max_length=72)
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

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_length(v)


class UserLogin(BaseModel):
    login: str = Field(max_length=254, description="Phone number or email address")
    password: str = Field(min_length=1, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_password_length(v)

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


class UserOTPRequest(BaseModel):
    phone: str = Field(description="Iranian mobile phone number")

    @field_validator("phone", mode="before")
    @classmethod
    def validate_and_normalize_phone(cls, v: str) -> str:
        return normalize_iranian_phone(v)


class UserOTPVerify(BaseModel):
    phone: str = Field(description="Iranian mobile phone number")
    code: str = Field(min_length=4, max_length=6, description="OTP verification code")
    first_name: str | None = Field(default=None, max_length=50)
    last_name: str | None = Field(default=None, max_length=50)

    @field_validator("phone", mode="before")
    @classmethod
    def validate_and_normalize_phone(cls, v: str) -> str:
        return normalize_iranian_phone(v)

    @field_validator("code", mode="before")
    @classmethod
    def normalize_code(cls, v: object) -> object:
        if v is None:
            return v
        return str(v).strip().translate(PERSIAN_ARABIC_DIGITS)


class OTPResponse(BaseModel):
    message: str
    dev_code: str | None = None
    expires_in_seconds: int = 300
