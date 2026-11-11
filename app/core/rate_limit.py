import time
from collections import deque
from threading import Lock

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


def check_login_rate_limit(key: str) -> None:
    """Raise 429 with Retry-After when the key has used up its failed attempts."""
    now = time.monotonic()
    with _lock:
        bucket = _attempts.get(key)
        if bucket is None:
            return
        _prune(bucket, now)
        if len(bucket) < settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS:
            return
        retry_after = max(
            1,
            int(bucket[0] + settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS - now) + 1,
        )
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many failed login attempts. Try again later.",
        headers={"Retry-After": str(retry_after)},
    )


def record_failed_login(key: str) -> None:
    now = time.monotonic()
    with _lock:
        _sweep(now)
        bucket = _attempts.setdefault(key, deque())
        _prune(bucket, now)
        bucket.append(now)


def clear_login_attempts(key: str | None = None) -> None:
    """Reset one key, or all keys (used by tests and by successful logins)."""
    with _lock:
        if key is None:
            _attempts.clear()
        else:
            _attempts.pop(key, None)
