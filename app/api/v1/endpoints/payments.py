import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.dependencies import CurrentUserDep, SessionDep
from app.core.config import settings
from app.models.accommodation import Accommodation
from app.models.payment import HostPayout, Payment
from app.models.reservation import Reservation
from app.schemas.payment import (
    HostPayoutResponse,
    PaymentInitiateRequest,
    PaymentInitiateResponse,
    PaymentResponse,
    PaymentVerifyRequest,
)
from app.services.coupon_service import lock_coupon_by_code
from app.services.reservation_service import check_and_expire_reservation, check_booking_overlap

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post(
    "/checkout", response_model=PaymentInitiateResponse, status_code=status.HTTP_201_CREATED
)
async def checkout_payment(
    req: PaymentInitiateRequest,
    current_user: CurrentUserDep,
    db: SessionDep,
    response: Response,
) -> PaymentInitiateResponse:
    stmt = (
        select(Reservation)
        .options(selectinload(Reservation.accommodation), selectinload(Reservation.payments))
        .where(Reservation.id == req.reservation_id)
        .with_for_update(of=Reservation)
    )
    res = await db.execute(stmt)
    reservation = res.scalars().first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found",
        )

    if current_user.role != "admin" and reservation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

    if reservation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot initiate payment for reservation with status '{reservation.status}'. Only 'pending' allowed.",
        )

    if reservation.total_price <= Decimal(0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reservation total price is zero; payment is not required.",
        )

    if await check_and_expire_reservation(db, reservation, commit=True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reservation has expired due to payment timeout. Please create a new booking.",
        )

    existing = (
        (
            await db.execute(
                select(Payment).where(
                    Payment.reservation_id == reservation.id,
                    Payment.status == "pending",
                )
            )
        )
        .scalars()
        .first()
    )
    if existing:
        # Reusing a pending payment is not a creation, so report 200 instead of
        # the route's default 201.
        response.status_code = status.HTTP_200_OK
        return PaymentInitiateResponse(
            payment_id=existing.id,
            reservation_id=reservation.id,
            amount=existing.amount,
            tracking_code=existing.tracking_code or "",
            gateway_url=f"https://shaparak.mock/pay?token={existing.tracking_code or ''}",
        )

    tracking_code = f"SHP-{uuid.uuid4().hex[:12].upper()}"
    payment = Payment(
        reservation_id=reservation.id,
        amount=reservation.total_price,
        tracking_code=tracking_code,
        status="pending",
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    return PaymentInitiateResponse(
        payment_id=payment.id,
        reservation_id=reservation.id,
        amount=payment.amount,
        tracking_code=tracking_code,
        gateway_url=f"https://shaparak.mock/pay?token={tracking_code}",
    )


@router.post("/verify", response_model=PaymentResponse)
async def verify_payment(
    req: PaymentVerifyRequest,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> PaymentResponse:
    stmt = (
        select(Payment)
        .options(selectinload(Payment.reservation).selectinload(Reservation.accommodation))
        .where(Payment.id == req.payment_id)
    )
    res = await db.execute(stmt)
    payment = res.scalars().first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found"
        )

    reservation = payment.reservation
    if current_user.role != "admin" and reservation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

    if payment.status == "success":
        return PaymentResponse.model_validate(payment)

    if payment.tracking_code and req.tracking_code != payment.tracking_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tracking code for this payment",
        )

    if payment.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment is already in '{payment.status}' state",
        )

    # Lock order everywhere: Reservation -> Accommodation/HostPayout -> Payment -> Coupon.
    reservation = (
        (
            await db.execute(
                select(Reservation)
                .options(selectinload(Reservation.accommodation))
                .where(Reservation.id == payment.reservation_id)
                .with_for_update(of=Reservation)
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .first()
    )

    # A concurrent verification may have completed while this request waited
    # for the reservation lock. Re-read the payment before rejecting on the
    # reservation status so duplicate verifications stay idempotent (200).
    payment = (
        (
            await db.execute(
                select(Payment)
                .where(Payment.id == req.payment_id)
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .first()
    )
    if payment and payment.status == "success":
        return PaymentResponse.model_validate(payment)

    if not reservation or reservation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Reservation is no longer pending "
                f"(current status: {reservation.status if reservation else 'missing'})"
            ),
        )

    if await check_and_expire_reservation(db, reservation, commit=True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reservation has expired due to payment timeout. Please create a new booking.",
        )

    if req.simulate_success:
        # Lock parent accommodation to serialize concurrent confirmations for this property
        acc_stmt = (
            select(Accommodation)
            .where(Accommodation.id == reservation.accommodation_id)
            .with_for_update(of=Accommodation)
        )
        await db.execute(acc_stmt)

    payment = (
        (
            await db.execute(
                select(Payment)
                .where(Payment.id == req.payment_id)
                .with_for_update(of=Payment)
                .execution_options(populate_existing=True)
            )
        )
        .scalars()
        .first()
    )
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found"
        )
    if payment.status == "success":
        return PaymentResponse.model_validate(payment)
    if payment.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment is already in '{payment.status}' state",
        )

    if req.simulate_success:
        # Re-verify no conflicting confirmed reservation exists
        is_conflict = await check_booking_overlap(
            db=db,
            accommodation_id=reservation.accommodation_id,
            check_in=reservation.check_in,
            check_out=reservation.check_out,
            exclude_reservation_id=reservation.id,
        )
        if is_conflict:
            payment.status = "failed"
            reservation.status = "cancelled"
            reservation.cancellation_reason = "Dates occupied by concurrent confirmed booking"
            reservation.cancelled_at = datetime.now(timezone.utc)
            if reservation.coupon_code:
                c_obj = await lock_coupon_by_code(db, reservation.coupon_code)
                if c_obj and c_obj.used_count > 0:
                    c_obj.used_count -= 1
            await (
                db.commit()
            )  # Persist failed payment and cancelled reservation state before raising
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Dates are no longer available. Another booking was confirmed while payment was processing.",
            )

        payment.status = "success"
        payment.paid_at = datetime.now(timezone.utc)
        reservation.status = "confirmed"

        host_id = reservation.accommodation.host_id
        commission_amount = Decimal(
            round(reservation.total_price * settings.PLATFORM_COMMISSION_RATE)
        )
        payout_amount = max(Decimal(0), reservation.total_price - commission_amount)

        payout = HostPayout(
            reservation_id=reservation.id,
            host_id=host_id,
            total_booking_amount=reservation.total_price,
            commission_amount=commission_amount,
            payout_amount=payout_amount,
            status="pending",
        )
        db.add(payout)
    else:
        payment.status = "failed"

    await db.commit()
    await db.refresh(payment)
    return PaymentResponse.model_validate(payment)


