from collections.abc import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine, get_db
from app.main import app


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
