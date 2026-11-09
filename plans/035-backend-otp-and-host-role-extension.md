# Plan 035: Extend Backend with OTP Authentication and Host-Role Listing Creation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 677a622..HEAD -- app/schemas/user.py app/api/dependencies.py app/api/v1/endpoints/auth.py app/api/v1/endpoints/accommodations.py tests/test_auth.py`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Status**: DONE
- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Planned at**: commit `677a622`, 2026-11-09

## Why this matters

The Ashianak booking platform frontend incorporates Iranian travel platform conventions (Jabama / Jajiga) with passwordless SMS OTP login (Stitch screens `otp_1` and `otp_2`) and a 5-step host accommodation registration flow. Currently, the backend only permits phone+password login and restricts accommodation creation strictly to the `admin` role. This plan introduces OTP endpoints (`/auth/otp/send` and `/auth/otp/verify` with dev/test code `1234`), a `/auth/become-host` role elevation endpoint, and expands `create_accommodation` access to the `host` role while maintaining full backward compatibility with all 103 existing test cases.

## Current state

- `app/schemas/user.py:19-57` defines registration and login schemas with phone normalization:
  ```python
  def normalize_iranian_phone(phone_str: str) -> str:
      clean = re.sub(r"[\s\-]", "", str(phone_str).strip()).translate(PERSIAN_ARABIC_DIGITS)
      match = re.match(r"^(?:\+98|0098|98|0)?(9\d{9})$", clean)
      if not match:
          raise ValueError("Invalid Iranian mobile phone number format")
      return f"0{match.group(1)}"
  ```
- `app/api/dependencies.py:61-70` defines `CurrentAdminDep` requiring `role == "admin"`.
- `app/api/v1/endpoints/accommodations.py:785-790` defines `create_accommodation` gated exclusively by `admin: CurrentAdminDep`:
  ```python
  @router.post("/", response_model=AccommodationDetail, status_code=status.HTTP_201_CREATED)
  async def create_accommodation(
      acc_in: AccommodationCreate,
      admin: CurrentAdminDep,
      db: SessionDep,
  ) -> AccommodationDetail:
  ```
- `app/api/v1/endpoints/auth.py:61-79` has `login` requiring identifier + password.
- Exemplar pattern for error handling and session management: `app/api/v1/endpoints/auth.py:25-60`.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| Lint      | `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m ruff check app/` | exit 0, All checks passed! |
| Tests     | `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest -v tests/test_auth.py tests/test_accommodations.py` | all pass |
| Full suite| `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest -v` | 103+ passed |

## Scope

**In scope**:
- `app/schemas/user.py`: Define `UserOTPRequest`, `UserOTPVerify`, and `OTPResponse` schemas with phone normalization.
- `app/api/dependencies.py`: Define `CurrentHostOrAdminDep` requiring `current_user.role in ("admin", "host")`.
- `app/api/v1/endpoints/auth.py`: Implement `POST /api/v1/auth/otp/send`, `POST /api/v1/auth/otp/verify`, and `POST /api/v1/auth/become-host`.
- `app/api/v1/endpoints/accommodations.py`: Switch `create_accommodation` to `CurrentHostOrAdminDep`. For `host` role, enforce `host_id = current_user.id`.
- `tests/test_auth.py`: Add tests for OTP request, OTP verify, automatic user registration, and host promotion.

**Out of scope**:
- Real SMS provider API keys (Kavenegar / Ghasedak) — test code `1234` is enforced for local/staging development as instructed.
- Password login deprecation — password login must remain functional for existing automated tests.

## Git workflow

- Branch: `advisor/035-backend-otp-and-host-role-extension`
- Commit style: `feat(auth): implement OTP endpoints and host listing authorization`

## Steps

### Step 1: Define OTP Schemas in `app/schemas/user.py`

