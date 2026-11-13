import threading
import uuid

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.rate_limit import (
    check_and_record_failed_login,
    clear_login_attempts,
)


def test_limit_triggers_after_max_attempts() -> None:
    key = "unit:limit"
    for _ in range(settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS):
        check_and_record_failed_login(key)

    with pytest.raises(HTTPException) as exc_info:
        check_and_record_failed_login(key)

    assert exc_info.value.status_code == 429
    assert exc_info.value.headers is not None
    assert "Retry-After" in exc_info.value.headers


def test_clear_resets_the_counter() -> None:
    key = "unit:clear"
    for _ in range(settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS):
        check_and_record_failed_login(key)

    clear_login_attempts(key)
    check_and_record_failed_login(key)  # fresh window: must not raise


def test_concurrent_failures_cannot_exceed_limit() -> None:
    key = "unit:concurrent"
    attempts = settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS + 5
    barrier = threading.Barrier(attempts)
    rejected: list[HTTPException] = []

    def worker() -> None:
        barrier.wait()
        try:
            check_and_record_failed_login(key)
        except HTTPException as exc:
            rejected.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(attempts)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert len(rejected) == 5
    assert all(exc.status_code == 429 for exc in rejected)


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


@pytest.mark.asyncio
async def test_unknown_login_still_runs_bcrypt(client: AsyncClient, monkeypatch):
    from app.api.v1.endpoints import auth as auth_module
    from app.core.security import DUMMY_PASSWORD_HASH

    calls: list[str] = []
    real_verify = auth_module.verify_password

    def spy(password: str, hashed: str) -> bool:
        calls.append(hashed)
        return real_verify(password, hashed)

    monkeypatch.setattr(auth_module, "verify_password", spy)
    phone = "0912" + f"{uuid.uuid4().int % 10_000_000:07d}"
    response = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"login": phone, "password": "definitely-wrong"},
    )
    assert response.status_code == 401
    assert calls == [DUMMY_PASSWORD_HASH]


@pytest.mark.asyncio
async def test_login_identifier_length_is_bounded(client: AsyncClient) -> None:
    url = f"{settings.API_V1_STR}/auth/login"

    too_long = await client.post(url, json={"login": "a" * 255, "password": "x"})
    assert too_long.status_code == 422

    # The boundary itself must still reach the endpoint (401 for an unknown
    # identifier), otherwise the limit is tighter than intended.
    at_limit = await client.post(url, json={"login": "a" * 254, "password": "x"})
    assert at_limit.status_code == 401


@pytest.mark.asyncio
async def test_otp_verify_is_rate_limited_per_phone(client: AsyncClient):
    phone = "0912" + f"{uuid.uuid4().int % 10_000_000:07d}"
    sent = await client.post(f"{settings.API_V1_STR}/auth/otp/send", json={"phone": phone})
    assert sent.status_code == 200

    for _ in range(settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS):
        response = await client.post(
            f"{settings.API_V1_STR}/auth/otp/verify",
            json={"phone": phone, "code": "9999"},
        )
        assert response.status_code == 400

    blocked = await client.post(
        f"{settings.API_V1_STR}/auth/otp/verify",
        json={"phone": phone, "code": "1234"},
    )
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers


@pytest.mark.asyncio
async def test_otp_success_clears_failed_attempts(client: AsyncClient):
    phone = "0912" + f"{uuid.uuid4().int % 10_000_000:07d}"
    await client.post(f"{settings.API_V1_STR}/auth/otp/send", json={"phone": phone})

    bad = await client.post(
        f"{settings.API_V1_STR}/auth/otp/verify",
        json={"phone": phone, "code": "9999"},
    )
    assert bad.status_code == 400

    ok = await client.post(
        f"{settings.API_V1_STR}/auth/otp/verify",
        json={"phone": phone, "code": "1234"},
    )
    assert ok.status_code == 200

    for _ in range(settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS):
        response = await client.post(
            f"{settings.API_V1_STR}/auth/otp/verify",
            json={"phone": phone, "code": "9999"},
        )
        assert response.status_code == 400

    blocked = await client.post(
        f"{settings.API_V1_STR}/auth/otp/verify",
        json={"phone": phone, "code": "1234"},
    )
    assert blocked.status_code == 429


def _client_from_ip(ip: str) -> AsyncClient:
    """An in-process client whose requests look like they come from ``ip``."""
    from app.main import app

    transport = ASGITransport(app=app, client=(ip, 4321))
    return AsyncClient(transport=transport, base_url="http://testserver")


