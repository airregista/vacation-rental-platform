import uuid

import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_register_and_login_flow(client: AsyncClient):
    random_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    register_payload = {
        "phone": random_phone,
        "email": f"user_{uuid.uuid4().hex[:6]}@example.com",
        "password": "strongPassword123",
        "first_name": "سامان",
        "last_name": "احمدی",
    }

    # 1. Register
    reg_res = await client.post(f"{settings.API_V1_STR}/auth/register", json=register_payload)
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["phone"] == random_phone
    assert reg_data["user"]["role"] == "guest"

    # 2. Duplicate registration fails
    dup_res = await client.post(f"{settings.API_V1_STR}/auth/register", json=register_payload)
    assert dup_res.status_code == 400

    # 3. Login
    login_res = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"login": random_phone, "password": "strongPassword123"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # 4. Profile /me
    me_res = await client.get(
        f"{settings.API_V1_STR}/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["phone"] == random_phone


@pytest.mark.asyncio
async def test_invalid_login(client: AsyncClient):
    res = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"login": "09120000000", "password": "wrong_password"},
    )
    assert res.status_code == 401