Add `UserOTPRequest`, `UserOTPVerify`, and `OTPResponse` with Iranian phone normalization via `normalize_iranian_phone`:
```python
class UserOTPRequest(BaseModel):
    phone: str = Field(description="Iranian mobile phone number")

    @field_validator("phone", mode="before")
    @classmethod
    def validate_and_normalize_phone(cls, v: str) -> str:
        return normalize_iranian_phone(v)


class UserOTPVerify(BaseModel):
    phone: str = Field(description="Iranian mobile phone number")
    code: str = Field(min_length=4, max_length=6, description="OTP verification code")
    first_name: str | None = Field(default=None, max_length=50)
    last_name: str | None = Field(default=None, max_length=50)

    @field_validator("phone", mode="before")
    @classmethod
    def validate_and_normalize_phone(cls, v: str) -> str:
        return normalize_iranian_phone(v)

    @field_validator("code", mode="before")
    @classmethod
    def normalize_code(cls, v: object) -> object:
        if v is None:
            return v
        return str(v).strip().translate(PERSIAN_ARABIC_DIGITS)


class OTPResponse(BaseModel):
    message: str
    dev_code: str | None = None
    expires_in_seconds: int = 300
```

**Verify**: `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m ruff check app/schemas/user.py` → exit 0

### Step 2: Implement `CurrentHostOrAdminDep` in `app/api/dependencies.py`

Add dependency allowing both `admin` and `host` roles:
```python
async def get_current_host_or_admin(current_user: CurrentUserDep) -> User:
    if current_user.role not in ("admin", "host"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Host or Admin privileges required to perform this action",
        )
    return current_user


CurrentHostOrAdminDep = Annotated[User, Depends(get_current_host_or_admin)]
```

**Verify**: `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m ruff check app/api/dependencies.py` → exit 0

### Step 3: Implement OTP & Become-Host Endpoints in `app/api/v1/endpoints/auth.py`

In `auth.py`, implement `send_otp`, `verify_otp` (with session requirement and replay eviction), and `become_host`:
```python
_OTP_CACHE: dict[str, tuple[str, datetime]] = {}


@router.post("/otp/send", response_model=OTPResponse)
async def send_otp(req: UserOTPRequest) -> OTPResponse:
    # Prune expired keys to avoid unbounded memory growth
    now = datetime.now(timezone.utc)
    expired = [k for k, (_, exp) in _OTP_CACHE.items() if exp < now]
    for k in expired:
        _OTP_CACHE.pop(k, None)

    code = "1234"
    expiry = now + timedelta(minutes=5)
    _OTP_CACHE[req.phone] = (code, expiry)
    return OTPResponse(
        message="کد تایید یکبار مصرف ارسال شد",
        dev_code=code,
        expires_in_seconds=300,
    )


@router.post("/otp/verify", response_model=Token)
async def verify_otp(payload: UserOTPVerify, db: SessionDep) -> Token:
    phone = payload.phone
    code = payload.code

    # Require prior OTP request in cache and active expiry
    cached = _OTP_CACHE.get(phone)
    if not cached:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="کد تایید منقضی شده یا درخواستی ثبت نشده است",
        )
    cached_code, expiry = cached
    if datetime.now(timezone.utc) > expiry:
        _OTP_CACHE.pop(phone, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="کد تایید منقضی شده است (کد آزمایشی: 1234)",
        )
    if code != cached_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="کد تایید وارد شده نامعتبر است (کد آزمایشی: 1234)",
        )

    # Evict on successful verification to prevent replay attacks
    _OTP_CACHE.pop(phone, None)

    stmt = select(User).where(User.phone == phone)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        user = User(
            phone=phone,
            password_hash=get_password_hash(secrets.token_hex(16)),
            first_name=payload.first_name or "کاربر",
            last_name=payload.last_name or "مهمان",
            role="guest",
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except IntegrityError:
            await db.rollback()
            stmt = select(User).where(User.phone == phone)
            user = (await db.execute(stmt)).scalars().first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="خطا در ایجاد حساب کاربری",
                )

    token = create_access_token(subject=user.id)
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/become-host", response_model=UserResponse)
async def become_host(current_user: CurrentUserDep, db: SessionDep) -> UserResponse:
    if current_user.role not in ("admin", "host"):
        current_user.role = "host"
        await db.commit()
        await db.refresh(current_user)
    return UserResponse.model_validate(current_user)
```

