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

## Second-pass review fixes (2026-11-10)

- **Status: APPROVED 2026-11-10.** Executor commit `8d33479` on `advisor/035-review-fixes` (9 files, +417/−22). Reviewer re-ran the full suite in the worktree: **109 passed** (106 baseline + 3 new R1/R2/R3 tests), ruff 0, tsc/lint/build 0; read the full diff. R1–R3 all done. The first run STOPPED on 17 pre-existing tests that assumed an admin could assign a listing to a guest; a REVISE round fixed them by promoting the assignee to host via `become-host` (test-only change, intent preserved, R1 not weakened). The one unidentified extra failure from the first run did not reproduce.
- **Planned at:** `438fdc8` (main, post-043 merge). **Source:** the 035–040 code review (2026-11-10): a coordinator subagent reviewed the net effect of plans 035–040 on main; the advisor verified every finding below against the live code before writing this section. All 3 findings are Low; no Medium/High in this plan.
- **Scope:** `app/api/v1/endpoints/auth.py`, `app/api/v1/endpoints/accommodations.py`, the OTP model file under `app/models/` (new table only), one new Alembic migration under `migrations/`, `tests/test_auth.py` (extend). Nothing else. SKIP `plans/README.md` — the reviewer maintains it.

### R1 (Low) — Admin can assign a listing to a plain guest
- **File:** `app/api/v1/endpoints/accommodations.py:828-837`. The admin branch of `create_accommodation` checks only that `host_id` exists; it never checks `host_user.role`. A mistyped user ID hands a listing to a guest, who can then edit/delete it and manage its calendar (those endpoints authorize on `acc.host_id == current_user.id` alone) and sees it in `GET /accommodations/my`.
- **Fix:** in the admin branch, reject with 400 unless `host_user.role in ("host", "admin")`.
- **Done when:** an admin creating a listing with a guest's `host_id` gets 400; with a host/admin `host_id` still gets 201; `test_admin_create_accommodation_permission` still passes.

### R2 (Low) — OTP cache is in-process memory; OTPs break across workers/restarts
- **File:** `app/api/v1/endpoints/auth.py:139` (`_OTP_CACHE` dict). `send_otp` stores the code in a module-level dict in one worker; `verify_otp` reads whichever process handles the request. With `--workers > 1` or a restart between send and verify, the verify finds no entry and returns 400 "no request registered" despite a correct code. Latent today (single-worker run command).
- **Judgment call (flagged):** plan 037 already records this as a *production migration* ("migrate `_OTP_CACHE` to Redis or a PostgreSQL table"). This R-item implements it now because the maintainer asked to fix all correct findings. Approach: a **PostgreSQL table** (no Redis in the stack — no new infrastructure). Preserve the current TTL and the `dev_code="1234"` behavior in development.
- **Fix:** add an `otp_codes` table (`phone` PK, `code`, `expires_at`, `created_at`), an Alembic migration, and read/write the OTP through the DB instead of the dict. Keep the expiry prune.
- **Done when:** a test sends an OTP, then verifies it with the in-memory state cleared (simulating a fresh process) and it still succeeds; expired codes still fail; verifying the same code twice still fails on the second attempt; all existing auth tests pass.

### R3 (Low) — OTP is evicted before the user record is created
- **File:** `app/api/v1/endpoints/auth.py:187`. The OTP is popped right after the code check, but the auto-registration `commit()` below only catches `IntegrityError`. Any other DB failure propagates as a 500 after the OTP is already gone — the user must request a new code and start over.
- **Fix:** evict the OTP only after the user is successfully committed (with R2 this means deleting the DB row only after commit; on any failure path the row stays so the code can be retried while unexpired).
- **Done when:** a test that forces a commit failure (a non-`IntegrityError` from `db.commit`) leaves the OTP usable for a retry; the happy path still evicts after success.

### Gates
- Frontend: `npx tsc --noEmit`, `npx eslint`, `npm run build` (from `frontend/`) — all exit 0.
- Full suite: `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u all_proxy -u no_proxy -u NO_PROXY ~/workspace/.test-venv/bin/python -m pytest -q` (from the repo root) — 106 passed. The sandbox Postgres runs on 127.0.0.1:5432 from `~/workspace/.pgdata-test`; if the server is down, restart it with `su postgres -c '/home/hatch/workspace/.pgsql18/bin/pg_ctl -D /home/hatch/workspace/.pgdata-test -l /home/hatch/workspace/.pgdata-test/logfile.log start'` — the `postgres` user may need recreating after a VM replacement (`useradd -u 999 postgres`).
- `git status --porcelain` shows only in-scope files.

### Git workflow
- Work in the isolated worktree on branch `advisor/035-review-fixes`, from main `438fdc8`. Commit as `fix(auth): second-pass review fixes R1-R3`.

## Third-pass review fixes (2026-11-11)

- **Planned at:** `f1cc407` (main, post-035–040 merge). **Source:** advisor review of plans 035–043 (2026-11-10): coordinator + 9 workers; advisor verified all High/Medium against live code and spot-checked the tricky Lows. This plan: 3 Low.
- **Scope:** `app/api/v1/endpoints/auth.py`, `app/models/user.py`, `tests/test_auth.py` (extend). Nothing else. SKIP `plans/README.md` — the reviewer maintains it.
- **Gates:** `ruff check app/ tests/test_auth.py` (exit 0); full suite `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u all_proxy -u no_proxy -u NO_PROXY ~/workspace/.test-venv/bin/python -m pytest -q` → 111 passed (109 + 2 new T1/T2 tests). Run pytest only when no other suite is running (shared test DB).
- **Branch:** `advisor/035-third-pass-fixes`. Commit style: `fix(auth): third-pass review fixes T1-T3`.

### T1 (Low) — Concurrent double-verify can replay the same OTP (TOCTOU)
- **File:** `app/api/v1/endpoints/auth.py:172-219`. Verify reads the row, checks the code, creates/logs in the user, and only then deletes the row, with no row lock.
- **Scenario:** two `POST /otp/verify` requests for the same phone+code in flight at once (double-submit, client retry) both pass the check before either reaches the delete, so both mint a valid JWT. Sequential replay is correctly blocked; only the concurrent window is open. Impact is limited (both tokens belong to the same phone owner).
- **Fix:** consume the OTP atomically — e.g. `delete(OTPCode).where(phone==..., code==..., expires_at > now).returning(...)` and treat zero rows deleted as failure, or `SELECT ... FOR UPDATE`.
- **Done when:** two concurrent verifies with the same code → exactly one succeeds (the other gets 400); sequential replay still blocked; new test proves it.

### T2 (Low) — Concurrent double-send for the same phone can 500
- **File:** `app/api/v1/endpoints/auth.py:149-157`. Send does select-then-insert (`if existing: update else: db.add(...)`).
- **Scenario:** user double-taps "send code" — both requests see no row, both `INSERT` the same `phone` PK; one gets an unhandled `IntegrityError` → 500 instead of 200. Transient (a retry succeeds).
- **Fix:** upsert (`pg_insert(...).on_conflict_do_update(...)`), or catch `IntegrityError` and retry as an update.
- **Done when:** two concurrent sends for the same phone → both 200, exactly one row; new test proves it.

### T3 (Low) — Stale comment on the role column
- **File:** `app/models/user.py:26-28` (`# "admin" or "guest"`); "host" is now a legitimate role value and is never mentioned. Cosmetic.
- **Fix:** update the comment to `"admin", "host" or "guest"`.
- **Done when:** the comment lists all three roles.
