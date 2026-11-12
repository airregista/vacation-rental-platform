import time
from collections import deque
from threading import Lock
from typing import NoReturn

from fastapi import HTTPException, status

from app.core.config import settings

# Key -> (monotonic timestamps of failed attempts inside the current window).
_attempts: dict[str, deque[float]] = {}
_lock = Lock()
_MAX_TRACKED_KEYS = 5000


def _prune(bucket: deque[float], now: float) -> None:
    cutoff = now - settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS
    while bucket and bucket[0] <= cutoff:
        bucket.popleft()


def _sweep(now: float) -> None:
    """Keep the table bounded by evicting the oldest buckets.

    This is a memory guard, not a security boundary: under key-spraying
    pressure an evicted key can get a fresh window. Rotating identifiers
    already bypasses a per-key limiter; a shared store is the real fix.
    """
    while len(_attempts) >= _MAX_TRACKED_KEYS:
        key = next(iter(_attempts))
        bucket = _attempts[key]
        _prune(bucket, now)
        _attempts.pop(key, None)


def _retry_after(bucket: deque[float], now: float) -> int:
    return max(
        1,
        int(bucket[0] + settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS - now) + 1,
    )


def _raise_too_many(retry_after: int) -> NoReturn:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many failed login attempts. Try again later.",
        headers={"Retry-After": str(retry_after)},
    )


def _effective_limit(limit: int | None) -> int:
    if limit is None:
        return settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS
    return limit


def check_login_rate_limit(key: str, *, limit: int | None = None) -> None:
    """Read-only pre-check: raise 429 when the key is already over the limit."""
    effective_limit = _effective_limit(limit)
    now = time.monotonic()
    with _lock:
        bucket = _attempts.get(key)
        if bucket is None:
            return
        _prune(bucket, now)
        if len(bucket) < effective_limit:
            return
        retry_after = _retry_after(bucket, now)
    _raise_too_many(retry_after)


def check_and_record_failed_login(key: str, *, limit: int | None = None) -> None:
    """Record one failed attempt and raise 429 when it crosses the limit.

    The append and the threshold decision happen under the same lock, so a
    concurrent burst cannot observe a stale count and slip extra attempts past
    the limit. Every call records, even the ones that raise: an attacker who
    keeps retrying keeps the window full, and a legitimate user clears it by
    logging in successfully.

    ``limit`` lets a coarse per-IP bucket use a higher threshold than the
    per-identifier bucket. The same helper is used for OTP sends and verifies.
    """
    effective_limit = _effective_limit(limit)
    now = time.monotonic()
    with _lock:
        _sweep(now)
        bucket = _attempts.setdefault(key, deque())
        _prune(bucket, now)
        bucket.append(now)
        if len(bucket) <= effective_limit:
            return
        retry_after = _retry_after(bucket, now)
    _raise_too_many(retry_after)


def clear_login_attempts(key: str | None = None) -> None:
    """Reset one key, or all keys (used by tests and by successful logins)."""
    with _lock:
        if key is None:
            _attempts.clear()
        else:
            _attempts.pop(key, None)
