import pytest

from app.core.config import settings
from app.seeds.seed_data import (
    DEMO_SEED_ENVIRONMENTS,
    ensure_demo_seeding_allowed,
    resolve_demo_password,
    seed,
)


@pytest.mark.parametrize("environment", ["production", "prod", "staging", "PRODUCTION"])
def test_demo_seeding_refused_outside_dev(environment: str) -> None:
    with pytest.raises(RuntimeError):
        ensure_demo_seeding_allowed(environment)


@pytest.mark.parametrize("environment", sorted(DEMO_SEED_ENVIRONMENTS))
def test_demo_seeding_allowed_in_dev(environment: str) -> None:
    ensure_demo_seeding_allowed(environment)


def test_configured_password_wins() -> None:
    assert resolve_demo_password("configured", "fallback") == "configured"


def test_dev_fallback_used_when_no_override() -> None:
    assert resolve_demo_password("", "fallback") == "fallback"


@pytest.mark.asyncio
async def test_seed_refuses_production_before_opening_a_connection(monkeypatch) -> None:
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with pytest.raises(RuntimeError):
        await seed()
