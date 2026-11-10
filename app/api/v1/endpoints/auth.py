import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentUserDep, SessionDep
from app.core.security import create_access_token, get_password_hash, verify_password
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


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, db: SessionDep) -> Token:
    # Check phone uniqueness
    stmt = select(User).where(User.phone == user_in.phone)
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this phone number already exists",
        )

    # Check email uniqueness if provided
    if user_in.email:
        stmt = select(User).where(func.lower(User.email) == user_in.email)
        result = await db.execute(stmt)
        if result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address already exists",
            )

    new_user = User(
        phone=user_in.phone,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
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
            detail="A user with this phone number or email address already exists",
        )
    await db.refresh(new_user)

    token = create_access_token(subject=new_user.id)
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user),
    )


@router.post("/login", response_model=Token)
async def login(login_data: UserLogin, db: SessionDep) -> Token:
    identifier = login_data.login.strip()
    stmt = select(User).where(or_(User.phone == identifier, func.lower(User.email) == identifier))
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Incorrect phone/email or password",
        )

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
    if user_update.email and user_update.email != current_user.email:
        stmt = select(User).where(
            func.lower(User.email) == user_update.email, User.id != current_user.id
        )
        result = await db.execute(stmt)
        if result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email address is already in use by another account",
            )
        current_user.email = user_update.email

    if user_update.first_name is not None:
        current_user.first_name = user_update.first_name
    if user_update.last_name is not None:
        current_user.last_name = user_update.last_name
    if user_update.avatar_url is not None:
        current_user.avatar_url = user_update.avatar_url
    if user_update.shaba_number is not None:
        current_user.shaba_number = user_update.shaba_number

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
async def send_otp(req: UserOTPRequest, db: SessionDep) -> OTPResponse:
    # Prune expired codes to avoid unbounded table growth. OTP codes live
    # in PostgreSQL (not in-process memory) so a code sent by one worker
    # can be verified by another and survives restarts.
    now = datetime.now(timezone.utc)
    await db.execute(delete(OTPCode).where(OTPCode.expires_at < now))

    # Test OTP code as requested by user
    code = "1234"
    expiry = now + timedelta(minutes=5)
    existing = (
        (await db.execute(select(OTPCode).where(OTPCode.phone == req.phone))).scalars().first()
    )
    if existing:
        existing.code = code
        existing.expires_at = expiry
    else:
        db.add(OTPCode(phone=req.phone, code=code, expires_at=expiry))
    await db.commit()
    return OTPResponse(
        message="کد تایید یکبار مصرف ارسال شد",
        dev_code=code,
        expires_in_seconds=300,
    )


@router.post("/otp/verify", response_model=Token)
async def verify_otp(payload: UserOTPVerify, db: SessionDep) -> Token:
    phone = payload.phone
    code = payload.code

    # Require prior OTP request in the database and active expiry
    otp_row = (await db.execute(select(OTPCode).where(OTPCode.phone == phone))).scalars().first()
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
    if code != otp_row.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="کد تایید وارد شده نامعتبر است (کد آزمایشی: 1234)",
        )

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

    # Evict the OTP only after the user is successfully persisted, so a
    # failed commit leaves the code usable for a retry while unexpired.
    await db.delete(otp_row)
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
