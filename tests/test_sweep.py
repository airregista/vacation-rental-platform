import asyncio
from contextlib import suppress

import pytest

from app import main


@pytest.mark.asyncio
async def test_sweep_loop_calls_expiry(monkeypatch):
    called = asyncio.Event()

    async def fake_expire(session, ttl_minutes=None):
        called.set()
        return 0

    monkeypatch.setattr(main, "expire_stale_pending_reservations", fake_expire)
    monkeypatch.setattr(main.settings, "RESERVATION_SWEEP_INTERVAL_SECONDS", 0.01)

    task = asyncio.create_task(main._reservation_sweep_loop())
    try:
        await asyncio.wait_for(called.wait(), timeout=2)
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


@pytest.mark.asyncio
async def test_lifespan_starts_and_cancels_sweep(monkeypatch):
    started = asyncio.Event()
    cancelled = asyncio.Event()

    async def fake_loop():
        started.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    monkeypatch.setattr(main, "_reservation_sweep_loop", fake_loop)
    monkeypatch.setattr(main.settings, "ENABLE_RESERVATION_SWEEP", True)
    monkeypatch.setattr(main.settings, "ENABLE_STARTUP_SEED", False)

    async with main.lifespan(main.app):
        await asyncio.wait_for(started.wait(), timeout=2)

    await asyncio.wait_for(cancelled.wait(), timeout=2)


@pytest.mark.asyncio
async def test_lifespan_skips_sweep_when_disabled(monkeypatch):
    created = []
    monkeypatch.setattr(
        main.asyncio, "create_task", lambda coro: created.append(coro) or coro.close()
    )
    monkeypatch.setattr(main.settings, "ENABLE_RESERVATION_SWEEP", False)
    monkeypatch.setattr(main.settings, "ENABLE_STARTUP_SEED", False)

    async with main.lifespan(main.app):
        pass

    assert created == []
