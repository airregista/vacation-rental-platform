import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import delete, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentUserDep, SessionDep
from app.core.config import settings
from app.core.rate_limit import (
    check_and_record_failed_login,
    check_login_rate_limit,
    clear_login_attempts,
)
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.models.otp_code import OTPCode
from app.models.user import User
from app.schemas.user import (
    OTPResponse,
    Token,
    UserLogin,
    UserOTPRequest,
    UserOTPVerify,
    UserRegister,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_REGISTRATION_REJECTED = "Registration could not be completed with the provided details"


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, request: Request, db: SessionDep) -> Token:
    client_ip = request.client.host if request.client else "unknown"
    check_and_record_failed_login(
        f"register-ip:{client_ip}",
        limit=settings.REGISTER_RATE_LIMIT_MAX_ATTEMPTS_PER_IP,
        detail="Too many registration attempts. Try again later.",
    )

    # Check phone uniqueness
    stmt = select(User).where(User.phone == user_in.phone)
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_REGISTRATION_REJECTED,
        )

    # Check email uniqueness if provided
    if user_in.email:
        stmt = select(User).where(User.email == user_in.email)
        result = await db.execute(stmt)
        if result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=_REGISTRATION_REJECTED,
            )

    new_user = User(
        phone=user_in.phone,
        email=user_in.email,
        password_hash=await run_in_threadpool(get_password_hash, user_in.password),
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        role="guest",
    )
    db.add(new_user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_REGISTRATION_REJECTED,
        )
    await db.refresh(new_user)

    token = create_access_token(subject=new_user.id)
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user),
    )


@router.post("/login", response_model=Token)
async def login(login_data: UserLogin, request: Request, db: SessionDep) -> Token:
    identifier = login_data.login.strip()
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"login:{client_ip}:{identifier.lower()}"
    ip_rate_key = f"login-ip:{client_ip}"
    check_login_rate_limit(rate_key)
    check_login_rate_limit(ip_rate_key, limit=settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP)
    stmt = select(User).where(or_(User.phone == identifier, User.email == identifier))
    result = await db.execute(stmt)
    user = result.scalars().first()

    password_hash = user.password_hash if user else DUMMY_PASSWORD_HASH
    password_ok = await run_in_threadpool(verify_password, login_data.password, password_hash)

    if user is None or not password_ok:
        # Count the failure against both the identifier and the source IP.
        # The IP bucket is intentionally not cleared on success: otherwise a
        # malicious registered user could reset it by logging into their own
        # account between bursts.
        check_and_record_failed_login(rate_key)
        check_and_record_failed_login(
            ip_rate_key, limit=settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Incorrect phone/email or password",
        )

    clear_login_attempts(rate_key)
    token = create_access_token(subject=user.id)
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUserDep) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> UserResponse:
    fields = user_update.model_fields_set
    if "email" in fields:
        if user_update.email is None:
            current_user.email = None
        elif user_update.email != current_user.email:
            stmt = select(User).where(User.email == user_update.email, User.id != current_user.id)
            result = await db.execute(stmt)
            if result.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This email address is already in use by another account",
                )
            current_user.email = user_update.email

    # model_fields_set distinguishes "omitted" from "explicitly null", so
    # an explicit null clears the field while an omitted field is untouched.
    for attr in ("first_name", "last_name", "avatar_url", "shaba_number"):
        if attr in fields:
            setattr(current_user, attr, getattr(user_update, attr))

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email address is already in use by another account",
        )
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/otp/send", response_model=OTPResponse)
async def send_otp(req: UserOTPRequest, request: Request, db: SessionDep) -> OTPResponse:
    client_ip = request.client.host if request.client else "unknown"
    ip_rate_key = f"otp-send-ip:{client_ip}"
    check_login_rate_limit(ip_rate_key, limit=settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP)

    # Prune expired codes to avoid unbounded table growth. OTP codes live
    # in PostgreSQL (not in-process memory) so a code sent by one worker
    # can be verified by another and survives restarts.
    now = datetime.now(timezone.utc)
    await db.execute(delete(OTPCode).where(OTPCode.expires_at < now))

    # Test OTP code as requested by user
    code = "1234"
    expiry = now + timedelta(minutes=5)
    # Upsert: two concurrent sends for the same phone must both succeed
    # instead of racing on select-then-insert and 500ing on the phone PK.
    stmt = (
        pg_insert(OTPCode)
        .values(phone=req.phone, code=code, expires_at=expiry)
        .on_conflict_do_update(
            index_elements=["phone"],
            # created_at refreshes on every resend so the 60s cooldown
            # below is measured from the last send, not the first.
            set_={"code": code, "expires_at": expiry, "created_at": now},
        )
    )
    # Per-phone 60s cooldown, measured from the last send (created_at is
    # refreshed on every resend by the upsert below). No hourly cap: that
    # would need a send-log table.
    existing = (
        (await db.execute(select(OTPCode).where(OTPCode.phone == req.phone))).scalars().first()
    )
    if existing and existing.created_at is not None:
        elapsed = (now - existing.created_at).total_seconds()
        if elapsed < 60:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"لطفاً {int(60 - elapsed)} ثانیه دیگر دوباره تلاش کنید",
            )
    # Count only sends that pass the per-phone cooldown: rejected retries do no
    # DB write and should not consume the caller's IP budget.
    check_and_record_failed_login(ip_rate_key, limit=settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP)
    await db.execute(stmt)
    await db.commit()
    return OTPResponse(
        message="کد تایید یکبار مصرف ارسال شد",
        dev_code=code,
        expires_in_seconds=300,
    )