**Verify**: `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m ruff check app/api/v1/endpoints/auth.py` → exit 0

### Step 4: Expand Accommodation Creation in `app/api/v1/endpoints/accommodations.py`

Update `create_accommodation` signature:
```python
@router.post("/", response_model=AccommodationDetail, status_code=status.HTTP_201_CREATED)
async def create_accommodation(
    acc_in: AccommodationCreate,
    current_user: CurrentHostOrAdminDep,
    db: SessionDep,
) -> AccommodationDetail:
    ...
    if current_user.role == "admin" and acc_in.host_id is not None:
        host_user = (
            (await db.execute(select(User).where(User.id == acc_in.host_id))).scalars().first()
        )
        if not host_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Host user with ID {acc_in.host_id} not found",
            )
        host_id = acc_in.host_id
    elif (
        current_user.role != "admin"
        and acc_in.host_id is not None
        and acc_in.host_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hosts cannot create accommodations on behalf of other users",
        )
    else:
        host_id = current_user.id
```

**Verify**: `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest -v tests/test_accommodations.py::test_admin_create_accommodation_permission` → PASSED

### Step 5: Add Automated Tests in `tests/test_auth.py`

Extend `tests/test_auth.py` with `test_otp_send_and_verify_flow` and `test_become_host_flow` including accommodation creation:
```python
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

    # Upgrade to host
    host_res = await client.post(
        f"{settings.API_V1_STR}/auth/become-host",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert host_res.status_code == 200
    assert host_res.json()["role"] == "host"

    # Newly promoted host can create accommodation
    cities_res = await client.get(f"{settings.API_V1_STR}/geo/cities")
    categories_res = await client.get(f"{settings.API_V1_STR}/categories/")
    city_id = cities_res.json()[0]["id"]
    category_id = categories_res.json()[0]["id"]

    new_acc_payload = {
        "category_id": category_id,
        "city_id": city_id,
        "title": "ویلا تست هاست جدید",
        "description": "توضیحات اقامتگاه هاست",
        "address": "گیلان، رشت",
        "base_price": 2500000,
        "cleaning_fee": 200000,
        "capacity": 4,
        "max_capacity": 6,
        "extra_guest_fee": 250000,
        "rooms_count": 2,
        "beds_count": 3,
        "rules": "قوانین تست هاست",
        "is_active": True,
        "images": [{"image_url": "https://example.com/host1.jpg", "is_cover": True, "sort_order": 1}],
    }
    create_res = await client.post(
        f"{settings.API_V1_STR}/accommodations/",
        json=new_acc_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    assert create_res.json()["host_id"] == user_id
```

**Verify**: `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest -v tests/test_auth.py` → all pass

## Test plan

- Test happy path: send OTP -> verify with "1234" -> receive token.
- Test rejection: send OTP -> verify with "9999" -> HTTP 400 error.
- Test unrequested OTP: verify without sending OTP -> HTTP 400 error.
- Test replay prevention: verifying the same OTP twice fails on second attempt.
- Test RBAC: guest attempting `POST /accommodations/` receives HTTP 403; host receives HTTP 201.
- Verification command: `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest -v` (104+ passed).

## Done criteria

- [x] `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m ruff check app/` exits 0 with zero lint errors
- [x] `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest -v tests/test_auth.py` exits 0 with all auth and OTP tests passing
- [x] `& "C:\Users\user\miniconda3\envs\ai_bootcamp\python.exe" -m pytest -v` exits 0 across entire test suite
- [x] `git status --porcelain` shows only in-scope files modified
- [x] `plans/README.md` status row updated

## STOP conditions

- If changing `create_accommodation` causes `test_admin_create_accommodation_permission` to fail.
- If phone normalization alters phone hashes or breaks uniqueness constraints.

## Maintenance notes

- When deploying to production with a real Iranian SMS provider (Kavenegar / Ghasedak / SMS.ir), replace `dev_code="1234"` with cryptographically secure 5-digit generation (`secrets.randbelow`) and gate the static code behind `settings.ENVIRONMENT == "development"`.
