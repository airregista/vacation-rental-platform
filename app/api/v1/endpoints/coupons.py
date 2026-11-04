from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentAdminDep, SessionDep
from app.models.coupon import Coupon
from app.schemas.coupon import (
    CouponCreate,
    CouponResponse,
    CouponValidateRequest,
    CouponValidateResponse,
)

router = APIRouter(prefix="/coupons", tags=["coupons"])


@router.post("/", response_model=CouponResponse, status_code=status.HTTP_201_CREATED)
async def create_coupon(
    coupon_in: CouponCreate, admin: CurrentAdminDep, db: SessionDep
) -> CouponResponse:
    clean_code = coupon_in.code.strip().upper()
    existing = (await db.execute(select(Coupon).where(Coupon.code == clean_code))).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    coupon = Coupon(**coupon_in.model_dump())
    coupon.code = clean_code
    db.add(coupon)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    await db.refresh(coupon)
    return CouponResponse.model_validate(coupon)


@router.get("/", response_model=list[CouponResponse])
async def list_coupons(
    admin: CurrentAdminDep,
    db: SessionDep,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[CouponResponse]:
    stmt = (
        select(Coupon)
        .order_by(Coupon.created_at.desc(), Coupon.id.desc())
        .offset(skip)
        .limit(limit)
    )
    coupons = (await db.execute(stmt)).scalars().all()
    return [CouponResponse.model_validate(c) for c in coupons]


@router.post("/validate", response_model=CouponValidateResponse)
async def validate_coupon(req: CouponValidateRequest, db: SessionDep) -> CouponValidateResponse:
    clean_code = req.code.strip().upper()
    coupon = (await db.execute(select(Coupon).where(Coupon.code == clean_code))).scalars().first()
    now_utc = datetime.now(timezone.utc)
    if not coupon or not coupon.is_active:
        return CouponValidateResponse(is_valid=False, message="Invalid or inactive coupon code")
    if now_utc < coupon.valid_from:
        return CouponValidateResponse(is_valid=False, message="Coupon is not yet active")
    if now_utc > coupon.valid_until:
        return CouponValidateResponse(is_valid=False, message="Coupon has expired")
    if req.booking_amount < coupon.min_booking_amount:
        return CouponValidateResponse(
            is_valid=False, message=f"Minimum booking amount is {coupon.min_booking_amount}"
        )
    if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
        return CouponValidateResponse(is_valid=False, message="Coupon usage limit reached")

    if coupon.discount_type == "percentage":
        raw = (req.booking_amount * Decimal(coupon.discount_value)) / Decimal(100)
        if coupon.max_discount_amount:
            raw = min(raw, Decimal(coupon.max_discount_amount))
    else:
        raw = min(req.booking_amount, Decimal(coupon.discount_value))

    return CouponValidateResponse(
        is_valid=True,
        discount_amount=Decimal(round(raw)),
        discount_type=coupon.discount_type,
        message="Coupon applied successfully",
    )
