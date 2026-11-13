import secrets
from decimal import Decimal
from typing import Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url

PLACEHOLDER_SECRET_MARKERS = (
    "donotuseinprod",
    "changeme",
    "change-me",
    "replace-with",
    "your-secure",
    "example",
)
DEMO_ENVIRONMENTS = frozenset({"development", "dev", "local", "test", "testing"})
DISALLOWED_PRODUCTION_DB_USERS = frozenset({"postgres", "root"})
LOCAL_DB_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
TLS_DB_SSL_MODES = frozenset({"require", "verify-ca", "verify-full"})


class Settings(BaseSettings):
    PROJECT_NAME: str = "Ashianak — Accommodation Booking API"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: int = Field(default=10, ge=1)
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP: int = Field(default=50, ge=1)
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = Field(default=300, ge=1)
    REGISTER_RATE_LIMIT_MAX_ATTEMPTS_PER_IP: int = Field(default=20, ge=1)
    CALENDAR_FEED_TTL_MINUTES: int = 60 * 24 * 7  # 7 days (10080 minutes)
    CALENDAR_MAX_BLOCK_DAYS: int = 90  # Max days between start_date and end_date in batch blocking
    RESERVATION_MAX_CHECKIN_MONTHS: int = 18  # Max forward booking horizon (18 * 30 = 540 days)
    PLATFORM_COMMISSION_RATE: Decimal = Decimal("0.10")
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = Field(default=5, ge=1, le=20)

    ENVIRONMENT: str

    @model_validator(mode="after")
    def validate_secret_key(self) -> Self:
        environment = self.ENVIRONMENT.strip().lower()
        key = self.SECRET_KEY.strip()

        if not environment:
            raise ValueError("ENVIRONMENT must be set (use development or test locally)")

        if key and any(marker in key.lower() for marker in PLACEHOLDER_SECRET_MARKERS):
            raise ValueError(
                "SECRET_KEY is a placeholder value. Generate one with: "
                'python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )

        if not key:
            if environment not in DEMO_ENVIRONMENTS:
                raise ValueError(
                    "SECRET_KEY must be set outside the demo environments "
                    f"(ENVIRONMENT={self.ENVIRONMENT!r})"
                )
            self.SECRET_KEY = secrets.token_urlsafe(48)
            return self

        if environment not in DEMO_ENVIRONMENTS and len(key) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters outside the demo environments"
            )
        self.SECRET_KEY = key
        return self

    @model_validator(mode="after")
    def validate_production_database(self) -> Self:
        environment = self.ENVIRONMENT.strip().lower()
        if environment in DEMO_ENVIRONMENTS:
            return self

        try:
            url = make_url(self.async_database_url)
        except Exception:
            raise ValueError(
                "DATABASE_URL is not a valid SQLAlchemy URL. "
                "Use postgresql+asyncpg://USER:PASSWORD@HOST:5432/DB."
            ) from None

        username = (url.username or "").strip()
        if not username:
            raise ValueError(
                "The production database URL must include a dedicated least-privilege username"
            )
        if username.lower() in DISALLOWED_PRODUCTION_DB_USERS:
            raise ValueError(
                "Refusing to start with a default/superuser database account "
                f"({username!r}). Create a dedicated least-privilege role; "
                "see DEPLOYMENT.md."
            )
        if not url.password:
            raise ValueError("The production database URL must include a password")
        if not url.host:
            raise ValueError("The production database URL must include a host")
        if url.host not in LOCAL_DB_HOSTS:
            ssl_mode = str(url.query.get("ssl") or "").lower()
            if ssl_mode not in TLS_DB_SSL_MODES:
                raise ValueError(
                    "Production database connections must use TLS. Append "
                    "?ssl=require (or verify-ca/verify-full) to DATABASE_URL."
                )
        return self

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "ashianak_db"
    DATABASE_URL: str | None = None
    ENABLE_STARTUP_SEED: bool = False
    SEED_ADMIN_PASSWORD: str = ""
    SEED_GUEST_PASSWORD: str = ""

    # Pool settings are per process. Keep
    # workers * (DB_POOL_SIZE + DB_MAX_OVERFLOW) below the server's
    # max_connections minus migration/maintenance headroom.
    DB_POOL_SIZE: int = Field(default=5, ge=1)
    DB_MAX_OVERFLOW: int = Field(default=5, ge=0)
    DB_POOL_TIMEOUT: int = Field(default=30, ge=1)
    DB_POOL_RECYCLE: int = Field(default=1800, ge=1)

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return URL.create(
            "postgresql+asyncpg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD or None,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            database=self.POSTGRES_DB,
        ).render_as_string(hide_password=False)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


# ENVIRONMENT (and SECRET_KEY) come from the process environment or .env at runtime.
settings = Settings()  # type: ignore[call-arg]
