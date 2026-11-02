import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app


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
