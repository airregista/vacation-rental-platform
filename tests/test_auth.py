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


@pytest.mark.asyncio
async def test_phone_normalization_registration(client: AsyncClient):
    suffix = f"{uuid.uuid4().int % 10000000:07d}"
    phone_plus98 = f"+98935{suffix}"
    canonical_phone = f"0935{suffix}"

    payload = {
        "phone": phone_plus98,
        "email": f"norm_{uuid.uuid4().hex[:6]}@example.com",
        "password": "strongPassword123",
    }
    reg_res = await client.post(f"{settings.API_V1_STR}/auth/register", json=payload)
    assert reg_res.status_code == 201
    assert reg_res.json()["user"]["phone"] == canonical_phone

    # Duplicate registration with local 09 format must be rejected
    dup_payload = {
        "phone": canonical_phone,
        "email": f"dup_{uuid.uuid4().hex[:6]}@example.com",
        "password": "strongPassword123",
    }
    dup_res = await client.post(f"{settings.API_V1_STR}/auth/register", json=dup_payload)
    assert dup_res.status_code == 400


@pytest.mark.asyncio
async def test_phone_cross_format_and_persian_digits_login(client: AsyncClient):
    suffix = f"{uuid.uuid4().int % 10000000:07d}"
    phone_plus98 = f"+98935{suffix}"
    canonical_phone = f"0935{suffix}"
    unprefixed_phone = f"935{suffix}"
    password = "strongPassword123"

    payload = {
        "phone": phone_plus98,
        "email": f"cross_{uuid.uuid4().hex[:6]}@example.com",
        "password": password,
    }
    reg_res = await client.post(f"{settings.API_V1_STR}/auth/register", json=payload)
    assert reg_res.status_code == 201

    # Digits mappings
    persian_digits_map = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
    arabic_digits_map = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")

    persian_phone = canonical_phone.translate(persian_digits_map)
    arabic_phone = canonical_phone.translate(arabic_digits_map)

    for login_id in [canonical_phone, phone_plus98, unprefixed_phone, persian_phone, arabic_phone]:
        login_res = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            json={"login": login_id, "password": password},
        )
        assert login_res.status_code == 200, f"Failed logging in with identifier {login_id}"
        assert "access_token" in login_res.json()


@pytest.mark.asyncio
async def test_case_insensitive_email_login_and_registration(client: AsyncClient):
    uid = uuid.uuid4().hex[:6]
    mixed_email = f"TestUser_{uid}@Example.COM"
    lower_email = mixed_email.lower()
    phone1 = f"0912{uuid.uuid4().int % 10000000:07d}"
    phone2 = f"0912{uuid.uuid4().int % 10000000:07d}"
    password = "strongPassword123"

    # Register with mixed case email
    payload = {
        "phone": phone1,
        "email": mixed_email,
        "password": password,
    }
    reg_res = await client.post(f"{settings.API_V1_STR}/auth/register", json=payload)
    assert reg_res.status_code == 201
    assert reg_res.json()["user"]["email"] == lower_email

    # Attempt duplicate registration with lower case email
    dup_payload = {
        "phone": phone2,
        "email": lower_email,
        "password": password,
    }
    dup_res = await client.post(f"{settings.API_V1_STR}/auth/register", json=dup_payload)
    assert dup_res.status_code == 400

    # Login with mixed case email and lower case email
    for email_identifier in [mixed_email, lower_email]:
        login_res = await client.post(
            f"{settings.API_V1_STR}/auth/login",
            json={"login": email_identifier, "password": password},
        )
        assert login_res.status_code == 200
        assert "access_token" in login_res.json()


@pytest.mark.asyncio
async def test_update_user_profile_success(client: AsyncClient):
    random_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    register_payload = {
        "phone": random_phone,
        "email": f"user_{uuid.uuid4().hex[:6]}@example.com",
        "password": "strongPassword123",
        "first_name": "سارا",
        "last_name": "بهرامی",
    }
    reg_res = await client.post(f"{settings.API_V1_STR}/auth/register", json=register_payload)
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]

    update_payload = {
        "first_name": "مریم",
        "last_name": "رضایی",
        "avatar_url": "https://example.com/avatars/maryam.jpg",
    }
    put_res = await client.put(
        f"{settings.API_V1_STR}/auth/me",
        json=update_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert put_res.status_code == 200
    data = put_res.json()
    assert data["first_name"] == update_payload["first_name"]
    assert data["last_name"] == update_payload["last_name"]
    assert data["avatar_url"] == update_payload["avatar_url"]
    assert data["phone"] == random_phone


@pytest.mark.asyncio
async def test_update_user_profile_email_collision_rejected(client: AsyncClient):
    uid_a = uuid.uuid4().hex[:6]
    uid_b = uuid.uuid4().hex[:6]
    email_a = f"usera_{uid_a}@example.com"
    email_b = f"userb_{uid_b}@example.com"
    password = "strongPassword123"

    # Register User A
    res_a = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": f"0912{uuid.uuid4().int % 10000000:07d}",
            "email": email_a,
            "password": password,
        },
    )
    assert res_a.status_code == 201

    # Register User B
    res_b = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": f"0912{uuid.uuid4().int % 10000000:07d}",
            "email": email_b,
            "password": password,
        },
    )
    assert res_b.status_code == 201
    token_b = res_b.json()["access_token"]

    # User B attempts PUT /auth/me with User A's email (lowercase)
    collision_res = await client.put(
        f"{settings.API_V1_STR}/auth/me",
        json={"email": email_a},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert collision_res.status_code == 400
    assert "already in use" in collision_res.json()["detail"]

    # User B attempts PUT /auth/me with User A's email (mixed-case)
    collision_mixed = await client.put(
        f"{settings.API_V1_STR}/auth/me",
        json={"email": email_a.upper()},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert collision_mixed.status_code == 400
    assert "already in use" in collision_mixed.json()["detail"]


@pytest.mark.asyncio
async def test_update_user_shaba_number_normalization_and_validation(client: AsyncClient):
    uid = uuid.uuid4().hex[:6]
    reg_res = await client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "phone": f"0912{uuid.uuid4().int % 10000000:07d}",
            "email": f"shaba_{uid}@example.com",
            "password": "Password123!",
        },
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]

    # Normalize lowercase and spaces/hyphens
    res = await client.put(
        f"{settings.API_V1_STR}/auth/me",
        json={"shaba_number": "ir 12-3456-7890-1234-5678-9012-34"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["shaba_number"] == "IR123456789012345678901234"

    # Invalid format rejection
    invalid_res = await client.put(
        f"{settings.API_V1_STR}/auth/me",
        json={"shaba_number": "IR123"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert invalid_res.status_code == 422

