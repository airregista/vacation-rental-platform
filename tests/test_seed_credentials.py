import pytest
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.user import User
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


@pytest.mark.asyncio
async def test_seed_rebrands_legacy_demo_emails() -> None:
    async with AsyncSessionLocal() as session:
        admin = (
            (await session.execute(select(User).where(User.phone == "09120000000"))).scalars().one()
        )
        guest = (
            (await session.execute(select(User).where(User.phone == "09121111111"))).scalars().one()
        )
        admin.email = "admin@jabama.local"
        guest.email = "guest@jabama.local"
        await session.commit()

    await seed()

    async with AsyncSessionLocal() as session:
        admin = (
            (await session.execute(select(User).where(User.phone == "09120000000"))).scalars().one()
        )
        guest = (
            (await session.execute(select(User).where(User.phone == "09121111111"))).scalars().one()
        )
        assert admin.email == "admin@ashianak.local"
        assert guest.email == "guest@ashianak.local"