@router.get("/my", response_model=list[PaymentResponse])
async def list_my_payments(
    current_user: CurrentUserDep,
    db: SessionDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[PaymentResponse]:
    stmt = (
        select(Payment)
        .join(Payment.reservation)
        .where(Reservation.user_id == current_user.id)
        .order_by(Payment.created_at.desc(), Payment.id.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    payments = result.scalars().all()
    return [PaymentResponse.model_validate(p) for p in payments]


@router.get("/host/payouts", response_model=list[HostPayoutResponse])
async def list_host_payouts(
    current_user: CurrentUserDep,
    db: SessionDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[HostPayoutResponse]:
    stmt = select(HostPayout)
    if current_user.role != "admin":
        stmt = stmt.where(HostPayout.host_id == current_user.id)
    stmt = (
        stmt.order_by(HostPayout.created_at.desc(), HostPayout.id.desc()).offset(skip).limit(limit)
    )
    result = await db.execute(stmt)
    payouts = result.scalars().all()
    return [HostPayoutResponse.model_validate(p) for p in payouts]


@router.post("/host/payouts/{id}/settle", response_model=HostPayoutResponse)
async def settle_host_payout(
    id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> HostPayoutResponse:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    stmt = (
        select(HostPayout)
        .options(selectinload(HostPayout.host), selectinload(HostPayout.reservation))
        .where(HostPayout.id == id)
        .with_for_update(of=HostPayout)
    )
    result = await db.execute(stmt)
    payout = result.scalars().first()
    if not payout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payout record not found")
    if payout.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payout has already been completed",
        )
    if payout.status == "cancelled" or payout.payout_amount == Decimal(0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot settle payout: Associated reservation has been cancelled with no payout balance",
        )
    if not payout.host.shaba_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot settle payout: Host has not registered a Shaba banking number",
        )
    if (
        payout.reservation
        and payout.reservation.status == "confirmed"
        and payout.reservation.check_in > date.today()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot settle payout: Reservation check-in date has not yet arrived",
        )

    # ponytail: manual mark-settled; replace with direct Paya/Satna bank transfer call when banking API available
    payout.status = "completed"
    payout.paid_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(payout)
    return HostPayoutResponse.model_validate(payout)


@router.get("/{id}", response_model=PaymentResponse)
async def get_payment(
    id: int,
    current_user: CurrentUserDep,
    db: SessionDep,
) -> PaymentResponse:
    stmt = select(Payment).options(selectinload(Payment.reservation)).where(Payment.id == id)
    res = await db.execute(stmt)
    payment = res.scalars().first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    if current_user.role != "admin" and payment.reservation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    return PaymentResponse.model_validate(payment)
