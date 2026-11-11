import pytest
from pydantic import ValidationError

from app.core.config import Settings

PRODUCTION_DB_URL = (
    "postgresql+asyncpg://ashianak_app:test-db-password"
    "@db.example.com:5432/ashianak?ssl=require"
)


def test_environment_must_be_set(monkeypatch):
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, SECRET_KEY="k" * 48)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, ENVIRONMENT="", SECRET_KEY="k" * 48)


def test_production_requires_secret_key():
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY="",
            DATABASE_URL=PRODUCTION_DB_URL,
        )


def test_production_rejects_short_secret_key():
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY="short",
            DATABASE_URL=PRODUCTION_DB_URL,
        )


def test_production_accepts_long_secret_key():
    result = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        SECRET_KEY="k" * 48,
        DATABASE_URL=PRODUCTION_DB_URL,
    )
    assert result.SECRET_KEY == "k" * 48


def test_secret_key_is_trimmed():
    result = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        SECRET_KEY="  " + "k" * 48 + "  ",
        DATABASE_URL=PRODUCTION_DB_URL,
    )
    assert result.SECRET_KEY == "k" * 48


def test_development_generates_ephemeral_secret_key():
    result = Settings(_env_file=None, ENVIRONMENT="development", SECRET_KEY="")
    assert len(result.SECRET_KEY) >= 32


def test_placeholder_secret_rejected_in_development():
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            ENVIRONMENT="development",
            SECRET_KEY="replace-with-a-secure-secret-key",
        )


def test_production_rejects_default_superuser_database():
    with pytest.raises(ValidationError, match="dedicated least-privilege"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY="k" * 48,
            DATABASE_URL=(
                "postgresql+asyncpg://postgres:secret"
                "@db.example.com:5432/ashianak?ssl=require"
            ),
        )


def test_production_rejects_database_without_password():
    with pytest.raises(ValidationError, match="must include a password"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY="k" * 48,
            DATABASE_URL=(
                "postgresql+asyncpg://ashianak_app"
                "@db.example.com:5432/ashianak?ssl=require"
            ),
        )


def test_production_requires_tls_for_remote_database():
    with pytest.raises(ValidationError, match="must use TLS"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            SECRET_KEY="k" * 48,
            DATABASE_URL=(
                "postgresql+asyncpg://ashianak_app:secret@db.example.com:5432/ashianak"
            ),
        )


def test_production_allows_local_database_without_tls():
    result = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        SECRET_KEY="k" * 48,
        DATABASE_URL="postgresql+asyncpg://ashianak_app:secret@localhost:5432/ashianak",
    )
    assert result.DATABASE_URL is not None


def test_fallback_database_url_encodes_special_characters(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    result = Settings(
        _env_file=None,
        ENVIRONMENT="development",
        SECRET_KEY="",
        POSTGRES_USER="ashianak_app",
        POSTGRES_PASSWORD="p@ss:word",
        POSTGRES_SERVER="localhost",
        POSTGRES_DB="ashianak",
    )
    assert "p%40ss%3Aword" in result.async_database_url
