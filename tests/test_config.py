import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_environment_must_be_set(monkeypatch):
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, SECRET_KEY="k" * 48)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, ENVIRONMENT="", SECRET_KEY="k" * 48)


def test_production_requires_secret_key():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, ENVIRONMENT="production", SECRET_KEY="")


def test_production_rejects_short_secret_key():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, ENVIRONMENT="production", SECRET_KEY="short")


def test_production_accepts_long_secret_key():
    result = Settings(_env_file=None, ENVIRONMENT="production", SECRET_KEY="k" * 48)
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
