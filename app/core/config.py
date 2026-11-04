from decimal import Decimal
from typing import Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Accommodation Booking API (Similar to Jabama & Airbnb)"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "supersecretkeyforjavabamaccommodationapppleasedonotuseinprod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    PLATFORM_COMMISSION_RATE: Decimal = Decimal("0.10")
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    ENVIRONMENT: str = "development"

    @model_validator(mode="after")
    def validate_production_secret(self) -> Self:
        if (
            self.ENVIRONMENT.lower() in ("production", "prod")
            and "donotuseinprod" in self.SECRET_KEY
        ):
            raise ValueError("Insecure default SECRET_KEY cannot be used in production environment")
        return self

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "jabama_db"
    DATABASE_URL: str | None = None
    ENABLE_STARTUP_SEED: bool = False

    DB_POOL_TYPE: str = "queue"  # "queue" or "null"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        auth = self.POSTGRES_USER
        if self.POSTGRES_PASSWORD:
            auth += f":{self.POSTGRES_PASSWORD}"
        return f"postgresql+asyncpg://{auth}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
