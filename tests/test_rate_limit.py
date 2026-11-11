import uuid

import pytest
from fastapi import HTTPException
from httpx import AsyncClient

from app.core.config import settings
from app.core.rate_limit import (
    check_login_rate_limit,
    clear_login_attempts,
    record_failed_login,
)


def test_limit_triggers_after_max_attempts() -> None:
    key = "unit:limit"
    for _ in range(settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS):
        check_login_rate_limit(key)
        record_failed_login(key)

    with pytest.raises(HTTPException) as exc_info:
        check_login_rate_limit(key)

    assert exc_info.value.status_code == 429
    assert exc_info.value.headers is not None
    assert "Retry-After" in exc_info.value.headers


def test_clear_resets_the_counter() -> None:
    key = "unit:clear"
    for _ in range(settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS):
        record_failed_login(key)

    clear_login_attempts(key)
    check_login_rate_limit(key)  # must not raise


@pytest.mark.asyncio
async def test_login_returns_429_after_repeated_failures(client: AsyncClient) -> None:
    phone = "0912" + f"{uuid.uuid4().int % 10_000_000:07d}"
    payload = {"login": phone, "password": "definitely-wrong"}

    for _ in range(settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS):
        response = await client.post(f"{settings.API_V1_STR}/auth/login", json=payload)
        assert response.status_code == 401

    blocked = await client.post(f"{settings.API_V1_STR}/auth/login", json=payload)
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers


@pytest.mark.asyncio
async def test_successful_login_resets_failed_attempts(client: AsyncClient) -> None:
    # Register a throwaway account so this test owns its password; do not use
    # the seeded demo credentials here.
    phone = "0912" + f"{uuid.uuid4().int % 10_000_000:07d}"
    password = "rate-limit-test-only"
    registered = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={"phone": phone, "password": password, "first_name": "Rate"},
    )
    assert registered.status_code == 201

    wrong = {"login": phone, "password": "definitely-wrong"}
    for _ in range(settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS - 1):
        response = await client.post(f"{settings.API_V1_STR}/auth/login", json=wrong)
        assert response.status_code == 401

    ok = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"login": phone, "password": password},
    )
    assert ok.status_code == 200  # success must clear the counter

    for _ in range(settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS):
        response = await client.post(f"{settings.API_V1_STR}/auth/login", json=wrong)
        assert response.status_code == 401

    blocked = await client.post(f"{settings.API_V1_STR}/auth/login", json=wrong)
    assert blocked.status_code == 429
