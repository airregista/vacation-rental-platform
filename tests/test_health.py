import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_reports_database_connected(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


@pytest.mark.asyncio
async def test_health_returns_503_when_database_is_down(client: AsyncClient, monkeypatch):
    class BrokenSession:
        async def __aenter__(self):
            raise RuntimeError("database is down")

        async def __aexit__(self, *args):
            return False

    monkeypatch.setattr("app.main.AsyncSessionLocal", lambda: BrokenSession())

    response = await client.get("/health")
    assert response.status_code == 503
    assert response.json() == {
        "status": "unhealthy",
        "database": "disconnected",
    }
    assert "database is down" not in response.text
