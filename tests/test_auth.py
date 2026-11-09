import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError

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


@pytest.mark.asyncio
async def test_register_duplicate_integrity_error_handled_as_400(client: AsyncClient):
    phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    payload = {
        "phone": phone,
        "email": f"integ_{uuid.uuid4().hex[:6]}@example.com",
        "password": "Password123!",
    }

    # Simulate race condition raising IntegrityError on commit
    with patch(
        "sqlalchemy.ext.asyncio.AsyncSession.commit",
        side_effect=IntegrityError("stmt", {}, Exception("orig")),
    ):
        res = await client.post(f"{settings.API_V1_STR}/auth/register", json=payload)
        assert res.status_code == 400
        assert "already exists" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_invalid_email_format_rejected(client: AsyncClient):
    for invalid_email in ["notanemail", "user@", "@domain.com", "user@domain..com", ""]:
        res = await client.post(
            f"{settings.API_V1_STR}/auth/register",
            json={
                "phone": f"0912{uuid.uuid4().int % 10000000:07d}",
                "email": invalid_email,
                "password": "Password123!",
            },
        )
        assert res.status_code == 422


@pytest.mark.asyncio
async def test_otp_send_and_verify_flow(client: AsyncClient):
    random_phone = f"0912{uuid.uuid4().int % 10000000:07d}"

    # 0. Rejection of OTP verification without prior send
    unrequested_res = await client.post(
        f"{settings.API_V1_STR}/auth/otp/verify",
        json={"phone": random_phone, "code": "1234"},
    )
    assert unrequested_res.status_code == 400

    # 1. Send OTP
    send_res = await client.post(
        f"{settings.API_V1_STR}/auth/otp/send",
        json={"phone": random_phone},
    )
    assert send_res.status_code == 200
    data = send_res.json()
    assert data["dev_code"] == "1234"

    # 2. Rejection of invalid OTP
    bad_res = await client.post(
        f"{settings.API_V1_STR}/auth/otp/verify",
        json={"phone": random_phone, "code": "9999"},
    )
    assert bad_res.status_code == 400

    # 3. Successful verification with 1234 creates user and issues JWT
    ok_res = await client.post(
        f"{settings.API_V1_STR}/auth/otp/verify",
        json={"phone": random_phone, "code": "1234", "first_name": "تست", "last_name": "پیامکی"},
    )
    assert ok_res.status_code == 200
    token_data = ok_res.json()
    assert "access_token" in token_data
    assert token_data["user"]["phone"] == random_phone
    assert token_data["user"]["first_name"] == "تست"
    assert token_data["user"]["role"] == "guest"

    # 4. Replay attack rejection: code already evicted on success
    replay_res = await client.post(
        f"{settings.API_V1_STR}/auth/otp/verify",
        json={"phone": random_phone, "code": "1234"},
    )
    assert replay_res.status_code == 400

    # 5. Schema validation: code=null returns 422 Unprocessable Entity
    null_code_res = await client.post(
        f"{settings.API_V1_STR}/auth/otp/verify",
        json={"phone": random_phone, "code": None},
    )
    assert null_code_res.status_code == 422

    # 6. Existing user re-login with OTP (does not duplicate user, issues valid JWT)
    await client.post(
        f"{settings.API_V1_STR}/auth/otp/send",
        json={"phone": random_phone},
    )
    relogin_res = await client.post(
        f"{settings.API_V1_STR}/auth/otp/verify",
        json={"phone": random_phone, "code": "1234"},
    )
    assert relogin_res.status_code == 200
    assert relogin_res.json()["user"]["id"] == token_data["user"]["id"]

    # 7. Persian numeral phone & code normalization
    persian_phone = "۰۹۱۲" + str(uuid.uuid4().int % 10000000).zfill(7).translate(
        str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
    )
    send_persian = await client.post(
        f"{settings.API_V1_STR}/auth/otp/send",
        json={"phone": persian_phone},
    )
    assert send_persian.status_code == 200
    verify_persian = await client.post(
        f"{settings.API_V1_STR}/auth/otp/verify",
        json={"phone": persian_phone, "code": "۱۲۳۴"},
    )
    assert verify_persian.status_code == 200
    assert verify_persian.json()["user"]["phone"].startswith("0912")


@pytest.mark.asyncio
async def test_become_host_flow(client: AsyncClient):
    random_phone = f"0912{uuid.uuid4().int % 10000000:07d}"
    await client.post(
        f"{settings.API_V1_STR}/auth/otp/send",
        json={"phone": random_phone},
    )
    verify_res = await client.post(
        f"{settings.API_V1_STR}/auth/otp/verify",
        json={"phone": random_phone, "code": "1234"},
    )
    token = verify_res.json()["access_token"]
    user_id = verify_res.json()["user"]["id"]

    # Guest user cannot create accommodation (403)
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    acc_payload = {
        "category_id": category_id,
        "city_id": city_id,
        "title": "ویلا هاست تستی جدید",
        "description": "توضیحات تست هاست",
        "address": "گیلان، رشت",
        "base_price": 2000000,
        "cleaning_fee": 150000,
        "capacity": 3,
        "max_capacity": 5,
        "extra_guest_fee": 100000,
        "rooms_count": 1,
        "beds_count": 2,
        "rules": "قوانین اقامتگاه",
        "is_active": True,
        "images": [{"image_url": "https://example.com/host.jpg", "is_cover": True, "sort_order": 1}],
    }

    guest_create = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=acc_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert guest_create.status_code == 403

    # Upgrade to host
    host_res = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert host_res.status_code == 200
    assert host_res.json()["role"] == "host"

    # Newly promoted host cannot create accommodation on behalf of another host (403)
    spoofed_payload = dict(acc_payload)
    spoofed_payload["host_id"] = user_id + 999
    spoofed_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=spoofed_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert spoofed_res.status_code == 403

    # Newly promoted host can create accommodation (201)
    host_create = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=acc_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert host_create.status_code == 201
    created_acc = host_create.json()
    assert created_acc["host_id"] == user_id
    assert created_acc["title"] == acc_payload["title"]
