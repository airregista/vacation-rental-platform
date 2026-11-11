import os
import re
import subprocess
import sys
from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession

_DEFAULT_TEST_URL = "postgresql+asyncpg://postgres@localhost:5432/jabama_test"
_TEST_URL = os.environ.get("TEST_DATABASE_URL") or _DEFAULT_TEST_URL
_TEST_DB = make_url(_TEST_URL)

if not _TEST_DB.database or not _TEST_DB.database.endswith("_test"):
    raise RuntimeError(
        "Refusing to run tests against a database whose name does not end in '_test': "
        f"{_TEST_DB.database!r}"
    )

os.environ["DATABASE_URL"] = _TEST_URL
os.environ.setdefault("ENVIRONMENT", "test")

_ROOT = Path(__file__).resolve().parents[1]

from app.core.config import settings  # noqa: E402
from app.core.database import AsyncSessionLocal, engine, get_db  # noqa: E402
from app.core.rate_limit import clear_login_attempts  # noqa: E402
from app.main import app  # noqa: E402


async def _ensure_test_database() -> None:
    import asyncpg

    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", _TEST_DB.database or ""):
        raise RuntimeError(f"Unsafe test database name: {_TEST_DB.database!r}")

    maintenance = _TEST_DB.set(database="postgres")
    dsn = maintenance.render_as_string(hide_password=False).replace(
        "postgresql+asyncpg://", "postgresql://"
    )
    conn = await asyncpg.connect(dsn)
    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", _TEST_DB.database
        )
        if not exists:
            await conn.execute(f'CREATE DATABASE "{_TEST_DB.database}"')
    finally:
        await conn.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def ensure_database_seeded():
    """Builds the disposable test database from Alembic and seeds it."""
    from sqlalchemy import text

    from app.core.database import engine
    from app.seeds.seed_data import seed

    await _ensure_test_database()

    # Hard guard against a misconfigured URL before any destructive DDL.
    await engine.dispose()
    async with engine.begin() as conn:
        current = (await conn.execute(text("SELECT current_database()"))).scalar_one()
        if not current.endswith("_test"):
            raise RuntimeError(
                f"Refusing to reset non-test database {current!r}; "
                "set TEST_DATABASE_URL to a database ending in '_test'."
            )
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))

    # Build the schema the same way production will: through Alembic.
    await engine.dispose()
    env = os.environ.copy()
    env["DATABASE_URL"] = _TEST_URL
    env["ENVIRONMENT"] = "test"
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=_ROOT,
        env=env,
        check=True,
    )

    # The database is empty after the reset; seed unconditionally.
    await seed()


@pytest_asyncio.fixture(autouse=True)
async def db_isolation() -> AsyncGenerator[None, None]:
    """Wraps each test in an isolated transaction savepoint that rolls back at test completion."""
    async with engine.connect() as connection:
        trans = await connection.begin()

        AsyncSessionLocal.configure(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )

        async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
            session = AsyncSession(
                bind=connection,
                expire_on_commit=False,
                join_transaction_mode="create_savepoint",
            )
            async with session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        try:
            yield
        finally:
            await trans.rollback()
            app.dependency_overrides.clear()
            AsyncSessionLocal.configure(bind=engine)


@pytest.fixture(autouse=True)
def reset_login_rate_limits():
    clear_login_attempts()
    yield
    clear_login_attempts()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_token(client: AsyncClient) -> str:
    response = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"login": "09120000000", "password": "admin123"},
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest_asyncio.fixture
async def guest_token(client: AsyncClient) -> str:
    response = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"login": "09121111111", "password": "guest123"},
    )
    assert response.status_code == 200, f"Guest login failed: {response.text}"
    return response.json()["access_token"]