@pytest.mark.asyncio
async def test_otp_verify_lockout_is_scoped_to_requesting_ip(
    client: AsyncClient,
) -> None:
    phone = "0912" + f"{uuid.uuid4().int % 10_000_000:07d}"
    sent = await client.post(f"{settings.API_V1_STR}/auth/otp/send", json={"phone": phone})
    assert sent.status_code == 200

    # Burn the per-phone budget from the default test IP.
    for _ in range(settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS):
        response = await client.post(
            f"{settings.API_V1_STR}/auth/otp/verify",
            json={"phone": phone, "code": "9999"},
        )
        assert response.status_code == 400

    blocked = await client.post(
        f"{settings.API_V1_STR}/auth/otp/verify",
        json={"phone": phone, "code": "1234"},
    )
    assert blocked.status_code == 429

    # A different source IP must still be able to verify the same phone; the
    # lockout belongs to the address that made the failed attempts, not to the
    # victim's phone number.
    async with _client_from_ip("198.51.100.7") as other_ip:
        ok = await other_ip.post(
            f"{settings.API_V1_STR}/auth/otp/verify",
            json={"phone": phone, "code": "1234"},
        )
    assert ok.status_code == 200


@pytest.mark.asyncio
async def test_login_per_ip_limit_blocks_rotating_identifiers(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP", 3)

    async with _client_from_ip("203.0.113.10") as rotating:
        for _ in range(3):
            # Every attempt uses a fresh identifier, so the per-identifier
            # bucket never fills; only the IP bucket can stop the burst.
            phone = "0912" + f"{uuid.uuid4().int % 10_000_000:07d}"
            response = await rotating.post(
                f"{settings.API_V1_STR}/auth/login",
                json={"login": phone, "password": "definitely-wrong"},
            )
            assert response.status_code == 401

        blocked = await rotating.post(
            f"{settings.API_V1_STR}/auth/login",
            json={"login": "09129999999", "password": "definitely-wrong"},
        )
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers


@pytest.mark.asyncio
async def test_otp_send_per_ip_limit_blocks_rotating_phones(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP", 3)

    async with _client_from_ip("203.0.113.11") as rotating:
        for _ in range(3):
            sent = await rotating.post(
                f"{settings.API_V1_STR}/auth/otp/send",
                json={"phone": "0912" + f"{uuid.uuid4().int % 10_000_000:07d}"},
            )
            assert sent.status_code == 200

        blocked = await rotating.post(
            f"{settings.API_V1_STR}/auth/otp/send",
            json={"phone": "09129999999"},
        )
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers


@pytest.mark.asyncio
async def test_successful_login_does_not_reset_the_ip_bucket(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP", 2)

    phone = "0912" + f"{uuid.uuid4().int % 10_000_000:07d}"
    password = "rate-limit-test-only"
    registered = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={"phone": phone, "password": password, "first_name": "Rate"},
    )
    assert registered.status_code == 201

    wrong = {"login": phone, "password": "definitely-wrong"}
    first = await client.post(f"{settings.API_V1_STR}/auth/login", json=wrong)
    assert first.status_code == 401

    # A successful login clears only the identifier bucket. Clearing the IP
    # bucket here would let a malicious registered user reset the address
    # budget between bursts.
    ok = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"login": phone, "password": password},
    )
    assert ok.status_code == 200

    second = await client.post(f"{settings.API_V1_STR}/auth/login", json=wrong)
    assert second.status_code == 401

    blocked = await client.post(f"{settings.API_V1_STR}/auth/login", json=wrong)
    assert blocked.status_code == 429


@pytest.mark.asyncio
async def test_password_checks_run_off_the_event_loop_thread(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.api.v1.endpoints import auth as auth_module

    loop_thread = threading.get_ident()
    verify_threads: list[int] = []
    hash_threads: list[int] = []
    real_verify = auth_module.verify_password
    real_hash = auth_module.get_password_hash

    def verify_spy(password: str, hashed: str) -> bool:
        verify_threads.append(threading.get_ident())
        return real_verify(password, hashed)

    def hash_spy(password: str) -> str:
        hash_threads.append(threading.get_ident())
        return real_hash(password)

    monkeypatch.setattr(auth_module, "verify_password", verify_spy)
    monkeypatch.setattr(auth_module, "get_password_hash", hash_spy)

    phone = "0912" + f"{uuid.uuid4().int % 10_000_000:07d}"
    failed = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"login": phone, "password": "definitely-wrong"},
    )
    assert failed.status_code == 401

    registered = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={"phone": phone, "password": "rate-limit-test-only", "first_name": "Rate"},
    )
    assert registered.status_code == 201

    # bcrypt must never run on the event-loop thread, otherwise a burst of
    # login attempts blocks every other request on that worker.
    assert verify_threads
    assert hash_threads
    assert all(thread != loop_thread for thread in verify_threads)
    assert all(thread != loop_thread for thread in hash_threads)


@pytest.mark.asyncio
async def test_register_returns_429_after_ip_budget(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "REGISTER_RATE_LIMIT_MAX_ATTEMPTS_PER_IP", 3)
    for _ in range(3):
        res = await client.post(
            f"{settings.API_V1_STR}/auth/register",
            json={
                "phone": f"0912{uuid.uuid4().int % 10000000:07d}",
                "password": "Password123!",
            },
        )
        assert res.status_code == 201

    blocked = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": f"0912{uuid.uuid4().int % 10000000:07d}",
            "password": "Password123!",
        },
    )
    assert blocked.status_code == 429
    assert "retry-after" in {k.lower() for k in blocked.headers}
    assert blocked.json()["detail"] == ("Too many registration attempts. Try again later.")
