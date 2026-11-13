from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import CurrentAdminDep, SessionDep
from app.models.coupon import Coupon
from app.schemas.coupon import (
    CouponCreate,
    CouponResponse,
    CouponUpdate,
    CouponValidateRequest,
    CouponValidateResponse,
)
from app.services.coupon_service import evaluate_coupon, get_coupon_by_code, normalize_code

router = APIRouter(prefix="/coupons", tags=["coupons"])


@router.post("/", response_model=CouponResponse, status_code=status.HTTP_201_CREATED)
async def create_coupon(
    coupon_in: CouponCreate, admin: CurrentAdminDep, db: SessionDep
) -> CouponResponse:
    clean_code = normalize_code(coupon_in.code)
    coupon_data = coupon_in.model_dump()
    coupon_data["code"] = clean_code
    coupon = Coupon(**coupon_data)
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
    coupon = await get_coupon_by_code(db, req.code)
    evaluation = evaluate_coupon(coupon, req.booking_amount)
    return CouponValidateResponse(
        is_valid=evaluation.is_valid,
        discount_amount=evaluation.discount_amount,
        discount_type=evaluation.discount_type,
        message=evaluation.message,
    )


@router.put("/{id}", response_model=CouponResponse)
async def update_coupon(
    id: int,
    coupon_in: CouponUpdate,
    admin: CurrentAdminDep,
    db: SessionDep,
) -> CouponResponse:
    stmt = select(Coupon).where(Coupon.id == id).with_for_update()
    coupon = (await db.execute(stmt)).scalars().first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")

    updates = coupon_in.model_dump(exclude_unset=True)
    if not updates:
        return CouponResponse.model_validate(coupon)

    non_nullable = {
        "discount_value",
        "min_booking_amount",
        "valid_from",
        "valid_until",
        "is_active",
    }
    for field in non_nullable & updates.keys():
        if updates[field] is None:
            raise HTTPException(
                status_code=400,
                detail=f"{field} cannot be null",
            )

    new_from = updates.get("valid_from", coupon.valid_from)
    new_until = updates.get("valid_until", coupon.valid_until)
    if new_until <= new_from:
        raise HTTPException(
            status_code=400,
            detail="valid_until must be after valid_from",
        )

    new_value = updates.get("discount_value", coupon.discount_value)
    if coupon.discount_type == "percentage" and new_value > 100:
        raise HTTPException(
            status_code=400,
            detail="Percentage discount cannot exceed 100%",
        )

    if "usage_limit" in updates and updates["usage_limit"] is not None:
        if updates["usage_limit"] < coupon.used_count:
            raise HTTPException(
                status_code=400,
                detail=(
                    "usage_limit cannot be lower than the already consumed "
                    f"count ({coupon.used_count})"
                ),
            )

    for field, value in updates.items():
        setattr(coupon, field, value)

    await db.commit()
    await db.refresh(coupon)
    return CouponResponse.model_validate(coupon)