@router.post("/otp/verify", response_model=Token)
async def verify_otp(payload: UserOTPVerify, request: Request, db: SessionDep) -> Token:
    phone = payload.phone
    code = payload.code
    client_ip = request.client.host if request.client else "unknown"
    # Scope the per-phone lockout to the requesting IP: a third party cannot
    # lock the victim's phone by sending wrong codes from another address.
    otp_rate_key = f"otp:{client_ip}:{phone}"
    otp_ip_key = f"otp-ip:{client_ip}"
    check_login_rate_limit(otp_rate_key)
    check_login_rate_limit(otp_ip_key, limit=settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP)

    # Atomically consume the OTP: the DELETE only removes a live row
    # matching this phone+code, so two concurrent verifies can never both
    # pass the check (TOCTOU). Zero rows deleted means the code is
    # missing, wrong, or expired — read the row only to tell the caller
    # which one.
    now = datetime.now(timezone.utc)
    consumed = (
        (
            await db.execute(
                delete(OTPCode)
                .where(OTPCode.phone == phone, OTPCode.code == code, OTPCode.expires_at > now)
                .returning(OTPCode.phone)
            )
        )
        .scalars()
        .first()
    )
    if consumed is None:
        check_and_record_failed_login(otp_rate_key)
        check_and_record_failed_login(
            otp_ip_key, limit=settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP
        )
        otp_row = (
            (await db.execute(select(OTPCode).where(OTPCode.phone == phone))).scalars().first()
        )
        if not otp_row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="کد تایید منقضی شده یا درخواستی ثبت نشده است",
            )
        if datetime.now(timezone.utc) > otp_row.expires_at:
            await db.delete(otp_row)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="کد تایید منقضی شده است (کد آزمایشی: 1234)",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="کد تایید وارد شده نامعتبر است (کد آزمایشی: 1234)",
        )

    clear_login_attempts(otp_rate_key)

    stmt = select(User).where(User.phone == phone)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        user = User(
            phone=phone,
            password_hash=await run_in_threadpool(get_password_hash, secrets.token_hex(16)),
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
            # The rollback also undid the atomic OTP consumption, and the
            # user was created by a concurrent request — consume the code
            # again before issuing a token.
            await db.execute(delete(OTPCode).where(OTPCode.phone == phone, OTPCode.code == code))
            await db.commit()

    # Persist the OTP consumption (a no-op when the user-creation commit
    # above already committed it). A failed commit rolls the delete back,
    # so the code stays usable for a retry while unexpired.
    await db.commit()

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
